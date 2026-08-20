import { getGovernanceAccess } from "@/app/lib/governance-auth";
import { NextRequest, NextResponse } from "next/server";
import { getDb, type CaseRow } from "@/server/store/db.ts";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const access = await getGovernanceAccess(request);
  if (access.kind !== "authorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const { id } = await context.params;

  const caseRow = db.prepare("SELECT * FROM cases WHERE id = ?").get(id) as unknown as CaseRow | undefined;
  if (!caseRow) {
    return NextResponse.json({ error: `Case ${id} not found` }, { status: 404 });
  }

  // Get evidence
  const evidenceList = db.prepare(`
    SELECT * FROM evidence
    WHERE case_id = ?
    ORDER BY uploaded_at DESC
  `).all(id) as any[];

  // Get runs
  const runsList = db.prepare(`
    SELECT id, run_number, evidence_hash, ruleset_v, mechanisms_v, adapter_v,
           status, leading_mechanism_id, leading_cause, posterior_probability,
           started_at, finished_at
    FROM runs
    WHERE case_id = ?
    ORDER BY run_number DESC
  `).all(id) as any[];

  // Get latest run full details
  let latestRun: any = null;
  if (runsList.length > 0) {
    const latestRunRow = db.prepare("SELECT * FROM runs WHERE id = ?").get(runsList[0].id) as any;
    if (latestRunRow) {
      latestRun = {
        ...latestRunRow,
        dials: latestRunRow.dials_json ? JSON.parse(latestRunRow.dials_json) : null,
        ledger: latestRunRow.ledger_json ? JSON.parse(latestRunRow.ledger_json) : null,
        timeline: latestRunRow.timeline_json ? JSON.parse(latestRunRow.timeline_json) : null,
        nextTests: latestRunRow.next_tests_json ? JSON.parse(latestRunRow.next_tests_json) : [],
        alternatives: latestRunRow.alternatives_json ? JSON.parse(latestRunRow.alternatives_json) : [],
      };
    }
  }

  let stopStateDetails = null;
  if (caseRow.status === "blocked" && caseRow.blocked_reason?.includes("Identity mismatch")) {
    const ev = db.prepare("SELECT * FROM evidence WHERE case_id = ? AND kind = 'workbook' ORDER BY uploaded_at DESC LIMIT 1").get(id) as any;
    if (ev) {
      let parsed = { meterSerial: "UNKNOWN" };
      try { parsed = JSON.parse(ev.parse_summary_json); } catch {}
      stopStateDetails = {
        workbookSerial: parsed.meterSerial,
        expectedOld: caseRow.meter_old,
        expectedNew: caseRow.meter_new,
        filename: ev.filename,
        sha256: ev.sha256,
        sizeBytes: ev.size,
      };
    }
  }

  return NextResponse.json({
    case: caseRow,
    evidence: evidenceList.map((e) => ({
      ...e,
      parseSummary: e.parse_summary_json ? JSON.parse(e.parse_summary_json) : null,
    })),
    runs: runsList,
    latestRun,
    isStopState: stopStateDetails !== null,
    stopStateDetails,
  });
}
