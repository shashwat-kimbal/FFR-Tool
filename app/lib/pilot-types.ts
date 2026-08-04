export type ProductFamily = "METER" | "NIC" | "GATEWAY";

export type ArtifactKind = "FFR_REGISTER" | "DLMS_PACKAGE" | "IMAGE" | "UNRECOGNIZED";

export type IdentityState =
  | "AWAITING_FILES"
  | "IDENTITY_NO_MATCH"
  | "IDENTITY_AMBIGUOUS"
  | "READY_TO_ANALYZE";

export type RuleStatus = "draft" | "active" | "retired";

export type RuleOperator = "exists" | "equals" | "gte" | "lte";

export interface ProductFamilyMapping {
  id: string;
  sourceField: "Meter type" | "Old_Meter_Type";
  sourceValue: string;
  productFamily: ProductFamily;
  basis: string;
}

export interface AppSettings {
  productMappings: ProductFamilyMapping[];
  retentionDays: number;
  uploadMaxMb: number;
  ai: {
    provider: string;
    credentialReference: string;
    visionEnabled: boolean;
    visionModel: string;
    reasoningModel: string;
  };
  pilotAccess: {
    mode: string;
    approvedRoles: string[];
  };
  rcaTemplate: string;
  capaTemplate: string;
}

export interface RuleCondition {
  feature: string;
  operator: RuleOperator;
  value?: string;
}

export interface DiagnosticRule {
  id: string;
  version: string;
  title: string;
  purpose: string;
  status: RuleStatus;
  productFamilies: ProductFamily[];
  complaintKeys: string[];
  requiredFeatures: string[];
  conditions: RuleCondition[];
  hypothesisCode: string;
  hypothesisLabel: string;
  weight: number;
  requiredFollowUp: string;
  allowedOutcome: string;
  limitation: string;
  analystExplanation: string;
  reportSafeExplanation: string;
  owner: string;
  reviewer: string;
}

export interface DerivedFeature {
  code: string;
  label: string;
  value: string | number | boolean;
  source: string;
  dataQuality?: "normal" | "warning";
}

export interface UploadedArtifact {
  id: string;
  name: string;
  size: number;
  kind: ArtifactKind;
  detail: string;
}

export interface FfrRow {
  rowNumber: number;
  values: Record<string, string>;
}

export interface AnalysisPackage {
  artifacts: UploadedArtifact[];
  ffrRows: FfrRow[];
  dlmsMeterId: string | null;
  dlmsFeatures: DerivedFeature[];
  imageCount: number;
  identityState: IdentityState;
  matchedRow: FfrRow | null;
  productFamily: ProductFamily | null;
  complaintKey: string | null;
  complaintLabel: string | null;
  messages: string[];
}

export interface RuleEvaluation {
  rule: DiagnosticRule;
  applicable: boolean;
  conditionResults: Array<RuleCondition & { passed: boolean; actual: string }>;
  summary: string;
}
