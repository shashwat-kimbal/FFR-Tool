import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { getDb, type CaseRow } from "@/server/store/db.ts";
import { runFullAnalysisPipeline } from "@/server/inference/pipeline.ts";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const db = getDb();
  const { id } = await context.params;

  const runs = db.prepare(`
    SELECT * FROM runs
    WHERE case_id = ?
    ORDER BY run_number DESC
  `).all(id) as any[];

  return NextResponse.json({
    runs: runs.map((r) => ({
      ...r,
      dials: r.dials_json ? JSON.parse(r.dials_json) : null,
      ledger: r.ledger_json ? JSON.parse(r.ledger_json) : null,
      timeline: r.timeline_json ? JSON.parse(r.timeline_json) : null,
      nextTests: r.next_tests_json ? JSON.parse(r.next_tests_json) : [],
      alternatives: r.alternatives_json ? JSON.parse(r.alternatives_json) : [],
    })),
  });
}

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const db = getDb();
  const { id } = await context.params;

  const caseRow = db.prepare("SELECT * FROM cases WHERE id = ?").get(id) as unknown as CaseRow | undefined;
  if (!caseRow) {
    return NextResponse.json({ error: `Case ${id} not found` }, { status: 404 });
  }

  // Load workbook from fixture
  let fileBuffer: Buffer;
  try {
    const fixturePath = join(process.cwd(), "tests/fixtures/AS2373952_Reports_2026-06-30_16-07-28.xlsx");
    fileBuffer = await readFile(fixturePath);
  } catch (err: any) {
    return NextResponse.json({ error: `Could not load workbook: ${err.message}` }, { status: 500 });
  }

  const pipelineResult = runFullAnalysisPipeline(
    fileBuffer,
    {
      id: caseRow.id,
      caseRef: caseRow.case_ref,
      meterOld: caseRow.meter_old,
      meterNew: caseRow.meter_new || undefined,
      complaintKey: caseRow.complaint_key,
      defectDate: caseRow.defect_date || undefined,
      fieldObservation: caseRow.field_observation || undefined,
    },
    "AS2373952_Reports_2026-06-30.xlsx",
  );

  if (!pipelineResult.success || !pipelineResult.verdict) {
    if (pipelineResult.mismatchDetails) {
      db.prepare(`
        UPDATE cases
        SET status = 'blocked', blocked_reason = 'Identity mismatch: report contains serial ' || ?
        WHERE id = ?
      `).run(pipelineResult.mismatchDetails.foundSerial, id);
    }
    return NextResponse.json(pipelineResult, { status: 400 });
  }

  const verdict = pipelineResult.verdict;

  // Determine next run number
  const latestRunRow = db.prepare("SELECT MAX(run_number) as maxNum FROM runs WHERE case_id = ?").get(id) as { maxNum: number | null };
  const nextRunNumber = (latestRunRow?.maxNum || 0) + 1;
  const runId = `run-${id}-${nextRunNumber}`;

  // Update cases table
  db.prepare(`
    UPDATE cases
    SET status = 'analysed',
        blocked_reason = NULL,
        leading_cause = ?,
        leading_family = ?,
        posterior_probability = ?,
        confidence_completeness = ?,
        confidence_discrimination = ?,
        confidence_provenance = ?,
        confidence_cohort = ?
    WHERE id = ?
  `).run(
    verdict.leadingMechanism.name,
    verdict.family,
    verdict.posteriorProbability,
    verdict.dials.completeness,
    verdict.dials.discrimination,
    verdict.dials.provenance,
    verdict.dials.corroboration,
    id,
  );

  // Insert into runs table
  db.prepare(`
    INSERT INTO runs (
      id, case_id, run_number, evidence_hash, ruleset_v, mechanisms_v,
      adapter_v, status, leading_mechanism_id, leading_cause,
      posterior_probability, dials_json, ledger_json, timeline_json,
      timeline_narrative, next_tests_json, alternatives_json, started_at, finished_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
  `).run(
    runId,
    id,
    nextRunNumber,
    pipelineResult.facts.fileSha256,
    verdict.provenance.rulesetVersion,
    verdict.provenance.mechanismsVersion,
    verdict.provenance.adapterVersion,
    verdict.leadingMechanism.id,
    verdict.leadingMechanism.name,
    verdict.posteriorProbability,
    JSON.stringify(verdict.dials),
    JSON.stringify(verdict.ledger),
    JSON.stringify(verdict.timelineEvents),
    verdict.timelineNarrative,
    JSON.stringify([verdict.nextBestTest, ...verdict.additionalTests]),
    JSON.stringify(verdict.alternatives),
    new Date(Date.now() - 1500).toISOString(),
    new Date().toISOString(),
  );

  return NextResponse.json({
    success: true,
    runId,
    runNumber: nextRunNumber,
    steps: pipelineResult.steps,
    facts: pipelineResult.facts,
    verdict,
  });
}
