import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getDb, type CaseRow } from "@/server/store/db.ts";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const db = getDb();
  const { id } = await context.params;

  const caseRow = db.prepare("SELECT * FROM cases WHERE id = ?").get(id) as unknown as CaseRow | undefined;
  if (!caseRow) {
    return NextResponse.json({ error: `Case ${id} not found` }, { status: 404 });
  }

  const body = await request.json();
  const { mechanismId, mechanismName, verdictType = "confirm", note = "", author = "SS" } = body;

  const adjId = randomUUID();
  const now = new Date().toISOString();

  // Record adjudication
  db.prepare(`
    INSERT INTO adjudication (
      id, case_id, run_id, mechanism_id, verdict, note, by, at
    ) VALUES (
      ?, ?, NULL, ?, ?, ?, ?, ?
    )
  `).run(
    adjId,
    id,
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
