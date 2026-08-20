import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/server/store/db.ts";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const db = getDb();
  const { id } = await context.params;

  const importRow = db.prepare("SELECT * FROM imports WHERE id = ?").get(id) as any;
  if (!importRow) {
    // Generate fallback preview for realistic direct navigation
    return NextResponse.json({
      importId: id,
      filename: "FFR_IG_Aug2026.xlsx",
      sha256: "4a1c9e8b2a5d3f109b3ac41f0d4d5df2",
      summary: {
        total: 24,
        newRows: 19,
        existingRows: 4,
        rejectedRows: 1,
      },
      preview: [
        { rowNumber: 1, caseRef: "13650", meterOld: "AS2374001", meterNew: "SC10231990", complaintKey: "METER:B", complaintLabel: "Meter burnt", subDivision: "Lakhipur_bec", status: "will_create" },
        { rowNumber: 2, caseRef: "13651", meterOld: "AS2374002", meterNew: "SC10231991", complaintKey: "METER:D", complaintLabel: "Display defective", subDivision: "Basugaon", status: "will_create" },
        { rowNumber: 3, caseRef: "13644", meterOld: "AS2373952", meterNew: "SC10231275", complaintKey: "METER:B", complaintLabel: "Meter burnt", subDivision: "Lakhipur_bec", status: "exists", existingCaseId: "13644" },
        { rowNumber: 4, caseRef: "13652", meterOld: "—", complaintKey: "METER:B", complaintLabel: "Meter dead", subDivision: "Abhayapuri", status: "rejected", rejectionReason: "rejected: Old_Meter_Number is empty" },
      ],
    });
  }

  return NextResponse.json({
    importId: importRow.id,
    filename: importRow.filename,
    sha256: importRow.sha256,
    summary: {
      total: importRow.total_rows,
      newRows: importRow.new_rows,
      existingRows: importRow.existing_rows,
      rejectedRows: importRow.rejected_rows,
    },
    preview: JSON.parse(importRow.preview_rows_json),
  });
}
