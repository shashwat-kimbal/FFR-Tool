import { getGovernanceAccess } from "@/app/lib/governance-auth";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/server/store/db.ts";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const access = await getGovernanceAccess(request);
  if (access.kind !== "authorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const { id } = await context.params;

  const importRow = db.prepare("SELECT * FROM imports WHERE id = ?").get(id) as any;
  let createdCount = 0;
  let skippedCount = 0;

  if (importRow) {
    const previewRows = JSON.parse(importRow.preview_rows_json);
    const insertCase = db.prepare(`
      INSERT OR IGNORE INTO cases (
        id, case_ref, register_hash, register_row, status, assignee_email,
        priority, meter_old, meter_new, complaint_key, complaint_label,
        product_family, sub_division, defect_date, field_observation,
        age_days, created_at
      ) VALUES (
        ?, ?, ?, ?, 'open', ?, 'normal', ?, ?, ?, ?, 'METER', ?, ?, ?, 1, ?
      )
    `);

    for (const r of previewRows) {
      if (r.status === "will_create") {
        const result = insertCase.run(
          r.caseRef,
          r.caseRef,
          importRow.sha256.substring(0, 16),
          r.rowNumber,
          access.actor.email,
          r.meterOld,
          r.meterNew || null,
          r.complaintKey,
          r.complaintLabel,
          r.subDivision || "Lakhipur_bec",
          r.defectDate || "2026-06-16",
          r.fieldObservation || r.complaintLabel,
          new Date().toISOString(),
        );
        if (result.changes > 0) {
          createdCount++;
        } else {
          skippedCount++;
        }
      } else {
        skippedCount++;
      }
    }
  } else {
    return NextResponse.json(
      { success: false, error: "Import not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    created: createdCount,
    skipped: skippedCount,
    message: `${createdCount} cases created`,
  });
}
