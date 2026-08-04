import type { DerivedFeature, DiagnosticRule, ProductFamily, RuleEvaluation } from "./pilot-types";

function asText(value: string | number | boolean | undefined) {
  return value === undefined ? "Not available" : String(value);
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
    const applicable = active && familyMatches && complaintMatches && conditionResults.every((result) => result.passed);
    const summary = !active
      ? "Draft rule — it is visible for review but cannot influence an analysis."
      : !familyMatches
        ? "Not applicable: product family does not match."
        : !complaintMatches
          ? "Not applicable: complaint key does not match."
          : applicable
            ? `Matched. It strengthens ${rule.hypothesisLabel} by ${rule.weight} points.`
            : "Applicable context, but one or more deterministic conditions did not match.";
    return { rule, applicable, conditionResults, summary };
  });
}
