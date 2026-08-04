import type {
  RuleBundleDocument,
  RuleExpression,
  RuleLifecycleStatus,
  SharedSettingsDocument,
} from "./governance-types";

const MAX_DOCUMENT_BYTES = 1_000_000;

export const DEFAULT_SHARED_SETTINGS: SharedSettingsDocument = {
  schemaVersion: "governance-settings-v1",
  branding: {
    logoObjectKey: null,
    logoUrl: null,
    altText: "Kimbal logo",
  },
  // Raw technical evidence is deliberately opt-in and disabled by default.
  evidenceRetention: {
    enabled: false,
    retentionDays: null,
  },
  productMappings: [],
  complaintMappings: [],
  adapterMappings: [],
  thresholds: {},
  ai: {
    provider: null,
    model: null,
    credentialsConfigured: false,
  },
};

const LIFECYCLE_TRANSITIONS: Record<RuleLifecycleStatus, RuleLifecycleStatus[]> = {
  draft: ["in_review"],
  in_review: ["draft", "provisional_active", "approved_active"],
  provisional_active: ["retired"],
  approved_active: ["retired"],
  retired: [],
};

export function canTransitionRuleVersion(
  from: RuleLifecycleStatus,
  to: RuleLifecycleStatus,
): boolean {
  return LIFECYCLE_TRANSITIONS[from]?.includes(to) ?? false;
}

export function isPublishedRuleVersion(status: RuleLifecycleStatus): boolean {
  return status === "provisional_active" || status === "approved_active" || status === "retired";
}

export function isReviewApproval(status: RuleLifecycleStatus): boolean {
  return status === "provisional_active" || status === "approved_active";
}

export function cloneDefaultSharedSettings(): SharedSettingsDocument {
  return JSON.parse(JSON.stringify(DEFAULT_SHARED_SETTINGS)) as SharedSettingsDocument;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function stableStringify(value: unknown): string {
  const normalise = (candidate: unknown): unknown => {
    if (Array.isArray(candidate)) return candidate.map(normalise);
    if (!isRecord(candidate)) return candidate;
    return Object.keys(candidate)
      .sort()
      .reduce<Record<string, unknown>>((result, key) => {
        result[key] = normalise(candidate[key]);
        return result;
      }, {});
  };
  return JSON.stringify(normalise(value));
}

export function parseJsonRecord(value: string, label: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!isRecord(parsed)) throw new Error("not an object");
    return parsed;
  } catch {
    throw new Error(`${label} is not a valid JSON object.`);
  }
}

export function validateSharedSettings(value: unknown): SharedSettingsDocument {
  if (!isRecord(value)) throw new Error("Shared settings must be a JSON object.");
  const text = stableStringify(value);
  if (new TextEncoder().encode(text).byteLength > MAX_DOCUMENT_BYTES) {
    throw new Error("Shared settings exceed the 1 MB configuration limit.");
  }

  const branding = isRecord(value.branding) ? value.branding : {};
  const retention = isRecord(value.evidenceRetention) ? value.evidenceRetention : {};
  const ai = isRecord(value.ai) ? value.ai : {};
  const retentionDays = retention.retentionDays;
  if (
    retentionDays !== null &&
    retentionDays !== undefined &&
    (!Number.isInteger(retentionDays) || Number(retentionDays) < 1 || Number(retentionDays) > 3650)
  ) {
    throw new Error("Evidence retention days must be a whole number between 1 and 3650, or null.");
  }

  return {
    ...value,
    schemaVersion:
      typeof value.schemaVersion === "string" ? value.schemaVersion : "governance-settings-v1",
    branding: {
      ...branding,
      logoObjectKey: typeof branding.logoObjectKey === "string" ? branding.logoObjectKey : null,
      logoUrl: typeof branding.logoUrl === "string" ? branding.logoUrl : null,
      altText: typeof branding.altText === "string" && branding.altText.trim() ? branding.altText.trim() : "Kimbal logo",
    },
    evidenceRetention: {
      enabled: retention.enabled === true,
      retentionDays: Number.isInteger(retentionDays) ? Number(retentionDays) : null,
    },
    productMappings: Array.isArray(value.productMappings) ? value.productMappings : [],
    complaintMappings: Array.isArray(value.complaintMappings) ? value.complaintMappings : [],
    adapterMappings: Array.isArray(value.adapterMappings) ? value.adapterMappings : [],
    thresholds: isRecord(value.thresholds) ? value.thresholds : {},
    ai: {
      provider: typeof ai.provider === "string" && ai.provider.trim() ? ai.provider.trim() : null,
      model: typeof ai.model === "string" && ai.model.trim() ? ai.model.trim() : null,
      credentialsConfigured: ai.credentialsConfigured === true,
    },
  } as SharedSettingsDocument;
}

export function validateRuleExpression(value: unknown, path = "when"): string[] {
  if (!isRecord(value) || typeof value.kind !== "string") return [`${path} must be a rule expression.`];
  if (value.kind === "predicate") {
    const errors: string[] = [];
    if (typeof value.feature !== "string" || !value.feature.trim()) errors.push(`${path}.feature is required.`);
    if (typeof value.operator !== "string" || !value.operator.trim()) errors.push(`${path}.operator is required.`);
    return errors;
  }
  if (value.kind === "all" || value.kind === "any") {
    if (!Array.isArray(value.clauses) || value.clauses.length === 0) return [`${path}.clauses must contain at least one expression.`];
    return value.clauses.flatMap((clause, index) => validateRuleExpression(clause, `${path}.clauses[${index}]`));
  }
  if (value.kind === "not") return validateRuleExpression(value.clause, `${path}.clause`);
  return [`${path}.kind must be predicate, all, any, or not.`];
}

export function validateRuleBundleDocument(value: unknown): RuleBundleDocument {
  if (!isRecord(value)) throw new Error("Rule bundle content must be a JSON object.");
  const errors: string[] = [];
  const bundleKey = typeof value.bundleKey === "string" ? value.bundleKey.trim() : "";
  const title = typeof value.title === "string" ? value.title.trim() : "";
  const productFamily = typeof value.productFamily === "string" ? value.productFamily.trim() : "";
  const scopeKey = typeof value.scopeKey === "string" ? value.scopeKey.trim() : "";
  const rules = Array.isArray(value.rules) ? value.rules : null;
  if (!bundleKey) errors.push("bundleKey is required.");
  if (!title) errors.push("title is required.");
  if (!productFamily) errors.push("productFamily is required.");
  if (!scopeKey) errors.push("scopeKey is required.");
  if (!rules) errors.push("rules must be an array.");

  if (rules) {
    const ids = new Set<string>();
    rules.forEach((rule, index) => {
      if (!isRecord(rule)) {
        errors.push(`rules[${index}] must be an object.`);
        return;
      }
      if (typeof rule.id !== "string" || !rule.id.trim()) errors.push(`rules[${index}].id is required.`);
      if (typeof rule.id === "string") {
        if (ids.has(rule.id)) errors.push(`rules[${index}].id duplicates ${rule.id}.`);
        ids.add(rule.id);
      }
      if (typeof rule.title !== "string" || !rule.title.trim()) errors.push(`rules[${index}].title is required.`);
      errors.push(...validateRuleExpression(rule.when, `rules[${index}].when`));
      if (!isRecord(rule.finding) || typeof rule.finding.code !== "string" || !rule.finding.code.trim()) {
        errors.push(`rules[${index}].finding.code is required.`);
      }
    });
  }

  const text = stableStringify(value);
  if (new TextEncoder().encode(text).byteLength > MAX_DOCUMENT_BYTES) {
    errors.push("Rule bundle exceeds the 1 MB configuration limit.");
  }
  if (errors.length) throw new Error(errors.join(" "));

  return {
    ...value,
    schemaVersion: typeof value.schemaVersion === "string" ? value.schemaVersion : "rule-bundle-v1",
    bundleKey,
    title,
    productFamily,
    scopeKey,
    rules: rules ?? [],
  } as RuleBundleDocument;
}

export function asRuleExpression(value: unknown): RuleExpression {
  const errors = validateRuleExpression(value);
  if (errors.length) throw new Error(errors.join(" "));
  return value as RuleExpression;
}
