export type ProductFamily = "METER" | "NIC" | "GATEWAY";

export type ArtifactKind = "FFR_REGISTER" | "DLMS_PACKAGE" | "IMAGE" | "UNRECOGNIZED";

export type IdentityState =
  | "AWAITING_FILES"
  | "IDENTITY_NO_MATCH"
  | "IDENTITY_AMBIGUOUS"
  | "READY_TO_ANALYZE";

export type IntakeException =
  | "MULTIPLE_FFR_REGISTERS"
  | "MULTIPLE_DLMS_PACKAGES"
  | "MISSING_REQUIRED_WORKBOOK"
  | "UNRECOGNIZED_FILE"
  | "IDENTITY_NO_MATCH";

export type RuleStatus = "draft" | "in_review" | "active" | "provisional_active" | "approved_active" | "retired";

export type RuleOperator = "exists" | "equals" | "gte" | "lte";

export interface ProductFamilyMapping {
  id: string;
  sourceField: "Meter type" | "Old_Meter_Type";
  sourceValue: string;
  productFamily: ProductFamily;
  basis: string;
}

/**
 * Complaint wording is configuration data. It is seeded from the supplied
 * catalogue, persisted with shared Settings, and never inferred by an AI.
 */
export interface ComplaintMapping {
  id: string;
  productFamily: ProductFamily;
  phrases: string[];
  categoryCode: string;
  subcategoryCode: string | null;
  reason: string;
}

/**
 * Declares whether an uploaded BCS/DLMS workbook is direct evidence for a
 * product family or merely Meter context pending a dedicated adapter.
 */
export interface AdapterMapping {
  id: string;
  productFamily: ProductFamily;
  adapterId: string;
  evidenceMode: "direct" | "context_only";
  description: string;
}

export interface AppSettings {
  productMappings: ProductFamilyMapping[];
  complaintMappings: ComplaintMapping[];
  adapterMappings: AdapterMapping[];
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
  branding: {
    logoDataUrl: string | null;
    logoFileName: string | null;
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
  provenance?: {
    sheet: string;
    locator: string;
    artifactName: string;
  };
  dataQuality?: "normal" | "warning";
}

export interface UploadedArtifact {
  id: string;
  name: string;
  size: number;
  kind: ArtifactKind;
  detail: string;
  sha256: string | null;
}

export interface FfrRow {
  rowNumber: number;
  values: Record<string, string>;
  labels: Record<string, string>;
}

export interface FfrRegisterInspection {
  artifact: UploadedArtifact;
  sheetName: string;
  rows: FfrRow[];
  fields: Array<{ key: string; label: string }>;
  messages: string[];
}

export interface DlmsInspection {
  artifact: UploadedArtifact;
  meterId: string | null;
  expectedMeterId: string;
  identityState: "READY_TO_ANALYZE" | "IDENTITY_NO_MATCH" | "AWAITING_FILES";
  features: DerivedFeature[];
  analysis?: import("./dlms-analysis").DlmsAnalysis;
  messages: string[];
}

export interface ImageInspection {
  artifacts: UploadedArtifact[];
  messages: string[];
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
