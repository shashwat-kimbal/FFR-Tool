import * as XLSX from "xlsx";
import { classifyComplaint, pilotContract } from "./pilot-config";
import type { AnalysisPackage, AppSettings, ArtifactKind, DerivedFeature, FfrRow, ProductFamily, UploadedArtifact } from "./pilot-types";

type SheetRows = Array<Array<unknown>>;

const expectedDlmsSheets: readonly string[] = pilotContract.dlmsWorkbook.expectedSheets;
const requiredFfrHeaders = pilotContract.ffrRegister.requiredHeaders;

function normalise(value: unknown) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

function meterKey(value: unknown) {
  return normalise(value).replace(/[\s-]/g, "");
}

function rowsFor(workbook: XLSX.WorkBook, sheetName: string): SheetRows {
  const sheet = workbook.Sheets[sheetName];
  return sheet ? (XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false }) as SheetRows) : [];
}

function findHeaderRow(rows: SheetRows, requiredHeaders: string[]) {
  return rows.findIndex((row) => {
    const headers = row.map(normalise);
    const nonEmptyHeaders = headers.filter(Boolean);
    const hasDuplicateHeader = new Set(nonEmptyHeaders).size !== nonEmptyHeaders.length;
    return !hasDuplicateHeader && requiredHeaders.every((header) => headers.includes(normalise(header)));
  });
}

function ffrRows(workbook: XLSX.WorkBook) {
  for (const sheetName of workbook.SheetNames) {
    const rows = rowsFor(workbook, sheetName);
    const headerIndex = findHeaderRow(rows, requiredFfrHeaders);
    if (headerIndex === -1) continue;
    const headers = rows[headerIndex].map((value) => String(value ?? "").trim());
    const entries: FfrRow[] = rows.slice(headerIndex + 1).flatMap((row, index) => {
      if (!row.some((value) => String(value ?? "").trim())) return [];
      return [{
        rowNumber: headerIndex + index + 2,
        values: Object.fromEntries(headers.map((header, column) => [header, String(row[column] ?? "").trim()])),
      }];
    });
    return entries;
  }
  return [];
}

function dlmsMeterId(workbook: XLSX.WorkBook) {
  const rows = rowsFor(workbook, "MeterConfiguration");
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const column = rows[rowIndex].findIndex((value) => normalise(value).includes("METER SERIAL NUMBER"));
    if (column === -1) continue;
    for (let valueRow = rowIndex + 1; valueRow < rows.length; valueRow += 1) {
      const candidate = String(rows[valueRow][column] ?? "").trim();
      if (candidate) return candidate;
    }
  }
  return null;
}

function findTableValue(rows: SheetRows, headerIncludes: string) {
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const column = rows[rowIndex].findIndex((value) => normalise(value).includes(normalise(headerIncludes)));
    if (column === -1) continue;
    for (let valueRow = rowIndex + 1; valueRow < rows.length; valueRow += 1) {
      const candidate = rows[valueRow][column];
      if (candidate !== "" && candidate !== undefined && candidate !== null) return candidate as string | number | boolean;
    }
  }
  return undefined;
}

function countEvents(rows: SheetRows, phrase: string) {
  return rows.flat().filter((value) => normalise(value).includes(normalise(phrase))).length;
}

function extractFeatures(workbook: XLSX.WorkBook): DerivedFeature[] {
  const selfDiagnostic = rowsFor(workbook, "SelfDiagnostic");
  const ip = rowsFor(workbook, "IP");
  const blockLoad = rowsFor(workbook, "BlockLoadProfile");
  const features: DerivedFeature[] = [];
  const add = (code: string, label: string, value: string | number | boolean | undefined, source: string) => {
    if (value !== undefined) features.push({ code, label, value, source });
  };
  add("self_diagnostic.status", "Self-diagnostic status", findTableValue(selfDiagnostic, "Status"), "SelfDiagnostic");
  add("self_diagnostic.rtc_battery", "RTC battery", findTableValue(selfDiagnostic, "RTC Battery"), "SelfDiagnostic");
  add("self_diagnostic.main_battery", "Main battery", findTableValue(selfDiagnostic, "Main Battery"), "SelfDiagnostic");
  add("ip.voltage", "Instantaneous voltage", findTableValue(ip, "Voltage"), "IP");
  add("ip.phase_current", "Phase current", findTableValue(ip, "Phase Current"), "IP");
  add("ip.power_factor", "Signed power factor", findTableValue(ip, "Signed Power Factor"), "IP");
  add("ip.programming_count", "Programming count", findTableValue(ip, "Cumulative programming count"), "IP");
  add("profile.block_load_records", "Block-load profile records", Math.max(0, blockLoad.length - 3), "BlockLoadProfile");
  const events = [
    ["event.over_voltage.count", "Overvoltage event records", "VoltageRelatedEvent", "Over Voltage"],
    ["event.power_failure.count", "Power-failure event records", "PowerRelatedEvent", "Power failure"],
    ["event.current_reverse.count", "Current-reversal event records", "CurrentRelatedEvent", "Current reverse"],
    ["event.low_pf.count", "Low-PF event records", "OtherEvent", "Low PF"],
    ["event.rtc_change.count", "RTC transaction records", "TransactionEvent", "Real Time Clock"],
  ] as const;
  events.forEach(([code, label, sheet, phrase]) => add(code, label, countEvents(rowsFor(workbook, sheet), phrase), sheet));
  return features;
}

function detectProductFamily(row: FfrRow | null, settings: AppSettings): ProductFamily | null {
  if (!row) return null;
  for (const mapping of settings.productMappings) {
    if (normalise(row.values[mapping.sourceField]) === normalise(mapping.sourceValue)) return mapping.productFamily;
  }
  return null;
}

function classifyWorkbook(workbook: XLSX.WorkBook): ArtifactKind {
  if (ffrRows(workbook).length) return "FFR_REGISTER";
  const names = workbook.SheetNames;
  const hasCore = ["MeterConfiguration", "SelfDiagnostic", "IP"].every((sheet) => names.includes(sheet));
  const hasProfile = names.some((name) => name.includes("Profile"));
  const hasEvent = names.some((name) => name.includes("Event"));
  return hasCore && hasProfile && hasEvent ? "DLMS_PACKAGE" : "UNRECOGNIZED";
}

export async function inspectFiles(files: File[], settings: AppSettings): Promise<AnalysisPackage> {
  const artifacts: UploadedArtifact[] = [];
  let ffr: XLSX.WorkBook | null = null;
  let dlms: XLSX.WorkBook | null = null;
  let images = 0;
  const messages: string[] = [];
  for (const file of files) {
    if (file.size > settings.uploadMaxMb * 1024 * 1024) {
      artifacts.push({ id: file.name, name: file.name, size: file.size, kind: "UNRECOGNIZED", detail: `File exceeds the configured ${settings.uploadMaxMb} MB upload limit` });
      continue;
    }
    const isImage = file.type.startsWith("image/") || /\.(jpg|jpeg|png|webp)$/i.test(file.name);
    if (isImage) {
      images += 1;
      artifacts.push({ id: file.name, name: file.name, size: file.size, kind: "IMAGE", detail: "Image evidence retained for view classification" });
      continue;
    }
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
      const kind = classifyWorkbook(workbook);
      const detail =
        kind === "FFR_REGISTER"
          ? `${ffrRows(workbook).length} FFR row(s) detected`
          : kind === "DLMS_PACKAGE"
            ? `${workbook.SheetNames.filter((name) => expectedDlmsSheets.includes(name)).length} of 16 expected sheets detected`
            : "Workbook signature is not recognised";
      artifacts.push({ id: file.name, name: file.name, size: file.size, kind, detail });
      if (kind === "FFR_REGISTER") ffr = workbook;
      if (kind === "DLMS_PACKAGE") dlms = workbook;
    } catch {
      artifacts.push({ id: file.name, name: file.name, size: file.size, kind: "UNRECOGNIZED", detail: "File cannot be read as a supported workbook or image" });
    }
  }

  const registerRows = ffr ? ffrRows(ffr) : [];
  const meterId = dlms ? dlmsMeterId(dlms) : null;
  const features = dlms ? extractFeatures(dlms) : [];
  const matches = meterId
    ? registerRows.filter((row) => [row.values.Old_Meter_Number, row.values.New_Meter_Number].some((value) => meterKey(value) === meterKey(meterId)))
    : [];
  const matchedRow = matches.length === 1 ? matches[0] : null;
  const productFamily = detectProductFamily(matchedRow, settings);
  const complaint = matchedRow
    ? classifyComplaint(productFamily, [
        matchedRow.values["Defect Trigger"],
        matchedRow.values["Symptoms of the problem New"],
        matchedRow.values["Field Observation"],
        matchedRow.values["Field Person visit Observation Report"],
      ])
    : null;
  let identityState: AnalysisPackage["identityState"] = "AWAITING_FILES";
  if (ffr && dlms && meterId) identityState = matches.length === 1 ? "READY_TO_ANALYZE" : matches.length ? "IDENTITY_AMBIGUOUS" : "IDENTITY_NO_MATCH";
  if (identityState === "IDENTITY_NO_MATCH") messages.push(`DLMS meter ${meterId} does not exactly match an FFR Old_Meter_Number or New_Meter_Number. No analysis or workbook update can proceed.`);
  if (identityState === "IDENTITY_AMBIGUOUS") messages.push(`DLMS meter ${meterId} matches more than one FFR row. An authorised resolution is required.`);
  if (ffr && !dlms) messages.push("A valid FFR register was detected, but the required DLMS workbook is missing.");
  if (dlms && !ffr) messages.push("A valid DLMS workbook was detected, but the required FFR register is missing.");
  if (matchedRow && !productFamily) messages.push("The FFR row matched, but no approved product-family mapping applies. Add a mapping in Settings.");
  if (images === 0) messages.push("No images were supplied. This is a non-blocking evidence warning until an active rule requires an image view.");
  return {
    artifacts,
    ffrRows: registerRows,
    dlmsMeterId: meterId,
    dlmsFeatures: features,
    imageCount: images,
    identityState,
    matchedRow,
    productFamily,
    complaintKey: complaint?.key ?? null,
    complaintLabel: complaint?.label ?? null,
    messages,
  };
}
