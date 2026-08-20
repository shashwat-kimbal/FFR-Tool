import { NextRequest, NextResponse } from "next/server";
import { createHash, randomUUID } from "node:crypto";
import * as XLSX from "xlsx";
import { getDb } from "@/server/store/db.ts";

export interface ReconciliationRow {
  rowNumber: number;
  caseRef: string;
  meterOld: string;
  meterNew?: string;
  complaintKey: string;
  complaintLabel: string;
  subDivision: string;
  defectDate: string;
  fieldObservation: string;
  status: "will_create" | "exists" | "rejected";
  existingCaseId?: string;
  rejectionReason?: string;
}

export async function POST(request: NextRequest) {
  const db = getDb();

  let fileBuffer: Buffer;
  let filename = "FFR_Register.xlsx";

  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file attached" }, { status: 400 });
    }
    filename = file.name;
    const ab = await file.arrayBuffer();
    fileBuffer = Buffer.from(ab);
  } else {
    const ab = await request.arrayBuffer();
    if (!ab || ab.byteLength === 0) {
      return NextResponse.json({ error: "Empty file payload" }, { status: 400 });
    }
    fileBuffer = Buffer.from(ab);
  }

  const sha256 = createHash("sha256").update(fileBuffer).digest("hex");
  const registerHash = sha256.substring(0, 16);

  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(fileBuffer, { type: "buffer", cellDates: true });
  } catch (err: any) {
    return NextResponse.json({ error: `Failed to parse workbook: ${err.message}` }, { status: 400 });
  }

  const firstSheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[firstSheetName];
  const rawRows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  if (!rawRows.length) {
    return NextResponse.json({ error: "Register sheet has no data rows" }, { status: 400 });
  }

  const previewRows: ReconciliationRow[] = [];
  let newRowsCount = 0;
  let existingRowsCount = 0;
  let rejectedRowsCount = 0;

  for (let i = 0; i < rawRows.length; i++) {
    const r = rawRows[i];
    const rowNum = i + 1;
    const caseRef = String(r["S.No"] || r["FFR_ID"] || r["Case"] || r["Case Ref"] || (13650 + i)).trim();
    const meterOld = String(r["Old_Meter_Number"] || r["Old Meter"] || r["Defective Serial"] || "").trim();
    const meterNew = String(r["New_Meter_Number"] || r["New Meter"] || r["Replacement Serial"] || "").trim();
    const subDivision = String(r["Sub-Division"] || r["SubDivision"] || r["Feeder"] || "Lakhipur_bec").trim();
    const defectTrigger = String(r["Defect Trigger"] || r["Symptoms of the problem New"] || r["Complaint"] || "Meter Burnt").trim();
    const fieldObs = String(r["Field Observation"] || r["Field Person visit Observation Report"] || defectTrigger).trim();
    const defectDate = String(r["Date"] || r["Defect Date"] || r["Complaint Date"] || "").trim();

    // Validate rejection
    if (!meterOld) {
      rejectedRowsCount++;
      previewRows.push({
        rowNumber: rowNum,
        caseRef: caseRef || `ROW-${rowNum}`,
        meterOld: "—",
        complaintKey: "UNKNOWN",
        complaintLabel: defectTrigger || "Unknown",
        subDivision,
        defectDate,
        fieldObservation: fieldObs,
        status: "rejected",
        rejectionReason: "rejected: Old_Meter_Number is empty",
      });
      continue;
    }

    // Check if case exists in DB
    const existing = db.prepare("SELECT id, case_ref FROM cases WHERE case_ref = ? OR meter_old = ?").get(caseRef, meterOld) as any;
    if (existing) {
      existingRowsCount++;
      previewRows.push({
        rowNumber: rowNum,
        caseRef,
        meterOld,
        meterNew,
        complaintKey: defectTrigger.toLowerCase().includes("burnt") ? "METER:B" : "METER:D",
        complaintLabel: defectTrigger,
        subDivision,
        defectDate,
        fieldObservation: fieldObs,
        status: "exists",
        existingCaseId: existing.id,
      });
    } else {
      newRowsCount++;
      previewRows.push({
        rowNumber: rowNum,
        caseRef,
        meterOld,
        meterNew,
        complaintKey: defectTrigger.toLowerCase().includes("burnt") ? "METER:B" : "METER:D",
        complaintLabel: defectTrigger,
        subDivision,
        defectDate,
        fieldObservation: fieldObs,
        status: "will_create",
      });
    }
  }



  const importId = randomUUID();
  const insertImport = db.prepare(`
    INSERT INTO imports (
      id, filename, sha256, total_rows, newRows, existing_rows, rejected_rows, preview_rows_json, created_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
  `);

  insertImport.run(
    importId,
    filename,
    sha256,
    previewRows.length,
    newRowsCount,
    existingRowsCount,
    rejectedRowsCount,
    JSON.stringify(previewRows),
    new Date().toISOString(),
  );

  return NextResponse.json({
    importId,
    filename,
    sha256,
    summary: {
      total: previewRows.length,
      newRows: newRowsCount,
      existingRows: existingRowsCount,
      rejectedRows: rejectedRowsCount,
    },
    preview: previewRows,
  });
}
