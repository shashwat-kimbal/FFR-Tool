import { getGovernanceAccess } from "@/app/lib/governance-auth";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getDb, type CaseRow } from "@/server/store/db.ts";

export async function POST(
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

  const body = await request.json();
  const { mechanismId, mechanismName, verdictType = "confirm", note = "" } = body;
  const author = access.actor.email; // Derive from session

  const adjId = randomUUID();
  const now = new Date().toISOString();

  // Find the most recent run for this case to link the adjudication
  const latestRun = db.prepare("SELECT id FROM runs WHERE case_id = ? ORDER BY created_at DESC LIMIT 1").get(id) as { id: string } | undefined;
  const runId = latestRun?.id || null;

  // Record adjudication
  db.prepare(`
    INSERT INTO adjudication (
      id, case_id, run_id, mechanism_id, verdict, note, by, at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?
    )
  `).run(
    adjId,
    id,
    runId,
    mechanismId || "MECH-TERM-PROGRESSIVE",
    verdictType,
    note,
    author,
    now,
  );

  // Update case status to in_review
  db.prepare(`
    UPDATE cases
    SET status = 'in_review',
        concluded_at = ?
    WHERE id = ?
  `).run(now, id);

  const updated = db.prepare("SELECT * FROM cases WHERE id = ?").get(id) as unknown as CaseRow;

  return NextResponse.json({
    success: true,
    case: updated,
    message: "Adjudicated. Added to the training corpus.",
  });
}
