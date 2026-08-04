import assert from "node:assert/strict";
import test from "node:test";

const { evaluateRules, ruleInputGaps } = await import("../app/lib/rule-engine.ts");

function completeRule(overrides = {}) {
  return {
    id: "METER-D-001",
    version: "1.0.0",
    title: "Display voltage check",
    purpose: "Check whether the voltage signal supports the defined display investigation.",
    status: "active",
    productFamilies: ["METER"],
    complaintKeys: ["METER:D"],
    requiredFeatures: ["ip.voltage"],
    conditions: [{ feature: "ip.voltage", operator: "gte", value: "220" }],
    hypothesisCode: "DISPLAY_POWER_DOMAIN",
    hypothesisLabel: "Display power-domain condition",
    weight: 20,
    requiredFollowUp: "Inspect approved display power view",
    allowedOutcome: "PROBABLE",
    limitation: "Does not confirm a component-level cause.",
    analystExplanation: "Explain the matched signal and its limitation.",
    reportSafeExplanation: "State the supported preliminary finding.",
    owner: "Engineering owner",
    reviewer: "Quality reviewer",
    ...overrides,
  };
}

test("complete local rule inputs pass the local readiness check", () => {
  assert.deepEqual(ruleInputGaps(completeRule()), []);
  assert.ok(ruleInputGaps(completeRule({ title: "", reviewer: "" })).includes("an engineering rule title"));
  assert.ok(ruleInputGaps(completeRule({ title: "", reviewer: "" })).includes("an independent reviewer"));
});

test("local evaluator matches only active rules in the configured scope", () => {
  const active = completeRule();
  const draft = completeRule({ id: "METER-D-002", status: "draft" });
  const results = evaluateRules([active, draft], "METER", "METER:D:D2", [{ code: "ip.voltage", label: "Instantaneous voltage", value: 230, source: "IP" }]);

  assert.equal(results[0].applicable, true);
  assert.equal(results[1].applicable, false);
  assert.match(results[0].summary, /Matched/);
  assert.match(results[1].summary, /Draft rule/);
});

test("local evaluator stops an active rule when its required feature is absent", () => {
  const results = evaluateRules([completeRule({ requiredFeatures: ["self_diagnostic.main_battery"] })], "METER", "METER:D", [{ code: "ip.voltage", label: "Instantaneous voltage", value: 230, source: "IP" }]);

  assert.equal(results[0].applicable, false);
  assert.match(results[0].summary, /required feature\(s\) unavailable/i);
});
