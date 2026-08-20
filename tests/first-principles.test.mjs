import assert from "node:assert/strict";
import test from "node:test";
import {
  analyzeCensoredStream,
  analyzeTruncation,
  analyzeDose,
  analyzeCoincidence,
  analyzeDecoupling,
  analyzeTestimonyConflict,
  reconstructStory,
} from "../server/inference/patterns.ts";
import { MECHANISM_LIBRARY, getMechanismById } from "../server/inference/mechanisms.ts";
import { evaluateVerdict } from "../server/inference/verdict-engine.ts";

test("First Principles L2: Censored stream analysis calculates saturation & rate", () => {
  const timestamps = [
    "2026-06-01T00:00:00Z",
    "2026-06-05T00:00:00Z",
    "2026-06-10T00:00:00Z",
  ];
  const res = analyzeCensoredStream("VoltageRelatedEvent", 50, timestamps, 50);
  assert.equal(res.saturated, true);
  assert.equal(res.totalRows, 50);
  assert.ok(res.spanDays !== null && res.spanDays > 0);
  assert.ok(res.ratePerDay !== null && res.ratePerDay > 0);
});

test("First Principles L2: Truncation detection identifies time of death & terminal values", () => {
  const records = [
    { timestamp: "2026-06-01T12:00:00Z", voltage: 230, current: 5 },
    { timestamp: "2026-06-05T18:30:00Z", voltage: 0, current: 0 },
    { timestamp: "2026-06-29T19:00:00Z", voltage: 0, current: 0 },
  ];
  const res = analyzeTruncation(records, "2026-06-16");
  assert.ok(res.lastLiveTs !== null);
  assert.equal(res.resumedInService, false);
  assert.ok(res.silenceDays !== null && res.silenceDays > 20);
});

test("First Principles L2: Dose calculation detects overvoltage stress & volt-hours", () => {
  const voltages = [220, 240, 255, 260, 258, 220];
  const timestamps = voltages.map((_, i) => `2026-06-0${i + 1}T12:00:00Z`);
  const res = analyzeDose(voltages, timestamps, 253, 207);
  assert.equal(res.totalSamples, 6);
  assert.equal(res.samplesAboveUpper, 3);
  assert.equal(res.peakVoltage, 260);
});

test("First Principles L3: Mechanisms library covers core failure modes", () => {
  assert.ok(MECHANISM_LIBRARY.length >= 6);
  const term = getMechanismById("MECH-TERM-PROGRESSIVE");
  assert.ok(term !== undefined);
  assert.equal(term?.family, "installation");
  assert.ok(term?.signature.requires.includes("TRUNCATION_AT_ZERO_VOLTS"));
});

test("First Principles L4/L5: Verdict engine computes posterior, 4 dials, and Next Best Test", () => {
  const mockPatterns = {
    censoredStreams: {
      powerEvent: {
        streamName: "PowerRelatedEvent",
        totalRows: 50,
        saturated: true,
        spanDays: 30,
        ratePerDay: 1.67,
        stalenessDays: 1,
        earliestTs: "2026-05-31",
        latestTs: "2026-06-30",
      },
      otherEvent: {
        streamName: "OtherEvent",
        totalRows: 50,
        saturated: true,
        spanDays: 17,
        ratePerDay: 2.94,
        stalenessDays: 1,
        earliestTs: "2026-05-19",
        latestTs: "2026-06-05",
      },
      currentEvent: {
        streamName: "CurrentRelatedEvent",
        totalRows: 50,
        saturated: true,
        spanDays: 4,
        ratePerDay: 12.5,
        stalenessDays: 560,
        earliestTs: "2024-12-14",
        latestTs: "2024-12-18",
      },
      voltageEvent: {
        streamName: "VoltageRelatedEvent",
        totalRows: 50,
        saturated: true,
        spanDays: 144,
        ratePerDay: 0.35,
        stalenessDays: 20,
        earliestTs: "2026-01-08",
        latestTs: "2026-06-01",
      },
    },
    truncation: {
      lastLiveTs: "2026-06-05 18:30:00",
      terminalVoltages: [0, 0, 0],
      terminalCurrents: [0, 0, 0],
      silenceDays: 24.0,
      resumedInService: false,
      defectDate: "2026-06-16",
      detectionLagDays: 11,
    },
    coincidence: {
      windowHours: 24,
      eventsInWindowCount: 7,
      streamsInvolved: ["power", "other", "voltage"],
      windowStartTs: "2026-06-01 00:00:00",
      windowEndTs: "2026-06-01 23:59:59",
      distanceToTruncationHours: 90,
    },
    dose: {
      totalSamples: 3360,
      samplesAboveUpper: 307,
      samplesBelowLower: 23,
      percentAboveUpper: 9.1,
      percentBelowLower: 0.7,
      voltHoursAboveUpper: 124.5,
      peakVoltage: 260.6,
      peakTs: "2026-03-29 18:45:00",
      trend: "stable",
    },
    decoupling: {
      zeroVoltageWithCurrentCount: 0,
      frozenEnergyWithProfileCount: 0,
      divergenceStartTs: null,
    },
    testimonyConflict: {
      conflictDetected: false,
      conflictType: null,
      confidence: 0.9,
      narrative: "Consistent",
    },
    reconstructedStory: "Narrative",
  };

  const verdict = evaluateVerdict(mockPatterns, "METER:B");
  assert.equal(verdict.leadingMechanism.id, "MECH-TERM-PROGRESSIVE");
  assert.equal(verdict.posteriorProbability, 0.71);
  assert.equal(verdict.dials.completeness, 3);
  assert.equal(verdict.dials.discrimination, 2);
  assert.equal(verdict.dials.provenance, 2);
  assert.equal(verdict.dials.corroboration, 0);
  assert.ok(verdict.nextBestTest.title.includes("Feeder cohort"));
  assert.ok(verdict.ledger.supporting.length >= 4);
});
