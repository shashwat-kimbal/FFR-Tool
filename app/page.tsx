"use client";
/* Shared logo URLs and browser-uploaded previews cannot use the image optimizer. */
/* eslint-disable @next/next/no-img-element */

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";
import {
  AlertTriangle,
  BookOpenCheck,
  CheckCircle2,
  ClipboardList,
  Database,
  Download,
  FileImage,
  FileJson,
  FileSpreadsheet,
  Info,
  Layers3,
  ListChecks,
  LockKeyhole,
  RefreshCw,
  Save,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Upload,
  X,
} from "lucide-react";
import {
  caseDisplayGroups,
  complaintOptions,
  defaultSettings,
  pilotContract,
  productFamilyOptions,
} from "./lib/pilot-config";
import {
  bcs16SheetAdapter,
  defaultProvisionalRuleProfile,
  genericProvisionalBundle,
  type AdapterDefinition,
  type DlmsFinding,
  type ProvisionalRuleProfile,
  type RuleBundle,
  type RuleDefinition,
} from "./lib/dlms-analysis";
import {
  canonicalField,
  classifyFfrCase,
  ffrValue,
  inspectDlmsWorkbook,
  inspectFfrRegister,
  inspectImageEvidence,
} from "./lib/workbook-parser";
import type {
  AppSettings,
  DlmsInspection,
  FfrRegisterInspection,
  FfrRow,
  ImageInspection,
  ProductFamily,
  UploadedArtifact,
} from "./lib/pilot-types";

type Page = "analysis" | "session" | "rules" | "readiness" | "settings";
type MeterRole = "old" | "new";
type FindingFilter = "all" | "attention" | "not_assessed";
type GovernanceMode = "loading" | "ready" | "setup" | "unavailable";

type GovernanceState = {
  mode: GovernanceMode;
  role: "user" | "author" | "reviewer" | "admin" | null;
  message: string;
  settingsVersion: number | null;
  activeBundle?: {
    bundleId: string;
    version: number;
    lifecycle: "provisional_active" | "approved_active";
    scopeKey: string;
  } | null;
  activeProfile?: { profileKey: string; version: number } | null;
  draftBundle?: { bundleId: string; version: number; lifecycle: string } | null;
  adapterCount?: number;
  featureCount?: number;
};

type CatalogueEntityType = "profile" | "adapter" | "feature";
type CatalogueDraft = {
  entityType: CatalogueEntityType;
  entityKey: string;
  version: number;
  lifecycle: string;
};
type CatalogueEditorKind = "adapter" | "feature";

const meterRoles: Array<{
  id: MeterRole;
  field: string;
  title: string;
  description: string;
}> = [
  {
    id: "old",
    field: pilotContract.ffrRegister.identityMatch.fieldsInOrder[0],
    title: "Defective / old meter",
    description: "Use when the returned failed meter is the evidence subject.",
  },
  {
    id: "new",
    field: pilotContract.ffrRegister.identityMatch.fieldsInOrder[1],
    title: "Replacement / new meter",
    description:
      "Use when evidence relates to the installed replacement meter.",
  },
];

const navigation: Array<{
  id: Page;
  label: string;
  icon: typeof Upload;
  description: string;
}> = [
  {
    id: "analysis",
    label: "Case intake",
    icon: Upload,
    description: "Register-first workflow",
  },
  {
    id: "session",
    label: "Current session",
    icon: ClipboardList,
    description: "Run state and evidence gate",
  },
  {
    id: "rules",
    label: "Rule library",
    icon: BookOpenCheck,
    description: "60 editable provisional checks",
  },
  {
    id: "readiness",
    label: "Governance",
    icon: ListChecks,
    description: "Release and evidence controls",
  },
  {
    id: "settings",
    label: "Settings",
    icon: Settings,
    description: "Shared profiles and mappings",
  },
];

const readinessChecklist = [
  [
    "Readiness checklist",
    "Rule bundle input is governed: RULE_BUNDLE_INPUT_REQUIRED applies until an administrator configures named access and a reviewed version is released.",
  ],
  [
    "Identity and evidence",
    "FFR case matching remains mandatory before case-specific findings, RCA, CAPA, or workbook write-back. Technical DLMS checks still run for a mismatched report.",
  ],
  [
    "Shared governance",
    "Named admins publish shared bundles and profiles; authors draft and reviewers approve. Browser storage is never authoritative.",
  ],
  [
    "Provisional guardrail",
    "The initial 60 checks create review-required findings only. They never create an approved RCA/CAPA or prove a physical root cause.",
  ],
  [
    "Retention",
    "Raw workbooks and images are not retained by default. An admin must explicitly enable a retention policy before evidence bytes are stored.",
  ],
] as const;

function Status({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "good" | "warning" | "danger" | "ai";
  children: ReactNode;
}) {
  return (
    <span className={`status status-${tone}`}>
      <span />
      {children}
    </span>
  );
}

function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`card ${className}`}>{children}</section>;
}

function SectionHead({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-head">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {action && <div className="section-action">{action}</div>}
    </div>
  );
}

function normalise(text: unknown) {
  return String(text ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function catalogueDraftTemplate(kind: CatalogueEditorKind) {
  if (kind === "adapter") {
    return {
      adapterKey: bcs16SheetAdapter.id,
      title: bcs16SheetAdapter.title,
      productFamily: "METER",
      enabled: true,
      definition: clone(bcs16SheetAdapter),
    };
  }
  return {
    adapterKey: bcs16SheetAdapter.id,
    featureCode: "example.feature.code",
    productFamily: "METER",
    valueType: "number",
    unit: null,
    enabled: true,
    definition: {
      label: "Example editable feature",
      description:
        "Describe the adapter-derived value and the sheet/header or calculation that supplies it.",
      source: "Workbook adapter mapping",
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function textValue(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function clientExpression(value: unknown): RuleDefinition["expression"] | null {
  if (!isRecord(value)) return null;
  if (typeof value.fact === "string")
    return value as RuleDefinition["expression"];
  if (Array.isArray(value.all))
    return {
      all: value.all
        .map(clientExpression)
        .filter((item): item is RuleDefinition["expression"] => Boolean(item)),
    };
  if (Array.isArray(value.any))
    return {
      any: value.any
        .map(clientExpression)
        .filter((item): item is RuleDefinition["expression"] => Boolean(item)),
    };
  if (isRecord(value.not)) {
    const child = clientExpression(value.not);
    return child ? { not: child } : null;
  }
  if (
    value.kind === "predicate" &&
    typeof value.feature === "string" &&
    typeof value.operator === "string"
  ) {
    const operators: Record<string, string> = {
      equal: "equals",
      neq: "not_equals",
    };
    return {
      fact: value.feature,
      operator: (operators[value.operator] ??
        value.operator) as RuleDefinition["expression"] extends {
        operator?: infer Operator;
      }
        ? Operator
        : never,
      ...(value.value !== undefined
        ? { value: value.value as string | number | boolean }
        : {}),
      ...(typeof value.parameter === "string"
        ? { parameter: value.parameter }
        : {}),
      ...(typeof value.lowerParameter === "string"
        ? { lowerParameter: value.lowerParameter }
        : {}),
      ...(typeof value.upperParameter === "string"
        ? { upperParameter: value.upperParameter }
        : {}),
    } as RuleDefinition["expression"];
  }
  if (value.kind === "all" && Array.isArray(value.clauses))
    return {
      all: value.clauses
        .map(clientExpression)
        .filter((item): item is RuleDefinition["expression"] => Boolean(item)),
    };
  if (value.kind === "any" && Array.isArray(value.clauses))
    return {
      any: value.clauses
        .map(clientExpression)
        .filter((item): item is RuleDefinition["expression"] => Boolean(item)),
    };
  if (value.kind === "not" && isRecord(value.clause)) {
    const child = clientExpression(value.clause);
    return child ? { not: child } : null;
  }
  return null;
}

function bundleFromServer(
  value: unknown,
): { bundle: RuleBundle; meta: GovernanceState["activeBundle"] } | null {
  if (!isRecord(value) || !isRecord(value.content)) return null;
  const content = value.content;
  const supportedGroups = new Set<RuleDefinition["group"]>([
    "Foundation",
    "Profile & data quality",
    "Events",
    "Complaint context",
  ]);
  const rules = arrayValue(content.rules).flatMap((candidate, index) => {
    if (!isRecord(candidate)) return [];
    const expression = clientExpression(
      candidate.sourceExpression ?? candidate.expression ?? candidate.when,
    );
    const id = textValue(candidate.id, `IMPORTED-${index + 1}`);
    if (!expression || !textValue(candidate.title)) return [];
    return [
      {
        id,
        group: supportedGroups.has(candidate.group as RuleDefinition["group"])
          ? (candidate.group as RuleDefinition["group"])
          : "Foundation",
        title: textValue(candidate.title),
        productFamilies: arrayValue(candidate.productFamilies).filter(
          (family): family is "METER" | "NIC" | "GATEWAY" =>
            family === "METER" || family === "NIC" || family === "GATEWAY",
        ),
        complaintKeys: arrayValue(candidate.complaintKeys).filter(
          (key): key is string => typeof key === "string",
        ),
        enabled: candidate.enabled !== false,
        severity:
          candidate.severity === "high" || candidate.severity === "critical"
            ? "high"
            : candidate.severity === "warning"
              ? "warning"
              : "info",
        expression,
        why: textValue(
          candidate.why ??
            (isRecord(candidate.finding) ? candidate.finding.whyItRan : ""),
          "The configured rule evaluates source-linked technical evidence.",
        ),
        limitation: textValue(
          candidate.limitation ??
            (isRecord(candidate.finding) ? candidate.finding.limitation : ""),
          "This technical check is not an approved RCA/CAPA conclusion.",
        ),
        followUp: textValue(
          candidate.followUp ??
            (isRecord(candidate.finding)
              ? candidate.finding.recommendedAction
              : ""),
          "Review the source evidence with the appropriate device specialist.",
        ),
      } satisfies RuleDefinition,
    ];
  });
  const lifecycle =
    value.lifecycleStatus === "approved_active"
      ? "approved_active"
      : "provisional_active";
  const version = typeof value.version === "number" ? value.version : 1;
  const bundleKey = textValue(
    content.bundleKey,
    textValue(value.bundleKey, "generic-provisional-v1"),
  );
  return {
    bundle: {
      id: bundleKey,
      version: textValue(content.sourceVersion, String(version)),
      title: textValue(content.title, "Generic provisional DLMS bundle"),
      lifecycle,
      adapterId: textValue(content.adapterId, "bcs-16-sheet-v1"),
      profileId: textValue(content.profileId, "generic-provisional-v1"),
      productFamilies: arrayValue(content.productFamilies).filter(
        (family): family is "METER" | "NIC" | "GATEWAY" =>
          family === "METER" || family === "NIC" || family === "GATEWAY",
      ),
      rules,
      summary: textValue(
        content.description,
        "Shared, source-linked provisional DLMS checks.",
      ),
      limitation: textValue(
        content.limitation,
        "Each output remains a provisional finding — review required.",
      ),
    },
    meta:
      typeof value.scopeKey === "string"
        ? {
            bundleId: textValue(value.bundleId, textValue(value.id, bundleKey)),
            version,
            lifecycle,
            scopeKey: value.scopeKey,
          }
        : null,
  };
}

function profileFromServer(
  value: unknown,
): {
  profile: ProvisionalRuleProfile;
  meta: GovernanceState["activeProfile"];
} | null {
  if (
    !isRecord(value) ||
    !isRecord(value.values) ||
    !isRecord(value.values.parameters)
  )
    return null;
  const descriptions = isRecord(value.values.descriptions)
    ? value.values.descriptions
    : {};
  const parameters = Object.fromEntries(
    Object.entries(value.values.parameters).filter(
      ([, parameter]) => typeof parameter === "number",
    ),
  ) as Record<string, number>;
  if (
    !Object.keys(parameters).length ||
    typeof value.profileKey !== "string" ||
    typeof value.version !== "number"
  )
    return null;
  return {
    profile: {
      ...clone(defaultProvisionalRuleProfile),
      id: value.profileKey,
      version: String(value.version),
      title: textValue(value.title, defaultProvisionalRuleProfile.title),
      status: value.isProvisional === false ? "approved" : "provisional",
      parameters: {
        ...defaultProvisionalRuleProfile.parameters,
        ...parameters,
      },
      descriptions: {
        ...defaultProvisionalRuleProfile.descriptions,
        ...(Object.fromEntries(
          Object.entries(descriptions).filter(
            ([, description]) => typeof description === "string",
          ),
        ) as Record<string, string>),
      },
    },
    meta: { profileKey: value.profileKey, version: value.version },
  };
}

function adapterFromServer(value: unknown): AdapterDefinition | null {
  if (!isRecord(value)) return null;
  const definition = isRecord(value.definition) ? value.definition : value;
  const id = textValue(definition.id, textValue(value.adapterKey));
  const mandatorySheets = arrayValue(definition.mandatorySheets).filter(
    (sheet): sheet is string =>
      typeof sheet === "string" && Boolean(sheet.trim()),
  );
  const optionalSheets = arrayValue(definition.optionalSheets).filter(
    (sheet): sheet is string =>
      typeof sheet === "string" && Boolean(sheet.trim()),
  );
  const identitySheet = textValue(definition.identitySheet);
  const identityHeader = textValue(definition.identityHeader);
  if (!id || !mandatorySheets.length || !identitySheet || !identityHeader)
    return null;
  return {
    ...definition,
    id,
    version: textValue(
      definition.version,
      typeof value.version === "number" ? String(value.version) : "1.0.0",
    ),
    title: textValue(definition.title, textValue(value.title, id)),
    mandatorySheets,
    optionalSheets,
    identitySheet,
    identityHeader,
  } as AdapterDefinition;
}

function formatSize(bytes: number) {
  return `${Math.max(1, Math.round(bytes / 1024 / 1024))} MB`;
}

function truncateHash(hash: string | null) {
  return hash
    ? `${hash.slice(0, 12)}…${hash.slice(-8)}`
    : "Hash unavailable in this browser";
}

function hydrateSettings(candidate?: Partial<AppSettings>): AppSettings {
  return {
    ...defaultSettings,
    ...candidate,
    productMappings:
      candidate?.productMappings ?? defaultSettings.productMappings,
    complaintMappings:
      candidate?.complaintMappings ?? defaultSettings.complaintMappings,
    adapterMappings:
      candidate?.adapterMappings ?? defaultSettings.adapterMappings,
    ai: { ...defaultSettings.ai, ...candidate?.ai },
    pilotAccess: {
      ...defaultSettings.pilotAccess,
      ...candidate?.pilotAccess,
      approvedRoles:
        candidate?.pilotAccess?.approvedRoles ??
        defaultSettings.pilotAccess.approvedRoles,
    },
    branding: { ...defaultSettings.branding, ...candidate?.branding },
  };
}

function settingsFromServer(value: unknown): AppSettings {
  if (!value || typeof value !== "object") return hydrateSettings();
  const server = value as Record<string, unknown>;
  const branding = server.branding as Record<string, unknown> | undefined;
  const retention = server.evidenceRetention as
    | Record<string, unknown>
    | undefined;
  return hydrateSettings({
    productMappings: Array.isArray(server.productMappings)
      ? (server.productMappings as AppSettings["productMappings"])
      : defaultSettings.productMappings,
    retentionDays:
      retention?.enabled === true &&
      typeof retention?.retentionDays === "number"
        ? retention.retentionDays
        : 0,
    uploadMaxMb:
      typeof server.uploadMaxMb === "number"
        ? server.uploadMaxMb
        : defaultSettings.uploadMaxMb,
    complaintMappings: Array.isArray(server.complaintMappings)
      ? (server.complaintMappings as AppSettings["complaintMappings"])
      : defaultSettings.complaintMappings,
    adapterMappings: Array.isArray(server.adapterMappings)
      ? (server.adapterMappings as AppSettings["adapterMappings"])
      : defaultSettings.adapterMappings,
    branding: {
      logoDataUrl:
        typeof branding?.logoUrl === "string" ? branding.logoUrl : null,
      logoFileName:
        typeof branding?.logoObjectKey === "string"
          ? (branding.logoObjectKey.split("/").pop() ?? null)
          : null,
    },
  });
}

function sharedDocument(
  settings: AppSettings,
  profile: ProvisionalRuleProfile,
) {
  return {
    schemaVersion: "governance-settings-v1",
    branding: {
      logoObjectKey: settings.branding.logoFileName
        ? `branding/${settings.branding.logoFileName}`
        : null,
      logoUrl: settings.branding.logoDataUrl,
      altText: "Kimbal logo",
    },
    evidenceRetention: {
      enabled: settings.retentionDays > 0,
      retentionDays: settings.retentionDays || null,
    },
    productMappings: settings.productMappings,
    complaintMappings: settings.complaintMappings,
    adapterMappings: settings.adapterMappings,
    thresholds: {
      profileId: profile.id,
      profileVersion: profile.version,
      profileTitle: profile.title,
      profileStatus: profile.status,
      profileParameters: profile.parameters,
      profileDescriptions: profile.descriptions,
    },
    ai: {
      provider: settings.ai.provider || null,
      model: settings.ai.reasoningModel || null,
      credentialsConfigured: false,
    },
    uploadMaxMb: settings.uploadMaxMb,
  };
}

function ArtifactSummary({ artifact }: { artifact: UploadedArtifact }) {
  const icon =
    artifact.kind === "IMAGE" ? (
      <FileImage size={18} />
    ) : (
      <FileSpreadsheet size={18} />
    );
  return (
    <article className="artifact-card">
      <span className={`artifact-icon artifact-${artifact.kind.toLowerCase()}`}>
        {icon}
      </span>
      <div>
        <strong title={artifact.name}>{artifact.name}</strong>
        <small>{artifact.detail}</small>
      </div>
      <Status tone={artifact.kind === "UNRECOGNIZED" ? "danger" : "good"}>
        {artifact.kind.replaceAll("_", " ")}
      </Status>
      <small>
        {formatSize(artifact.size)} · SHA-256 {truncateHash(artifact.sha256)}
      </small>
    </article>
  );
}

function UploadStage({
  title,
  description,
  buttonText,
  accept,
  multiple = false,
  disabled = false,
  onChange,
  children,
}: {
  title: string;
  description: string;
  buttonText: string;
  accept: string;
  multiple?: boolean;
  disabled?: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  children?: ReactNode;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <Card className="stage-card">
      <SectionHead title={title} description={description} />
      <button
        className="drop-zone stage-upload"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        <span className="drop-icon">
          <Upload size={23} />
        </span>
        <strong>{buttonText}</strong>
        <span>
          {multiple
            ? "You may select several image files."
            : "Select one workbook for this stage."}
        </span>
        <em>
          {disabled ? "Complete the previous stage first" : "Select file"}
        </em>
      </button>
      <input
        ref={inputRef}
        className="visually-hidden"
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        onChange={onChange}
      />
      {children}
    </Card>
  );
}

function findingTone(finding: DlmsFinding) {
  if (finding.status === "attention" && finding.severity === "high")
    return "danger" as const;
  if (finding.status === "attention") return "warning" as const;
  if (finding.status === "pass") return "good" as const;
  return "neutral" as const;
}

export default function Home() {
  const [page, setPage] = useState<Page>("analysis");
  const [settings, setSettings] = useState<AppSettings>(() =>
    hydrateSettings(),
  );
  const [profile, setProfile] = useState<ProvisionalRuleProfile>(() =>
    clone(defaultProvisionalRuleProfile),
  );
  const [bundle, setBundle] = useState<RuleBundle>(() =>
    clone(genericProvisionalBundle),
  );
  const [sharedAdapters, setSharedAdapters] = useState<
    Record<string, AdapterDefinition>
  >({});
  const [configurationEpoch, setConfigurationEpoch] = useState(0);
  const [governance, setGovernance] = useState<GovernanceState>({
    mode: "loading",
    role: null,
    message: "Connecting to shared governance…",
    settingsVersion: null,
  });
  const [register, setRegister] = useState<FfrRegisterInspection | null>(null);
  const [selectedRowNumber, setSelectedRowNumber] = useState<number | null>(
    null,
  );
  const [meterRole, setMeterRole] = useState<MeterRole>("old");
  const [dlms, setDlms] = useState<DlmsInspection | null>(null);
  const [dlmsFile, setDlmsFile] = useState<File | null>(null);
  const [images, setImages] = useState<ImageInspection | null>(null);
  const [busyStage, setBusyStage] = useState<
    "ffr" | "dlms" | "images" | "rerun" | "saving" | null
  >(null);
  const [notice, setNotice] = useState("");
  const [intakeError, setIntakeError] = useState("");
  const [mappingValue, setMappingValue] = useState("");
  const [mappingField, setMappingField] = useState<
    "Meter type" | "Old_Meter_Type"
  >("Old_Meter_Type");
  const [mappingFamily, setMappingFamily] = useState<ProductFamily>("METER");
  const [complaintFamily, setComplaintFamily] =
    useState<ProductFamily>("METER");
  const [complaintPhrases, setComplaintPhrases] = useState("");
  const [complaintCategory, setComplaintCategory] = useState("");
  const [complaintSubcategory, setComplaintSubcategory] = useState("");
  const [complaintReason, setComplaintReason] = useState("");
  const [adapterFamily, setAdapterFamily] = useState<ProductFamily>("METER");
  const [adapterKey, setAdapterKey] = useState("bcs-16-sheet-v1");
  const [adapterMode, setAdapterMode] = useState<"direct" | "context_only">(
    "direct",
  );
  const [adapterDescription, setAdapterDescription] = useState("");
  const [rollbackVersion, setRollbackVersion] = useState("");
  const [auditEvents, setAuditEvents] = useState<
    Array<{
      id: string;
      action: string;
      entityType: string;
      entityId: string;
      createdAt: string;
    }>
  >([]);
  const [roleEmail, setRoleEmail] = useState("");
  const [roleToAssign, setRoleToAssign] = useState<
    "author" | "reviewer" | "user"
  >("author");
  const [roleAssignments, setRoleAssignments] = useState<
    Array<{ id: string; email: string; role: string; enabled: boolean }>
  >([]);
  const [catalogueDraft, setCatalogueDraft] = useState<CatalogueDraft | null>(
    null,
  );
  const [catalogueRollbackVersion, setCatalogueRollbackVersion] = useState("");
  const [catalogueEditorKind, setCatalogueEditorKind] =
    useState<CatalogueEditorKind>("adapter");
  const [catalogueEditorJson, setCatalogueEditorJson] = useState(() =>
    JSON.stringify(catalogueDraftTemplate("adapter"), null, 2),
  );
  const [selectedRuleId, setSelectedRuleId] = useState(
    bundle.rules[0]?.id ?? null,
  );
  const [expressionDrafts, setExpressionDrafts] = useState<
    Record<string, string>
  >({});
  const [findingFilter, setFindingFilter] = useState<FindingFilter>("all");

  const isAdmin = governance.mode === "ready" && governance.role === "admin";
  const canDraft =
    governance.mode === "ready" &&
    (governance.role === "admin" || governance.role === "author");
  const canReview =
    governance.mode === "ready" &&
    (governance.role === "admin" || governance.role === "reviewer");
  const canPublish = governance.mode === "ready" && governance.role === "admin";
  const selectedRow = useMemo(
    () =>
      register?.rows.find((row) => row.rowNumber === selectedRowNumber) ?? null,
    [register, selectedRowNumber],
  );
  const selectedRole =
    meterRoles.find((role) => role.id === meterRole) ?? meterRoles[0];
  const selectedMeterId = selectedRow
    ? ffrValue(selectedRow, selectedRole.field)
    : "";
  const selectedCase = selectedRow
    ? classifyFfrCase(selectedRow, settings)
    : null;
  const validDlms = dlms?.identityState === "READY_TO_ANALYZE";
  const sharedAnalysisReady =
    governance.mode === "ready" &&
    Boolean(governance.activeBundle && governance.activeProfile);
  const sharedAnalysisMessage = sharedAnalysisReady
    ? "Shared released configuration is ready for intake."
    : governance.mode === "loading"
      ? "Waiting for the shared released rule bundle and profile."
      : "A named administrator must configure and release the shared rule bundle before intake can start.";
  const selectedRule =
    bundle.rules.find((rule) => rule.id === selectedRuleId) ??
    bundle.rules[0] ??
    null;
  const expressionDraft = selectedRule
    ? (expressionDrafts[selectedRule.id] ??
      JSON.stringify(selectedRule.expression, null, 2))
    : "";

  useEffect(() => {
    let cancelled = false;
    const loadSharedConfiguration = async () => {
      try {
        const response = await fetch("/api/governance/bootstrap", {
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => ({}))) as Record<
          string,
          unknown
        >;
        if (cancelled) return;
        if (!response.ok || payload.mode !== "ready") {
          setGovernance({
            mode: "setup",
            role: null,
            message:
              typeof payload.message === "string"
                ? payload.message
                : "Shared governance needs D1/R2 provisioning and an ADMIN_ALLOWLIST before settings can be saved.",
            settingsVersion: null,
          });
          return;
        }
        const roles = Array.isArray(payload.roles)
          ? payload.roles.map(String)
          : ["user"];
        const role = roles.includes("admin")
          ? "admin"
          : roles.includes("reviewer")
            ? "reviewer"
            : roles.includes("author")
              ? "author"
              : "user";
        const settingsResponse = await fetch("/api/governance/settings", {
          cache: "no-store",
        });
        const settingsPayload = (await settingsResponse
          .json()
          .catch(() => ({}))) as {
          settings?: { value?: unknown; version?: number };
        };
        const settingsRecord = settingsPayload.settings;
        const shared = settingsRecord?.value;
        if (shared && typeof shared === "object") {
          const hydrated = settingsFromServer(shared);
          setSettings(hydrated);
          const thresholds = (shared as Record<string, unknown>).thresholds as
            | Record<string, unknown>
            | undefined;
          if (
            thresholds &&
            thresholds.profileParameters &&
            typeof thresholds.profileParameters === "object"
          ) {
            setProfile((current) => ({
              ...current,
              parameters: {
                ...current.parameters,
                ...(thresholds.profileParameters as Record<string, number>),
              },
              descriptions: {
                ...current.descriptions,
                ...(thresholds.profileDescriptions as Record<string, string>),
              },
            }));
          }
        }
        setGovernance({
          mode: "ready",
          role,
          message:
            role === "admin"
              ? "Shared governance is ready. You can create governed configuration drafts."
              : "Shared rule configuration is loaded. Only named administrators can change it.",
          settingsVersion:
            typeof settingsRecord?.version === "number"
              ? settingsRecord.version
              : null,
        });
        setConfigurationEpoch((current) => current + 1);
      } catch {
        if (!cancelled)
          setGovernance({
            mode: "unavailable",
            role: null,
            message:
              "Shared governance is unavailable. Intake remains disabled until the released shared configuration can be loaded.",
            settingsVersion: null,
          });
      }
    };
    void loadSharedConfiguration();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadActiveConfiguration = async () => {
      try {
        const response = await fetch("/api/governance/active-configuration", {
          cache: "no-store",
        });
        if (!response.ok) {
          setGovernance((current) =>
            current.mode === "ready"
              ? {
                  ...current,
                  activeBundle: null,
                  activeProfile: null,
                  message:
                    "Shared governance is available, but no released analysis configuration can be used yet.",
                }
              : current,
          );
          return;
        }
        const payload = (await response.json().catch(() => ({}))) as Record<
          string,
          unknown
        >;
        if (cancelled || !isRecord(payload.settings)) return;
        const settingsRecord = payload.settings;
        if (!isRecord(settingsRecord.value)) return;
        const hydrated = settingsFromServer(settingsRecord.value);
        const activeAdapters = arrayValue(payload.adapters).filter(isRecord);
        const adapterEntries = activeAdapters.flatMap((record) => {
          const adapter = adapterFromServer(record);
          if (!adapter) return [] as Array<[string, AdapterDefinition]>;
          const adapterKey = textValue(record.adapterKey, adapter.id);
          return adapterKey === adapter.id
            ? ([[adapter.id, adapter]] as Array<[string, AdapterDefinition]>)
            : ([
                [adapter.id, adapter],
                [adapterKey, adapter],
              ] as Array<[string, AdapterDefinition]>);
        });
        const sharedBundle = bundleFromServer(payload.bundle);
        const sharedProfile = profileFromServer(payload.profile);
        setSettings(hydrated);
        setSharedAdapters(Object.fromEntries(adapterEntries));
        if (sharedBundle) setBundle(sharedBundle.bundle);
        if (sharedProfile) setProfile(sharedProfile.profile);
        setGovernance((current) =>
          current.mode === "ready"
            ? {
                ...current,
                settingsVersion:
                  typeof settingsRecord.version === "number"
                    ? settingsRecord.version
                    : current.settingsVersion,
                activeBundle: sharedBundle?.meta ?? null,
                activeProfile: sharedProfile?.meta ?? null,
                adapterCount: activeAdapters.length,
                featureCount: arrayValue(payload.features).length,
                message:
                  sharedBundle && sharedProfile
                    ? "Shared active configuration loaded. Drafts cannot change a live analysis until review and release."
                    : "Shared governance is available, but no released rule bundle and profile can be used for intake yet.",
              }
            : current,
        );
      } catch {
        if (!cancelled) {
          setGovernance((current) =>
            current.mode === "ready"
              ? {
                  ...current,
                  activeBundle: null,
                  activeProfile: null,
                  message:
                    "The shared released configuration could not be loaded. Intake remains disabled.",
                }
              : current,
          );
        }
      }
    };
    void loadActiveConfiguration();
    return () => {
      cancelled = true;
    };
  }, [configurationEpoch]);

  const resetEvidence = () => {
    setDlms(null);
    setDlmsFile(null);
    setImages(null);
  };

  const recordRun = async (inspection: DlmsInspection) => {
    if (governance.mode !== "ready" || !inspection.analysis) return;
    try {
      await fetch("/api/governance/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          caseRef: selectedRow ? ffrValue(selectedRow, "S.No") || null : null,
          meterSerial: inspection.meterId,
          productFamily: selectedCase?.productFamily ?? "UNRESOLVED",
          identityStatus: inspection.identityState,
          bundleId: governance.activeBundle?.bundleId ?? null,
          bundleVersion: governance.activeBundle?.version ?? null,
          profileKey:
            governance.activeProfile?.profileKey ??
            inspection.analysis.profile.id,
          profileVersion: governance.activeProfile?.version ?? null,
          adapterKey: inspection.analysis.adapter.id,
          adapterVersion: 1,
          resultStatus: "provisional",
          findingsCount: inspection.analysis.summary.attention,
          summary: {
            status: "provisional",
            title: "60-check DLMS technical analysis",
            findings: inspection.analysis.findings.slice(0, 60),
            messages: [
              ...inspection.messages,
              inspection.analysis.scope.message,
            ],
          },
        }),
      });
    } catch {
      // A run record must never block browser-side technical analysis.
    }
  };

  const retainEvidenceIfEnabled = async (
    files: File | File[],
    caseRef: string | null = null,
  ) => {
    if (governance.mode !== "ready" || settings.retentionDays < 1) return;
    const items = Array.isArray(files) ? files : [files];
    const outcomes = await Promise.all(
      items.map(async (file) => {
        try {
          const response = await fetch("/api/governance/evidence", {
            method: "POST",
            headers: {
              "content-type": file.type || "application/octet-stream",
              ...(caseRef ? { "x-case-ref": caseRef } : {}),
            },
            body: file,
          });
          const payload = (await response.json().catch(() => ({}))) as {
            evidence?: { retained?: boolean };
          };
          return response.ok && payload.evidence?.retained === true;
        } catch {
          return false;
        }
      }),
    );
    if (outcomes.some(Boolean))
      setNotice(
        `${outcomes.filter(Boolean).length} evidence file(s) were retained under the active shared retention policy.`,
      );
  };

  const handleFfrUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!sharedAnalysisReady) {
      setIntakeError(`SHARED_CONFIGURATION_REQUIRED: ${sharedAnalysisMessage}`);
      return;
    }
    if (files.length !== 1) {
      setIntakeError(
        files.length > 1
          ? "MULTIPLE_FFR_REGISTERS: upload one FFR register at a time."
          : "MISSING_REQUIRED_WORKBOOK: choose the FFR register first.",
      );
      return;
    }
    setBusyStage("ffr");
    setIntakeError("");
    try {
      const inspection = await inspectFfrRegister(files[0], settings);
      setRegister(inspection);
      setSelectedRowNumber(null);
      setMeterRole("old");
      resetEvidence();
      setNotice(
        "FFR register validated. Choose one case, then choose the meter whose DLMS evidence you are uploading.",
      );
      void retainEvidenceIfEnabled(files[0]);
    } catch (error) {
      setRegister(null);
      setSelectedRowNumber(null);
      resetEvidence();
      setIntakeError(
        error instanceof Error
          ? error.message
          : "UNRECOGNIZED_FILE: the FFR register could not be validated.",
      );
    } finally {
      setBusyStage(null);
    }
  };

  const chooseCase = (rowNumber: number) => {
    setSelectedRowNumber(rowNumber);
    setMeterRole("old");
    resetEvidence();
    setIntakeError("");
    setNotice(
      `Case on FFR row ${rowNumber} selected. The next stage is the meter-specific DLMS report.`,
    );
  };

  const chooseMeterRole = (role: MeterRole) => {
    setMeterRole(role);
    resetEvidence();
    setIntakeError("");
  };

  const inspectDlms = async (file: File, stage: "dlms" | "rerun") => {
    if (!sharedAnalysisReady) {
      setIntakeError(`SHARED_CONFIGURATION_REQUIRED: ${sharedAnalysisMessage}`);
      return;
    }
    if (!selectedMeterId) return;
    setBusyStage(stage);
    setIntakeError("");
    try {
      const adapterMapping = selectedCase?.productFamily
        ? (settings.adapterMappings.find(
            (mapping) => mapping.productFamily === selectedCase.productFamily,
          ) ?? null)
        : null;
      const adapter =
        sharedAdapters[adapterMapping?.adapterId ?? bundle.adapterId];
      const inspection = await inspectDlmsWorkbook(
        file,
        selectedMeterId,
        settings,
        profile,
        bundle,
        {
          productFamily: selectedCase?.productFamily ?? null,
          complaintKey: selectedCase?.complaintKey ?? null,
          adapter,
          dedicatedAdapterConfigured: Boolean(
            adapter && adapterMapping?.evidenceMode === "direct",
          ),
        },
      );
      setDlms(inspection);
      setDlmsFile(file);
      setImages(null);
      setNotice(inspection.messages[0]);
      void recordRun(inspection);
      void retainEvidenceIfEnabled(
        file,
        selectedRow ? ffrValue(selectedRow, "S.No") || null : null,
      );
    } catch (error) {
      setDlms(null);
      setImages(null);
      setIntakeError(
        error instanceof Error
          ? error.message
          : "UNRECOGNIZED_FILE: the DLMS workbook could not be validated.",
      );
    } finally {
      setBusyStage(null);
    }
  };

  const handleDlmsUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length !== 1) {
      setIntakeError(
        files.length > 1
          ? "MULTIPLE_DLMS_PACKAGES: upload one DLMS workbook for the selected meter."
          : "MISSING_REQUIRED_WORKBOOK: choose the matching DLMS workbook.",
      );
      return;
    }
    await inspectDlms(files[0], "dlms");
  };

  const rerunAnalysis = async () => {
    if (!dlmsFile) return;
    await inspectDlms(dlmsFile, "rerun");
  };

  const handleImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    setBusyStage("images");
    setIntakeError("");
    try {
      const inspection = await inspectImageEvidence(files, settings);
      setImages(inspection);
      setNotice(
        inspection.messages[0] ??
          `${inspection.artifacts.filter((artifact) => artifact.kind === "IMAGE").length} image file(s) were bound to the selected meter.`,
      );
      void retainEvidenceIfEnabled(
        files,
        selectedRow ? ffrValue(selectedRow, "S.No") || null : null,
      );
    } finally {
      setBusyStage(null);
    }
  };

  const updateRule = (ruleId: string, changes: Partial<RuleDefinition>) => {
    setBundle((current) => ({
      ...current,
      rules: current.rules.map((rule) =>
        rule.id === ruleId ? { ...rule, ...changes } : rule,
      ),
    }));
  };

  const setExpressionDraft = (value: string) => {
    if (!selectedRule) return;
    setExpressionDrafts((current) => ({
      ...current,
      [selectedRule.id]: value,
    }));
  };

  const applyExpression = () => {
    if (!selectedRule) return;
    try {
      const expression = JSON.parse(
        expressionDraft,
      ) as RuleDefinition["expression"];
      updateRule(selectedRule.id, { expression });
      setExpressionDrafts((current) => {
        const next = { ...current };
        delete next[selectedRule.id];
        return next;
      });
      setNotice(
        `${selectedRule.id} expression updated in this draft. Save the shared library to publish a new governed version.`,
      );
    } catch {
      setNotice(
        "Rule expression must be valid JSON. The existing rule was not changed.",
      );
    }
  };

  const addMapping = () => {
    if (!mappingValue.trim()) {
      setNotice("Enter the exact FFR value before adding a mapping.");
      return;
    }
    setSettings((current) => ({
      ...current,
      productMappings: [
        ...current.productMappings,
        {
          id: `mapping-${Date.now()}`,
          sourceField: mappingField,
          sourceValue: mappingValue.trim(),
          productFamily: mappingFamily,
          basis: "Shared configuration draft",
        },
      ],
    }));
    setMappingValue("");
  };

  const addComplaintMapping = () => {
    const phrases = complaintPhrases
      .split(",")
      .map((phrase) => normalise(phrase))
      .filter(Boolean);
    if (!phrases.length || !complaintCategory.trim()) {
      setNotice(
        "Add at least one exact complaint phrase and a catalogue category code.",
      );
      return;
    }
    setSettings((current) => ({
      ...current,
      complaintMappings: [
        ...current.complaintMappings,
        {
          id: `complaint-${Date.now()}`,
          productFamily: complaintFamily,
          phrases,
          categoryCode: complaintCategory.trim().toUpperCase(),
          subcategoryCode: complaintSubcategory.trim().toUpperCase() || null,
          reason: complaintReason.trim() || "Shared mapping draft",
        },
      ],
    }));
    setComplaintPhrases("");
    setComplaintCategory("");
    setComplaintSubcategory("");
    setComplaintReason("");
  };

  const addAdapterMapping = () => {
    if (!adapterKey.trim() || !adapterDescription.trim()) {
      setNotice(
        "Provide an adapter key and explain what the mapping can and cannot establish.",
      );
      return;
    }
    setSettings((current) => ({
      ...current,
      adapterMappings: [
        ...current.adapterMappings.filter(
          (mapping) => mapping.productFamily !== adapterFamily,
        ),
        {
          id: `adapter-${Date.now()}`,
          productFamily: adapterFamily,
          adapterId: adapterKey.trim(),
          evidenceMode: adapterMode,
          description: adapterDescription.trim(),
        },
      ],
    }));
    setAdapterDescription("");
  };

  const updateProfileParameter = (key: string, value: string) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return;
    setProfile((current) => ({
      ...current,
      parameters: { ...current.parameters, [key]: numeric },
    }));
  };

  const downloadBundle = () => {
    const blob = new Blob([JSON.stringify({ bundle, profile }, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${bundle.id}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setNotice("Rule bundle and profile downloaded for controlled review.");
  };

  const importBundle = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as {
          bundle?: RuleBundle;
          profile?: ProvisionalRuleProfile;
        };
        if (
          !parsed.bundle ||
          !Array.isArray(parsed.bundle.rules) ||
          parsed.bundle.rules.length < 1
        )
          throw new Error("Bundle rules are missing");
        setBundle(parsed.bundle);
        if (parsed.profile?.parameters) setProfile(parsed.profile);
        setSelectedRuleId(parsed.bundle.rules[0]?.id ?? null);
        setNotice(
          "Rule bundle loaded as an editable draft. Save it through shared governance to create a new version.",
        );
      } catch {
        setNotice("The selected file is not a compatible rule-bundle export.");
      }
    };
    reader.readAsText(file);
  };

  const saveSharedConfiguration = async () => {
    if (!isAdmin) {
      setNotice(
        "Only a named administrator can save shared settings or publish a rule bundle.",
      );
      return;
    }
    setBusyStage("saving");
    try {
      const settingsResponse = await fetch("/api/governance/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          settings: sharedDocument(settings, profile),
          expectedVersion: governance.settingsVersion,
        }),
      });
      if (!settingsResponse.ok)
        throw new Error(
          (
            (await settingsResponse.json().catch(() => ({}))) as {
              message?: string;
            }
          ).message ?? "Settings could not be saved",
        );
      const settingsPayload = (await settingsResponse
        .json()
        .catch(() => ({}))) as { settings?: { version?: number } };
      if (typeof settingsPayload.settings?.version === "number")
        setGovernance((current) => ({
          ...current,
          settingsVersion:
            settingsPayload.settings?.version ?? current.settingsVersion,
        }));
      const profileResponse = await fetch("/api/governance/profiles", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          profile: {
            profileKey: profile.id,
            title: profile.title,
            productFamily: "MULTI",
            lifecycleStatus: "provisional_active",
            isProvisional: profile.status === "provisional",
            enabled: true,
            scope: {
              adapterId: bundle.adapterId,
              productFamilies: bundle.productFamilies,
            },
            values: {
              parameters: profile.parameters,
              descriptions: profile.descriptions,
            },
          },
        }),
      });
      const profilePayload = (await profileResponse
        .json()
        .catch(() => ({}))) as {
        profile?: Record<string, unknown>;
        message?: string;
      };
      if (!profileResponse.ok)
        throw new Error(
          profilePayload.message ??
            "Settings saved but the profile could not be versioned",
        );
      if (
        profilePayload.profile &&
        typeof profilePayload.profile.profileKey === "string" &&
        typeof profilePayload.profile.version === "number"
      ) {
        setCatalogueDraft({
          entityType: "profile",
          entityKey: profilePayload.profile.profileKey,
          version: profilePayload.profile.version,
          lifecycle:
            typeof profilePayload.profile.lifecycleStatus === "string"
              ? profilePayload.profile.lifecycleStatus
              : "draft",
        });
      }
      const bundleResponse = await fetch("/api/governance/rule-bundles", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ source: "settings", bundle }),
      });
      if (!bundleResponse.ok)
        throw new Error(
          (
            (await bundleResponse.json().catch(() => ({}))) as {
              message?: string;
            }
          ).message ?? "Settings saved but the bundle could not be versioned",
        );
      const bundlePayload = (await bundleResponse.json().catch(() => ({}))) as {
        bundle?: Record<string, unknown>;
      };
      if (
        bundlePayload.bundle &&
        typeof bundlePayload.bundle.bundleId === "string" &&
        typeof bundlePayload.bundle.version === "number"
      ) {
        setGovernance((current) => ({
          ...current,
          draftBundle: {
            bundleId: bundlePayload.bundle?.bundleId as string,
            version: bundlePayload.bundle?.version as number,
            lifecycle:
              typeof bundlePayload.bundle?.lifecycleStatus === "string"
                ? bundlePayload.bundle.lifecycleStatus
                : "draft",
          },
        }));
      }
      setNotice(
        "Shared settings were saved. The profile and bundle changes are immutable drafts; submit, independently approve, and release each governed version before it changes live analysis.",
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Shared configuration could not be saved.",
      );
    } finally {
      setBusyStage(null);
    }
  };

  const saveRuleDraft = async () => {
    if (!canDraft) {
      setNotice(
        "A named author or administrator is required to create a governed rule draft.",
      );
      return;
    }
    setBusyStage("saving");
    try {
      const response = await fetch("/api/governance/rule-bundles", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ source: "settings", bundle }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        bundle?: Record<string, unknown>;
        message?: string;
      };
      if (
        !response.ok ||
        !payload.bundle ||
        typeof payload.bundle.bundleId !== "string" ||
        typeof payload.bundle.version !== "number"
      ) {
        throw new Error(
          payload.message ?? "The rule draft could not be created.",
        );
      }
      setGovernance((current) => ({
        ...current,
        draftBundle: {
          bundleId: payload.bundle?.bundleId as string,
          version: payload.bundle?.version as number,
          lifecycle:
            typeof payload.bundle?.lifecycleStatus === "string"
              ? payload.bundle.lifecycleStatus
              : "draft",
        },
      }));
      setNotice(
        "A new immutable rule draft was created. Submit it for independent review before release.",
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "The rule draft could not be created.",
      );
    } finally {
      setBusyStage(null);
    }
  };

  const transitionDraft = async (
    targetStatus: "in_review" | "provisional_active" | "approved_active",
  ) => {
    const draft = governance.draftBundle;
    if (!draft) {
      setNotice("Create or select a governed draft version first.");
      return;
    }
    setBusyStage("saving");
    try {
      const response = await fetch(
        `/api/governance/rule-bundles/${draft.bundleId}/transition`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            version: draft.version,
            targetStatus,
            reviewNote:
              "Workflow action recorded from the shared governance screen.",
          }),
        },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        bundle?: Record<string, unknown>;
        message?: string;
      };
      if (!response.ok || !payload.bundle)
        throw new Error(
          payload.message ?? "The lifecycle action could not be completed.",
        );
      setGovernance((current) => ({
        ...current,
        draftBundle: {
          bundleId: draft.bundleId,
          version: draft.version,
          lifecycle:
            typeof payload.bundle?.lifecycleStatus === "string"
              ? payload.bundle.lifecycleStatus
              : targetStatus,
        },
      }));
      setNotice(
        targetStatus === "in_review"
          ? "Draft submitted for independent review."
          : "Rule version approved. An administrator may now release it to the shared live scope.",
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "The lifecycle action could not be completed.",
      );
    } finally {
      setBusyStage(null);
    }
  };

  const transitionCatalogueDraft = async (
    targetStatus: "in_review" | "provisional_active" | "approved_active",
  ) => {
    const draft = catalogueDraft;
    const canAct = targetStatus === "in_review" ? canDraft : canReview;
    if (!draft || !canAct) {
      setNotice(
        targetStatus === "in_review"
          ? "A named author or administrator is required to submit a catalogue draft."
          : "An independent named reviewer or administrator is required to approve a catalogue version.",
      );
      return;
    }
    setBusyStage("saving");
    try {
      const response = await fetch(
        `/api/governance/catalogue/${draft.entityType}/${encodeURIComponent(draft.entityKey)}/transition`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            version: draft.version,
            targetStatus,
            reviewNote:
              "Workflow action recorded from the shared governance screen.",
          }),
        },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        version?: Record<string, unknown>;
        message?: string;
      };
      if (!response.ok || !payload.version)
        throw new Error(
          payload.message ??
            "The catalogue lifecycle action could not be completed.",
        );
      setCatalogueDraft({
        ...draft,
        lifecycle:
          typeof payload.version.lifecycleStatus === "string"
            ? payload.version.lifecycleStatus
            : targetStatus,
      });
      setNotice(
        targetStatus === "in_review"
          ? "Catalogue draft submitted for independent review."
          : "Catalogue version approved. An administrator may now release it to the shared active configuration.",
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "The catalogue lifecycle action could not be completed.",
      );
    } finally {
      setBusyStage(null);
    }
  };

  const publishCatalogueDraft = async () => {
    const draft = catalogueDraft;
    if (
      !canPublish ||
      !draft ||
      (draft.lifecycle !== "provisional_active" &&
        draft.lifecycle !== "approved_active")
    ) {
      setNotice(
        "An administrator and an independently approved profile, adapter, or feature version are required for release.",
      );
      return;
    }
    setBusyStage("saving");
    try {
      const response = await fetch(
        `/api/governance/catalogue/${draft.entityType}/${encodeURIComponent(draft.entityKey)}/publish`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            version: draft.version,
            reason: "Shared governed catalogue release",
          }),
        },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        message?: string;
      };
      if (!response.ok)
        throw new Error(
          payload.message ??
            "The approved catalogue version could not be released.",
        );
      setConfigurationEpoch((current) => current + 1);
      setNotice(
        `Released ${draft.entityType} ${draft.entityKey} v${draft.version}. Reloading the shared active configuration now.`,
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "The approved catalogue version could not be released.",
      );
    } finally {
      setBusyStage(null);
    }
  };

  const rollbackCatalogueDraft = async () => {
    const draft = catalogueDraft;
    const version = Number(catalogueRollbackVersion);
    if (!canPublish || !draft || !Number.isInteger(version) || version < 1) {
      setNotice(
        "Enter a previously reviewed catalogue version number to roll back the active shared projection.",
      );
      return;
    }
    setBusyStage("saving");
    try {
      const response = await fetch(
        `/api/governance/catalogue/${draft.entityType}/${encodeURIComponent(draft.entityKey)}/rollback`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            version,
            reason: "Administrator-requested governed catalogue rollback",
          }),
        },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        version?: Record<string, unknown>;
        message?: string;
      };
      if (!response.ok || !payload.version)
        throw new Error(
          payload.message ?? "The catalogue rollback could not be completed.",
        );
      setCatalogueDraft({
        ...draft,
        version,
        lifecycle:
          typeof payload.version.lifecycleStatus === "string"
            ? payload.version.lifecycleStatus
            : draft.lifecycle,
      });
      setConfigurationEpoch((current) => current + 1);
      setNotice(
        `Catalogue projection rolled back to ${draft.entityType} ${draft.entityKey} v${version}.`,
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "The catalogue rollback could not be completed.",
      );
    } finally {
      setBusyStage(null);
    }
  };

  const saveCatalogueDefinitionDraft = async () => {
    if (!canDraft) {
      setNotice(
        "A named author or administrator is required to create an adapter or feature draft.",
      );
      return;
    }
    let definition: Record<string, unknown>;
    try {
      const parsed = JSON.parse(catalogueEditorJson) as unknown;
      if (!isRecord(parsed))
        throw new Error("Definition JSON must be an object.");
      definition = parsed;
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Definition JSON is invalid.",
      );
      return;
    }
    const adapterKey = textValue(definition.adapterKey);
    const entityKey =
      catalogueEditorKind === "feature"
        ? `${adapterKey}:${textValue(definition.featureCode)}`
        : adapterKey;
    if (
      !adapterKey ||
      (catalogueEditorKind === "feature" && !textValue(definition.featureCode))
    ) {
      setNotice(
        "The adapter key is required, and a feature draft also needs a feature code.",
      );
      return;
    }
    setBusyStage("saving");
    try {
      const endpoint =
        catalogueEditorKind === "adapter"
          ? "/api/governance/adapters"
          : "/api/governance/features";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          catalogueEditorKind === "adapter"
            ? { adapter: definition }
            : { feature: definition },
        ),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        adapter?: Record<string, unknown>;
        feature?: Record<string, unknown>;
        message?: string;
      };
      const saved =
        catalogueEditorKind === "adapter" ? payload.adapter : payload.feature;
      if (!response.ok || !saved || typeof saved.version !== "number")
        throw new Error(
          payload.message ?? "The catalogue draft could not be created.",
        );
      setCatalogueDraft({
        entityType: catalogueEditorKind,
        entityKey,
        version: saved.version,
        lifecycle:
          typeof saved.lifecycleStatus === "string"
            ? saved.lifecycleStatus
            : "draft",
      });
      setNotice(
        `A new immutable ${catalogueEditorKind} draft was created. Submit it for independent review before release.`,
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "The catalogue draft could not be created.",
      );
    } finally {
      setBusyStage(null);
    }
  };

  const publishDraft = async () => {
    const draft = governance.draftBundle;
    if (!canPublish || !draft) {
      setNotice(
        "An administrator and an independently approved draft are required for release.",
      );
      return;
    }
    setBusyStage("saving");
    try {
      const response = await fetch(
        `/api/governance/rule-bundles/${draft.bundleId}/publish`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            version: draft.version,
            scopeKey: "DLMS:generic-provisional-v1",
            reason: "Shared provisional DLMS release",
          }),
        },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        message?: string;
      };
      if (!response.ok)
        throw new Error(
          payload.message ?? "The approved version could not be released.",
        );
      setGovernance((current) => ({
        ...current,
        activeBundle: {
          bundleId: draft.bundleId,
          version: draft.version,
          lifecycle:
            draft.lifecycle === "approved_active"
              ? "approved_active"
              : "provisional_active",
          scopeKey: "DLMS:generic-provisional-v1",
        },
      }));
      setNotice(
        "The approved rule version is now the shared active configuration. Reload any existing sessions before re-running analysis.",
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "The approved version could not be released.",
      );
    } finally {
      setBusyStage(null);
    }
  };

  const rollbackRuleBundle = async () => {
    const active = governance.activeBundle;
    const version = Number(rollbackVersion);
    if (!canPublish || !active || !Number.isInteger(version) || version < 1) {
      setNotice(
        "Enter a previously reviewed version number to roll back the active shared bundle.",
      );
      return;
    }
    setBusyStage("saving");
    try {
      const response = await fetch(
        `/api/governance/rule-bundles/${active.bundleId}/rollback`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            version,
            scopeKey: active.scopeKey,
            reason: "Administrator-requested rollback",
          }),
        },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        bundle?: Record<string, unknown>;
        message?: string;
      };
      if (!response.ok || !payload.bundle)
        throw new Error(
          payload.message ?? "The rollback could not be completed.",
        );
      setGovernance((current) => ({
        ...current,
        activeBundle: {
          bundleId: active.bundleId,
          version,
          lifecycle:
            payload.bundle?.lifecycleStatus === "approved_active"
              ? "approved_active"
              : "provisional_active",
          scopeKey: active.scopeKey,
        },
      }));
      setNotice(
        "The requested historical version is now the shared active bundle. Its prior release and audit history remain intact.",
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "The rollback could not be completed.",
      );
    } finally {
      setBusyStage(null);
    }
  };

  const refreshAuditEvents = async () => {
    if (!canPublish) return;
    try {
      const response = await fetch("/api/governance/audit?limit=20", {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => ({}))) as {
        events?: Array<{
          id: string;
          action: string;
          entityType: string;
          entityId: string;
          createdAt: string;
        }>;
      };
      if (response.ok && Array.isArray(payload.events))
        setAuditEvents(payload.events);
    } catch {
      setNotice("The audit log could not be refreshed right now.");
    }
  };

  const refreshRoleAssignments = async () => {
    if (!canPublish) return;
    try {
      const response = await fetch("/api/governance/roles", {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => ({}))) as {
        assignments?: Array<{
          id: string;
          email: string;
          role: string;
          enabled: boolean;
        }>;
      };
      if (response.ok && Array.isArray(payload.assignments))
        setRoleAssignments(payload.assignments);
    } catch {
      setNotice("Role assignments could not be refreshed right now.");
    }
  };

  const assignRole = async () => {
    if (!canPublish || !roleEmail.trim()) {
      setNotice("Enter the team member email before assigning a server role.");
      return;
    }
    setBusyStage("saving");
    try {
      const response = await fetch("/api/governance/roles", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: roleEmail.trim(),
          role: roleToAssign,
          enabled: true,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        assignments?: Array<{
          id: string;
          email: string;
          role: string;
          enabled: boolean;
        }>;
        message?: string;
      };
      if (!response.ok)
        throw new Error(
          payload.message ?? "The server role could not be assigned.",
        );
      if (Array.isArray(payload.assignments))
        setRoleAssignments(payload.assignments);
      setRoleEmail("");
      setNotice(
        "Server role assigned. The person receives the new capability the next time they load shared governance.",
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "The server role could not be assigned.",
      );
    } finally {
      setBusyStage(null);
    }
  };

  const handleLogoUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.type === "image/svg+xml") {
      setNotice(
        "Use a PNG, JPEG, or WebP logo. SVG is not accepted by the shared image store.",
      );
      return;
    }
    if (!file.type.startsWith("image/") || file.size > 2 * 1024 * 1024) {
      setNotice("Use an image logo smaller than 2 MB.");
      return;
    }
    if (!isAdmin) {
      setNotice("Only a named administrator can upload the shared logo.");
      return;
    }
    setBusyStage("saving");
    try {
      const response = await fetch("/api/governance/logo", {
        method: "PUT",
        headers: {
          "content-type": file.type,
          ...(governance.settingsVersion
            ? { "x-settings-version": String(governance.settingsVersion) }
            : {}),
        },
        body: file,
      });
      const payload = (await response.json().catch(() => ({}))) as {
        logoUrl?: string;
        settings?: {
          version?: number;
          value?: { branding?: { logoObjectKey?: string | null } };
        };
        message?: string;
      };
      if (!response.ok || !payload.logoUrl)
        throw new Error(payload.message ?? "Logo upload failed");
      setSettings((current) => ({
        ...current,
        branding: {
          logoDataUrl: payload.logoUrl ?? null,
          logoFileName:
            payload.settings?.value?.branding?.logoObjectKey
              ?.split("/")
              .pop() ?? file.name,
        },
      }));
      if (typeof payload.settings?.version === "number")
        setGovernance((current) => ({
          ...current,
          settingsVersion: payload.settings?.version ?? current.settingsVersion,
        }));
      setNotice(
        "Shared logo uploaded and recorded in the branding audit trail.",
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Logo upload failed.");
    } finally {
      setBusyStage(null);
    }
  };

  const renderCaseDetails = (row: FfrRow) => (
    <div className="case-context-list">
      {caseDisplayGroups.map((group) => (
        <details
          key={group.id}
          open={
            group.id === "case_context" ||
            group.id === "asset_context" ||
            group.id === "complaint_context"
          }
        >
          <summary>{group.title}</summary>
          <dl>
            {group.fields.map((field) => (
              <div key={field}>
                <dt>{row.labels[canonicalField(field)] ?? field}</dt>
                <dd>{ffrValue(row, field) || "Not supplied"}</dd>
              </div>
            ))}
          </dl>
        </details>
      ))}
    </div>
  );

  const renderTechnicalAnalysis = () => {
    const analysis = dlms?.analysis;
    if (!analysis) return null;
    const visible = analysis.findings.filter(
      (finding) => findingFilter === "all" || finding.status === findingFilter,
    );
    const groups = [
      "Foundation",
      "Profile & data quality",
      "Events",
      "Complaint context",
    ] as const;
    return (
      <Card className="technical-analysis">
        <SectionHead
          eyebrow="3. Technical DLMS analysis"
          title={`${analysis.summary.total} provisional checks ran`}
          description="Every result is source-linked and review-required. A technical finding can be shown for an identity mismatch, but no case-specific conclusion is created until the exact FFR meter and product mapping are valid."
          action={
            <div className="button-row">
              <button
                className="button secondary"
                disabled={!dlmsFile || busyStage === "rerun"}
                onClick={rerunAnalysis}
              >
                <RefreshCw
                  size={15}
                  className={busyStage === "rerun" ? "spin" : ""}
                />{" "}
                Re-run with current profile
              </button>
              <Status tone="warning">PROVISIONAL FINDING</Status>
            </div>
          }
        />
        <div className="rule-summary">
          <div>
            <strong>{analysis.summary.total}</strong>
            <span>checks run</span>
          </div>
          <div>
            <strong>{analysis.summary.attention}</strong>
            <span>need review</span>
          </div>
          <div>
            <strong>{analysis.summary.high}</strong>
            <span>high context signals</span>
          </div>
          <div>
            <strong>{analysis.summary.notAssessed}</strong>
            <span>evidence gaps</span>
          </div>
        </div>
        <div className="filter-row" aria-label="Filter technical findings">
          <button
            className={findingFilter === "all" ? "selected" : ""}
            onClick={() => setFindingFilter("all")}
          >
            All {analysis.summary.total}
          </button>
          <button
            className={findingFilter === "attention" ? "selected" : ""}
            onClick={() => setFindingFilter("attention")}
          >
            Needs review {analysis.summary.attention}
          </button>
          <button
            className={findingFilter === "not_assessed" ? "selected" : ""}
            onClick={() => setFindingFilter("not_assessed")}
          >
            Evidence gaps {analysis.summary.notAssessed}
          </button>
        </div>
        <div className="finding-list">
          {groups.map((group) => {
            const findings = visible.filter(
              (finding) => finding.group === group,
            );
            if (!findings.length) return null;
            return (
              <details
                className="finding-group"
                key={group}
                open={findingFilter !== "all" || group === "Foundation"}
              >
                <summary>
                  <span>
                    <strong>{group}</strong>
                    <small>
                      {
                        analysis.findings.filter(
                          (finding) => finding.group === group,
                        ).length
                      }{" "}
                      configured checks
                    </small>
                  </span>
                  <span>
                    {
                      findings.filter(
                        (finding) => finding.status === "attention",
                      ).length
                    }{" "}
                    need review
                  </span>
                </summary>
                {findings.map((finding) => (
                  <details
                    className={`finding-row finding-${finding.status}`}
                    key={finding.id}
                  >
                    <summary>
                      <Status tone={findingTone(finding)}>
                        {finding.status === "attention"
                          ? finding.severity === "high"
                            ? "HIGH REVIEW"
                            : "REVIEW"
                          : finding.status === "pass"
                            ? "CHECK PASSED"
                            : "NOT ASSESSED"}
                      </Status>
                      <span>
                        <strong>{finding.title}</strong>
                        <small>
                          {finding.id} · {finding.actual}
                        </small>
                      </span>
                    </summary>
                    <dl>
                      <div>
                        <dt>Threshold / rule</dt>
                        <dd>{finding.threshold}</dd>
                      </div>
                      <div>
                        <dt>Source</dt>
                        <dd>
                          {finding.sources
                            .map((item) => `${item.sheet}: ${item.locator}`)
                            .join("; ") || "Required evidence unavailable"}
                        </dd>
                      </div>
                      <div>
                        <dt>Why it ran</dt>
                        <dd>{finding.why}</dd>
                      </div>
                      <div>
                        <dt>What it cannot prove</dt>
                        <dd>{finding.limitation}</dd>
                      </div>
                      <div>
                        <dt>Required follow-up</dt>
                        <dd>{finding.followUp}</dd>
                      </div>
                    </dl>
                  </details>
                ))}
              </details>
            );
          })}
        </div>
      </Card>
    );
  };

  const renderAnalysis = () => (
    <div className="page-stack">
      <header className="page-header">
        <div className="page-symbol">
          <ClipboardList size={22} />
        </div>
        <div>
          <span className="eyebrow">Development proof of concept</span>
          <h1>Register-first case intake</h1>
          <p>
            Upload the FFR register first, select one case and meter, then
            upload its DLMS workbook and images in separate stages.
          </p>
          <p className="helper-text">
            Deepu return-module enrichment is not connected in this build. The
            DLMS workbook itself is read directly, and its 60 technical checks
            run even when the selected FFR meter does not match.
          </p>
        </div>
        <Status tone="warning">Provisional analysis</Status>
      </header>
      <section className="workflow-overview" aria-label="Case intake stages">
        {[
          ["1", "FFR register", Boolean(register)],
          ["2", "Case and meter", Boolean(selectedRow && selectedMeterId)],
          ["3", "DLMS technical check", Boolean(dlms)],
          ["4", "Image evidence", Boolean(images)],
          [
            "5",
            "Case rule gate",
            Boolean(validDlms && selectedCase?.productFamily),
          ],
        ].map(([number, label, complete]) => (
          <div
            className={complete ? "pipeline-step complete" : "pipeline-step"}
            key={String(number)}
          >
            <span>{complete ? <CheckCircle2 size={15} /> : number}</span>
            <strong>{label}</strong>
          </div>
        ))}
      </section>
      {intakeError && (
        <div className="callout danger" role="alert">
          <AlertTriangle size={19} />
          <div>
            <strong>Intake stopped.</strong>
            <p>{intakeError}</p>
          </div>
        </div>
      )}
      {!register && (
        <UploadStage
          title="1. Upload the FFR IG register"
          description="This multi-case register establishes the case, meter IDs, complaint, field observation, and source data to be mapped later."
          buttonText={
            busyStage === "ffr"
              ? "Reading FFR register…"
              : "Upload one FFR IG workbook"
          }
          accept=".xlsx,.xls"
          onChange={handleFfrUpload}
        />
      )}
      {register && !selectedRow && (
        <Card className="stage-card">
          <SectionHead
            eyebrow="1. FFR register validated"
            title="Choose the FFR case before uploading evidence"
            description="A register can contain several meters. DLMS evidence belongs to exactly one selected case and meter."
            action={<Status tone="good">{register.rows.length} cases</Status>}
          />
          <div className="artifact-grid">
            <ArtifactSummary artifact={register.artifact} />
          </div>
          <div className="case-table-wrap">
            <table className="case-table">
              <thead>
                <tr>
                  <th>Case</th>
                  <th>Sub-division</th>
                  <th>Defective meter</th>
                  <th>Replacement meter</th>
                  <th>Complaint</th>
                  <th>Field observation</th>
                  <th>
                    <span className="visually-hidden">Select</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {register.rows.map((row) => (
                  <tr key={row.rowNumber}>
                    <td>
                      <strong>
                        {ffrValue(row, "S.No") || `Row ${row.rowNumber}`}
                      </strong>
                      <small>Excel row {row.rowNumber}</small>
                    </td>
                    <td>{ffrValue(row, "Sub-Division") || "Not supplied"}</td>
                    <td>
                      {ffrValue(row, "Old_Meter_Number") || "Not supplied"}
                    </td>
                    <td>
                      {ffrValue(row, "New_Meter_Number") || "Not supplied"}
                    </td>
                    <td>
                      <strong>
                        {ffrValue(row, "Defect Trigger") || "Not supplied"}
                      </strong>
                      <small>
                        {ffrValue(row, "Symptoms of the problem New")}
                      </small>
                    </td>
                    <td>
                      {ffrValue(row, "Field Observation") || "Not supplied"}
                    </td>
                    <td>
                      <button
                        className="button primary"
                        onClick={() => chooseCase(row.rowNumber)}
                      >
                        Choose case
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      {selectedRow && (
        <>
          <Card className="case-card">
            <SectionHead
              eyebrow="2. Selected FFR case"
              title={`Case ${ffrValue(selectedRow, "S.No") || `row ${selectedRow.rowNumber}`}`}
              description="FFR values are source context. Existing RCA/CAPA cells are never treated as approved conclusions."
              action={
                <button
                  className="button secondary"
                  onClick={() => {
                    setSelectedRowNumber(null);
                    resetEvidence();
                  }}
                >
                  Change case
                </button>
              }
            />
            <div className="case-summary">
              <div>
                <span>Defect date</span>
                <strong>
                  {ffrValue(selectedRow, "Date Of Defect") || "Not supplied"}
                </strong>
              </div>
              <div>
                <span>Sub-division</span>
                <strong>
                  {ffrValue(selectedRow, "Sub-Division") || "Not supplied"}
                </strong>
              </div>
              <div>
                <span>Product mapping</span>
                <strong>
                  {selectedCase?.productFamily ??
                    "Unresolved — add a shared mapping"}
                </strong>
              </div>
              <div>
                <span>Complaint mapping</span>
                <strong>
                  {selectedCase?.complaintLabel ?? "Unclassified"}
                </strong>
              </div>
            </div>
            {renderCaseDetails(selectedRow)}
          </Card>
          <Card className="stage-card">
            <SectionHead
              eyebrow="2. Evidence target"
              title="Which meter are you uploading evidence for?"
              description="This choice controls the exact DLMS identity gate."
            />
            <div className="meter-role-grid">
              {meterRoles.map((role) => {
                const meterId = ffrValue(selectedRow, role.field);
                return (
                  <button
                    key={role.id}
                    className={
                      meterRole === role.id
                        ? "meter-role selected"
                        : "meter-role"
                    }
                    onClick={() => chooseMeterRole(role.id)}
                    disabled={!meterId}
                  >
                    <span>
                      <strong>{role.title}</strong>
                      <small>{role.description}</small>
                    </span>
                    <b>{meterId || "No meter number supplied"}</b>
                    {meterRole === role.id && <CheckCircle2 size={18} />}
                  </button>
                );
              })}
            </div>
          </Card>
          <UploadStage
            title="3. Upload the matching BCS / DLMS workbook"
            description="The technical 60-check report runs immediately. Exact identity still decides whether any finding can be linked to this FFR case."
            buttonText={
              busyStage === "dlms"
                ? "Reading DLMS report…"
                : "Upload one BCS / DLMS workbook"
            }
            accept=".xlsx,.xls"
            disabled={!selectedMeterId}
            onChange={handleDlmsUpload}
          />
          {dlms && (
            <div className={validDlms ? "callout good" : "callout danger"}>
              {validDlms ? (
                <CheckCircle2 size={19} />
              ) : (
                <AlertTriangle size={19} />
              )}
              <div>
                <strong>
                  {validDlms
                    ? "Exact meter identity confirmed"
                    : "IDENTITY_NO_MATCH — case-level analysis is blocked"}
                </strong>
                <p>
                  {dlms.messages[0]}{" "}
                  {validDlms && !selectedCase?.productFamily
                    ? "The FFR product mapping is still unresolved, so case-specific packs will remain contextual only."
                    : ""}
                </p>
              </div>
            </div>
          )}
          {renderTechnicalAnalysis()}
          {dlms && validDlms && (
            <UploadStage
              title="4. Upload meter images"
              description="Images remain separately attached evidence. This build validates the files but does not fabricate visual findings."
              buttonText={
                busyStage === "images"
                  ? "Checking image evidence…"
                  : "Attach meter images"
              }
              accept=".png,.jpg,.jpeg,.webp"
              multiple
              onChange={handleImageUpload}
            >
              {images && (
                <div className="artifact-grid">
                  {images.artifacts.map((artifact) => (
                    <ArtifactSummary key={artifact.id} artifact={artifact} />
                  ))}
                </div>
              )}
            </UploadStage>
          )}
          {dlms && (
            <Card>
              <SectionHead
                eyebrow="5. Case rule gate"
                title={
                  validDlms && selectedCase?.productFamily
                    ? "Case context is eligible for provisional interpretation"
                    : "Case-specific interpretation remains blocked"
                }
                description={
                  validDlms && selectedCase?.productFamily
                    ? `The current selected case is mapped to ${selectedCase.productFamily}. The same shared bundle is filtered by its family/complaint scopes when a governed run is released.`
                    : "The technical report above remains useful, but it cannot be assigned to a customer case, RCA, CAPA, or workbook output yet."
                }
                action={
                  <button
                    className="button secondary"
                    onClick={() => setPage("rules")}
                  >
                    <BookOpenCheck size={15} /> Review 60 checks
                  </button>
                }
              />
            </Card>
          )}
        </>
      )}
    </div>
  );

  const renderSession = () => (
    <div className="page-stack">
      <header className="page-header">
        <div className="page-symbol">
          <ClipboardList size={22} />
        </div>
        <div>
          <span className="eyebrow">Current evidence session</span>
          <h1>Run state and audit boundary</h1>
          <p>
            Technical analysis is created in the browser immediately. When
            shared governance is available, its summary is saved without
            retaining raw evidence by default.
          </p>
        </div>
        <Status tone={governance.mode === "ready" ? "good" : "warning"}>
          {governance.mode === "ready" ? "SHARED GOVERNANCE" : "SESSION ONLY"}
        </Status>
      </header>
      <Card>
        {selectedRow ? (
          <>
            <SectionHead
              title={`Selected case ${ffrValue(selectedRow, "S.No") || selectedRow.rowNumber}`}
              description="The analysis version, profile, identity state, and raw-evidence retention policy are visible below."
            />
            <div className="data-list">
              <div>
                <dt>Selected meter</dt>
                <dd>{selectedMeterId || "Not selected"}</dd>
              </div>
              <div>
                <dt>DLMS serial</dt>
                <dd>{dlms?.meterId ?? "Not uploaded"}</dd>
              </div>
              <div>
                <dt>Identity state</dt>
                <dd>{dlms?.identityState ?? "Awaiting DLMS"}</dd>
              </div>
              <div>
                <dt>Bundle / profile</dt>
                <dd>
                  {dlms?.analysis
                    ? `${dlms.analysis.bundle.id} · ${dlms.analysis.profile.id}`
                    : "Awaiting analysis"}
                </dd>
              </div>
              <div>
                <dt>Evidence retention</dt>
                <dd>
                  {settings.retentionDays > 0
                    ? `${settings.retentionDays} days configured (requires admin enablement)`
                    : "Disabled"}
                </dd>
              </div>
              <div>
                <dt>Raw evidence</dt>
                <dd>Not retained by this browser analysis</dd>
              </div>
            </div>
          </>
        ) : (
          <div className="empty-state">
            <ClipboardList size={28} />
            <strong>No case selected in this session</strong>
            <span>Start by uploading the FFR register.</span>
            <button
              className="button primary"
              onClick={() => setPage("analysis")}
            >
              Start case intake
            </button>
          </div>
        )}
      </Card>
    </div>
  );

  const renderRules = () => {
    const coverage = ["METER", "NIC", "GATEWAY"].map((family) => ({
      family,
      scopes: complaintOptions(family as ProductFamily).length,
    }));
    const groups = [
      "Foundation",
      "Profile & data quality",
      "Events",
      "Complaint context",
    ] as const;
    return (
      <div className="page-stack">
        <header className="page-header">
          <div className="page-symbol">
            <BookOpenCheck size={22} />
          </div>
          <div>
            <span className="eyebrow">Shared modular rule library</span>
            <h1>Generic provisional DLMS bundle</h1>
            <p>
              {bundle.summary} Every rule says what it checks, why it ran, what
              it cannot prove, and the required next validation.
            </p>
          </div>
          <Status tone="warning">{bundle.lifecycle.toUpperCase()}</Status>
        </header>
        <Card>
          <SectionHead
            eyebrow="Coverage"
            title={`${bundle.rules.length} active definitions across all product families`}
            description="Each product family is scoped by shared data. A selected adapter is direct only after its governed definition and mapping are released; otherwise the report is explicitly contextual evidence."
            action={
              <div className="button-row">
                <button className="button secondary" onClick={downloadBundle}>
                  <Download size={15} /> Export bundle
                </button>
                {canDraft && (
                  <label className="button secondary">
                    <FileJson size={15} /> Import draft
                    <input
                      className="visually-hidden"
                      type="file"
                      accept="application/json,.json"
                      onChange={importBundle}
                    />
                  </label>
                )}
              </div>
            }
          />
          <div className="rule-summary">
            {coverage.map((item) => (
              <div key={item.family}>
                <strong>{item.scopes}</strong>
                <span>{item.family} catalogue scopes</span>
              </div>
            ))}
            <div>
              <strong>
                {bundle.rules.filter((rule) => rule.enabled).length}
              </strong>
              <span>enabled checks</span>
            </div>
          </div>
        </Card>
        <section className="rule-editor-layout">
          <Card>
            <SectionHead
              title="Rule coverage"
              description="Select a rule to inspect or edit it. Disabled rules are retained in the bundle and audit history, but do not run."
            />
            <div className="rule-list">
              {groups.map((group) => (
                <div className="rule-group" key={group}>
                  <span className="eyebrow">{group}</span>
                  {bundle.rules
                    .filter((rule) => rule.group === group)
                    .map((rule) => (
                      <button
                        key={rule.id}
                        className={
                          rule.id === selectedRule?.id
                            ? "rule-list-item selected"
                            : "rule-list-item"
                        }
                        onClick={() => setSelectedRuleId(rule.id)}
                      >
                        <span>
                          <strong>{rule.title}</strong>
                          <small>
                            {rule.id} · {rule.complaintKeys.join(", ")}
                          </small>
                        </span>
                        <Status tone={rule.enabled ? "warning" : "neutral"}>
                          {rule.enabled ? "ENABLED" : "DISABLED"}
                        </Status>
                      </button>
                    ))}
                </div>
              ))}
            </div>
          </Card>
          {selectedRule && (
            <Card>
              <SectionHead
                eyebrow="Selected rule"
                title={selectedRule.id}
                description="The fields below are data in the shared bundle, not hard-coded application behavior."
                action={
                  canDraft ? (
                    <button
                      className="button primary"
                      disabled={busyStage === "saving"}
                      onClick={saveRuleDraft}
                    >
                      <Save size={15} /> Create governed draft
                    </button>
                  ) : (
                    <Status tone="warning">AUTHOR ROLE REQUIRED</Status>
                  )
                }
              />
              <div className="form-grid rule-editor-fields">
                <label className="wide">
                  Rule title
                  <input
                    disabled={!canDraft}
                    value={selectedRule.title}
                    onChange={(event) =>
                      updateRule(selectedRule.id, { title: event.target.value })
                    }
                  />
                </label>
                <label>
                  Severity
                  <select
                    disabled={!canDraft}
                    value={selectedRule.severity}
                    onChange={(event) =>
                      updateRule(selectedRule.id, {
                        severity: event.target
                          .value as RuleDefinition["severity"],
                      })
                    }
                  >
                    <option value="info">Info</option>
                    <option value="warning">Warning</option>
                    <option value="high">High</option>
                  </select>
                </label>
                <label className="toggle">
                  <input
                    disabled={!canDraft}
                    type="checkbox"
                    checked={selectedRule.enabled}
                    onChange={(event) =>
                      updateRule(selectedRule.id, {
                        enabled: event.target.checked,
                      })
                    }
                  />{" "}
                  Enabled for future analyses
                </label>
                <label className="wide">
                  Why this rule runs
                  <textarea
                    disabled={!canDraft}
                    value={selectedRule.why}
                    onChange={(event) =>
                      updateRule(selectedRule.id, { why: event.target.value })
                    }
                  />
                </label>
                <label className="wide">
                  What it cannot prove
                  <textarea
                    disabled={!canDraft}
                    value={selectedRule.limitation}
                    onChange={(event) =>
                      updateRule(selectedRule.id, {
                        limitation: event.target.value,
                      })
                    }
                  />
                </label>
                <label className="wide">
                  Required follow-up
                  <textarea
                    disabled={!canDraft}
                    value={selectedRule.followUp}
                    onChange={(event) =>
                      updateRule(selectedRule.id, {
                        followUp: event.target.value,
                      })
                    }
                  />
                </label>
                <label className="wide">
                  Scope keys
                  <input
                    disabled={!canDraft}
                    value={selectedRule.complaintKeys.join(", ")}
                    onChange={(event) =>
                      updateRule(selectedRule.id, {
                        complaintKeys: event.target.value
                          .split(",")
                          .map((value) => normalise(value))
                          .filter(Boolean),
                      })
                    }
                  />
                </label>
              </div>
              <label className="rule-expression">
                Rule expression (JSON)
                <textarea
                  disabled={!canDraft}
                  value={expressionDraft}
                  onChange={(event) => setExpressionDraft(event.target.value)}
                />
                {canDraft && (
                  <button
                    className="button secondary"
                    onClick={applyExpression}
                  >
                    <SlidersHorizontal size={15} /> Apply expression
                  </button>
                )}
              </label>
            </Card>
          )}
        </section>
      </div>
    );
  };

  const renderReadiness = () => (
    <div className="page-stack">
      <header className="page-header">
        <div className="page-symbol">
          <ShieldCheck size={22} />
        </div>
        <div>
          <span className="eyebrow">Governed release controls</span>
          <h1>Readiness and audit policy</h1>
          <p>
            The shared library replaces browser-local activation. It keeps
            drafts, review, provisional release, approval, retirement, and
            historical version references separate.
          </p>
        </div>
        <Status tone={governance.mode === "ready" ? "good" : "warning"}>
          {governance.mode === "ready" ? "CONNECTED" : "SETUP REQUIRED"}
        </Status>
      </header>
      <Card>
        <SectionHead
          title="Shared governance status"
          description={governance.message}
          action={
            <button
              className="button secondary"
              onClick={() => window.location.reload()}
            >
              <RefreshCw size={15} /> Refresh connection
            </button>
          }
        />
        <div className="guard-grid">
          <div>
            <Database size={19} />
            <strong>D1 shared state</strong>
            <span>
              Settings, bundles, roles, run summaries, fixtures metadata, and
              audit events are server-owned.
            </span>
          </div>
          <div>
            <LockKeyhole size={19} />
            <strong>Named-admin publishing</strong>
            <span>
              Only the server-recognized admin role can modify shared settings
              or create bundle versions.
            </span>
          </div>
          <div>
            <ShieldCheck size={19} />
            <strong>Provisional output gate</strong>
            <span>
              Initial findings are always review-required and never create
              approved RCA/CAPA text.
            </span>
          </div>
        </div>
      </Card>
      <div className="readiness-grid">
        {readinessChecklist.map(([title, detail], index) => (
          <Card key={title} className="readiness-card">
            <SectionHead
              eyebrow={`Control ${index + 1}`}
              title={title}
              description={detail}
            />
          </Card>
        ))}
      </div>
    </div>
  );

  const renderSettings = () => (
    <div className="page-stack">
      <header className="page-header">
        <div className="page-symbol">
          <Settings size={22} />
        </div>
        <div>
          <span className="eyebrow">Shared app settings</span>
          <h1>Profiles, mappings, and branding</h1>
          <p>
            These configuration values are read by the generic evaluator. Change
            a profile or mapping here, save a governed version, then re-run the
            same report to see the effect.
          </p>
        </div>
        {isAdmin ? (
          <button
            className="button primary"
            disabled={busyStage === "saving"}
            onClick={saveSharedConfiguration}
          >
            <Save size={15} /> Save shared settings
          </button>
        ) : (
          <Status tone="warning">VIEW ONLY</Status>
        )}
      </header>
      <div className="callout neutral">
        <Info size={19} />
        <div>
          <strong>
            {governance.mode === "ready"
              ? "Shared configuration loaded"
              : "Shared configuration setup required"}
          </strong>
          <p>{governance.message}</p>
        </div>
      </div>
      <section className="settings-grid">
        <Card>
          <SectionHead
            eyebrow="Branding"
            title="Upload the Kimbal logo"
            description="The approved logo is stored in shared object storage and referenced from shared settings."
          />
          <div className="logo-setting">
            <div className="logo-preview">
              {settings.branding.logoDataUrl ? (
                <img
                  src={settings.branding.logoDataUrl}
                  alt="Uploaded organisation logo"
                />
              ) : (
                <span>No logo uploaded</span>
              )}
            </div>
            <div>
              <label className="button secondary">
                {" "}
                <Upload size={15} /> Upload logo
                <input
                  className="visually-hidden"
                  disabled={!isAdmin}
                  type="file"
                  accept=".svg,.png,.jpg,.jpeg,.webp"
                  onChange={handleLogoUpload}
                />
              </label>
              {settings.branding.logoFileName && (
                <small>{settings.branding.logoFileName}</small>
              )}
            </div>
          </div>
        </Card>
        <Card>
          <SectionHead
            eyebrow="Retention and access"
            title="Pilot configuration"
          />
          <div className="form-grid">
            <label>
              Retention policy (days)
              <input
                disabled={!isAdmin}
                type="number"
                min="0"
                value={settings.retentionDays}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    retentionDays: Number(event.target.value),
                  }))
                }
              />
            </label>
            <label>
              Upload limit (MB)
              <input
                disabled={!isAdmin}
                type="number"
                min="1"
                value={settings.uploadMaxMb}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    uploadMaxMb: Number(event.target.value),
                  }))
                }
              />
            </label>
            <label className="wide">
              Named role reference
              <input
                disabled={!isAdmin}
                value={settings.pilotAccess.approvedRoles.join(", ")}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    pilotAccess: {
                      ...current.pilotAccess,
                      approvedRoles: event.target.value
                        .split(",")
                        .map((item) => normalise(item))
                        .filter(Boolean),
                    },
                  }))
                }
              />
            </label>
          </div>
          <p className="helper-text">
            Raw evidence remains off by default. A retention value is a
            configuration preference; server-side retention is only enabled by
            an administrator.
          </p>
        </Card>
      </section>
      <Card>
        <SectionHead
          eyebrow="Provisional profile"
          title={profile.title}
          description="Meter configuration values take precedence when present; these fields are transparent editable fallbacks. All changes are configuration data, not application code."
          action={
            <Status tone="warning">{profile.status.toUpperCase()}</Status>
          }
        />
        <div className="parameter-grid">
          {Object.entries(profile.parameters)
            .filter(
              ([key]) => !key.endsWith("_lower_v") && !key.endsWith("_upper_v"),
            )
            .map(([key, value]) => (
              <label key={key}>
                <span>
                  <strong>{key.replaceAll("_", " ")}</strong>
                  <small>
                    {profile.descriptions[key] ?? "Derived profile parameter"}
                  </small>
                </span>
                <input
                  disabled={!isAdmin}
                  type="number"
                  step="any"
                  value={value}
                  onChange={(event) =>
                    updateProfileParameter(key, event.target.value)
                  }
                />
              </label>
            ))}
        </div>
        <p className="helper-text">
          Effective voltage bands are derived from nominal voltage plus the
          configured warning/critical percentages. If MeterConfiguration
          supplies a usable nominal voltage, it overrides the fallback for that
          run.
        </p>
      </Card>
      <Card>
        <SectionHead
          eyebrow="Product-family mapping"
          title="Map actual FFR values to Meter, NIC, or Gateway"
          description="Unmapped cases remain unresolved; no AI or free-text inference selects a product family."
        />
        <div className="mapping-list">
          {settings.productMappings.map((mapping) => (
            <div key={mapping.id}>
              <span>
                <strong>{mapping.sourceField}</strong>
                <small>{mapping.basis}</small>
              </span>
              <strong>{mapping.sourceValue}</strong>
              <Status tone="good">{mapping.productFamily}</Status>
              {isAdmin && (
                <button
                  aria-label={`Remove ${mapping.sourceValue} mapping`}
                  onClick={() =>
                    setSettings((current) => ({
                      ...current,
                      productMappings: current.productMappings.filter(
                        (item) => item.id !== mapping.id,
                      ),
                    }))
                  }
                >
                  <X size={15} />
                </button>
              )}
            </div>
          ))}
        </div>
        {isAdmin && (
          <div className="inline-form">
            <select
              value={mappingField}
              onChange={(event) =>
                setMappingField(
                  event.target.value as "Meter type" | "Old_Meter_Type",
                )
              }
            >
              <option>Old_Meter_Type</option>
              <option>Meter type</option>
            </select>
            <input
              value={mappingValue}
              onChange={(event) => setMappingValue(event.target.value)}
              placeholder="Exact FFR value"
            />
            <select
              value={mappingFamily}
              onChange={(event) =>
                setMappingFamily(event.target.value as ProductFamily)
              }
            >
              {productFamilyOptions().map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button className="button secondary" onClick={addMapping}>
              <SlidersHorizontal size={15} /> Add mapping
            </button>
          </div>
        )}
      </Card>
    </div>
  );

  const renderGovernanceControls = () => {
    const draft = governance.draftBundle;
    const active = governance.activeBundle;
    return (
      <div className="page-stack">
        <Card>
          <SectionHead
            eyebrow="Shared release workflow"
            title="Draft, review, release, and rollback"
            description="Published versions are immutable. A person who drafted a version cannot approve the same version, and only a named administrator can release or roll it back."
            action={
              <Status tone={active ? "good" : "warning"}>
                {active ? `ACTIVE V${active.version}` : "FALLBACK ONLY"}
              </Status>
            }
          />
          <div className="data-list">
            <div>
              <dt>Your server role</dt>
              <dd>{governance.role ?? "Not connected"}</dd>
            </div>
            <div>
              <dt>Active bundle</dt>
              <dd>
                {active
                  ? `${active.bundleId} v${active.version} (${active.lifecycle})`
                  : "No shared release — generic provisional fallback"}
              </dd>
            </div>
            <div>
              <dt>Active profile</dt>
              <dd>
                {governance.activeProfile
                  ? `${governance.activeProfile.profileKey} v${governance.activeProfile.version}`
                  : "Labelled provisional fallback"}
              </dd>
            </div>
            <div>
              <dt>Active adapters / features</dt>
              <dd>
                {governance.adapterCount ?? 0} adapters ·{" "}
                {governance.featureCount ?? 0} features
              </dd>
            </div>
            <div>
              <dt>Current draft</dt>
              <dd>
                {draft
                  ? `${draft.bundleId} v${draft.version} (${draft.lifecycle})`
                  : "None"}
              </dd>
            </div>
          </div>
          <div className="button-row">
            {canDraft && (
              <button
                className="button secondary"
                disabled={busyStage === "saving"}
                onClick={saveRuleDraft}
              >
                <Save size={15} /> Create draft from working bundle
              </button>
            )}
            {canDraft && (
              <label className="button secondary">
                <FileJson size={15} /> Import draft bundle
                <input
                  className="visually-hidden"
                  type="file"
                  accept="application/json,.json"
                  onChange={importBundle}
                />
              </label>
            )}
            {canDraft && draft?.lifecycle === "draft" && (
              <button
                className="button secondary"
                disabled={busyStage === "saving"}
                onClick={() => void transitionDraft("in_review")}
              >
                Submit for review
              </button>
            )}
            {canReview && draft?.lifecycle === "in_review" && (
              <>
                <button
                  className="button secondary"
                  disabled={busyStage === "saving"}
                  onClick={() => void transitionDraft("provisional_active")}
                >
                  Approve provisional
                </button>
                <button
                  className="button secondary"
                  disabled={busyStage === "saving"}
                  onClick={() => void transitionDraft("approved_active")}
                >
                  Approve active
                </button>
              </>
            )}
            {canPublish &&
              (draft?.lifecycle === "provisional_active" ||
                draft?.lifecycle === "approved_active") && (
                <button
                  className="button primary"
                  disabled={busyStage === "saving"}
                  onClick={publishDraft}
                >
                  <ShieldCheck size={15} /> Release shared version
                </button>
              )}
          </div>
          {canPublish && active && (
            <div className="inline-form">
              <input
                type="number"
                min="1"
                value={rollbackVersion}
                onChange={(event) => setRollbackVersion(event.target.value)}
                placeholder="Reviewed version number"
              />
              <button
                className="button secondary"
                disabled={busyStage === "saving"}
                onClick={rollbackRuleBundle}
              >
                <RefreshCw size={15} /> Roll back to version
              </button>
              <button className="button secondary" onClick={refreshAuditEvents}>
                <ListChecks size={15} /> Refresh audit
              </button>
            </div>
          )}
        </Card>
        {catalogueDraft && (
          <Card>
            <SectionHead
              eyebrow="Profile, adapter, or feature workflow"
              title={`Governed ${catalogueDraft.entityType} version`}
              description="Catalogue definitions are immutable once reviewed. Publishing changes only the shared server projection; it never changes a historical run record."
              action={
                <Status
                  tone={
                    catalogueDraft.lifecycle === "draft" ||
                    catalogueDraft.lifecycle === "in_review"
                      ? "warning"
                      : "good"
                  }
                >
                  {catalogueDraft.lifecycle.toUpperCase()}
                </Status>
              }
            />
            <div className="data-list">
              <div>
                <dt>Entity</dt>
                <dd>{catalogueDraft.entityType}</dd>
              </div>
              <div>
                <dt>Key</dt>
                <dd>{catalogueDraft.entityKey}</dd>
              </div>
              <div>
                <dt>Version</dt>
                <dd>v{catalogueDraft.version}</dd>
              </div>
              <div>
                <dt>Lifecycle</dt>
                <dd>{catalogueDraft.lifecycle}</dd>
              </div>
            </div>
            <div className="button-row">
              {canDraft && catalogueDraft.lifecycle === "draft" && (
                <button
                  className="button secondary"
                  disabled={busyStage === "saving"}
                  onClick={() => void transitionCatalogueDraft("in_review")}
                >
                  Submit for review
                </button>
              )}
              {canReview && catalogueDraft.lifecycle === "in_review" && (
                <>
                  <button
                    className="button secondary"
                    disabled={busyStage === "saving"}
                    onClick={() =>
                      void transitionCatalogueDraft("provisional_active")
                    }
                  >
                    Approve provisional
                  </button>
                  <button
                    className="button secondary"
                    disabled={busyStage === "saving"}
                    onClick={() =>
                      void transitionCatalogueDraft("approved_active")
                    }
                  >
                    Approve active
                  </button>
                </>
              )}
              {canPublish &&
                (catalogueDraft.lifecycle === "provisional_active" ||
                  catalogueDraft.lifecycle === "approved_active") && (
                  <button
                    className="button primary"
                    disabled={busyStage === "saving"}
                    onClick={() => void publishCatalogueDraft()}
                  >
                    <ShieldCheck size={15} /> Release shared version
                  </button>
                )}
            </div>
            {canPublish && (
              <div className="inline-form">
                <input
                  type="number"
                  min="1"
                  value={catalogueRollbackVersion}
                  onChange={(event) =>
                    setCatalogueRollbackVersion(event.target.value)
                  }
                  placeholder="Reviewed catalogue version"
                />
                <button
                  className="button secondary"
                  disabled={busyStage === "saving"}
                  onClick={() => void rollbackCatalogueDraft()}
                >
                  <RefreshCw size={15} /> Roll back catalogue
                </button>
              </div>
            )}
          </Card>
        )}
        {canPublish && auditEvents.length > 0 && (
          <Card>
            <SectionHead
              eyebrow="Audit history"
              title="Latest governed actions"
            />
            <div className="mapping-list">
              {auditEvents.map((event) => (
                <div key={event.id}>
                  <span>
                    <strong>{event.action}</strong>
                    <small>
                      {event.entityType} · {event.entityId}
                    </small>
                  </span>
                  <small>{event.createdAt}</small>
                </div>
              ))}
            </div>
          </Card>
        )}
        {canPublish && (
          <Card>
            <SectionHead
              eyebrow="Role assignments"
              title="Author and reviewer access"
              description="Administrators are server-allowlisted outside the app. Assign only author, reviewer, or user roles here."
              action={
                <button
                  className="button secondary"
                  onClick={refreshRoleAssignments}
                >
                  <RefreshCw size={15} /> Refresh roles
                </button>
              }
            />
            <div className="inline-form">
              <input
                type="email"
                value={roleEmail}
                onChange={(event) => setRoleEmail(event.target.value)}
                placeholder="team.member@example.com"
              />
              <select
                value={roleToAssign}
                onChange={(event) =>
                  setRoleToAssign(
                    event.target.value as "author" | "reviewer" | "user",
                  )
                }
              >
                <option value="author">Author</option>
                <option value="reviewer">Reviewer</option>
                <option value="user">User</option>
              </select>
              <button
                className="button secondary"
                disabled={busyStage === "saving"}
                onClick={assignRole}
              >
                <ShieldCheck size={15} /> Assign role
              </button>
            </div>
            {roleAssignments.length > 0 && (
              <div className="mapping-list">
                {roleAssignments.map((assignment) => (
                  <div key={assignment.id}>
                    <strong>{assignment.email}</strong>
                    <Status tone={assignment.enabled ? "good" : "neutral"}>
                      {assignment.role.toUpperCase()}
                    </Status>
                    <small>{assignment.enabled ? "Enabled" : "Disabled"}</small>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}
        <Card>
          <SectionHead
            eyebrow="Access boundary"
            title="Named server roles"
            description="The pilot-role text in Settings is descriptive only. Administrators assign author and reviewer access through the server-side role controls; administrator access itself comes only from the deployment allowlist."
          />
        </Card>
      </div>
    );
  };

  const renderConfigurationCatalogues = () => (
    <div className="page-stack">
      <Card>
        <SectionHead
          eyebrow="Complaint mapping"
          title="Map exact FFR complaint wording"
          description="These mappings control the product-family complaint scope. They never infer an unlisted subcategory and are saved as shared configuration."
        />
        <div className="mapping-list">
          {settings.complaintMappings.map((mapping) => (
            <div key={mapping.id}>
              <span>
                <strong>
                  {mapping.productFamily}:{mapping.categoryCode}
                  {mapping.subcategoryCode ? `:${mapping.subcategoryCode}` : ""}
                </strong>
                <small>{mapping.reason}</small>
              </span>
              <strong>{mapping.phrases.join(" · ")}</strong>
              {isAdmin && (
                <button
                  aria-label={`Remove ${mapping.phrases[0] ?? "complaint"} complaint mapping`}
                  onClick={() =>
                    setSettings((current) => ({
                      ...current,
                      complaintMappings: current.complaintMappings.filter(
                        (item) => item.id !== mapping.id,
                      ),
                    }))
                  }
                >
                  <X size={15} />
                </button>
              )}
            </div>
          ))}
        </div>
        {isAdmin && (
          <div className="inline-form">
            <select
              value={complaintFamily}
              onChange={(event) =>
                setComplaintFamily(event.target.value as ProductFamily)
              }
            >
              {productFamilyOptions().map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <input
              value={complaintPhrases}
              onChange={(event) => setComplaintPhrases(event.target.value)}
              placeholder="Exact phrase(s), comma-separated"
            />
            <input
              value={complaintCategory}
              onChange={(event) => setComplaintCategory(event.target.value)}
              placeholder="Category code"
            />
            <input
              value={complaintSubcategory}
              onChange={(event) => setComplaintSubcategory(event.target.value)}
              placeholder="Subcategory (optional)"
            />
            <input
              value={complaintReason}
              onChange={(event) => setComplaintReason(event.target.value)}
              placeholder="Why this mapping is permitted"
            />
            <button className="button secondary" onClick={addComplaintMapping}>
              <SlidersHorizontal size={15} /> Add mapping
            </button>
          </div>
        )}
      </Card>
      <Card>
        <SectionHead
          eyebrow="Adapter mapping"
          title="Declare direct versus contextual evidence"
          description="NIC and Gateway retain the Meter report as contextual evidence until an approved dedicated adapter is mapped. A direct mapping does not remove device/manual verification requirements from physical-condition complaints."
        />
        <div className="mapping-list">
          {settings.adapterMappings.map((mapping) => (
            <div key={mapping.id}>
              <span>
                <strong>{mapping.productFamily}</strong>
                <small>{mapping.description}</small>
              </span>
              <strong>{mapping.adapterId}</strong>
              <Status
                tone={mapping.evidenceMode === "direct" ? "good" : "warning"}
              >
                {mapping.evidenceMode === "direct" ? "DIRECT" : "CONTEXT ONLY"}
              </Status>
              {isAdmin && (
                <button
                  aria-label={`Remove ${mapping.productFamily} adapter mapping`}
                  onClick={() =>
                    setSettings((current) => ({
                      ...current,
                      adapterMappings: current.adapterMappings.filter(
                        (item) => item.id !== mapping.id,
                      ),
                    }))
                  }
                >
                  <X size={15} />
                </button>
              )}
            </div>
          ))}
        </div>
        {isAdmin && (
          <div className="inline-form">
            <select
              value={adapterFamily}
              onChange={(event) =>
                setAdapterFamily(event.target.value as ProductFamily)
              }
            >
              {productFamilyOptions().map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <input
              value={adapterKey}
              onChange={(event) => setAdapterKey(event.target.value)}
              placeholder="Adapter key"
            />
            <select
              value={adapterMode}
              onChange={(event) =>
                setAdapterMode(event.target.value as "direct" | "context_only")
              }
            >
              <option value="direct">Direct evidence</option>
              <option value="context_only">Context only</option>
            </select>
            <input
              value={adapterDescription}
              onChange={(event) => setAdapterDescription(event.target.value)}
              placeholder="Evidence boundary and verification requirement"
            />
            <button className="button secondary" onClick={addAdapterMapping}>
              <SlidersHorizontal size={15} /> Save mapping
            </button>
          </div>
        )}
      </Card>
      <Card>
        <SectionHead
          eyebrow="Adapter and feature definitions"
          title="Create an editable parsing catalogue draft"
          description="Use this controlled JSON editor for sheet/header mappings and derived features. An adapter remains contextual until its own reviewed version is released and a direct product-family mapping explicitly selects it."
          action={
            <Status tone={canDraft ? "good" : "warning"}>
              {canDraft ? "AUTHOR DRAFTS ENABLED" : "VIEW ONLY"}
            </Status>
          }
        />
        <div className="inline-form">
          <select
            disabled={!canDraft}
            value={catalogueEditorKind}
            onChange={(event) => {
              const next = event.target.value as CatalogueEditorKind;
              setCatalogueEditorKind(next);
              setCatalogueEditorJson(
                JSON.stringify(catalogueDraftTemplate(next), null, 2),
              );
            }}
          >
            <option value="adapter">Adapter definition</option>
            <option value="feature">Feature definition</option>
          </select>
          <button
            className="button secondary"
            disabled={!canDraft || busyStage === "saving"}
            onClick={() => void saveCatalogueDefinitionDraft()}
          >
            <Save size={15} /> Create governed draft
          </button>
        </div>
        <label className="rule-expression">
          {catalogueEditorKind === "adapter"
            ? "Adapter definition JSON"
            : "Feature definition JSON"}
          <textarea
            disabled={!canDraft}
            value={catalogueEditorJson}
            onChange={(event) => setCatalogueEditorJson(event.target.value)}
          />
        </label>
        <p className="helper-text">
          The seed is a template, not fixed application logic. Edit it, submit
          it for independent review in Governance, release it, then save the
          corresponding direct/context-only mapping above.
        </p>
      </Card>
      <Card>
        <SectionHead
          eyebrow="AI provider"
          title="Provider and model references"
          description="Credentials are never entered or stored in the browser. A deployment administrator configures secret references separately; these fields document the configured provider and model choice."
        />
        <div className="form-grid">
          <label>
            Provider
            <input
              disabled={!isAdmin}
              value={settings.ai.provider}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  ai: { ...current.ai, provider: event.target.value },
                }))
              }
              placeholder="Not configured"
            />
          </label>
          <label>
            Reasoning model
            <input
              disabled={!isAdmin}
              value={settings.ai.reasoningModel}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  ai: { ...current.ai, reasoningModel: event.target.value },
                }))
              }
              placeholder="Not configured"
            />
          </label>
          <label>
            Vision model
            <input
              disabled={!isAdmin}
              value={settings.ai.visionModel}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  ai: { ...current.ai, visionModel: event.target.value },
                }))
              }
              placeholder="Not configured"
            />
          </label>
          <label>
            Credential reference
            <input
              disabled={!isAdmin}
              value={settings.ai.credentialReference}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  ai: {
                    ...current.ai,
                    credentialReference: event.target.value,
                  },
                }))
              }
              placeholder="Server-side secret reference only"
            />
          </label>
        </div>
      </Card>
    </div>
  );

  const renderTechnicalPolicy = () =>
    dlms?.analysis ? (
      <Card>
        <SectionHead
          eyebrow="Finding policy"
          title="Provisional finding — review required"
          description={`${dlms.analysis.scope.message} Technical DLMS checks may describe electrical context only. They never approve RCA/CAPA, and physical-condition complaints never receive a claimed physical root cause from DLMS evidence.`}
        />
      </Card>
    ) : null;

  const renderUnmatchedImageStage = () =>
    dlms && !validDlms ? (
      <UploadStage
        title="4. Upload image evidence as unassigned context"
        description="You may preserve image evidence after an identity mismatch, but it remains unassigned and cannot support a customer-case conclusion until the exact meter identity is corrected."
        buttonText={
          busyStage === "images"
            ? "Checking image evidence…"
            : "Attach unassigned meter images"
        }
        accept=".png,.jpg,.jpeg,.webp"
        multiple
        onChange={handleImageUpload}
      >
        {images && (
          <div className="artifact-grid">
            {images.artifacts.map((artifact) => (
              <ArtifactSummary key={artifact.id} artifact={artifact} />
            ))}
          </div>
        )}
      </UploadStage>
    ) : null;

  const renderInitialRulePolicy = () => (
    <Card>
      <SectionHead
        eyebrow="Shared rule library"
        title="Rule bundle readiness"
        description="The generic 60-check rule bundle is provisional and source-linked. Rule bundle changes require a governed draft, independent review, and release; every result remains a Provisional finding — review required."
      />
    </Card>
  );

  const content: Record<Page, ReactNode> = {
    analysis: (
      <>
        {!sharedAnalysisReady && (
          <div className="callout warning">
            <LockKeyhole size={19} />
            <div>
              <strong>Shared configuration required</strong>
              <p>{sharedAnalysisMessage}</p>
            </div>
          </div>
        )}
        {renderAnalysis()}
        {renderInitialRulePolicy()}
        {renderUnmatchedImageStage()}
        {renderTechnicalPolicy()}
      </>
    ),
    session: renderSession(),
    rules: renderRules(),
    readiness: (
      <>
        {renderReadiness()}
        {renderGovernanceControls()}
      </>
    ),
    settings: (
      <>
        {renderSettings()}
        {renderConfigurationCatalogues()}
      </>
    ),
  };

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to case intake
      </a>
      <aside className="sidebar">
        <div className="brand">
          {settings.branding.logoDataUrl ? (
            <img
              className="brand-logo-image"
              src={settings.branding.logoDataUrl}
              alt="Organisation logo"
            />
          ) : (
            <div className="brand-wordmark">Kimbal</div>
          )}
          <div>
            <strong>Kimbal</strong>
            <span>FFR Intelligence</span>
          </div>
        </div>
        <div className="pilot-chip">
          <Layers3 size={14} /> Shared provisional rule pilot
        </div>
        <nav aria-label="Primary navigation">
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <button
                aria-current={page === item.id ? "page" : undefined}
                className={page === item.id ? "active" : ""}
                key={item.id}
                onClick={() => setPage(item.id)}
              >
                <Icon size={18} />
                <span>
                  <strong>{item.label}</strong>
                  <small>{item.description}</small>
                </span>
              </button>
            );
          })}
        </nav>
        <div className="sidebar-note">
          <ShieldCheck size={16} />
          <span>
            <strong>Exact identity before case inference</strong>
            <small>
              Technical DLMS findings can run first; customer-case conclusions
              need a matched meter.
            </small>
          </span>
        </div>
      </aside>
      <main className="main" id="main-content">
        <header className="topbar">
          <div>
            <span>Private pilot workspace</span>
            <strong>Staged evidence and governed rules</strong>
          </div>
          <div className="topbar-status">
            <Status tone={governance.mode === "ready" ? "good" : "warning"}>
              {governance.mode === "ready"
                ? "Shared configuration"
                : "Governance setup"}
            </Status>
            <span>{bundle.version}</span>
          </div>
        </header>
        <div className="content">
          {notice && (
            <div className="notice" aria-live="polite">
              <Info size={16} />
              <span>{notice}</span>
              <button
                aria-label="Dismiss notification"
                onClick={() => setNotice("")}
              >
                <X size={15} />
              </button>
            </div>
          )}
          {content[page]}
        </div>
      </main>
    </div>
  );
}
