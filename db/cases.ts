import { isRecord, parseJsonRecord, stableStringify } from "../app/lib/governance-contract";
import type { GovernanceActor } from "../app/lib/governance-types";
import { GovernanceDataError, isDatabaseSchemaError, writeAuditEvent } from "./governance";
import { getD1 } from "./index";

/**
 * Case/DLMS persistence, isolated from db/governance.ts. Same conventions
 * (raw D1 SQL, self-healing CREATE TABLE IF NOT EXISTS, no SQL FOREIGN KEY
 * clauses — referential integrity is application-level) but a distinct
 * domain, so a schema mistake here can't regress the governance subsystem.
 */

type DbRow = Record<string, unknown>;
export type MeterRole = "old" | "new";

function makeId(): string {
  return crypto.randomUUID();
}

function asString(value: unknown, field: string): string {
  if (typeof value !== "string") throw new GovernanceDataError(`Database ${field} is invalid.`, "invalid_database_row", 500);
  return value;
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown, field: string): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) throw new GovernanceDataError(`Database ${field} is invalid.`, "invalid_database_row", 500);
  return numeric;
}

function safelyParseObject(value: unknown, field: string): Record<string, unknown> {
  try {
    return parseJsonRecord(asString(value, field), field);
  } catch (error) {
    if (error instanceof GovernanceDataError) throw error;
    throw new GovernanceDataError(error instanceof Error ? error.message : `Database ${field} is invalid.`, "invalid_database_row", 500);
  }
}

function safelyParseArray(value: unknown, field: string): unknown[] {
  const text = asString(value, field);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new GovernanceDataError(`Database ${field} is invalid.`, "invalid_database_row", 500);
  }
  if (!Array.isArray(parsed)) throw new GovernanceDataError(`Database ${field} is invalid.`, "invalid_database_row", 500);
  return parsed;
}

function stringOrNull(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value;
  return null;
}

function validateNonEmpty(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new GovernanceDataError(`${label} is required.`, "invalid_input");
  }
  return value.trim();
}

function validateMeterRole(value: unknown): MeterRole {
  if (value === "old" || value === "new") return value;
  throw new GovernanceDataError("Meter role must be 'old' or 'new'.", "invalid_input");
}

function nullableInteger(value: unknown, label: string): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (!Number.isInteger(value) || Number(value) < 1) throw new GovernanceDataError(`${label} must be a positive integer.`, "invalid_input");
  return Number(value);
}

let casesSchemaInitialized = false;

export async function autoMigrateCasesSchema(): Promise<void> {
  if (casesSchemaInitialized) return;
  const db = getD1();
  const statements = [
    `CREATE TABLE IF NOT EXISTS cases (id text PRIMARY KEY NOT NULL, case_ref text NOT NULL, register_artifact_name text NOT NULL, register_row_number integer NOT NULL, register_row_json text NOT NULL, product_family text, complaint_key text, complaint_label text, created_by_user_id text NOT NULL, created_by_email text NOT NULL, created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL, updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL);`,
    `CREATE INDEX IF NOT EXISTS idx_cases_case_ref ON cases (case_ref, created_at);`,
    `CREATE INDEX IF NOT EXISTS idx_cases_created ON cases (created_at);`,
    `CREATE TABLE IF NOT EXISTS case_meters (id text PRIMARY KEY NOT NULL, case_id text NOT NULL, role text NOT NULL, meter_serial text, created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL, updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL);`,
    `CREATE UNIQUE INDEX IF NOT EXISTS case_meters_case_role_unique ON case_meters (case_id, role);`,
    `CREATE INDEX IF NOT EXISTS idx_case_meters_serial ON case_meters (meter_serial);`,
    `CREATE TABLE IF NOT EXISTS dlms_reports (id text PRIMARY KEY NOT NULL, case_id text NOT NULL, case_meter_id text NOT NULL, meter_role text NOT NULL, meter_serial text, expected_meter_id text DEFAULT '' NOT NULL, identity_state text NOT NULL, artifact_json text NOT NULL, features_json text NOT NULL, messages_json text NOT NULL, analysis_json text, bundle_id text, bundle_version integer, profile_key text, profile_version integer, adapter_key text, adapter_version integer, findings_count integer DEFAULT 0 NOT NULL, attention_count integer DEFAULT 0 NOT NULL, high_count integer DEFAULT 0 NOT NULL, created_by_user_id text NOT NULL, created_by_email text NOT NULL, created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL);`,
    `CREATE INDEX IF NOT EXISTS idx_dlms_reports_case_created ON dlms_reports (case_id, created_at);`,
    `CREATE INDEX IF NOT EXISTS idx_dlms_reports_meter_created ON dlms_reports (case_meter_id, created_at);`,
  ];
  for (const stmt of statements) {
    try {
      await db.prepare(stmt).run();
    } catch {}
  }
  casesSchemaInitialized = true;
}

async function all<T extends DbRow>(query: string, params: unknown[] = []): Promise<T[]> {
  try {
    const result = await getD1().prepare(query).bind(...params).all<T>();
    return result.results ?? [];
  } catch (error) {
    if (isDatabaseSchemaError(error)) {
      await autoMigrateCasesSchema();
      const retry = await getD1().prepare(query).bind(...params).all<T>();
      return retry.results ?? [];
    }
    throw error;
  }
}

async function first<T extends DbRow>(query: string, params: unknown[] = []): Promise<T | null> {
  try {
    return await getD1().prepare(query).bind(...params).first<T>();
  } catch (error) {
    if (isDatabaseSchemaError(error)) {
      await autoMigrateCasesSchema();
      return await getD1().prepare(query).bind(...params).first<T>();
    }
    throw error;
  }
}

async function execute(query: string, params: unknown[] = []): Promise<number> {
  try {
    const result = await getD1().prepare(query).bind(...params).run();
    return result.meta?.changes ?? 0;
  } catch (error) {
    if (isDatabaseSchemaError(error)) {
      await autoMigrateCasesSchema();
      const retry = await getD1().prepare(query).bind(...params).run();
      return retry.meta?.changes ?? 0;
    }
    throw error;
  }
}

export type CaseRecord = {
  id: string;
  caseRef: string;
  registerArtifactName: string;
  registerRowNumber: number;
  registerRow: Record<string, unknown>;
  productFamily: string | null;
  complaintKey: string | null;
  complaintLabel: string | null;
  createdByUserId: string;
  createdByEmail: string;
  createdAt: string;
  updatedAt: string;
};

export type CaseMeterRecord = {
  id: string;
  caseId: string;
  role: MeterRole;
  meterSerial: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DlmsReportRecord = {
  id: string;
  caseId: string;
  caseMeterId: string;
  meterRole: MeterRole;
  meterId: string | null;
  expectedMeterId: string;
  identityState: string;
  artifact: Record<string, unknown>;
  features: unknown[];
  messages: string[];
  analysis: Record<string, unknown> | null;
  bundleId: string | null;
  bundleVersion: number | null;
  profileKey: string | null;
  profileVersion: number | null;
  adapterKey: string | null;
  adapterVersion: number | null;
  findingsCount: number;
  attentionCount: number;
  highCount: number;
  createdByUserId: string;
  createdByEmail: string;
  createdAt: string;
};

const CASE_COLUMNS =
  "id, case_ref, register_artifact_name, register_row_number, register_row_json, product_family, complaint_key, complaint_label, created_by_user_id, created_by_email, created_at, updated_at";

function parseCaseRow(row: DbRow): CaseRecord {
  return {
    id: asString(row.id, "id"),
    caseRef: asString(row.case_ref, "case_ref"),
    registerArtifactName: asString(row.register_artifact_name, "register_artifact_name"),
    registerRowNumber: asNumber(row.register_row_number, "register_row_number"),
    registerRow: safelyParseObject(row.register_row_json, "register_row_json"),
    productFamily: optionalString(row.product_family),
    complaintKey: optionalString(row.complaint_key),
    complaintLabel: optionalString(row.complaint_label),
    createdByUserId: asString(row.created_by_user_id, "created_by_user_id"),
    createdByEmail: asString(row.created_by_email, "created_by_email"),
    createdAt: asString(row.created_at, "created_at"),
    updatedAt: asString(row.updated_at, "updated_at"),
  };
}

const CASE_METER_COLUMNS = "id, case_id, role, meter_serial, created_at, updated_at";

function parseCaseMeterRow(row: DbRow): CaseMeterRecord {
  return {
    id: asString(row.id, "id"),
    caseId: asString(row.case_id, "case_id"),
    role: validateMeterRole(row.role),
    meterSerial: optionalString(row.meter_serial),
    createdAt: asString(row.created_at, "created_at"),
    updatedAt: asString(row.updated_at, "updated_at"),
  };
}

const DLMS_REPORT_COLUMNS =
  "id, case_id, case_meter_id, meter_role, meter_serial, expected_meter_id, identity_state, artifact_json, features_json, messages_json, analysis_json, bundle_id, bundle_version, profile_key, profile_version, adapter_key, adapter_version, findings_count, attention_count, high_count, created_by_user_id, created_by_email, created_at";

function parseDlmsReportRow(row: DbRow): DlmsReportRecord {
  return {
    id: asString(row.id, "id"),
    caseId: asString(row.case_id, "case_id"),
    caseMeterId: asString(row.case_meter_id, "case_meter_id"),
    meterRole: validateMeterRole(row.meter_role),
    meterId: optionalString(row.meter_serial),
    expectedMeterId: asString(row.expected_meter_id, "expected_meter_id"),
    identityState: asString(row.identity_state, "identity_state"),
    artifact: safelyParseObject(row.artifact_json, "artifact_json"),
    features: safelyParseArray(row.features_json, "features_json"),
    messages: safelyParseArray(row.messages_json, "messages_json").map((value) => String(value)),
    analysis: row.analysis_json === null || row.analysis_json === undefined ? null : safelyParseObject(row.analysis_json, "analysis_json"),
    bundleId: optionalString(row.bundle_id),
    bundleVersion: row.bundle_version === null || row.bundle_version === undefined ? null : asNumber(row.bundle_version, "bundle_version"),
    profileKey: optionalString(row.profile_key),
    profileVersion: row.profile_version === null || row.profile_version === undefined ? null : asNumber(row.profile_version, "profile_version"),
    adapterKey: optionalString(row.adapter_key),
    adapterVersion: row.adapter_version === null || row.adapter_version === undefined ? null : asNumber(row.adapter_version, "adapter_version"),
    findingsCount: asNumber(row.findings_count, "findings_count"),
    attentionCount: asNumber(row.attention_count, "attention_count"),
    highCount: asNumber(row.high_count, "high_count"),
    createdByUserId: asString(row.created_by_user_id, "created_by_user_id"),
    createdByEmail: asString(row.created_by_email, "created_by_email"),
    createdAt: asString(row.created_at, "created_at"),
  };
}

type CreateCaseInput = {
  caseRef: string;
  registerArtifactName: string;
  registerRowNumber: number;
  registerRow: Record<string, unknown>;
  oldMeterSerial: string | null;
  newMeterSerial: string | null;
  productFamily: string | null;
  complaintKey: string | null;
  complaintLabel: string | null;
};

function validateCreateCaseInput(input: unknown): CreateCaseInput {
  if (!isRecord(input)) throw new GovernanceDataError("Case input must be a JSON object.", "invalid_input");
  if (!isRecord(input.registerRow)) throw new GovernanceDataError("registerRow is required.", "invalid_input");
  const rowNumber = input.registerRowNumber;
  if (!Number.isInteger(rowNumber) || Number(rowNumber) < 1) {
    throw new GovernanceDataError("registerRowNumber must be a positive integer.", "invalid_input");
  }
  return {
    caseRef: validateNonEmpty(input.caseRef, "Case reference"),
    registerArtifactName: validateNonEmpty(input.registerArtifactName, "Register artifact name"),
    registerRowNumber: Number(rowNumber),
    registerRow: input.registerRow,
    oldMeterSerial: stringOrNull(input.oldMeterSerial),
    newMeterSerial: stringOrNull(input.newMeterSerial),
    productFamily: stringOrNull(input.productFamily),
    complaintKey: stringOrNull(input.complaintKey),
    complaintLabel: stringOrNull(input.complaintLabel),
  };
}

export async function createCase(
  actor: GovernanceActor,
  input: unknown,
): Promise<{ case: CaseRecord; meters: CaseMeterRecord[] }> {
  const parsed = validateCreateCaseInput(input);
  const id = makeId();
  await execute(
    `INSERT INTO cases
      (id, case_ref, register_artifact_name, register_row_number, register_row_json,
       product_family, complaint_key, complaint_label, created_by_user_id, created_by_email)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      parsed.caseRef,
      parsed.registerArtifactName,
      parsed.registerRowNumber,
      stableStringify(parsed.registerRow),
      parsed.productFamily,
      parsed.complaintKey,
      parsed.complaintLabel,
      actor.userId,
      actor.email,
    ],
  );

  const meters: CaseMeterRecord[] = [];
  const roleSerials: Array<[MeterRole, string | null]> = [
    ["old", parsed.oldMeterSerial],
    ["new", parsed.newMeterSerial],
  ];
  for (const [role, serial] of roleSerials) {
    const meterId = makeId();
    await execute(`INSERT INTO case_meters (id, case_id, role, meter_serial) VALUES (?, ?, ?, ?)`, [meterId, id, role, serial]);
    const meterRow = await first<DbRow>(`SELECT ${CASE_METER_COLUMNS} FROM case_meters WHERE id = ?`, [meterId]);
    if (meterRow) meters.push(parseCaseMeterRow(meterRow));
  }

  const row = await first<DbRow>(`SELECT ${CASE_COLUMNS} FROM cases WHERE id = ?`, [id]);
  if (!row) throw new GovernanceDataError("Case could not be created.", "case_unavailable", 500);
  const created = parseCaseRow(row);
  await writeAuditEvent(actor, "case.created", "case", id, {
    caseRef: created.caseRef,
    productFamily: created.productFamily,
  });
  return { case: created, meters };
}

export async function listCases(options: { limit?: number; caseRef?: string | null } = {}): Promise<CaseRecord[]> {
  const limit = Math.max(1, Math.min(200, Math.floor(options.limit ?? 50)));
  const rows = options.caseRef
    ? await all<DbRow>(`SELECT ${CASE_COLUMNS} FROM cases WHERE case_ref = ? ORDER BY created_at DESC, id DESC LIMIT ?`, [options.caseRef, limit])
    : await all<DbRow>(`SELECT ${CASE_COLUMNS} FROM cases ORDER BY created_at DESC, id DESC LIMIT ?`, [limit]);
  return rows.map(parseCaseRow);
}

export async function getCaseById(caseId: string): Promise<CaseRecord | null> {
  const row = await first<DbRow>(`SELECT ${CASE_COLUMNS} FROM cases WHERE id = ?`, [caseId]);
  return row ? parseCaseRow(row) : null;
}

export async function getCaseMeters(caseId: string): Promise<CaseMeterRecord[]> {
  const rows = await all<DbRow>(`SELECT ${CASE_METER_COLUMNS} FROM case_meters WHERE case_id = ? ORDER BY role ASC`, [caseId]);
  return rows.map(parseCaseMeterRow);
}

export async function getLatestDlmsReports(
  caseId: string,
): Promise<Record<MeterRole, DlmsReportRecord | null>> {
  const meters = await getCaseMeters(caseId);
  const result: Record<MeterRole, DlmsReportRecord | null> = { old: null, new: null };
  for (const meter of meters) {
    const row = await first<DbRow>(
      `SELECT ${DLMS_REPORT_COLUMNS} FROM dlms_reports WHERE case_meter_id = ? ORDER BY created_at DESC, id DESC LIMIT 1`,
      [meter.id],
    );
    result[meter.role] = row ? parseDlmsReportRow(row) : null;
  }
  return result;
}

type CreateDlmsReportInput = {
  meterId: string | null;
  expectedMeterId: string;
  identityState: string;
  artifact: Record<string, unknown>;
  features: unknown[];
  messages: string[];
  analysis: Record<string, unknown> | null;
  bundleId: string | null;
  bundleVersion: number | null;
  profileKey: string | null;
  profileVersion: number | null;
  adapterKey: string | null;
  adapterVersion: number | null;
};

function validateCreateDlmsReportInput(input: unknown): CreateDlmsReportInput {
  if (!isRecord(input)) throw new GovernanceDataError("DLMS report input must be a JSON object.", "invalid_input");
  if (!isRecord(input.artifact)) throw new GovernanceDataError("artifact is required.", "invalid_input");
  if (!Array.isArray(input.features)) throw new GovernanceDataError("features must be an array.", "invalid_input");
  if (!Array.isArray(input.messages)) throw new GovernanceDataError("messages must be an array.", "invalid_input");
  if (
    input.identityState !== "READY_TO_ANALYZE" &&
    input.identityState !== "IDENTITY_NO_MATCH" &&
    input.identityState !== "IDENTITY_AMBIGUOUS" &&
    input.identityState !== "AWAITING_FILES"
  ) {
    throw new GovernanceDataError("identityState is invalid.", "invalid_input");
  }
  let analysis: Record<string, unknown> | null = null;
  if (input.analysis !== null && input.analysis !== undefined) {
    if (!isRecord(input.analysis)) throw new GovernanceDataError("analysis must be an object.", "invalid_input");
    if (!Array.isArray(input.analysis.findings)) throw new GovernanceDataError("analysis.findings must be an array.", "invalid_input");
    const json = stableStringify(input.analysis);
    if (new TextEncoder().encode(json).byteLength > 1_000_000) {
      throw new GovernanceDataError("DLMS analysis exceeds the 1 MB limit.", "invalid_input");
    }
    analysis = input.analysis;
  }
  return {
    meterId: stringOrNull(input.meterId),
    expectedMeterId: typeof input.expectedMeterId === "string" ? input.expectedMeterId : "",
    identityState: input.identityState,
    artifact: input.artifact,
    features: input.features,
    messages: input.messages.map((value) => String(value)),
    analysis,
    bundleId: stringOrNull(input.bundleId),
    bundleVersion: nullableInteger(input.bundleVersion, "Bundle version"),
    profileKey: stringOrNull(input.profileKey),
    profileVersion: nullableInteger(input.profileVersion, "Profile version"),
    adapterKey: stringOrNull(input.adapterKey),
    adapterVersion: nullableInteger(input.adapterVersion, "Adapter version"),
  };
}

export async function createDlmsReport(
  actor: GovernanceActor,
  caseId: string,
  meterRole: MeterRole,
  input: unknown,
): Promise<DlmsReportRecord> {
  const parsed = validateCreateDlmsReportInput(input);
  const meterRow = await first<DbRow>(`SELECT ${CASE_METER_COLUMNS} FROM case_meters WHERE case_id = ? AND role = ?`, [caseId, meterRole]);
  if (!meterRow) throw new GovernanceDataError("Case or meter role was not found.", "case_meter_not_found", 404);
  const caseMeter = parseCaseMeterRow(meterRow);

  let findingsCount = 0;
  let attentionCount = 0;
  let highCount = 0;
  if (parsed.analysis) {
    const findings = parsed.analysis.findings as unknown[];
    findingsCount = findings.length;
    for (const finding of findings) {
      if (isRecord(finding) && finding.status === "attention") {
        attentionCount += 1;
        if (finding.severity === "high") highCount += 1;
      }
    }
  }

  const id = makeId();
  await execute(
    `INSERT INTO dlms_reports
      (id, case_id, case_meter_id, meter_role, meter_serial, expected_meter_id, identity_state,
       artifact_json, features_json, messages_json, analysis_json,
       bundle_id, bundle_version, profile_key, profile_version, adapter_key, adapter_version,
       findings_count, attention_count, high_count, created_by_user_id, created_by_email)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      caseId,
      caseMeter.id,
      meterRole,
      parsed.meterId,
      parsed.expectedMeterId,
      parsed.identityState,
      stableStringify(parsed.artifact),
      stableStringify(parsed.features),
      stableStringify(parsed.messages),
      parsed.analysis ? stableStringify(parsed.analysis) : null,
      parsed.bundleId,
      parsed.bundleVersion,
      parsed.profileKey,
      parsed.profileVersion,
      parsed.adapterKey,
      parsed.adapterVersion,
      findingsCount,
      attentionCount,
      highCount,
      actor.userId,
      actor.email,
    ],
  );

  const row = await first<DbRow>(`SELECT ${DLMS_REPORT_COLUMNS} FROM dlms_reports WHERE id = ?`, [id]);
  if (!row) throw new GovernanceDataError("DLMS report could not be created.", "dlms_report_unavailable", 500);
  const created = parseDlmsReportRow(row);
  await writeAuditEvent(actor, "dlms_report.created", "dlms_report", id, {
    caseId,
    meterRole,
    identityState: created.identityState,
    findingsCount: created.findingsCount,
  });
  return created;
}
