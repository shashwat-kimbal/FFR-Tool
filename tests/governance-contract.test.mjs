import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const contract = await import("../app/lib/governance-contract.ts");

test("shared governance defaults keep raw evidence retention disabled", () => {
  const settings = contract.cloneDefaultSharedSettings();
  assert.equal(settings.evidenceRetention.enabled, false);
  assert.equal(settings.evidenceRetention.retentionDays, null);
  settings.branding.altText = "Changed only in this clone";
  assert.equal(contract.cloneDefaultSharedSettings().branding.altText, "Kimbal logo");
});

test("rule lifecycle requires review before an active version", () => {
  assert.equal(contract.canTransitionRuleVersion("draft", "in_review"), true);
  assert.equal(contract.canTransitionRuleVersion("draft", "provisional_active"), false);
  assert.equal(contract.canTransitionRuleVersion("in_review", "approved_active"), true);
  assert.equal(contract.canTransitionRuleVersion("approved_active", "draft"), false);
  assert.equal(contract.isPublishedRuleVersion("approved_active"), true);
  assert.equal(contract.isPublishedRuleVersion("in_review"), false);
});

test("canonical bundle documents support all, any, and not expressions", () => {
  const bundle = contract.validateRuleBundleDocument({
    schemaVersion: "rule-bundle-v1",
    bundleKey: "test-dlms-v1",
    title: "Test DLMS bundle",
    productFamily: "METER",
    scopeKey: "METER:TEST",
    rules: [
      {
        id: "TEST-001",
        title: "Nested expression",
        when: {
          kind: "all",
          clauses: [
            { kind: "predicate", feature: "ip.voltage", operator: "gte", value: 220 },
            {
              kind: "not",
              clause: {
                kind: "any",
                clauses: [
                  { kind: "predicate", feature: "event.power_failure.count", operator: "gt", value: 3 },
                ],
              },
            },
          ],
        },
        finding: { code: "TEST", label: "Nested expression" },
      },
    ],
  });
  assert.equal(bundle.rules.length, 1);
  assert.throws(
    () => contract.validateRuleBundleDocument({ ...bundle, rules: [{ id: "bad", title: "Bad", when: { kind: "any", clauses: [] }, finding: {} }] }),
    /clauses/i,
  );
});

test("hosting declares shared D1 and R2 logical bindings", async () => {
  const config = JSON.parse(await readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"));
  assert.equal(config.d1, "DB");
  assert.equal(config.r2, "EVIDENCE");
});
