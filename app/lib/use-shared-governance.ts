"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import {
  bcs16SheetAdapter,
  defaultProvisionalRuleProfile,
  genericProvisionalBundle,
  type AdapterDefinition,
  type ProvisionalRuleProfile,
  type RuleBundle,
  type RuleDefinition,
} from "./dlms-analysis";
import { defaultSettings } from "./pilot-config";
import type { AppSettings } from "./pilot-types";

/**
 * Rule bundle drafts, catalogue drafts, and audit/role data are read and
 * acted on from three different screens (rule library, governance, settings)
 * — they are not cleanly separable per-page state. This hook is the shared
 * home for that state and its handlers, duplicated independently by each
 * page component per this project's no-shared-context convention.
 */

export type GovernanceMode = "loading" | "ready" | "setup" | "unavailable";

export type GovernanceState = {
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

export type CatalogueEntityType = "profile" | "adapter" | "feature";
export type CatalogueDraft = {
  entityType: CatalogueEntityType;
  entityKey: string;
  version: number;
  lifecycle: string;
};
export type CatalogueEditorKind = "adapter" | "feature";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function textValue(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function catalogueDraftTemplate(kind: CatalogueEditorKind) {
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

function sharedDocument(settings: AppSettings, profile: ProvisionalRuleProfile) {
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

export function useSharedGovernance() {
  const [settings, setSettings] = useState<AppSettings>(() => hydrateSettings());
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
  const [busyStage, setBusyStage] = useState<"saving" | null>(null);
  const [notice, setNotice] = useState("");
  const [catalogueDraft, setCatalogueDraft] = useState<CatalogueDraft | null>(
    null,
  );
  const [catalogueRollbackVersion, setCatalogueRollbackVersion] = useState("");
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

  const isAdmin = governance.mode === "ready" && governance.role === "admin";
  const canDraft =
    governance.mode === "ready" &&
    (governance.role === "admin" || governance.role === "author");
  const canReview =
    governance.mode === "ready" &&
    (governance.role === "admin" || governance.role === "reviewer");
  const canPublish = governance.mode === "ready" && governance.role === "admin";

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
        setGovernance((current) => ({
          ...current,
          mode: "ready",
          role,
          message:
            current.activeBundle && current.activeProfile
              ? current.message
              : role === "admin"
                ? "Shared governance is ready. You can create governed configuration drafts."
                : "Shared rule configuration is loaded. Only named administrators can change it.",
          settingsVersion:
            typeof settingsRecord?.version === "number"
              ? settingsRecord.version
              : current.settingsVersion,
        }));
        setConfigurationEpoch((current) => current + 1);
      } catch {
        if (!cancelled)
          setGovernance((current) => ({
            ...current,
            mode: current.mode === "ready" ? "ready" : "unavailable",
            role: current.role,
            message:
              "Shared governance is unavailable. Intake remains disabled until the released shared configuration can be loaded.",
          }));
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
          setGovernance((current) => ({
            ...current,
            activeBundle: null,
            activeProfile: null,
            message:
              "Shared governance is available, but no released analysis configuration can be used yet.",
          }));
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
        setGovernance((current) => ({
          ...current,
          mode: current.mode === "loading" ? "ready" : current.mode,
          settingsVersion:
            typeof settingsRecord.version === "number"
              ? settingsRecord.version
              : current.settingsVersion,
          activeBundle: sharedBundle?.meta ?? current.activeBundle ?? null,
          activeProfile: sharedProfile?.meta ?? current.activeProfile ?? null,
          adapterCount: activeAdapters.length,
          featureCount: arrayValue(payload.features).length,
          message:
            sharedBundle && sharedProfile
              ? "Shared active configuration loaded. Drafts cannot change a live analysis until review and release."
              : "Shared governance is available, but no released rule bundle and profile can be used for intake yet.",
        }));
      } catch {
        if (!cancelled) {
          setGovernance((current) => ({
            ...current,
            activeBundle: null,
            activeProfile: null,
            message:
              "The shared released configuration could not be loaded. Intake remains disabled.",
          }));
        }
      }
    };
    void loadActiveConfiguration();
    return () => {
      cancelled = true;
    };
  }, [configurationEpoch]);

  const updateRule = (ruleId: string, changes: Partial<RuleDefinition>) => {
    setBundle((current) => ({
      ...current,
      rules: current.rules.map((rule) =>
        rule.id === ruleId ? { ...rule, ...changes } : rule,
      ),
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

  const importBundle = (
    event: ChangeEvent<HTMLInputElement>,
    onImported?: (ruleId: string | null) => void,
  ) => {
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
        onImported?.(parsed.bundle.rules[0]?.id ?? null);
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

  const saveCatalogueDefinitionDraft = async (
    catalogueEditorKind: CatalogueEditorKind,
    catalogueEditorJson: string,
  ) => {
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

  return {
    settings,
    setSettings,
    profile,
    setProfile,
    bundle,
    sharedAdapters,
    governance,
    isAdmin,
    canDraft,
    canReview,
    canPublish,
    busyStage,
    notice,
    setNotice,
    catalogueDraft,
    catalogueRollbackVersion,
    setCatalogueRollbackVersion,
    rollbackVersion,
    setRollbackVersion,
    auditEvents,
    roleEmail,
    setRoleEmail,
    roleToAssign,
    setRoleToAssign,
    roleAssignments,
    updateRule,
    downloadBundle,
    importBundle,
    saveSharedConfiguration,
    saveRuleDraft,
    transitionDraft,
    transitionCatalogueDraft,
    publishCatalogueDraft,
    rollbackCatalogueDraft,
    saveCatalogueDefinitionDraft,
    publishDraft,
    rollbackRuleBundle,
    refreshAuditEvents,
    refreshRoleAssignments,
    assignRole,
    handleLogoUpload,
  };
}
