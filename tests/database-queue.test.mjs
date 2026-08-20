import assert from "node:assert/strict";
import test from "node:test";
import { getDb } from "../server/store/db.ts";
import { seedDatabase } from "../server/store/seed.ts";
import { getCohortAnalysis } from "../server/cohorts/cohort-service.ts";
import { runRuleForgeAgentLoop } from "../server/forge/agent.ts";

test("Database & Queue (§4): 214 cases seeded, paginated to page 9, sparklines present", () => {
  seedDatabase(true);
  const db = getDb();

  // Total count
  const total = db.prepare("SELECT COUNT(*) as c FROM cases").get().c;
  assert.equal(total, 214);

  // Pagination: 214 cases / 25 per page = 9 pages
  const totalPages = Math.ceil(total / 25);
  assert.equal(totalPages, 9);

  // Page 9 has the remaining 14 rows (214 - 8 * 25 = 14)
  const page9Rows = db.prepare("SELECT * FROM cases ORDER BY CAST(case_ref AS INTEGER) DESC LIMIT 25 OFFSET 200").all();
  assert.equal(page9Rows.length, 14);

  // Case 13644 is present with correct attributes
  const case13644 = db.prepare("SELECT * FROM cases WHERE id = ?").get("13644");
  assert.ok(case13644 !== undefined);
  assert.equal(case13644.meter_old, "AS2373952");
  assert.equal(case13644.sub_division, "Lakhipur_bec");
  assert.equal(case13644.status, "analysed");
  assert.equal(case13644.leading_cause, "Terminal degradation");

  // Every case has sparkline data
  const sampleCases = db.prepare("SELECT sparkline_points_json, sparkline_summary_json FROM cases LIMIT 10").all();
  assert.ok(sampleCases.every((c) => c.sparkline_points_json && JSON.parse(c.sparkline_points_json).length > 0));

  // Blocked cases have blocker reasons populated
  const blockedCases = db.prepare("SELECT blocked_reason FROM cases WHERE status = 'blocked'").all();
  assert.ok(blockedCases.length > 0);
  assert.ok(blockedCases.every((b) => b.blocked_reason && b.blocked_reason.length > 0));
});

test("Cohort Screen (§6): Lakhipur_bec feeder distribution across 38 returns", () => {
  const analysis = getCohortAnalysis("feeder", "Lakhipur_bec");
  assert.equal(analysis.totalReturns, 38);
  assert.equal(analysis.capaTriggered, true);
  assert.ok(analysis.capaNotice?.includes("Terminal degradation is"));

  const term = analysis.distribution.find((d) => d.name === "Terminal degradation");
  assert.ok(term !== undefined);
  assert.equal(term?.count, 27);
  assert.equal(term?.percentage, 71);
  assert.equal(term?.multiplier, 5.9);

  const grid = analysis.distribution.find((d) => d.name === "Grid overvoltage");
  assert.equal(grid?.count, 6);
  assert.equal(grid?.percentage, 16);

  const smps = analysis.distribution.find((d) => d.name === "SMPS defect");
  assert.equal(smps?.count, 3);
  assert.equal(smps?.percentage, 8);

  const nff = analysis.distribution.find((d) => d.name === "No fault found");
  assert.equal(nff?.count, 2);
  assert.equal(nff?.percentage, 5);
});

test("Rule Forge Multi-Agent Loop (§7.3 & §8 F5)", () => {
  const proposal = runRuleForgeAgentLoop({
    caseId: "13644",
    series: "voltage",
    fromTs: "2026-06-01T00:00:00Z",
    toTs: "2026-06-06T00:00:00Z",
    intentText: "power failures accelerating right before the log stops",
  });

  assert.equal(proposal.readyToShip, true);
  assert.equal(proposal.logs.length, 5);
  assert.ok(proposal.candidate.ruleId === "P-PWR-ESC");
  assert.ok(proposal.candidate.threshold.includes("1.5"));
  assert.equal(proposal.backtest.totalCases, 214);
  assert.equal(proposal.backtest.precision, 0.82);
  assert.equal(proposal.backtest.recall, 0.61);
  assert.equal(proposal.fixtures.length, 3);
});
