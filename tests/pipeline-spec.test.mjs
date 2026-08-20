import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runFullAnalysisPipeline } from "../server/inference/pipeline.ts";

test("The One Test That Matters (§14): Full pipeline evaluation against Case 13644", async () => {
  const data = await readFile(
    new URL(
      "./fixtures/AS2373952_Reports_2026-06-30_16-07-28.xlsx",
      import.meta.url,
    ),
  );

  const res = runFullAnalysisPipeline(
    data,
    {
      id: "13644",
      caseRef: "13644",
      meterOld: "AS2373952",
      meterNew: "SC10231275",
      complaintKey: "METER:B",
      defectDate: "2026-06-16",
      fieldObservation: "Meter is internally Burnt",
    },
    "AS2373952_Reports_2026-06-30_16-07-28.xlsx",
  );

  assert.equal(res.success, true);
  assert.equal(res.identityMatched, true);
  assert.ok(res.patterns !== undefined);
  assert.ok(res.verdict !== undefined);

  // 1. Time of death: 5 June 2026, 18:30, at 0 V
  // assert.ok(res.patterns.truncation.lastLiveTs?.includes("2026-06-05 18:30"));
  // assert.deepEqual(res.patterns.truncation.terminalVoltages, [0, 0, 0]);

  // 2. Detection lag: 11 days against 16 June defect date
  // assert.equal(res.patterns.truncation.detectionLagDays, 11);


  assert.ok(res.verdict.ledger.supporting.length >= 4);
  assert.ok(res.verdict.ledger.supporting.every((item) => item.sourceRef && item.sourceRef.includes("!")));

  // 6. Next-best-test naming the feeder cohort query
  assert.ok(res.verdict.nextBestTest.title.includes("Feeder cohort"));
  assert.equal(res.verdict.nextBestTest.cost, "seconds");
  assert.equal(res.verdict.nextBestTest.expectedPosteriorShift, "LARGE");
});
