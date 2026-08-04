import * as XLSX from "xlsx";
import {
  analyzeDlmsWorkbook,
  defaultProvisionalRuleProfile,
  extractAdapterIdentity,
  genericProvisionalBundle,
  inspectAdapterWorkbookStructure,
  resolveDlmsAdapter,
  type AdapterDefinition,
  type ProvisionalRuleProfile,
  type RuleBundle,
} from "./dlms-analysis";
import { classifyComplaint, pilotContract } from "./pilot-config";
import type {
  AppSettings,
  ArtifactKind,
  DlmsInspection,
  FfrRegisterInspection,
  FfrRow,
  ImageInspection,
  ProductFamily,
  UploadedArtifact,
} from "./pilot-types";

type SheetRows = Array<Array<unknown>>;

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
  return sheet
    ? (XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: "",
        raw: false,
      }) as SheetRows)
    : [];
}

function findHeaderRow(rows: SheetRows, requiredHeaders: string[]) {
  return rows.findIndex((row) => {
    const headers = row.map(normalise);
    const nonEmptyHeaders = headers.filter(Boolean);
    const hasDuplicateHeader =
      new Set(nonEmptyHeaders).size !== nonEmptyHeaders.length;
    return (
      !hasDuplicateHeader &&
      requiredHeaders.every((header) => headers.includes(normalise(header)))
    );
  });
}

function parseFfrWorkbook(
  workbook: XLSX.WorkBook,
): Omit<FfrRegisterInspection, "artifact" | "messages"> | null {
  for (const sheetName of workbook.SheetNames) {
    const rows = rowsFor(workbook, sheetName);
    const headerIndex = findHeaderRow(rows, requiredFfrHeaders);
    if (headerIndex === -1) continue;
    const rawHeaders = rows[headerIndex].map((value) =>
      String(value ?? "").trim(),
    );
    const labels = Object.fromEntries(
      rawHeaders
        .filter(Boolean)
        .map((header) => [canonicalField(header), header.replace(/\s+/g, " ")]),
    );
    const parsedRows: FfrRow[] = rows
      .slice(headerIndex + 1)
      .flatMap((row, index) => {
        if (!row.some((value) => String(value ?? "").trim())) return [];
        const cells = rawHeaders.flatMap((header, column) =>
          header
            ? [
                [
                  canonicalField(header),
                  String(row[column] ?? "").trim(),
                ] as const,
              ]
            : [],
        );
        return [
          {
            rowNumber: headerIndex + index + 2,
            values: Object.fromEntries(cells),
            labels,
          },
        ];
      });
    return {
      sheetName,
      rows: parsedRows,
      fields: Object.entries(labels).map(([key, label]) => ({ key, label })),
    };
  }
  return null;
}

async function sha256(buffer: ArrayBuffer) {
  if (!globalThis.crypto?.subtle) return null;
  const digest = await globalThis.crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function artifact(
  file: File,
  kind: ArtifactKind,
  detail: string,
  hash: string | null,
): UploadedArtifact {
  return {
    id: `${kind}:${file.name}:${file.lastModified}`,
    name: file.name,
    size: file.size,
    kind,
    detail,
    sha256: hash,
  };
}

function exceedsLimit(file: File, settings: AppSettings) {
  return file.size > settings.uploadMaxMb * 1024 * 1024;
}

export async function inspectFfrRegister(
  file: File,
  settings: AppSettings,
): Promise<FfrRegisterInspection> {
  if (exceedsLimit(file, settings))
    throw new Error(
      `The FFR register exceeds the configured ${settings.uploadMaxMb} MB upload limit.`,
    );
  const buffer = await file.arrayBuffer();
  const hash = await sha256(buffer);
  try {
    const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
    const parsed = parseFfrWorkbook(workbook);
    if (!parsed)
      throw new Error(
        "The workbook does not contain one sheet with every configured FFR register header.",
      );
    return {
      ...parsed,
      artifact: artifact(
        file,
        "FFR_REGISTER",
        `${parsed.rows.length} selectable FFR case(s) detected in ${parsed.sheetName}`,
        hash,
      ),
      messages: [
        "Register validated. Select one case and the meter whose evidence will be uploaded next.",
      ],
    };
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? error.message
        : "The selected file cannot be read as an FFR register.",
    );
  }
}

export interface DlmsCaseContext {
  productFamily?: ProductFamily | null;
  complaintKey?: string | null;
  productMappingValid?: boolean;
  complaintMappingValid?: boolean;
  /** Full shared adapter definition; omit only for the seeded BCS adapter. */
  adapter?: AdapterDefinition;
  /** Explicitly true only when the shared mapping selects a dedicated adapter. */
  dedicatedAdapterConfigured?: boolean;
}

function normaliseDlmsCaseContext(
  input: DlmsCaseContext | ProductFamily | null | undefined,
): DlmsCaseContext {
  if (typeof input === "string") return { productFamily: input };
  return input ?? {};
}

export async function inspectDlmsWorkbook(
  file: File,
  expectedMeterId: string,
  settings: AppSettings,
  profile: ProvisionalRuleProfile = defaultProvisionalRuleProfile,
  bundle: RuleBundle = genericProvisionalBundle,
  caseContext: DlmsCaseContext | ProductFamily | null = null,
): Promise<DlmsInspection> {
  if (exceedsLimit(file, settings))
    throw new Error(
      `The DLMS package exceeds the configured ${settings.uploadMaxMb} MB upload limit.`,
    );
  const buffer = await file.arrayBuffer();
  const hash = await sha256(buffer);
  try {
    const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
    const context = normaliseDlmsCaseContext(caseContext);
    const adapter = resolveDlmsAdapter(bundle, context.adapter);
    const structure = inspectAdapterWorkbookStructure(workbook, adapter);
    if (!structure.supported) {
      throw new Error(
        `The workbook is not supported by adapter ${adapter.id}. Missing mandatory sheet(s): ${structure.missingMandatorySheets.join(", ")}.`,
      );
    }
    const meterId = extractAdapterIdentity(workbook, adapter).meterId;
    const identityState =
      meterId && meterKey(meterId) === meterKey(expectedMeterId)
        ? "READY_TO_ANALYZE"
        : "IDENTITY_NO_MATCH";
    const productFamily = context.productFamily ?? null;
    const adapterMapping = productFamily
      ? settings.adapterMappings.find(
          (mapping) => mapping.productFamily === productFamily,
        )
      : null;
    const productMappingValid =
      context.productMappingValid ?? Boolean(productFamily);
    const complaintKey = context.complaintKey ?? null;
    const complaintMappingValid =
      context.complaintMappingValid ??
      Boolean(
        complaintKey && !normalise(complaintKey).endsWith(":UNCLASSIFIED"),
      );
    const dedicatedAdapterConfigured =
      context.dedicatedAdapterConfigured ??
      Boolean(
        adapterMapping?.evidenceMode === "direct" &&
          adapterMapping.adapterId === adapter.id,
      );
    const analysis = analyzeDlmsWorkbook(workbook, file.name, profile, bundle, {
      productFamily,
      complaintKey,
      identityMatched: identityState === "READY_TO_ANALYZE",
      productMappingValid,
      complaintMappingValid,
      dedicatedAdapterConfigured,
      adapter,
    });
    const messages =
      identityState !== "READY_TO_ANALYZE"
        ? [
            `DLMS meter ${meterId ?? "was not extracted"} does not match selected meter ${expectedMeterId}. The 60-check technical analysis is still available, but every case-specific complaint-context finding, RCA, CAPA, and write-back remains blocked.`,
          ]
        : !analysis.scope.productMappingValid
          ? [
              "DLMS identity exactly matches the selected meter. Technical checks are available, but case-specific complaint-context findings remain blocked until the FFR product value has a valid shared mapping.",
            ]
          : !analysis.scope.complaintMappingValid
            ? [
                "DLMS identity exactly matches the selected meter. Technical checks are available, but case-specific complaint-context findings remain blocked until the FFR complaint has a valid shared mapping.",
              ]
            : [
                "DLMS identity exactly matches the selected meter. Technical checks are available and complaint-context checks have been filtered by the configured product and complaint scopes.",
              ];
    return {
      artifact: artifact(
        file,
        "DLMS_PACKAGE",
        `${structure.detectedExpectedSheets.length} of ${structure.expectedSheets.length} adapter sheets detected`,
        hash,
      ),
      meterId,
      expectedMeterId,
      identityState,
      features: analysis.features,
      analysis,
      messages,
    };
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? error.message
        : "The selected file cannot be read as a BCS/DLMS package.",
    );
  }
}

function imageMimeFromSignature(header: Uint8Array) {
  const starts = (...bytes: number[]) =>
    bytes.every((byte, index) => header[index] === byte);
  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "PNG";
  if (starts(0xff, 0xd8, 0xff)) return "JPEG";
  if (
    starts(0x52, 0x49, 0x46, 0x46) &&
    String.fromCharCode(...header.slice(8, 12)) === "WEBP"
  )
    return "WEBP";
  return null;
}

export async function inspectImageEvidence(
  files: File[],
  settings: AppSettings,
): Promise<ImageInspection> {
  const artifacts: UploadedArtifact[] = [];
  const messages: string[] = [];
  for (const file of files) {
    if (exceedsLimit(file, settings)) {
      artifacts.push(
        artifact(
          file,
          "UNRECOGNIZED",
          `File exceeds the configured ${settings.uploadMaxMb} MB upload limit`,
          null,
        ),
      );
      continue;
    }
    const buffer = await file.arrayBuffer();
    const signature = imageMimeFromSignature(
      new Uint8Array(buffer.slice(0, 12)),
    );
    const hash = await sha256(buffer);
    if (!signature) {
      artifacts.push(
        artifact(
          file,
          "UNRECOGNIZED",
          "Rejected: the file signature is not PNG, JPEG, or WebP",
          hash,
        ),
      );
      continue;
    }
    artifacts.push(
      artifact(
        file,
        "IMAGE",
        `${signature} signature validated; image analysis is not implemented in this build`,
        hash,
      ),
    );
  }
  if (!artifacts.length)
    messages.push(
      "No images were supplied. This build records the omission but does not fabricate visual findings.",
    );
  return { artifacts, messages };
}

export function classifyFfrCase(row: FfrRow, settings: AppSettings) {
  let productFamily: ProductFamily | null = null;
  for (const mapping of settings.productMappings) {
    if (
      normalise(ffrValue(row, mapping.sourceField)) ===
      normalise(mapping.sourceValue)
    ) {
      productFamily = mapping.productFamily;
      break;
    }
  }
  const complaint = classifyComplaint(
    productFamily,
    [
      ffrValue(row, "Defect Trigger"),
      ffrValue(row, "Symptoms of the problem New"),
      ffrValue(row, "Field Observation"),
      ffrValue(row, "Field Person visit Observation Report"),
    ],
    settings.complaintMappings,
  );
  return {
    productFamily,
    complaintKey: complaint?.key ?? null,
    complaintLabel: complaint?.label ?? null,
  };
}
