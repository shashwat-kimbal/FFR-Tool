import type { DerivedFeature, DiagnosticRule, ProductFamily, RuleEvaluation } from "./pilot-types";

function asText(value: string | number | boolean | undefined) {
  return value === undefined ? "Not available" : String(value);
}

/**
 * Checks whether a rule contains enough information for a browser-local test.
 * This is deliberately not an approval check: genuine publication requires
 * server-side approval records, immutable versioning, fixtures and audit.
 */
export function ruleInputGaps(rule: DiagnosticRule) {
  const gaps: string[] = [];
  if (!rule.id.trim() || rule.id === "PRODUCT-COMPLAINT-SIGNAL-NNN") gaps.push("a stable rule ID");
  if (!rule.version.trim()) gaps.push("a version");
  if (!rule.title.trim() || rule.title.startsWith("Replace with")) gaps.push("an engineering rule title");
  if (!rule.purpose.trim() || rule.purpose.startsWith("Explain the")) gaps.push("the rule purpose");
  if (!rule.productFamilies.length) gaps.push("at least one product family");
  if (!rule.complaintKeys.length) gaps.push("at least one complaint key");
  if (!rule.requiredFeatures.length) gaps.push("at least one required feature");
  if (!rule.conditions.length || rule.conditions.some((condition) => !condition.feature.trim() || (condition.operator !== "exists" && !String(condition.value ?? "").trim()))) {
    gaps.push("complete evidence conditions");
  }
  if (rule.conditions.some((condition) => condition.feature.trim() && !rule.requiredFeatures.includes(condition.feature.trim()))) {
    gaps.push("condition features listed as required features");
  }
  if (!rule.hypothesisCode.trim() || !rule.hypothesisLabel.trim()) gaps.push("a hypothesis effect");
  if (!Number.isFinite(rule.weight)) gaps.push("a numeric weight");
  if (!rule.requiredFollowUp.trim()) gaps.push("a required follow-up");
  if (!rule.allowedOutcome.trim()) gaps.push("an allowed outcome");
  if (!rule.limitation.trim()) gaps.push("a stop policy / limitation");
  if (!rule.analystExplanation.trim() || !rule.reportSafeExplanation.trim()) gaps.push("analyst and report-safe explanations");
  if (!rule.owner.trim() || rule.owner === "Unassigned") gaps.push("an engineering owner");
  if (!rule.reviewer.trim() || rule.reviewer === "Unassigned") gaps.push("an independent reviewer");
  return gaps;
}

export function evaluateRules(
  rules: DiagnosticRule[],
  productFamily: string | null,
  complaintKey: string | null,
  features: DerivedFeature[],
): RuleEvaluation[] {
  const featureMap = new Map(features.map((feature) => [feature.code, feature.value]));
  return rules.map((rule) => {
    const familyMatches = Boolean(productFamily && rule.productFamilies.includes(productFamily as ProductFamily));
    const complaintMatches = rule.complaintKeys.includes("*") || Boolean(complaintKey && rule.complaintKeys.some((key) => complaintKey.startsWith(key)));
    const active = rule.status === "active";
    const missingRequiredFeatures = rule.requiredFeatures.filter((feature) => {
      const actual = featureMap.get(feature);
      return actual === undefined || actual === "";
    });
    const conditionResults = rule.conditions.map((condition) => {
      const actual = featureMap.get(condition.feature);
      const expected = condition.value;
      const numericActual = Number(actual);
      const numericExpected = Number(expected);
      const passed =
        condition.operator === "exists"
          ? actual !== undefined && actual !== ""
          : condition.operator === "equals"
            ? String(actual).toLowerCase() === String(expected).toLowerCase()
            : condition.operator === "gte"
              ? Number.isFinite(numericActual) && Number.isFinite(numericExpected) && numericActual >= numericExpected
              : Number.isFinite(numericActual) && Number.isFinite(numericExpected) && numericActual <= numericExpected;
      return { ...condition, passed, actual: asText(actual) };
    });
    const applicable = active && familyMatches && complaintMatches && !missingRequiredFeatures.length && conditionResults.every((result) => result.passed);
    const summary = !active
      ? "Draft rule — it is visible for review but cannot influence an analysis."
      : !familyMatches
        ? "Not applicable: product family does not match."
        : !complaintMatches
        ? "Not applicable: complaint key does not match."
        : missingRequiredFeatures.length
          ? `Not applicable: required feature(s) unavailable: ${missingRequiredFeatures.join(", ")}.`
        : applicable
            ? `Matched. It strengthens ${rule.hypothesisLabel} by ${rule.weight} points.`
            : "Applicable context, but one or more deterministic conditions did not match.";
    return { rule, applicable, conditionResults, summary };
  });
}
