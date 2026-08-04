import { isRecord, validateRuleBundleDocument } from "./governance-contract";
import type { RuleBundleDocument, RuleDefinition, RuleExpression } from "./governance-types";

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim())
    : [];
}

function severity(value: unknown): "info" | "warning" | "critical" {
  if (value === "high" || value === "critical") return "critical";
  if (value === "warning") return "warning";
  return "info";
}

function externalExpression(value: unknown): RuleExpression {
  if (!isRecord(value)) {
    return { kind: "predicate", feature: "unmapped.expression", operator: "exists", explanation: "The imported expression was incomplete." };
  }
  if (Array.isArray(value.all)) {
    return { kind: "all", clauses: value.all.map(externalExpression) };
  }
  if (Array.isArray(value.any)) {
    return { kind: "any", clauses: value.any.map(externalExpression) };
  }
  if (isRecord(value.not)) {
    return { kind: "not", clause: externalExpression(value.not) };
  }
  return {
    kind: "predicate",
    feature: text(value.fact, "unmapped.expression"),
    operator: text(value.operator, "exists"),
    ...(value.value !== undefined ? { value: value.value } : {}),
    ...(typeof value.parameter === "string" ? { parameter: value.parameter } : {}),
    ...(typeof value.lowerParameter === "string" ? { lowerParameter: value.lowerParameter } : {}),
    ...(typeof value.upperParameter === "string" ? { upperParameter: value.upperParameter } : {}),
  };
}

/**
 * Converts the serializable 60-check DLMS bundle used by the current client
 * into the canonical server-owned bundle document. The original expression and
 * fields are retained as metadata so a future evaluator can use them directly.
 */
export function adaptDlmsRuleBundle(value: unknown): RuleBundleDocument {
  if (!isRecord(value)) return validateRuleBundleDocument(value);
  const candidate = isRecord(value.bundle) ? value.bundle : value;
  if (
    typeof candidate.bundleKey === "string" &&
    typeof candidate.scopeKey === "string" &&
    Array.isArray(candidate.rules)
  ) {
    return validateRuleBundleDocument(candidate);
  }
  if (!Array.isArray(candidate.rules)) return validateRuleBundleDocument(candidate);

  const productFamilies = stringList(candidate.productFamilies);
  const bundleKey = text(candidate.id, "generic-provisional-v1");
  const productFamily = productFamilies.length === 1 ? productFamilies[0] : "MULTI";
  const scopeKey = `DLMS:${bundleKey}`;
  const document: RuleBundleDocument = {
    schemaVersion: "rule-bundle-v1",
    bundleKey,
    title: text(candidate.title, bundleKey),
    productFamily,
    scopeKey,
    description: text(candidate.summary),
    adapterId: text(candidate.adapterId),
    profileId: text(candidate.profileId),
    productFamilies,
    sourceVersion: text(candidate.version),
    sourceLifecycle: text(candidate.lifecycle, "draft"),
    limitation: text(candidate.limitation),
    rules: candidate.rules.map((item, index) => {
      const rule = isRecord(item) ? item : {};
      const id = text(rule.id, `IMPORTED-${index + 1}`);
      const title = text(rule.title, id);
      return {
        ...rule,
        id,
        title,
        enabled: rule.enabled !== false,
        complaintKeys: stringList(rule.complaintKeys),
        productFamilies: stringList(rule.productFamilies),
        when: externalExpression(rule.expression),
        finding: {
          code: id,
          label: title,
          severity: severity(rule.severity),
          whyItRan: text(rule.why),
          limitation: text(rule.limitation),
          recommendedAction: text(rule.followUp),
        },
        sourceExpression: rule.expression ?? null,
      } as RuleDefinition;
    }),
  };
  return validateRuleBundleDocument(document);
}
