/** Shared, server-governed configuration types. No browser-local setting is authoritative. */

export const RULE_LIFECYCLE_STATUSES = [
  "draft",
  "in_review",
  "provisional_active",
  "approved_active",
  "retired",
] as const;

export type RuleLifecycleStatus = (typeof RULE_LIFECYCLE_STATUSES)[number];

export const GOVERNANCE_ROLES = ["user", "author", "reviewer", "admin"] as const;
export type GovernanceRole = (typeof GOVERNANCE_ROLES)[number];

export type ProductFamilyScope = "METER" | "NIC" | "GATEWAY" | "MULTI" | string;

export type FeatureValueType = "number" | "string" | "boolean" | "timestamp" | "duration" | "enum";

export type FeatureDefinition = {
  code: string;
  label: string;
  productFamily: ProductFamilyScope;
  adapterKey: string;
  valueType: FeatureValueType;
  unit?: string;
  description?: string;
  source?: string;
  enabled?: boolean;
  [key: string]: unknown;
};

export type RulePredicate = {
  kind: "predicate";
  feature: string;
  operator: string;
  value?: unknown;
  unit?: string;
  source?: string;
  explanation?: string;
  parameter?: string;
  lowerParameter?: string;
  upperParameter?: string;
};

export type RuleExpression =
  | RulePredicate
  | { kind: "all" | "any"; clauses: RuleExpression[]; explanation?: string }
  | { kind: "not"; clause: RuleExpression; explanation?: string };

export type RuleDefinition = {
  id: string;
  title: string;
  enabled?: boolean;
  category?: string;
  complaintKeys?: string[];
  requiredFeatures?: string[];
  when: RuleExpression;
  finding: {
    code: string;
    label: string;
    severity?: "info" | "warning" | "critical";
    whyItRan?: string;
    limitation?: string;
    recommendedAction?: string;
  };
  references?: Array<{ source: string; locator?: string; note?: string }>;
  [key: string]: unknown;
};

export type RuleBundleDocument = {
  schemaVersion: "rule-bundle-v1" | string;
  bundleKey: string;
  title: string;
  productFamily: ProductFamilyScope;
  scopeKey: string;
  description?: string;
  features?: FeatureDefinition[];
  rules: RuleDefinition[];
  notes?: string;
  [key: string]: unknown;
};

export type RuleBundleVersionRecord = {
  id: string;
  bundleId: string;
  bundleKey: string;
  title: string;
  productFamily: ProductFamilyScope;
  scopeKey: string;
  version: number;
  lifecycleStatus: RuleLifecycleStatus;
  content: RuleBundleDocument;
  contentHash: string;
  createdAt: string;
  createdByUserId: string;
  createdByEmail: string;
  updatedAt: string;
  reviewedAt: string | null;
  reviewedByUserId: string | null;
  reviewedByEmail: string | null;
  reviewNote: string | null;
  contentLockedAt: string | null;
};

export type RuleProfile = {
  id: string;
  profileKey: string;
  title: string;
  productFamily: ProductFamilyScope;
  version: number;
  lifecycleStatus: RuleLifecycleStatus;
  isProvisional: boolean;
  enabled: boolean;
  scope: Record<string, unknown>;
  values: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type AdapterDefinition = {
  id: string;
  adapterKey: string;
  title: string;
  productFamily: ProductFamilyScope;
  version: number;
  lifecycleStatus: RuleLifecycleStatus;
  enabled: boolean;
  definition: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type EvaluationFinding = {
  ruleId: string;
  status: "matched" | "not_matched" | "not_run" | "context_only";
  value?: unknown;
  source?: string;
  threshold?: unknown;
  whyItRan?: string;
  limitation?: string;
  [key: string]: unknown;
};

export type EvaluationSummary = {
  status: "provisional" | "blocked" | "complete" | "failed";
  title?: string;
  findings: EvaluationFinding[];
  messages?: string[];
  [key: string]: unknown;
};

export type SharedSettingsDocument = {
  schemaVersion: "governance-settings-v1" | string;
  branding: {
    logoObjectKey: string | null;
    logoUrl: string | null;
    altText: string;
    updatedAt?: string;
  };
  evidenceRetention: {
    enabled: boolean;
    retentionDays: number | null;
  };
  productMappings: unknown[];
  complaintMappings: unknown[];
  adapterMappings: unknown[];
  thresholds: Record<string, unknown>;
  ai: {
    provider: string | null;
    model: string | null;
    credentialsConfigured: boolean;
  };
  [key: string]: unknown;
};

export type SettingsRecord = {
  key: "shared_settings";
  value: SharedSettingsDocument;
  version: number;
  updatedAt: string;
  updatedByUserId: string | null;
  updatedByEmail: string | null;
};

export type RunSummary = {
  id: string;
  caseRef: string | null;
  meterSerial: string | null;
  productFamily: ProductFamilyScope;
  identityStatus: string;
  bundleId: string | null;
  bundleVersion: number | null;
  profileKey: string | null;
  profileVersion: number | null;
  adapterKey: string | null;
  adapterVersion: number | null;
  resultStatus: string;
  findingsCount: number;
  summary: EvaluationSummary;
  rawEvidenceRetained: false;
  createdAt: string;
};

export type GovernanceActor = {
  userId: string;
  email: string;
  displayName: string;
};

export type GovernanceAuditEvent = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  detail: Record<string, unknown>;
  actorUserId: string | null;
  actorEmail: string | null;
  createdAt: string;
};

/** Repository fixture metadata only; source evidence bytes are never copied to D1. */
export type GovernanceFixture = {
  id: string;
  fixtureKey: string;
  title: string;
  fixtureType: "FFR_REGISTER" | "DLMS_REPORT" | "IMAGE_SET" | string;
  sourceReference: string;
  metadata: Record<string, unknown>;
  lifecycleStatus: RuleLifecycleStatus;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};
