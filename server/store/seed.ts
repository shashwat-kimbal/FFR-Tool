import { getDb, type SparklinePoint, type SparklineSummary } from "./db.ts";
import { evaluateVerdict } from "../inference/verdict-engine.ts";
import {
  analyzeCensoredStream,
  analyzeTruncation,
  analyzeDose,
  analyzeCoincidence,
  analyzeDecoupling,
  analyzeTestimonyConflict,
  reconstructStory,
  type FirstPrinciplesPatterns,
} from "../inference/patterns.ts";

function generateDailySparkline(
  profileType: "terminal_deg" | "grid_ov" | "smps" | "healthy" | "gap" | "flat_dead",
  baseDate = new Date("2026-06-30"),
): { points: SparklinePoint[]; summary: SparklineSummary } {
  const points: SparklinePoint[] = [];
  let minAll = 300;
  let maxAll = 0;
  let totalBelow = 0;
  let totalAbove = 0;
  let totalPoints = 0;
  let truncationDate: string | null = null;

  for (let i = 89; i >= 0; i--) {
    const d = new Date(baseDate.getTime() - i * 24 * 60 * 60 * 1000);
    const dayStr = d.toISOString().substring(0, 10);
    const isPastDeath = profileType === "terminal_deg" && i <= 25; // dies around June 5

    let minV = 220;
    let maxV = 240;
    let avgV = 230;
    let pctBelow = 0;
    let pctAbove = 0;
    let truncated = false;

    if (profileType === "terminal_deg") {
      if (i <= 25) {
        minV = 0;
        maxV = 0;
        avgV = 0;
        pctBelow = 100;
        truncated = true;
        if (!truncationDate) truncationDate = "2026-06-05 18:30";
      } else if (i < 35) {
        minV = 180 + Math.random() * 20;
        maxV = 258 + Math.random() * 5;
        avgV = 225;
        pctBelow = 15;
        pctAbove = 20;
      } else {
        minV = 215 + Math.random() * 10;
        maxV = 254 + Math.random() * 7;
        avgV = 238;
        pctAbove = 9.1;
      }
    } else if (profileType === "grid_ov") {
      minV = 228 + Math.random() * 10;
      maxV = 262 + Math.random() * 8;
      avgV = 248;
      pctAbove = 28;
    } else if (profileType === "flat_dead") {
      minV = 0;
      maxV = 0;
      avgV = 0;
      pctBelow = 100;
      truncated = true;
      truncationDate = "2026-05-12";
    } else if (profileType === "gap") {
      if (i > 40 && i < 60) {
        minV = 0;
        maxV = 0;
        avgV = 0;
        pctBelow = 100;
      } else {
        minV = 222 + Math.random() * 10;
        maxV = 242 + Math.random() * 10;
        avgV = 232;
      }
    } else {
      minV = 224 + Math.random() * 8;
      maxV = 238 + Math.random() * 8;
      avgV = 230;
    }

    if (minV < minAll) minAll = minV;
    if (maxV > maxAll) maxAll = maxV;
    if (pctBelow > 0) totalBelow += pctBelow;
    if (pctAbove > 0) totalAbove += pctAbove;
    totalPoints++;

    points.push({
      day: dayStr,
      minV: Number(minV.toFixed(1)),
      maxV: Number(maxV.toFixed(1)),
      avgV: Number(avgV.toFixed(1)),
      pctBelow,
      pctAbove,
      truncated,
    });
  }

  return {
    points,
    summary: {
      minV: Number(minAll.toFixed(1)),
      maxV: Number(maxAll.toFixed(1)),
      pctBelow: Number((totalBelow / totalPoints).toFixed(1)),
      pctAbove: Number((totalAbove / totalPoints).toFixed(1)),
      truncationDate,
      hasGap: profileType === "gap",
    },
  };
}

export function seedDatabase(force = false) {
  const db = getDb();
  const countRow = db.prepare("SELECT COUNT(*) as count FROM cases").get() as { count: number };
  if (countRow.count >= 214 && !force) {
    return;
  }

  db.exec("DELETE FROM runs; DELETE FROM evidence; DELETE FROM adjudication; DELETE FROM cases;");

  const insertCase = db.prepare(`
    INSERT INTO cases (
      id, case_ref, register_hash, register_row, status, blocked_reason,
      assignee_email, priority, meter_old, meter_new, complaint_key,
      complaint_label, product_family, sub_division, defect_date,
      field_observation, leading_cause, leading_family, posterior_probability,
      confidence_completeness, confidence_discrimination, confidence_provenance,
      confidence_cohort, sparkline_points_json, sparkline_summary_json,
      age_days, created_at, concluded_at, closed_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
  `);

  const insertEvidence = db.prepare(`
    INSERT INTO evidence (
      id, case_id, kind, role, filename, sha256, size, storage_key,
      parse_summary_json, uploaded_by, uploaded_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
  `);

  const insertRun = db.prepare(`
    INSERT INTO runs (
      id, case_id, run_number, evidence_hash, ruleset_v, mechanisms_v,
      adapter_v, status, leading_mechanism_id, leading_cause,
      posterior_probability, dials_json, ledger_json, timeline_json,
      timeline_narrative, next_tests_json, alternatives_json, started_at, finished_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
  `);

  const subdivisions = [
    "Lakhipur_bec",
    "Basugaon",
    "Abhayapuri",
    "Bongaigaon",
    "Kokrajhar",
    "Bijni",
    "Bilasipara",
    "Goalpara",
    "Dhubri",
  ];

  const complaints = [
    { key: "METER:B", label: "METER:B · Meter burnt", obs: "Meter is internally burnt" },
    { key: "METER:D", label: "METER:D · Display defective", obs: "Display is blank or garbled" },
    { key: "METER:C", label: "METER:C · No comms", obs: "Optical/RF communications failed" },
    { key: "METER:O", label: "METER:O · Other/Accuracy", obs: "Fast recording reported by consumer" },
  ];

  const owners = ["SS", "RK", "AP", "VG", null];

  // Seed primary Case 13644 (Ground Truth)
  const case13644Spark = generateDailySparkline("terminal_deg");
  insertCase.run(
    "13644",
    "13644",
    "4a1c9e8b2a5d3f10",
    2,
    "analysed",
    null,
    "SS",
    "high",
    "AS2373952",
    "SC10231275",
    "METER:B",
    "METER:B · Meter burnt",
    "METER",
    "Lakhipur_bec",
    "2026-06-16",
    "Meter is internally Burnt",
    "Terminal degradation",
    "INSTALLATION",
    0.71,
    3,
    2,
    2,
    0,
    JSON.stringify(case13644Spark.points),
    JSON.stringify(case13644Spark.summary),
    76,
    "2026-06-05 08:30:00",
    null,
    null,
  );

  // Evidence for 13644
  insertEvidence.run(
    "ev-13644-dlms",
    "13644",
    "workbook",
    "primary_dlms",
    "AS2373952_Reports_2026-06-30.xlsx",
    "9b3ac41f0d4d5df289a74c2e6b8109d32fe4",
    1245184,
    "evidence/AS2373952_Reports_2026-06-30.xlsx",
    JSON.stringify({
      sheetCount: 16,
      profileRowCount: 3360,
      totalEvents: 244,
      meterSerial: "AS2373952",
      manufacturer: "SINHAL UDYOG",
      firmware: "TEST 1.22",
    }),
    "SS",
    "2026-08-19 14:01:00",
  );

  insertEvidence.run(
    "ev-13644-img",
    "13644",
    "image",
    "inspection_photo",
    "burn_terminal_01.jpg",
    "4d1e8b2a3f9c5e7b1a0d4c8e6a2b9f3e1a7c",
    2184512,
    "evidence/burn_terminal_01.jpg",
    JSON.stringify({
      mimeType: "image/jpeg",
      dimensions: "4032x3024",
      label: "Terminal charring close-up",
    }),
    "SS",
    "2026-08-19 14:03:00",
  );

  // Runs for 13644 (Runs 1 to 4)
  const runDials = { completeness: 3, discrimination: 2, provenance: 2, corroboration: 0 };
  const runTimeline = [
    { dateStr: "28 Mar", description: "Recording begins. 9.1% of samples above 253 V." },
    { dateStr: "9 May", description: "First zero-voltage samples appear." },
    { dateStr: "19 May", description: "Low-PF event buffer saturates — 50 events in 17 days." },
    { dateStr: "31 May", description: "Power-failure buffer saturates — 50 events in 30 days." },
    { dateStr: "1 Jun", description: "Three event streams converge within 24 hours." },
    { dateStr: "5 Jun", description: "18:30 — last record, 0 V.", badge: "TIME OF DEATH", isDeath: true },
    { dateStr: "16 Jun", description: "Field reports the defect.", badge: "11-DAY DETECTION LAG", isLag: true },
    { dateStr: "29 Jun", description: "Depot power-up. Still 0 V. Not a recovery." },
  ];

  const runLedger = {
    supporting: [
      {
        id: "P-PWR-ESC",
        ruleCode: "P-PWR-ESC",
        family: "termination",
        title: "Power-failure rate escalating",
        measured: "1.67/day over final 30 days (buffer saturated)",
        sourceRef: "PowerRelatedEvent!C14:C63",
        colorKind: "source",
        likelihoodRatio: 6.0,
        direction: "supports",
      },
      {
        id: "P-TRUNC-0V",
        ruleCode: "P-TRUNC-0V",
        family: "timing/truncation",
        title: "Truncation at zero volts",
        measured: "last 3 samples 0 V, 5 Jun 18:30",
        sourceRef: "BlockLoadProfile!C3348:D3350",
        colorKind: "source",
        likelihoodRatio: 8.0,
        direction: "supports",
      },
      {
        id: "P-PF-COLLAPSE",
        ruleCode: "P-PF-COLLAPSE",
        family: "termination",
        title: "Low power-factor buffer saturated",
        measured: "2.94/day across 17 days (50 events)",
        sourceRef: "OtherEvent!C14:C63",
        colorKind: "source",
        likelihoodRatio: 4.5,
        direction: "supports",
      },
      {
        id: "P-COINCIDENCE",
        ruleCode: "P-COINCIDENCE",
        family: "timing/truncation",
        title: "Multi-stream event convergence",
        measured: "7 events across 3 streams in 24h window",
        sourceRef: "BlockLoadProfile!D3200:D3300",
        colorKind: "calculated",
        likelihoodRatio: 3.5,
        direction: "supports",
      },
      {
        id: "P-CURR-SILENCE",
        ruleCode: "P-CURR-SILENCE",
        family: "load-side",
        title: "Current axis inactive",
        measured: "no load-side events in 560 days",
        sourceRef: "CurrentRelatedEvent!C14:C63",
        colorKind: "source",
        likelihoodRatio: 2.5,
        direction: "supports",
      },
    ],
    against: [
      {
        id: "P-VOLT-STRESS",
        ruleCode: "P-VOLT-STRESS",
        family: "voltage-stress",
        title: "Chronic overvoltage exposure",
        measured: "9.1% samples > 253V (points partly to grid)",
        sourceRef: "BlockLoadProfile!D14:D3373",
        colorKind: "calculated",
        likelihoodRatio: 0.8,
        direction: "against",
      },
    ],
    gaps: [
      {
        id: "GAP-VOLT-FALLBACK",
        ruleCode: "GAP",
        family: "provenance",
        title: "Voltage threshold from fallback",
        measured: "nominal 230 V assumed — MeterConfiguration had no rated voltage",
        sourceRef: "MeterConfiguration!A1:J6",
        colorKind: "assumed",
        likelihoodRatio: 1.0,
        direction: "gap",
        note: "Recover rated voltage from contract to lift provenance dial.",
      },
      {
        id: "GAP-BENCH-TEST",
        ruleCode: "GAP",
        family: "physical",
        title: "Bench contact resistance unmeasured",
        measured: "Torque & resistance not verified on test bench",
        sourceRef: "PhysicalInspection!A1",
        colorKind: "missing",
        likelihoodRatio: 1.0,
        direction: "gap",
      },
    ],
    passed: [
      { id: "DLMS-PRF-001", title: "Profile interval integrity", sourceRef: "BlockLoadProfile!B14:B3373", measured: "100% complete", colorKind: "source", likelihoodRatio: 1.0, direction: "passed" },
      { id: "DLMS-PRF-002", title: "Clock monotonicity", sourceRef: "BlockLoadProfile!C14:C3373", measured: "Verified monotone", colorKind: "source", likelihoodRatio: 1.0, direction: "passed" },
      { id: "DLMS-EVT-001", title: "Tamper record structure", sourceRef: "OtherEvent!A1:E63", measured: "Compliant", colorKind: "source", likelihoodRatio: 1.0, direction: "passed" },
    ],
  };

  const nextBest = {
    rank: 1,
    title: "Feeder cohort — power-failure rate 31 May–5 Jun across 38 meters",
    cost: "seconds",
    expectedPosteriorShift: "LARGE",
    description: "Elevated power-failure storm across feeder → grid root cause; isolated to this meter → progressive termination failure.",
    actionText: "Run this now →",
    queryParam: "/cohorts/feeder/Lakhipur_bec",
  };

  const runAlternatives = [
    { mechanismId: "MECH-GRID-OV-THERMAL", name: "Grid overvoltage thermal stress", family: "grid", posterior: 0.19, narrative: "Grid supply sustained chronic high voltage causing thermal runaway." },
    { mechanismId: "MECH-PROD-SMPS", name: "SMPS component defect", family: "product", posterior: 0.07, narrative: "Internal SMPS controller or diode breakdown under normal voltage." },
    { mechanismId: "MECH-NO-FAULT", name: "No fault found", family: "no-fault", posterior: 0.02, narrative: "Meter functional; cosmetic or misdiagnosed return." },
  ];

  insertRun.run(
    "run-13644-4",
    "13644",
    4,
    "9b3ac41f0d4d5df289a74c2e6b8109d32fe4",
    "ruleset v3",
    "mechanisms v2",
    "bcs-16-sheet-v1",
    "completed",
    "MECH-TERM-PROGRESSIVE",
    "Terminal degradation",
    0.71,
    JSON.stringify(runDials),
    JSON.stringify(runLedger),
    JSON.stringify(runTimeline),
    "Reconstructed narrative from 28 Mar to 30 Jun.",
    JSON.stringify([nextBest]),
    JSON.stringify(runAlternatives),
    "2026-08-19 14:02:00",
    "2026-08-19 14:02:02",
  );

  insertRun.run(
    "run-13644-3",
    "13644",
    3,
    "9b3ac41f0d4d5df289a74c2e6b8109d32fe4",
    "ruleset v2",
    "mechanisms v2",
    "bcs-16-sheet-v1",
    "completed",
    "MECH-TERM-PROGRESSIVE",
    "Terminal degradation",
    0.64,
    JSON.stringify({ completeness: 2, discrimination: 2, provenance: 2, corroboration: 0 }),
    JSON.stringify(runLedger),
    JSON.stringify(runTimeline),
    "Run 3 evaluation",
    JSON.stringify([nextBest]),
    JSON.stringify(runAlternatives),
    "2026-08-12 09:15:00",
    "2026-08-12 09:15:02",
  );

  insertRun.run(
    "run-13644-2",
    "13644",
    2,
    "9b3ac41f0d4d5df289a74c2e6b8109d32fe4",
    "ruleset v2",
    "mechanisms v1",
    "bcs-16-sheet-v1",
    "completed",
    "MECH-GRID-OV-THERMAL",
    "Grid overvoltage",
    0.51,
    JSON.stringify({ completeness: 2, discrimination: 1, provenance: 2, corroboration: 0 }),
    JSON.stringify(runLedger),
    JSON.stringify(runTimeline),
    "Run 2 evaluation",
    JSON.stringify([nextBest]),
    JSON.stringify(runAlternatives),
    "2026-08-04 16:40:00",
    "2026-08-04 16:40:02",
  );

  insertRun.run(
    "run-13644-1",
    "13644",
    1,
    "9b3ac41f0d4d5df289a74c2e6b8109d32fe4",
    "ruleset v1",
    "mechanisms v1",
    "bcs-16-sheet-v1",
    "completed",
    "MECH-NO-FAULT",
    "Inconclusive",
    null,
    JSON.stringify({ completeness: 1, discrimination: 0, provenance: 1, corroboration: 0 }),
    JSON.stringify({ supporting: [], against: [], gaps: [], passed: [] }),
    JSON.stringify([]),
    "Run 1 evaluation",
    JSON.stringify([nextBest]),
    JSON.stringify(runAlternatives),
    "2026-07-28 11:22:00",
    "2026-07-28 11:22:02",
  );

  // Seed remaining 213 cases (13643, 13642, ... down to 13431)
  // Ensure Lakhipur_bec has exactly 38 cases:
  // 27 Terminal degradation, 6 Grid overvoltage, 3 SMPS defect, 2 No fault found
  let lakhipurCount = 1; // 13644 is #1 (terminal degradation)
  let lakhipurTermCount = 1;
  let lakhipurGridCount = 0;
  let lakhipurSmpsCount = 0;
  let lakhipurNffCount = 0;

  for (let c = 13643; c >= 13431; c--) {
    const id = String(c);
    const caseRef = id;
    const isNeedsMe = c % 18 === 0; // ~12 cases
    const isBlocked = c === 13639 || c === 13622 || c === 13605 || c === 13588 || c === 13571 || c === 13554 || c === 13537 || c === 13520; // 8 cases
    const isAwaitingReview = !isNeedsMe && !isBlocked && c % 9 === 0; // ~23 cases
    const isClosed = !isNeedsMe && !isBlocked && !isAwaitingReview && c % 5 === 0; // ~41 cases

    let status: "open" | "evidence_ready" | "analysed" | "blocked" | "in_review" | "closed" = "analysed";
    let blockerReason: string | null = null;

    if (isBlocked) {
      status = "blocked";
      const blockers = [
        "Identity mismatch: AS2373110 attached",
        "Missing BlockLoadProfile sheet in workbook",
        "Phase voltage registers contain checksum errors",
        "Unmapped defect trigger code in FFR register",
      ];
      blockerReason = blockers[c % blockers.length];
    } else if (isAwaitingReview) {
      status = "in_review";
    } else if (isClosed) {
      status = "closed";
    } else if (c % 25 === 0) {
      status = "open";
    } else if (c % 20 === 0) {
      status = "evidence_ready";
    }

    // Assign subdivision & causes
    let sub: string;
    let leadingCause: string | null = null;
    let leadingFam: string | null = null;
    let posterior: number | null = null;
    let sparkType: "terminal_deg" | "grid_ov" | "smps" | "healthy" | "gap" | "flat_dead" = "healthy";

    if (lakhipurCount < 38 && !isBlocked && (c % 5 === 0 || lakhipurCount < 30)) {
      sub = "Lakhipur_bec";
      lakhipurCount++;
      if (lakhipurTermCount < 27) {
        leadingCause = "Terminal degradation";
        leadingFam = "INSTALLATION";
        posterior = 0.68 + (c % 10) * 0.01;
        sparkType = "terminal_deg";
        lakhipurTermCount++;
      } else if (lakhipurGridCount < 6) {
        leadingCause = "Grid overvoltage";
        leadingFam = "GRID";
        posterior = 0.58 + (c % 10) * 0.01;
        sparkType = "grid_ov";
        lakhipurGridCount++;
      } else if (lakhipurSmpsCount < 3) {
        leadingCause = "SMPS defect";
        leadingFam = "PRODUCT";
        posterior = 0.62;
        sparkType = "healthy";
        lakhipurSmpsCount++;
      } else if (lakhipurNffCount < 2) {
        leadingCause = "No fault found";
        leadingFam = "NO-FAULT";
        posterior = 0.45;
        sparkType = "healthy";
        lakhipurNffCount++;
      } else {
        leadingCause = "Terminal degradation";
        leadingFam = "INSTALLATION";
        posterior = 0.71;
        sparkType = "terminal_deg";
      }
    } else {
      const otherSubs = subdivisions.filter((s) => s !== "Lakhipur_bec");
      sub = otherSubs[c % otherSubs.length];
      if (status === "open" || status === "blocked") {
        leadingCause = null;
        leadingFam = null;
        posterior = null;
        sparkType = status === "blocked" ? "flat_dead" : "healthy";
      } else {
        const causes = [
          { cause: "Terminal degradation", fam: "INSTALLATION", p: 0.71, st: "terminal_deg" as const },
          { cause: "Grid overvoltage", fam: "GRID", p: 0.65, st: "grid_ov" as const },
          { cause: "SMPS defect", fam: "PRODUCT", p: 0.58, st: "healthy" as const },
          { cause: "Neutral open surge", fam: "GRID", p: 0.74, st: "grid_ov" as const },
          { cause: "Relay contact weld", fam: "PRODUCT", p: 0.69, st: "gap" as const },
          { cause: "Water ingress", fam: "ENVIRONMENT", p: 0.54, st: "gap" as const },
          { cause: "Tamper / HV spark", fam: "CUSTOMER", p: 0.81, st: "flat_dead" as const },
          { cause: "No fault found", fam: "NO-FAULT", p: 0.42, st: "healthy" as const },
        ];
        const pick = causes[c % causes.length];
        leadingCause = pick.cause;
        leadingFam = pick.fam;
        posterior = pick.p;
        sparkType = pick.st;
      }
    }

    const comp = complaints[c % complaints.length];
    const oldMeterSerial = `AS237${(c * 7) % 9000 + 1000}`;
    const newMeterSerial = `SC102${(c * 11) % 9000 + 1000}`;
    const ageDays = (13644 - c) % 45 + 1;
    const spark = generateDailySparkline(sparkType);
    const owner = isNeedsMe ? "SS" : owners[c % owners.length];

    const cCompleteness = leadingCause ? (c % 3) + 2 : 0;
    const cDiscrimination = leadingCause ? (c % 3) + 1 : 0;
    const cProvenance = leadingCause ? 2 : 0;
    const cCohort = leadingCause ? (sub === "Lakhipur_bec" ? 3 : (c % 2)) : 0;

    insertCase.run(
      id,
      caseRef,
      `reg_hash_${c}`,
      c - 13400,
      status,
      blockerReason,
      owner,
      c % 7 === 0 ? "high" : "normal",
      oldMeterSerial,
      newMeterSerial,
      comp.key,
      comp.label,
      "METER",
      sub,
      "2026-06-16",
      comp.obs,
      leadingCause,
      leadingFam,
      posterior,
      cCompleteness,
      cDiscrimination,
      cProvenance,
      cCohort,
      JSON.stringify(spark.points),
      JSON.stringify(spark.summary),
      ageDays,
      `2026-05-${String((c % 28) + 1).padStart(2, "0")} 10:00:00`,
      status === "closed" ? "2026-07-01 12:00:00" : null,
      status === "closed" ? "2026-07-05 15:00:00" : null,
    );
  }

  console.log("Seeded database with 214 cases.");
}
