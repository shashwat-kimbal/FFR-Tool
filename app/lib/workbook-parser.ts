import * as XLSX from "xlsx";
import { classifyComplaint, pilotContract } from "./pilot-config";
import type {
  AppSettings,
  ArtifactKind,
  DerivedFeature,
  DlmsInspection,
  FfrRegisterInspection,
  FfrRow,
  ImageInspection,
  ProductFamily,
  UploadedArtifact,
} from "./pilot-types";

type SheetRows = Array<Array<unknown>>;

const expectedDlmsSheets: readonly string[] = pilotContract.dlmsWorkbook.expectedSheets;
const requiredFfrHeaders = pilotContract.ffrRegister.requiredHeaders;

function normalise(value: unknown) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

export function canonicalField(value: unknown) {
  return normalise(value)
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function ffrValue(row: FfrRow, configuredField: string) {
  return row.values[canonicalField(configuredField)] ?? "";
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

function parseFfrWorkbook(workbook: XLSX.WorkBook): Omit<FfrRegisterInspection, "artifact" | "messages"> | null {
  for (const sheetName of workbook.SheetNames) {
    const rows = rowsFor(workbook, sheetName);
    const headerIndex = findHeaderRow(rows, requiredFfrHeaders);
    if (headerIndex === -1) continue;
    const rawHeaders = rows[headerIndex].map((value) => String(value ?? "").trim());
    const labels = Object.fromEntries(rawHeaders.filter(Boolean).map((header) => [canonicalField(header), header.replace(/\s+/g, " ")]));
    const parsedRows: FfrRow[] = rows.slice(headerIndex + 1).flatMap((row, index) => {
      if (!row.some((value) => String(value ?? "").trim())) return [];
      const cells = rawHeaders.flatMap((header, column) => header
        ? [[canonicalField(header), String(row[column] ?? "").trim()] as const]
        : []);
      return [{
        rowNumber: headerIndex + index + 2,
        values: Object.fromEntries(cells),
        labels,
      }];
    });
    return { sheetName, rows: parsedRows, fields: Object.entries(labels).map(([key, label]) => ({ key, label })) };
  }
  return null;
}

async function sha256(buffer: ArrayBuffer) {
  if (!globalThis.crypto?.subtle) return null;
  const digest = await globalThis.crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function artifact(file: File, kind: ArtifactKind, detail: string, hash: string | null): UploadedArtifact {
  return { id: `${kind}:${file.name}:${file.lastModified}`, name: file.name, size: file.size, kind, detail, sha256: hash };
}

function exceedsLimit(file: File, settings: AppSettings) {
  return file.size > settings.uploadMaxMb * 1024 * 1024;
}

export async function inspectFfrRegister(file: File, settings: AppSettings): Promise<FfrRegisterInspection> {
  if (exceedsLimit(file, settings)) throw new Error(`The FFR register exceeds the configured ${settings.uploadMaxMb} MB upload limit.`);
  const buffer = await file.arrayBuffer();
  const hash = await sha256(buffer);
  try {
    const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
    const parsed = parseFfrWorkbook(workbook);
    if (!parsed) throw new Error("The workbook does not contain one sheet with every configured FFR register header.");
    return {
      ...parsed,
      artifact: artifact(file, "FFR_REGISTER", `${parsed.rows.length} selectable FFR case(s) detected in ${parsed.sheetName}`, hash),
      messages: ["Register validated. Select one case and the meter whose evidence will be uploaded next."],
    };
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "The selected file cannot be read as an FFR register.");
  }
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

function countProfileRows(rows: SheetRows) {
  const dataHeaderIndex = rows.findIndex((row) => row.some((value) => normalise(value).includes("METER RTC")));
  if (dataHeaderIndex === -1) return 0;
  return rows.slice(dataHeaderIndex + 1).filter((row) => row.some((value) => String(value ?? "").trim())).length;
}

function extractFeatures(workbook: XLSX.WorkBook, artifactName: string): DerivedFeature[] {
  const selfDiagnostic = rowsFor(workbook, "SelfDiagnostic");
  const ip = rowsFor(workbook, "IP");
  const blockLoad = rowsFor(workbook, "BlockLoadProfile");
  const features: DerivedFeature[] = [];
  const add = (code: string, label: string, value: string | number | boolean | undefined, sheet: string, locator: string) => {
    if (value !== undefined) features.push({ code, label, value, source: sheet, provenance: { sheet, locator, artifactName } });
  };
  add("self_diagnostic.status", "Self-diagnostic status", findTableValue(selfDiagnostic, "Status"), "SelfDiagnostic", "Detected header/value cell");
  add("self_diagnostic.rtc_battery", "RTC battery", findTableValue(selfDiagnostic, "RTC Battery"), "SelfDiagnostic", "Detected header/value cell");
  add("self_diagnostic.main_battery", "Main battery", findTableValue(selfDiagnostic, "Main Battery"), "SelfDiagnostic", "Detected header/value cell");
  add("ip.voltage", "Instantaneous voltage", findTableValue(ip, "Voltage"), "IP", "Detected header/value cell");
  add("ip.phase_current", "Phase current", findTableValue(ip, "Phase Current"), "IP", "Detected header/value cell");
  add("ip.power_factor", "Signed power factor", findTableValue(ip, "Signed Power Factor"), "IP", "Detected header/value cell");
  add("ip.programming_count", "Programming count", findTableValue(ip, "Cumulative programming count"), "IP", "Detected header/value cell");
  add("profile.block_load_records", "Block-load profile records", countProfileRows(blockLoad), "BlockLoadProfile", "Rows after detected Meter RTC data header");
  const events = [
    ["event.over_voltage.count", "Overvoltage event records", "VoltageRelatedEvent", "Over Voltage"],
    ["event.power_failure.count", "Power-failure event records", "PowerRelatedEvent", "Power failure"],
    ["event.current_reverse.count", "Current-reversal event records", "CurrentRelatedEvent", "Current reverse"],
    ["event.low_pf.count", "Low-PF event records", "OtherEvent", "Low PF"],
    ["event.rtc_change.count", "RTC transaction records", "TransactionEvent", "Real Time Clock"],
  ] as const;
  events.forEach(([code, label, sheet, phrase]) => add(code, label, countEvents(rowsFor(workbook, sheet), phrase), sheet, `Occurrences containing ${phrase}`));
  return features;
}

function isDlmsWorkbook(workbook: XLSX.WorkBook) {
  const names = workbook.SheetNames;
  const hasMandatorySheets = pilotContract.dlmsWorkbook.mandatorySheets.every((sheet) => names.includes(sheet));
  const hasProfile = names.some((name) => name.includes("Profile"));
  const hasEvent = names.some((name) => name.includes("Event"));
  return hasMandatorySheets && hasProfile && hasEvent;
}

export async function inspectDlmsWorkbook(file: File, expectedMeterId: string, settings: AppSettings): Promise<DlmsInspection> {
  if (exceedsLimit(file, settings)) throw new Error(`The DLMS package exceeds the configured ${settings.uploadMaxMb} MB upload limit.`);
  const buffer = await file.arrayBuffer();
  const hash = await sha256(buffer);
  try {
    const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
    if (!isDlmsWorkbook(workbook)) throw new Error("The workbook is not a supported BCS/DLMS package. MeterConfiguration, SelfDiagnostic, IP, profile, and event sheets are required.");
    const meterId = dlmsMeterId(workbook);
    const identityState = meterId && meterKey(meterId) === meterKey(expectedMeterId) ? "READY_TO_ANALYZE" : "IDENTITY_NO_MATCH";
    const sheetCount = workbook.SheetNames.filter((name) => expectedDlmsSheets.includes(name)).length;
    const messages = identityState === "READY_TO_ANALYZE"
      ? ["DLMS identity exactly matches the selected meter. Image evidence can now be attached to this case."]
      : [`DLMS meter ${meterId ?? "was not extracted"} does not match selected meter ${expectedMeterId}. Upload the correct DLMS workbook or choose a different meter from the register.`];
    return {
      artifact: artifact(file, "DLMS_PACKAGE", `${sheetCount} of ${expectedDlmsSheets.length} expected sheets detected`, hash),
      meterId,
      expectedMeterId,
      identityState,
      features: extractFeatures(workbook, file.name),
      messages,
    };
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "The selected file cannot be read as a BCS/DLMS package.");
  }
}

function imageMimeFromSignature(header: Uint8Array) {
  const starts = (...bytes: number[]) => bytes.every((byte, index) => header[index] === byte);
  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "PNG";
  if (starts(0xff, 0xd8, 0xff)) return "JPEG";
  if (starts(0x52, 0x49, 0x46, 0x46) && String.fromCharCode(...header.slice(8, 12)) === "WEBP") return "WEBP";
  return null;
}

export async function inspectImageEvidence(files: File[], settings: AppSettings): Promise<ImageInspection> {
  const artifacts: UploadedArtifact[] = [];
  const messages: string[] = [];
  for (const file of files) {
    if (exceedsLimit(file, settings)) {
      artifacts.push(artifact(file, "UNRECOGNIZED", `File exceeds the configured ${settings.uploadMaxMb} MB upload limit`, null));
      continue;
    }
    const buffer = await file.arrayBuffer();
    const signature = imageMimeFromSignature(new Uint8Array(buffer.slice(0, 12)));
    const hash = await sha256(buffer);
    if (!signature) {
      artifacts.push(artifact(file, "UNRECOGNIZED", "Rejected: the file signature is not PNG, JPEG, or WebP", hash));
      continue;
    }
    artifacts.push(artifact(file, "IMAGE", `${signature} signature validated; image analysis is not implemented in this build`, hash));
  }
  if (!artifacts.length) messages.push("No images were supplied. This build records the omission but does not fabricate visual findings.");
  return { artifacts, messages };
}

export function classifyFfrCase(row: FfrRow, settings: AppSettings) {
  let productFamily: ProductFamily | null = null;
  for (const mapping of settings.productMappings) {
    if (normalise(ffrValue(row, mapping.sourceField)) === normalise(mapping.sourceValue)) {
      productFamily = mapping.productFamily;
      break;
    }
  }
  const complaint = classifyComplaint(productFamily, [
    ffrValue(row, "Defect Trigger"),
    ffrValue(row, "Symptoms of the problem New"),
    ffrValue(row, "Field Observation"),
    ffrValue(row, "Field Person visit Observation Report"),
  ]);
  return { productFamily, complaintKey: complaint?.key ?? null, complaintLabel: complaint?.label ?? null };
}
