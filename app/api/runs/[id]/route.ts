import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/server/store/db.ts";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const db = getDb();
  const { id } = await context.params;

  const runRow = db.prepare("SELECT * FROM runs WHERE id = ?").get(id) as any;
  if (!runRow) {
    return NextResponse.json({ error: `Run ${id} not found` }, { status: 404 });
  }

  return NextResponse.json({
    run: {
      ...runRow,
      dials: runRow.dials_json ? JSON.parse(runRow.dials_json) : null,
      ledger: runRow.ledger_json ? JSON.parse(runRow.ledger_json) : null,
      timeline: runRow.timeline_json ? JSON.parse(runRow.timeline_json) : null,
      nextTests: runRow.next_tests_json ? JSON.parse(runRow.next_tests_json) : [],
      alternatives: runRow.alternatives_json ? JSON.parse(runRow.alternatives_json) : [],
    },
  });
}
