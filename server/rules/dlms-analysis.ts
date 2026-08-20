import * as XLSX from "xlsx";
import bcs16AdapterSeed from "../../config/dlms-adapter-bcs-16-sheet.v1.json" with { type: "json" };
import provisionalProfileSeed from "../../config/dlms-provisional-profile.v1.json" with { type: "json" };
import genericProvisionalSeed from "../../rules/bundles/generic-provisional-v1.json" with { type: "json" };
import {
  analyzeCensoredStream,
  analyzeTruncation,
  analyzeDose,
  analyzeCoincidence,
  analyzeDecoupling,
  analyzeTestimonyConflict,
  reconstructStory,
  type FirstPrinciplesPatterns,
} from "../inference/patterns.ts";
import { evaluateVerdict, type VerdictObject } from "../inference/verdict-engine.ts";

/**
 * The analysis library intentionally keeps rule content as serializable data.
 * UI, persistence, and future vendor adapters can replace this bundle without
 * changing the evaluator itself.
 */
export type FindingStatus = "pass" | "attention" | "not_assessed";
export type FindingSeverity = "info" | "warning" | "high";
export type RuleLifecycle =
  | "draft"
  | "in_review"
  | "provisional_active"
  | "approved_active"
  | "retired";
export type RuleOperator =
  | "exists"
  | "missing"
  | "equals"
  | "not_equals"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "outside";

export interface SourceReference {
  sheet: string;
  locator: string;
  artifactName: string;
}

export interface AnalysisFeature {
  code: string;
  label: string;
  value: string | number | boolean;
  source: string;
  provenance: SourceReference;
  dataQuality?: "normal" | "warning";
}

export interface RuleExpression {
  fact?: string;
  operator?: RuleOperator;
  value?: string | number | boolean;
  lowerParameter?: string;
  upperParameter?: string;
  parameter?: string;
  all?: RuleExpression[];
  any?: RuleExpression[];
  not?: RuleExpression;
}

export interface RuleDefinition {
  id: string;
  group:
    | "Foundation"
    | "Profile & data quality"
    | "Events"
    | "Complaint context";
  title: string;
  productFamilies: Array<"METER" | "NIC" | "GATEWAY">;
  complaintKeys: string[];
  enabled: boolean;
  severity: FindingSeverity;
  expression: RuleExpression;
  why: string;
  limitation: string;
  followUp: string;
}

export interface ProvisionalRuleProfile {
  id: string;
  version: string;
  title: string;
  status: "provisional" | "approved";
  parameters: Record<string, number>;
  descriptions: Record<string, string>;
}

export interface AdapterDefinition {
  id: string;
  version: string;
  title: string;
  mandatorySheets: string[];
  optionalSheets: string[];
  identitySheet: string;
  identityHeader: string;
  /**
   * Optional feature locations are adapter data.  The BCS seed relies on the
   * conventional names below, while a governed adapter can replace any of
   * them without changing the evaluator.
   */
  sheetMappings?: Partial<Record<AdapterSheetRole, string>>;
  /** Optional aliases for labels that vary by manufacturer/export version. */
  headerMappings?: Partial<Record<AdapterHeaderRole, string | string[]>>;
  /** Optional phrases used to identify configured event records. */
  eventPhrases?: Partial<Record<AdapterEventRole, string>>;
}

export type AdapterSheetRole =
  | "configuration"
  | "selfDiagnostic"
  | "instantaneous"
  | "blockLoadProfile"
  | "currentEvent"
  | "otherEvent"
  | "controlEvent"
  | "powerEvent"
  | "transactionEvent"
  | "voltageEvent";

export type AdapterHeaderRole =
  | "meterSerial"
  | "model"
  | "ratedVoltage"
  | "ratedCurrent"
  | "selfDiagnosticStatus"
  | "rtcBattery"
  | "mainBattery"
  | "voltage"
  | "phaseCurrent"
  | "powerFactor"
  | "activePower"
  | "programmingCount"
  | "profileTimestamp";

export type AdapterEventRole =
  | "overVoltage"
  | "underVoltage"
  | "powerFailure"
  | "currentReverse"
  | "lowPowerFactor"
  | "rtcChange"
  | "tamper"
  | "occurrence"
  | "restoration"
  | "connect"
  | "disconnect"
  | "loadLimit";

export interface RuleBundle {
  id: string;
  version: string;
  title: string;
  lifecycle: RuleLifecycle;
  adapterId: string;
  profileId: string;
  productFamilies: Array<"METER" | "NIC" | "GATEWAY">;
  rules: RuleDefinition[];
  summary: string;
  limitation: string;
}

export interface DlmsFinding {
  id: string;
  group: RuleDefinition["group"];
  title: string;
  status: FindingStatus;
  severity: FindingSeverity;
  enabled: boolean;
  actual: string;
  threshold: string;
  sources: SourceReference[];
  why: string;
  evaluation: string;
  limitation: string;
  followUp: string;
  contextOnly: boolean;
}

export interface DlmsAnalysis {
  bundle: Pick<RuleBundle, "id" | "version" | "title" | "lifecycle">;
  profile: ProvisionalRuleProfile;
  profileSources: Record<string, "workbook" | "provisional fallback">;
  adapter: AdapterDefinition;
  scope: {
    productFamily: "METER" | "NIC" | "GATEWAY" | null;
    evidenceMode: "direct" | "context_only" | "unscoped";
    manualVerificationRequired: boolean;
    identityMatched: boolean;
    productMappingValid: boolean;
    complaintMappingValid: boolean;
    complaintKey: string | null;
    message: string;
  };
  features: AnalysisFeature[];
  findings: DlmsFinding[];
  summary: {
    total: number;
    pass: number;
    attention: number;
    notAssessed: number;
    high: number;
  };
  firstPrinciples?: {
    patterns: FirstPrinciplesPatterns;
    verdict: VerdictObject;
  };
}

type SheetRows = Array<Array<unknown>>;
type MetricValue = string | number | boolean | undefined;
type Metric = { value: MetricValue; label: string; sources: SourceReference[] };
type Metrics = Record<string, Metric>;

export interface DlmsAnalysisScope {
  productFamily?: "METER" | "NIC" | "GATEWAY" | null;
  complaintKey?: string | null;
  /** True only after the meter identifier exactly matches the selected FFR row. */
  identityMatched?: boolean;
  /** True only when the selected FFR product value resolved through shared mappings. */
  productMappingValid?: boolean;
  /** False for an unclassified/no complaint mapping, even when the family is known. */
  complaintMappingValid?: boolean;
  /**
   * Indicates a dedicated device adapter has been configured for the selected
   * product family. Any supplied evidence remains context-only until this is
   * explicitly true through a shared adapter mapping.
   */
  dedicatedAdapterConfigured?: boolean;
  /** Full adapter definition selected from the shared adapter catalogue. */
  adapter?: AdapterDefinition;
}

/**
 * These are editable seed documents. Shared governance can replace them with
 * an approved/released version at runtime; the evaluator below only consumes
 * the serializable definitions it receives.
 */
export const bcs16SheetAdapter = bcs16AdapterSeed as AdapterDefinition;
export const defaultProvisionalRuleProfile =
  provisionalProfileSeed as ProvisionalRuleProfile;
export const genericProvisionalBundle = genericProvisionalSeed as RuleBundle;

if (genericProvisionalBundle.rules.length !== 60) {
  throw new Error(
    "The generic provisional bundle must contain exactly 60 checks.",
  );
}

function normalise(value: unknown) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
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

const conventionalSheetNames: Record<AdapterSheetRole, string> = {
  configuration: "MeterConfiguration",
  selfDiagnostic: "SelfDiagnostic",
  instantaneous: "IP",
  blockLoadProfile: "BlockLoadProfile",
  currentEvent: "CurrentRelatedEvent",
  otherEvent: "OtherEvent",
  controlEvent: "ControlEvent",
  powerEvent: "PowerRelatedEvent",
  transactionEvent: "TransactionEvent",
  voltageEvent: "VoltageRelatedEvent",
};

const conventionalHeaders: Record<AdapterHeaderRole, string[]> = {
  meterSerial: ["Meter Serial Number"],
  model: ["Meter Type", "Model"],
  ratedVoltage: ["Rated Voltage", "Nominal Voltage"],
  ratedCurrent: ["Rated Current", "Current Rating"],
  selfDiagnosticStatus: ["Status"],
  rtcBattery: ["RTC Battery"],
  mainBattery: ["Main Battery"],
  voltage: ["Voltage"],
  phaseCurrent: ["Phase Current"],
  powerFactor: ["Signed Power Factor", "Power Factor"],
  activePower: ["Active Power", "Total Active Power"],
  programmingCount: ["Cumulative programming count"],
  profileTimestamp: ["Meter RTC"],
};

const conventionalEventPhrases: Record<AdapterEventRole, string> = {
  overVoltage: "Over Voltage",
  underVoltage: "Under Voltage",
  powerFailure: "Power failure",
  currentReverse: "Current reverse",
  lowPowerFactor: "Low PF",
  rtcChange: "Real Time Clock",
  tamper: "TAMPER",
  occurrence: "OCCURRENCE",
  restoration: "RESTORATION",
  connect: "Connect",
  disconnect: "Disconnect",
  loadLimit: "Load Limit",
};

function adapterSheet(
  adapter: AdapterDefinition,
  role: AdapterSheetRole,
): string {
  if (role === "configuration")
    return adapter.sheetMappings?.[role] ?? adapter.identitySheet;
  return adapter.sheetMappings?.[role] ?? conventionalSheetNames[role];
}

function adapterHeaders(
  adapter: AdapterDefinition,
  role: AdapterHeaderRole,
): string[] {
  if (role === "meterSerial") return [adapter.identityHeader];
  const configured = adapter.headerMappings?.[role];
  if (Array.isArray(configured))
    return configured.filter((value) => Boolean(value?.trim()));
  return typeof configured === "string" && configured.trim()
    ? [configured]
    : conventionalHeaders[role];
}

function adapterEventPhrase(
  adapter: AdapterDefinition,
  role: AdapterEventRole,
): string {
  return adapter.eventPhrases?.[role]?.trim() || conventionalEventPhrases[role];
}

function workbookSheetName(
  workbook: XLSX.WorkBook,
  expectedName: string,
): string | null {
  const expected = normalise(expectedName);
  return (
    workbook.SheetNames.find((name) => normalise(name) === expected) ?? null
  );
}

export function adapterExpectedSheets(adapter: AdapterDefinition): string[] {
  return [...new Set([...adapter.mandatorySheets, ...adapter.optionalSheets])];
}

export function inspectAdapterWorkbookStructure(
  workbook: XLSX.WorkBook,
  adapter: AdapterDefinition,
) {
  const expectedSheets = adapterExpectedSheets(adapter);
  const missingMandatorySheets = adapter.mandatorySheets.filter(
    (name) => !workbookSheetName(workbook, name),
  );
  const detectedExpectedSheets = expectedSheets.filter((name) =>
    workbookSheetName(workbook, name),
  );
  return {
    expectedSheets,
    missingMandatorySheets,
    detectedExpectedSheets,
    supported: missingMandatorySheets.length === 0,
  };
}

export function extractAdapterIdentity(
  workbook: XLSX.WorkBook,
  adapter: AdapterDefinition,
) {
  const identitySheet = workbookSheetName(workbook, adapter.identitySheet);
  if (!identitySheet) {
    return {
      meterId: null,
      source: source(
        adapter.identitySheet,
        `Identity sheet not found for adapter ${adapter.id}`,
        "Workbook",
      ),
    };
  }
  const identity = findValueForHeaders(
    rowsFor(workbook, identitySheet),
    adapterHeaders(adapter, "meterSerial"),
  );
  return {
    meterId: identity ? String(identity.value).trim() || null : null,
    source: source(
      identitySheet,
      identity?.locator ?? `Header ${adapter.identityHeader} not detected`,
      "Workbook",
    ),
  };
}

function source(
  sheet: string,
  locator: string,
  artifactName: string,
): SourceReference {
  return { sheet, locator, artifactName };
}

function numeric(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const clean = String(value ?? "")
    .replace(/,/g, "")
    .trim();
  if (!clean) return undefined;
  const parsed = Number(clean);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function boolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  const text = normalise(value);
  if (["TRUE", "OK", "YES", "1", "PASS"].includes(text)) return true;
  if (["FALSE", "NOT OK", "NOK", "NO", "0", "FAIL", "FAILED"].includes(text))
    return false;
  return undefined;
}

function findValue(
  rows: SheetRows,
  headerIncludes: string,
): { value: unknown; locator: string } | undefined {
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const column = rows[rowIndex].findIndex((value) =>
      normalise(value).includes(normalise(headerIncludes)),
    );
    if (column === -1) continue;
    for (let valueRow = rowIndex + 1; valueRow < rows.length; valueRow += 1) {
      const candidate = rows[valueRow][column];
      if (candidate !== "" && candidate !== undefined && candidate !== null)
        return {
          value: candidate,
          locator: `column ${column + 1}, row ${valueRow + 1}`,
        };
    }
  }
  return undefined;
}

function findValueForHeaders(
  rows: SheetRows,
  headerIncludes: string[],
): { value: unknown; locator: string } | undefined {
  for (const header of headerIncludes) {
    const value = findValue(rows, header);
    if (value) return value;
  }
  return undefined;
}

function findHeaderColumn(rows: SheetRows, includes: string[]) {
  for (let index = 0; index < rows.length; index += 1) {
    const columns = rows[index].map(normalise);
    const column = columns.findIndex((value) =>
      includes.some((needle) => value.includes(normalise(needle))),
    );
    if (column >= 0) return { row: index, column };
  }
  return undefined;
}

function countPhrase(rows: SheetRows, phrase: string) {
  return rows
    .flat()
    .filter((value) => normalise(value).includes(normalise(phrase))).length;
}

function median(values: number[]) {
  if (!values.length) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function parseDate(value: unknown) {
  if (value instanceof Date && Number.isFinite(value.getTime()))
    return value.getTime();
  const text = String(value ?? "").trim();
  if (!text) return undefined;
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function runLength(values: number[]) {
  let longest = 0;
  let current = 0;
  let previous: number | undefined;
  values.forEach((value) => {
    if (previous !== undefined && value === previous) current += 1;
    else current = 1;
    previous = value;
    longest = Math.max(longest, current);
  });
  return longest;
}

function metric(
  metrics: Metrics,
  code: string,
  label: string,
  value: MetricValue,
  sources: SourceReference[],
) {
  metrics[code] = { value, label, sources };
}

function profileMetrics(
  rows: SheetRows,
  artifactName: string,
  profile: ProvisionalRuleProfile,
  metrics: Metrics,
  sheetName: string,
  timestampHeaders: string[],
) {
  const rtcHeader = findHeaderColumn(rows, timestampHeaders);
  if (!rtcHeader) {
    metric(
      metrics,
      "profile.record_count",
      "Block-load profile records",
      undefined,
      [
        source(
          sheetName,
          `${timestampHeaders.join(" / ")} header not detected`,
          artifactName,
        ),
      ],
    );
    return;
  }
  const headers = rows[rtcHeader.row].map((value) => normalise(value));
  const data = rows
    .slice(rtcHeader.row + 1)
    .filter((row) => row.some((value) => String(value ?? "").trim()));
  const locator = `rows ${rtcHeader.row + 2}-${rtcHeader.row + data.length + 1}`;
  const profileSource = [source(sheetName, locator, artifactName)];
  const timestamps = data.map((row) => parseDate(row[rtcHeader.column]));
  const parseable = timestamps.filter(
    (value): value is number => value !== undefined,
  );
  const intervalValues = parseable
    .slice(1)
    .map((value, index) => value - parseable[index])
    .filter((value) => value > 0)
    .map((value) => value / 60000);
  const intervalMinutes = median(intervalValues);
  const expected =
    intervalMinutes ?? profile.parameters.expected_interval_minutes;
  const duplicate = new Set<string>();
  let duplicateCount = 0;
  let outOfOrderCount = 0;
  let longGapCount = 0;
  for (let index = 0; index < timestamps.length; index += 1) {
    const timestamp = timestamps[index];
    if (timestamp === undefined) continue;
    if (duplicate.has(String(timestamp))) duplicateCount += 1;
    duplicate.add(String(timestamp));
    const previous = timestamps[index - 1];
    if (previous !== undefined && timestamp < previous) outOfOrderCount += 1;
    if (
      previous !== undefined &&
      timestamp >
        previous + expected * profile.parameters.long_gap_intervals * 60000
    )
      longGapCount += 1;
  }
  const numericColumn = (names: string[]) => {
    const column = headers.findIndex((header) =>
      names.some((name) => header.includes(normalise(name))),
    );
    return column < 0
      ? []
      : data
          .map((row) => numeric(row[column]))
          .filter((value): value is number => value !== undefined);
  };
  const voltage = numericColumn(["VOLTAGE", "PHASE VOLTAGE"]);
  const current = numericColumn(["PHASE CURRENT", "CURRENT"]);
  const importEnergy = numericColumn([
    "IMPORT ACTIVE ENERGY",
    "CUMULATIVE IMPORT",
    "ACTIVE ENERGY IMPORT",
  ]);
  const exportEnergy = numericColumn([
    "EXPORT ACTIVE ENERGY",
    "CUMULATIVE EXPORT",
    "ACTIVE ENERGY EXPORT",
  ]);
  const monotonicViolations = (values: number[]) =>
    values.slice(1).filter((value, index) => value < values[index]).length;
  const windowDays =
    parseable.length >= 2
      ? (Math.max(...parseable) - Math.min(...parseable)) / 86400000
      : undefined;
  metric(
    metrics,
    "profile.record_count",
    "Block-load profile records",
    data.length,
    profileSource,
  );
  metric(
    metrics,
    "profile.unparseable_timestamp_count",
    "Unparseable profile timestamps",
    data.length - parseable.length,
    profileSource,
  );
  metric(
    metrics,
    "profile.interval_minutes",
    "Observed profile interval (minutes)",
    intervalMinutes,
    profileSource,
  );
  metric(
    metrics,
    "profile.duplicate_interval_count",
    "Duplicate profile intervals",
    duplicateCount,
    profileSource,
  );
  metric(
    metrics,
    "profile.out_of_order_count",
    "Out-of-order profile intervals",
    outOfOrderCount,
    profileSource,
  );
  metric(
    metrics,
    "profile.long_gap_count",
    "Long profile gaps",
    longGapCount,
    profileSource,
  );
  metric(
    metrics,
    "profile.window_days",
    "Profile window (days)",
    windowDays,
    profileSource,
  );
  metric(
    metrics,
    "profile.voltage_min",
    "Profile voltage minimum",
    voltage.length ? Math.min(...voltage) : undefined,
    profileSource,
  );
  metric(
    metrics,
    "profile.voltage_median",
    "Profile voltage median",
    median(voltage),
    profileSource,
  );
  metric(
    metrics,
    "profile.voltage_max",
    "Profile voltage maximum",
    voltage.length ? Math.max(...voltage) : undefined,
    profileSource,
  );
  metric(
    metrics,
    "profile.zero_voltage_count",
    "Zero-voltage profile intervals",
    voltage.filter((value) => value === 0).length,
    profileSource,
  );
  metric(
    metrics,
    "profile.current_max",
    "Profile current maximum",
    current.length ? Math.max(...current) : undefined,
    profileSource,
  );
  metric(
    metrics,
    "profile.zero_current_count",
    "Zero-current profile intervals",
    current.filter((value) => value === 0).length,
    profileSource,
  );
  metric(
    metrics,
    "profile.import_monotonicity_violations",
    "Import register decreases",
    importEnergy.length ? monotonicViolations(importEnergy) : undefined,
    profileSource,
  );
  metric(
    metrics,
    "profile.export_monotonicity_violations",
    "Export register decreases",
    exportEnergy.length ? monotonicViolations(exportEnergy) : undefined,
    profileSource,
  );
  metric(
    metrics,
    "profile.repeated_value_run",
    "Longest repeated profile numeric run",
    Math.max(
      runLength(voltage),
      runLength(current),
      runLength(importEnergy),
      runLength(exportEnergy),
    ),
    profileSource,
  );
  metric(
    metrics,
    "profile.register_consistency_available",
    "Comparable profile/register evidence",
    importEnergy.length > 1 || exportEnergy.length > 1,
    profileSource,
  );
  metric(
    metrics,
    "profile.energy_jump_available",
    "Compatible energy series available",
    importEnergy.length > 1 || exportEnergy.length > 1,
    profileSource,
  );
}

function buildMetrics(
  workbook: XLSX.WorkBook,
  artifactName: string,
  profile: ProvisionalRuleProfile,
  adapter: AdapterDefinition,
): Metrics {
  const metrics: Metrics = {};
  const structure = inspectAdapterWorkbookStructure(workbook, adapter);
  const sheetName = (role: AdapterSheetRole) =>
    workbookSheetName(workbook, adapterSheet(adapter, role)) ??
    adapterSheet(adapter, role);
  const roleRows = (role: AdapterSheetRole) =>
    rowsFor(workbook, sheetName(role));
  const configurationSheet = sheetName("configuration");
  const selfDiagnosticSheet = sheetName("selfDiagnostic");
  const instantaneousSheet = sheetName("instantaneous");
  const blockProfileSheet = sheetName("blockLoadProfile");
  const configurationRows = roleRows("configuration");
  const selfRows = roleRows("selfDiagnostic");
  const ipRows = roleRows("instantaneous");
  const blockRows = roleRows("blockLoadProfile");
  const eventSheetRoles: AdapterSheetRole[] = [
    "currentEvent",
    "otherEvent",
    "controlEvent",
    "powerEvent",
    "transactionEvent",
    "voltageEvent",
  ];
  const eventSheets = [
    ...new Set([
      ...adapter.optionalSheets.filter((name) => /EVENT/i.test(name)),
      ...eventSheetRoles.map((role) => adapterSheet(adapter, role)),
    ]),
  ]
    .map((name) => workbookSheetName(workbook, name))
    .filter((name): name is string => Boolean(name));
  const eventRows = eventSheets.flatMap((name) => rowsFor(workbook, name));
  const configurationValue = (role: AdapterHeaderRole) =>
    findValueForHeaders(configurationRows, adapterHeaders(adapter, role));
  const ipValue = (role: AdapterHeaderRole) =>
    findValueForHeaders(ipRows, adapterHeaders(adapter, role));
  const selfValue = (role: AdapterHeaderRole) =>
    findValueForHeaders(selfRows, adapterHeaders(adapter, role));
  const addTable = (
    code: string,
    label: string,
    result: { value: unknown; locator: string } | undefined,
    sheet: string,
    transform?: (value: unknown) => MetricValue,
  ) =>
    metric(
      metrics,
      code,
      label,
      result
        ? transform
          ? transform(result.value)
          : String(result.value).trim()
        : undefined,
      [
        source(
          sheet,
          result?.locator ?? `Header ${label} not detected`,
          artifactName,
        ),
      ],
    );

  metric(
    metrics,
    "workbook.expected_sheet_count",
    "Expected adapter sheets detected",
    structure.detectedExpectedSheets.length,
    [
      source(
        "Workbook",
        `adapter ${adapter.id} sheet collection`,
        artifactName,
      ),
    ],
  );
  metric(
    metrics,
    "workbook.mandatory_missing_count",
    "Missing mandatory adapter sheets",
    structure.missingMandatorySheets.length,
    [
      source(
        "Workbook",
        structure.missingMandatorySheets.length
          ? `Missing: ${structure.missingMandatorySheets.join(", ")}`
          : `All ${adapter.mandatorySheets.length} mandatory sheets detected`,
        artifactName,
      ),
    ],
  );
  metric(
    metrics,
    "workbook.profile_sheet_count",
    "Configured profile sheets detected",
    structure.detectedExpectedSheets.filter((name) => /PROFILE/i.test(name))
      .length,
    [source("Workbook", "adapter profile sheet coverage", artifactName)],
  );
  metric(
    metrics,
    "workbook.event_sheet_count",
    "Configured event sheets detected",
    eventSheets.length,
    [source("Workbook", "adapter event sheet coverage", artifactName)],
  );
  addTable(
    "configuration.meter_serial",
    "Meter serial",
    configurationValue("meterSerial"),
    configurationSheet,
  );
  metric(
    metrics,
    "configuration.non_empty_values",
    "Non-empty configuration values",
    configurationRows.flat().filter((value) => String(value ?? "").trim())
      .length,
    [source(configurationSheet, "all non-empty cells", artifactName)],
  );
  addTable(
    "configuration.model",
    "Meter model",
    configurationValue("model"),
    configurationSheet,
  );
  addTable(
    "configuration.rated_voltage",
    "Rated voltage",
    configurationValue("ratedVoltage"),
    configurationSheet,
    numeric,
  );
  addTable(
    "configuration.rated_current",
    "Rated current",
    configurationValue("ratedCurrent"),
    configurationSheet,
    numeric,
  );
  metric(
    metrics,
    "configuration.unit_or_scaler_tokens",
    "Configuration unit/scaler labels",
    configurationRows
      .flat()
      .filter((value) => /UNIT|SCALER/i.test(String(value ?? ""))).length,
    [source(configurationSheet, "unit/scaler labels", artifactName)],
  );
  addTable(
    "self_diagnostic.status",
    "Self-diagnostic status",
    selfValue("selfDiagnosticStatus"),
    selfDiagnosticSheet,
    (value) => String(value).trim(),
  );
  addTable(
    "self_diagnostic.rtc_battery",
    "RTC battery",
    selfValue("rtcBattery"),
    selfDiagnosticSheet,
    boolean,
  );
  addTable(
    "self_diagnostic.main_battery",
    "Main battery",
    selfValue("mainBattery"),
    selfDiagnosticSheet,
    boolean,
  );
  addTable(
    "ip.voltage",
    "Instantaneous voltage",
    ipValue("voltage"),
    instantaneousSheet,
    numeric,
  );
  addTable(
    "ip.phase_current",
    "Instantaneous phase current",
    ipValue("phaseCurrent"),
    instantaneousSheet,
    numeric,
  );
  addTable(
    "ip.power_factor",
    "Signed power factor",
    ipValue("powerFactor"),
    instantaneousSheet,
    numeric,
  );
  addTable(
    "ip.active_power",
    "Instantaneous active power",
    ipValue("activePower"),
    instantaneousSheet,
    numeric,
  );
  addTable(
    "ip.programming_count",
    "Cumulative programming count",
    ipValue("programmingCount"),
    instantaneousSheet,
    numeric,
  );
  metric(
    metrics,
    "ip.power_factor_abs",
    "Absolute power factor",
    metrics["ip.power_factor"]?.value === undefined
      ? undefined
      : Math.abs(Number(metrics["ip.power_factor"].value)),
    metrics["ip.power_factor"]?.sources ?? [
      source(instantaneousSheet, "Power factor unavailable", artifactName),
    ],
  );
  profileMetrics(
    blockRows,
    artifactName,
    profile,
    metrics,
    blockProfileSheet,
    adapterHeaders(adapter, "profileTimestamp"),
  );
  const eventMetric = (
    code: string,
    label: string,
    phraseRole: AdapterEventRole,
    role: AdapterSheetRole,
  ) => {
    const sheet = sheetName(role);
    const phrase = adapterEventPhrase(adapter, phraseRole);
    metric(
      metrics,
      code,
      label,
      countPhrase(rowsFor(workbook, sheet), phrase),
      [source(sheet, `Cells containing ${phrase}`, artifactName)],
    );
  };
  const voltageEventSheet = sheetName("voltageEvent");
  const powerEventSheet = sheetName("powerEvent");
  metric(
    metrics,
    "event.voltage_source_available",
    "Voltage event source available",
    Boolean(workbookSheetName(workbook, voltageEventSheet)),
    [source(voltageEventSheet, "sheet availability", artifactName)],
  );
  metric(
    metrics,
    "event.power_source_available",
    "Power event source available",
    Boolean(workbookSheetName(workbook, powerEventSheet)),
    [source(powerEventSheet, "sheet availability", artifactName)],
  );
  eventMetric(
    "event.over_voltage.count",
    "Overvoltage event records",
    "overVoltage",
    "voltageEvent",
  );
  eventMetric(
    "event.under_voltage.count",
    "Undervoltage event records",
    "underVoltage",
    "voltageEvent",
  );
  eventMetric(
    "event.power_failure.count",
    "Power-failure event records",
    "powerFailure",
    "powerEvent",
  );
  eventMetric(
    "event.current_reverse.count",
    "Current-reversal event records",
    "currentReverse",
    "currentEvent",
  );
  eventMetric(
    "event.low_pf.count",
    "Low-PF event records",
    "lowPowerFactor",
    "otherEvent",
  );
  eventMetric(
    "event.rtc_change.count",
    "RTC transaction records",
    "rtcChange",
    "transactionEvent",
  );
  metric(
    metrics,
    "event.tamper.count",
    "Tamper-labelled event records",
    eventRows
      .flat()
      .filter((value) =>
        normalise(value).includes(
          normalise(adapterEventPhrase(adapter, "tamper")),
        ),
      ).length,
    [
      source(
        "Event sheets",
        `cells containing ${adapterEventPhrase(adapter, "tamper")}`,
        artifactName,
      ),
    ],
  );
  const occurrenceCount = eventRows
    .flat()
    .filter((value) =>
      normalise(value).includes(
        normalise(adapterEventPhrase(adapter, "occurrence")),
      ),
    ).length;
  const restorationCount = eventRows
    .flat()
    .filter((value) =>
      normalise(value).includes(
        normalise(adapterEventPhrase(adapter, "restoration")),
      ),
    ).length;
  metric(
    metrics,
    "event.unpaired_count",
    "Unpaired event transitions",
    occurrenceCount || restorationCount
      ? Math.abs(occurrenceCount - restorationCount)
      : undefined,
    [
      source(
        "Event sheets",
        "configured occurrence/restoration labels",
        artifactName,
      ),
    ],
  );
  const timestampCount = eventRows
    .flat()
    .filter((value) => parseDate(value) !== undefined).length;
  metric(
    metrics,
    "event.timestamp_count",
    "Detected event timestamps",
    timestampCount || undefined,
    [source("Event sheets", "date-like cells", artifactName)],
  );
  const controlEventSheet = sheetName("controlEvent");
  const transactionEventSheet = sheetName("transactionEvent");
  metric(
    metrics,
    "event.connect_disconnect_available",
    "Connect/disconnect event evidence",
    countPhrase(
      rowsFor(workbook, controlEventSheet),
      adapterEventPhrase(adapter, "connect"),
    ) +
      countPhrase(
        rowsFor(workbook, controlEventSheet),
        adapterEventPhrase(adapter, "disconnect"),
      ) >
      0,
    [
      source(
        controlEventSheet,
        "configured connect/disconnect labels",
        artifactName,
      ),
    ],
  );
  metric(
    metrics,
    "event.load_limit_available",
    "Load-limit event evidence",
    countPhrase(
      rowsFor(workbook, controlEventSheet),
      adapterEventPhrase(adapter, "loadLimit"),
    ) +
      countPhrase(
        rowsFor(workbook, transactionEventSheet),
        adapterEventPhrase(adapter, "loadLimit"),
      ) >
      0,
    [
      source(
        `${controlEventSheet} / ${transactionEventSheet}`,
        "configured load-limit labels",
        artifactName,
      ),
    ],
  );
  metric(
    metrics,
    "communication.evidence_available",
    "Direct communication evidence available",
    false,
    [
      source(
        "Adapter",
        "No dedicated communication feature mapped by this adapter",
        artifactName,
      ),
    ],
  );
  metric(
    metrics,
    "rtc.drift_minutes_per_year",
    "RTC drift (minutes/year)",
    undefined,
    [
      source(
        "Adapter",
        "Reference-period timestamps unavailable",
        artifactName,
      ),
    ],
  );
  const electricalStress = [
    "event.over_voltage.count",
    "event.power_failure.count",
    "event.current_reverse.count",
  ].reduce((total, code) => total + (Number(metrics[code]?.value) || 0), 0);
  metric(
    metrics,
    "derived.electrical_stress_score",
    "Electrical stress event score",
    electricalStress,
    [
      source(
        "Event sheets",
        "overvoltage + power failure + current reversal counts",
        artifactName,
      ),
    ],
  );
  return metrics;
}

function effectiveProfile(base: ProvisionalRuleProfile, metrics: Metrics) {
  const profile: ProvisionalRuleProfile = {
    ...base,
    parameters: { ...base.parameters },
    descriptions: { ...base.descriptions },
  };
  const sources: Record<string, "workbook" | "provisional fallback"> =
    Object.fromEntries(
      Object.keys(profile.parameters).map((key) => [
        key,
        "provisional fallback",
      ]),
    );
  const ratedVoltage = numeric(metrics["configuration.rated_voltage"]?.value);
  if (ratedVoltage && ratedVoltage > 100 && ratedVoltage < 500) {
    profile.parameters.nominal_voltage_v = ratedVoltage;
    sources.nominal_voltage_v = "workbook";
  }
  const nominal = profile.parameters.nominal_voltage_v;
  profile.parameters.voltage_warning_lower_v =
    nominal * (1 - profile.parameters.voltage_warning_percent / 100);
  profile.parameters.voltage_warning_upper_v =
    nominal * (1 + profile.parameters.voltage_warning_percent / 100);
  profile.parameters.voltage_critical_lower_v =
    nominal * (1 - profile.parameters.voltage_critical_percent / 100);
  profile.parameters.voltage_critical_upper_v =
    nominal * (1 + profile.parameters.voltage_critical_percent / 100);
  sources.voltage_warning_lower_v = sources.nominal_voltage_v;
  sources.voltage_warning_upper_v = sources.nominal_voltage_v;
  sources.voltage_critical_lower_v = sources.nominal_voltage_v;
  sources.voltage_critical_upper_v = sources.nominal_voltage_v;
  return { profile, sources };
}

function resolveExpected(
  expression: RuleExpression,
  profile: ProvisionalRuleProfile,
) {
  return expression.parameter
    ? profile.parameters[expression.parameter]
    : expression.value;
}

function evaluateExpression(
  expression: RuleExpression,
  metrics: Metrics,
  profile: ProvisionalRuleProfile,
): boolean | null {
  if (expression.all) {
    const results = expression.all.map((child) =>
      evaluateExpression(child, metrics, profile),
    );
    if (results.includes(false)) return false;
    return results.includes(null) ? null : true;
  }
  if (expression.any) {
    const results = expression.any.map((child) =>
      evaluateExpression(child, metrics, profile),
    );
    if (results.includes(true)) return true;
    return results.includes(null) ? null : false;
  }
  if (expression.not) {
    const result = evaluateExpression(expression.not, metrics, profile);
    return result === null ? null : !result;
  }
  const actual = expression.fact ? metrics[expression.fact]?.value : undefined;
  if (expression.operator === "missing")
    return actual === undefined || actual === "";
  if (expression.operator === "exists")
    return actual === undefined || actual === "" ? false : true;
  if (actual === undefined || actual === "") return null;
  const expected = resolveExpected(expression, profile);
  if (expression.operator === "equals")
    return String(actual).toUpperCase() === String(expected).toUpperCase();
  if (expression.operator === "not_equals")
    return String(actual).toUpperCase() !== String(expected).toUpperCase();
  const actualNumber = numeric(actual);
  if (actualNumber === undefined) return null;
  if (expression.operator === "outside") {
    const lower = expression.lowerParameter
      ? profile.parameters[expression.lowerParameter]
      : undefined;
    const upper = expression.upperParameter
      ? profile.parameters[expression.upperParameter]
      : undefined;
    return lower === undefined || upper === undefined
      ? null
      : actualNumber < lower || actualNumber > upper;
  }
  const expectedNumber = numeric(expected);
  if (expectedNumber === undefined) return null;
  if (expression.operator === "gt") return actualNumber > expectedNumber;
  if (expression.operator === "gte") return actualNumber >= expectedNumber;
  if (expression.operator === "lt") return actualNumber < expectedNumber;
  if (expression.operator === "lte") return actualNumber <= expectedNumber;
  return null;
}

function expressionFacts(expression: RuleExpression): string[] {
  if (expression.fact) return [expression.fact];
  if (expression.all) return expression.all.flatMap(expressionFacts);
  if (expression.any) return expression.any.flatMap(expressionFacts);
  if (expression.not) return expressionFacts(expression.not);
  return [];
}

function describeExpression(
  expression: RuleExpression,
  profile: ProvisionalRuleProfile,
): string {
  if (expression.all)
    return expression.all
      .map((child) => describeExpression(child, profile))
      .join(" AND ");
  if (expression.any)
    return expression.any
      .map((child) => describeExpression(child, profile))
      .join(" OR ");
  if (expression.not)
    return `NOT (${describeExpression(expression.not, profile)})`;
  const factLabel = expression.fact ?? "evidence";
  if (expression.operator === "missing") return `${factLabel} is unavailable`;
  if (expression.operator === "outside")
    return `${factLabel} outside ${expression.lowerParameter ? profile.parameters[expression.lowerParameter] : "?"}–${expression.upperParameter ? profile.parameters[expression.upperParameter] : "?"}`;
  const expected = resolveExpected(expression, profile);
  return `${factLabel} ${expression.operator ?? ""} ${expected ?? ""}`.trim();
}

function formatValue(value: MetricValue) {
  if (value === undefined || value === "") return "Not available";
  if (typeof value === "number")
    return Number.isInteger(value)
      ? String(value)
      : value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
  return String(value);
}

function explainEvaluation(
  rule: RuleDefinition,
  match: boolean | null,
  metrics: Metrics,
  profile: ProvisionalRuleProfile,
): string {
  if (!rule.enabled)
    return "The rule is disabled in this bundle, so it was not assessed.";
  const facts = expressionFacts(rule.expression);
  const unavailable = facts.filter(
    (factCode) =>
      metrics[factCode]?.value === undefined || metrics[factCode]?.value === "",
  );
  if (match === null) {
    return unavailable.length
      ? `Not assessed because ${unavailable.join(", ")} is unavailable in this workbook.`
      : "Not assessed because the configured expression could not be evaluated from the supplied evidence.";
  }
  const threshold = describeExpression(rule.expression, profile);
  const actual = facts
    .map((factCode) => `${factCode}=${formatValue(metrics[factCode]?.value)}`)
    .join(", ");
  return match
    ? `Matched because the observed evidence (${actual || "available evidence"}) satisfies ${threshold}.`
    : `Did not match because the observed evidence (${actual || "available evidence"}) does not satisfy ${threshold}.`;
}

function featuresFromMetrics(metrics: Metrics): AnalysisFeature[] {
  return Object.entries(metrics).flatMap(([code, item]) =>
    item.value === undefined || item.value === ""
      ? []
      : [
          {
            code,
            label: item.label,
            value: item.value,
            source: item.sources[0]?.sheet ?? "Workbook",
            provenance: item.sources[0] ?? {
              sheet: "Workbook",
              locator: "Unknown",
              artifactName: "Unknown",
            },
            dataQuality:
              code.startsWith("profile.") || code.startsWith("workbook.")
                ? "warning"
                : "normal",
          },
        ],
  );
}

function complaintScopeMatches(configuredKeys: string[], complaintKey: string) {
  return configuredKeys.some((configuredKey) => {
    const candidate = normalise(configuredKey);
    const selected = normalise(complaintKey);
    return (
      candidate === "*" ||
      selected === candidate ||
      selected.startsWith(`${candidate}:`)
    );
  });
}

type RuleGate = { eligible: true } | { eligible: false; reason: string };

function ruleGate(
  rule: RuleDefinition,
  scope: {
    productFamily: "METER" | "NIC" | "GATEWAY" | null;
    evidenceMode: "direct" | "context_only" | "unscoped";
    identityMatched: boolean;
    productMappingValid: boolean;
    complaintMappingValid: boolean;
    complaintKey: string | null;
  },
): RuleGate {
  if (!rule.enabled)
    return {
      eligible: false,
      reason:
        "Not assessed because this rule is disabled in the active bundle.",
    };

  // A direct adapter is asserting evidence about the selected device. Honour
  // the bundle's product scope in that circumstance. Unscoped uploads and
  // context-only uploads still evaluate the technical quality of the
  // submitted workbook so that a bad or unmatched file is never hidden.
  if (rule.group !== "Complaint context") {
    if (
      scope.evidenceMode === "direct" &&
      scope.productFamily &&
      !rule.productFamilies.includes(scope.productFamily)
    ) {
      return {
        eligible: false,
        reason: `Not assessed because this technical rule is scoped to ${rule.productFamilies.join(" / ")}, not the selected ${scope.productFamily} device.`,
      };
    }
    return { eligible: true };
  }

  if (!scope.identityMatched) {
    return {
      eligible: false,
      reason:
        "Not assessed because case-specific complaint context requires an exact DLMS identity match to the selected FFR meter.",
    };
  }
  if (!scope.productMappingValid || !scope.productFamily) {
    return {
      eligible: false,
      reason:
        "Not assessed because case-specific complaint context requires a valid shared product-family mapping.",
    };
  }
  if (!scope.complaintMappingValid || !scope.complaintKey) {
    return {
      eligible: false,
      reason:
        "Not assessed because case-specific complaint context requires a valid shared complaint mapping.",
    };
  }
  const productFamily = scope.productFamily;
  const complaintKey = scope.complaintKey;
  if (!rule.productFamilies.includes(productFamily)) {
    return {
      eligible: false,
      reason: `Not assessed because this complaint-context rule is scoped to ${rule.productFamilies.join(" / ")}, not ${productFamily}.`,
    };
  }
  if (!complaintScopeMatches(rule.complaintKeys, complaintKey)) {
    return {
      eligible: false,
      reason: `Not assessed because complaint ${complaintKey} is outside this rule's configured complaint scope (${rule.complaintKeys.join(", ") || "none"}).`,
    };
  }
  return { eligible: true };
}

export function resolveDlmsAdapter(
  bundle: RuleBundle,
  suppliedAdapter?: AdapterDefinition,
): AdapterDefinition {
  // A rule bundle names its default adapter. A shared product-family mapping
  // can explicitly supply another released adapter without changing evaluator
  // code or cloning the generic rule bundle for each device family.
  if (suppliedAdapter) return suppliedAdapter;
  if (bundle.adapterId === bcs16SheetAdapter.id) return bcs16SheetAdapter;
  throw new Error(
    `No adapter definition was supplied for bundle adapter ${bundle.adapterId}.`,
  );
}

export function analyzeDlmsWorkbook(
  workbook: XLSX.WorkBook,
  artifactName: string,
  configuredProfile: ProvisionalRuleProfile = defaultProvisionalRuleProfile,
  configuredBundle: RuleBundle = genericProvisionalBundle,
  scope: DlmsAnalysisScope = {},
): DlmsAnalysis {
  const adapter = resolveDlmsAdapter(configuredBundle, scope.adapter);
  const firstPass = buildMetrics(
    workbook,
    artifactName,
    configuredProfile,
    adapter,
  );
  const effective = effectiveProfile(configuredProfile, firstPass);
  const metrics = buildMetrics(
    workbook,
    artifactName,
    effective.profile,
    adapter,
  );
  const requestedProductFamily = scope.productFamily ?? null;
  const productMappingValid = Boolean(
    requestedProductFamily &&
      scope.productMappingValid !== false &&
      configuredBundle.productFamilies.includes(requestedProductFamily),
  );
  const productFamily = productMappingValid ? requestedProductFamily : null;
  const complaintKey =
    typeof scope.complaintKey === "string" && scope.complaintKey.trim()
      ? scope.complaintKey.trim()
      : null;
  const complaintMappingValid = Boolean(
    productFamily &&
      complaintKey &&
      scope.complaintMappingValid !== false &&
      !normalise(complaintKey).endsWith(":UNCLASSIFIED"),
  );
  const identityMatched = scope.identityMatched === true;
  const dedicatedAdapterConfigured = scope.dedicatedAdapterConfigured === true;
  const contextOnly = Boolean(productFamily && !dedicatedAdapterConfigured);
  const evidenceMode = contextOnly
    ? ("context_only" as const)
    : productFamily
      ? ("direct" as const)
      : ("unscoped" as const);
  const normalizedScope = {
    productFamily,
    evidenceMode,
    identityMatched,
    productMappingValid,
    complaintMappingValid,
    complaintKey,
  };
  const profileUse = Object.entries(effective.sources)
    .filter(([key]) =>
      [
        "nominal_voltage_v",
        "expected_interval_minutes",
        "recurrent_event_count",
        "low_pf_limit",
        "rtc_drift_minutes_per_year",
      ].includes(key),
    )
    .map(([key, sourceName]) => `${key}=${sourceName}`)
    .join(", ");
  const findings = configuredBundle.rules.map((rule) => {
    const gate = ruleGate(rule, normalizedScope);
    const match = gate.eligible
      ? evaluateExpression(rule.expression, metrics, effective.profile)
      : null;
    const facts = expressionFacts(rule.expression);
    const sourceReferences = facts.flatMap(
      (item) => metrics[item]?.sources ?? [],
    );
    const primary = facts[0] ? metrics[facts[0]] : undefined;
    const evaluation = gate.eligible
      ? explainEvaluation(rule, match, metrics, effective.profile)
      : gate.reason;
    return {
      id: rule.id,
      group: rule.group,
      title: rule.title,
      status:
        !gate.eligible || match === null
          ? ("not_assessed" as FindingStatus)
          : match
            ? ("attention" as FindingStatus)
            : ("pass" as FindingStatus),
      severity: rule.severity,
      enabled: rule.enabled,
      actual: `${primary ? `${primary.label}: ${formatValue(primary.value)}` : "Required evidence unavailable"}${contextOnly ? " — context only; manual/device verification required." : ""}`,
      threshold: `${describeExpression(rule.expression, effective.profile)}. Profile source: ${profileUse || "provisional fallback"}.`,
      sources: sourceReferences,
      why: `${rule.why} ${evaluation}${contextOnly ? ` ${adapter.title} evidence is contextual for ${productFamily}; it is not dedicated ${productFamily} device evidence.` : ""}`,
      evaluation,
      limitation: rule.limitation,
      followUp: rule.followUp,
      contextOnly,
    };
  });

  // Extract L0 series & events for L2 Pattern Engine & L4/L5 First Principles Inference
  const blockSheetName = workbookSheetName(workbook, adapterSheet(adapter, "blockLoadProfile")) ?? "BlockLoadProfile";
  const blockRows = rowsFor(workbook, blockSheetName);
  const rtcHeader = findHeaderColumn(blockRows, adapterHeaders(adapter, "profileTimestamp"));
  
  let profileRecords: Array<{ timestamp: unknown; voltage: number; current: number }> = [];
  let timestamps: unknown[] = [];
  let voltages: number[] = [];
  let currents: number[] = [];
  let importEnergies: number[] = [];

  if (rtcHeader) {
    const headers = blockRows[rtcHeader.row].map((v) => normalise(v));
    const dataRows = blockRows.slice(rtcHeader.row + 1).filter((row) => row.some((v) => String(v ?? "").trim()));
    const vCol = headers.findIndex((h) => h.includes("VOLTAGE"));
    const iCol = headers.findIndex((h) => h.includes("CURRENT"));
    const eCol = headers.findIndex((h) => h.includes("IMPORT ACTIVE ENERGY") || h.includes("CUMULATIVE IMPORT"));

    dataRows.forEach((r) => {
      const ts = r[rtcHeader.column];
      const v = numeric(r[vCol]) ?? 0;
      const i = numeric(r[iCol]) ?? 0;
      const e = numeric(r[eCol]) ?? 0;
      timestamps.push(ts);
      voltages.push(v);
      currents.push(i);
      importEnergies.push(e);
      profileRecords.push({ timestamp: ts, voltage: v, current: i });
    });
  }

  const getSheetTimestamps = (role: AdapterSheetRole) => {
    const sName = workbookSheetName(workbook, adapterSheet(adapter, role));
    if (!sName) return [];
    const rows = rowsFor(workbook, sName);
    return rows.slice(1).map((r) => r[1] ?? r[0]).filter(Boolean);
  };

  const currTs = getSheetTimestamps("currentEvent");
  const voltTs = getSheetTimestamps("voltageEvent");
  const powTs = getSheetTimestamps("powerEvent");
  const othTs = getSheetTimestamps("otherEvent");

  const censoredCurr = analyzeCensoredStream("CurrentRelatedEvent", currTs.length, currTs);
  const censoredVolt = analyzeCensoredStream("VoltageRelatedEvent", voltTs.length, voltTs);
  const censoredPower = analyzeCensoredStream("PowerRelatedEvent", powTs.length, powTs);
  const censoredOther = analyzeCensoredStream("OtherEvent", othTs.length, othTs);

  const truncation = analyzeTruncation(profileRecords, complaintKey);
  const dose = analyzeDose(voltages, timestamps, effective.profile.parameters.voltage_warning_upper_v ?? 253, effective.profile.parameters.voltage_warning_lower_v ?? 207);

  const allEvents = [
    ...currTs.map((ts) => ({ stream: "CurrentRelatedEvent", timestamp: ts })),
    ...voltTs.map((ts) => ({ stream: "VoltageRelatedEvent", timestamp: ts })),
    ...powTs.map((ts) => ({ stream: "PowerRelatedEvent", timestamp: ts })),
    ...othTs.map((ts) => ({ stream: "OtherEvent", timestamp: ts })),
  ];

  const coincidence = analyzeCoincidence(allEvents, truncation.lastLiveTs, 24);
  const decoupling = analyzeDecoupling(voltages, currents, importEnergies, timestamps);
  const testimonyConflict = analyzeTestimonyConflict("METER_BURNT", complaintKey, truncation, dose);

  const censoredStreamsMap = {
    currentEvent: censoredCurr,
    voltageEvent: censoredVolt,
    powerEvent: censoredPower,
    otherEvent: censoredOther,
  };

  const story = reconstructStory(truncation, dose, censoredStreamsMap, coincidence);

  const patterns: FirstPrinciplesPatterns = {
    censoredStreams: censoredStreamsMap,
    truncation,
    coincidence,
    dose,
    decoupling,
    testimonyConflict,
    reconstructedStory: story,
  };

  const verdict = evaluateVerdict(patterns, effective.sources, adapter.id);

  return {
    bundle: {
      id: configuredBundle.id,
      version: configuredBundle.version,
      title: configuredBundle.title,
      lifecycle: configuredBundle.lifecycle,
    },
    profile: effective.profile,
    profileSources: effective.sources,
    adapter,
    scope: contextOnly
      ? {
          productFamily,
          evidenceMode: "context_only",
          manualVerificationRequired: true,
          identityMatched,
          productMappingValid,
          complaintMappingValid,
          complaintKey,
          message: `${adapter.title} evidence is contextual for ${productFamily}. Verify the ${productFamily} device and its dedicated adapter manually before treating any result as device evidence.`,
        }
      : productFamily
        ? {
            productFamily,
            evidenceMode: "direct",
            manualVerificationRequired: false,
            identityMatched,
            productMappingValid,
            complaintMappingValid,
            complaintKey,
            message: `The configured ${adapter.title} adapter is the direct source for this technical evidence.`,
          }
        : {
            productFamily: null,
            evidenceMode: "unscoped",
            manualVerificationRequired: false,
            identityMatched,
            productMappingValid,
            complaintMappingValid,
            complaintKey,
            message:
              "No product family is mapped yet; this remains an unassigned technical DLMS report.",
          },
    features: featuresFromMetrics(metrics),
    findings,
    summary: {
      total: findings.length,
      pass: findings.filter((finding) => finding.status === "pass").length,
      attention: findings.filter((finding) => finding.status === "attention")
        .length,
      notAssessed: findings.filter(
        (finding) => finding.status === "not_assessed",
      ).length,
      high: findings.filter(
        (finding) =>
          finding.status === "attention" && finding.severity === "high",
      ).length,
    },
    firstPrinciples: {
      patterns,
      verdict,
    },
  };
}
