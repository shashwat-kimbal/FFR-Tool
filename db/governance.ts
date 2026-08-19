import {
  canTransitionRuleVersion,
  cloneDefaultSharedSettings,
  isPublishedRuleVersion,
  isReviewApproval,
  isRecord,
  parseJsonRecord,
  stableStringify,
  validateRuleBundleDocument,
  validateSharedSettings,
} from "../app/lib/governance-contract";
import { adaptDlmsRuleBundle } from "../app/lib/governance-adapters";
import type {
  AdapterDefinition,
  EvaluationSummary,
  FeatureDefinition,
  GovernanceActor,
  GovernanceAuditEvent,
  GovernanceFixture,
  GovernanceRole,
  RuleBundleDocument,
  RuleBundleVersionRecord,
  RuleExpression,
  RuleLifecycleStatus,
  RuleProfile,
  RunSummary,
  SettingsRecord,
  SharedSettingsDocument,
} from "../app/lib/governance-types";
import genericProvisionalBundleSeed from "../rules/bundles/generic-provisional-v1.json" with { type: "json" };
import provisionalProfileSeed from "../config/dlms-provisional-profile.v1.json" with { type: "json" };
import bcsAdapterSeed from "../config/dlms-adapter-bcs-16-sheet.v1.json" with { type: "json" };
import productFamilyMapSeed from "../rules/catalogues/product-family-map.v1.json" with { type: "json" };
import complaintSynonymSeed from "../rules/catalogues/complaint-synonyms.v1.json" with { type: "json" };
import adapterMappingSeed from "../config/adapter-mappings.v1.json" with { type: "json" };
import configurationDefaultsSeed from "../config/pilot-configuration-defaults.v1.json" with { type: "json" };
import { getD1, getRuntimeBindings } from "./index";

const SHARED_SETTINGS_KEY = "shared_settings";
const BUNDLE_KEY_PATTERN = /^[A-Za-z][A-Za-z0-9._-]{2,127}$/;
const PROFILE_KEY_PATTERN = /^[A-Za-z][A-Za-z0-9._-]{2,127}$/;
const ALLOWED_ASSIGNABLE_ROLES = new Set<GovernanceRole>(["user", "author", "reviewer"]);
const INITIAL_BUNDLE_ID = "seed:rule-bundle:generic-provisional-v1";
const INITIAL_BUNDLE_VERSION_ID = "seed:rule-bundle:generic-provisional-v1:1";
const INITIAL_RELEASE_ID = "seed:rule-release:DLMS:generic-provisional-v1";
const INITIAL_PROFILE_ID = "seed:rule-profile:generic-provisional-v1";
const INITIAL_ADAPTER_ID = "seed:adapter:bcs-16-sheet-v1";
const INITIAL_SEED_ACTOR = {
  userId: "system:version-controlled-seed",
  email: "version-controlled-seed@kimbal.invalid",
};

type DbRow = Record<string, unknown>;

export class GovernanceDataError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "GovernanceDataError";
  }
}

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

function asBoolean(value: unknown): boolean {
  return value === true || value === 1 || value === "1";
}

function asObject(value: unknown, field: string): Record<string, unknown> {
  return parseJsonRecord(asString(value, field), field);
}

function safelyParseObject(value: unknown, field: string): Record<string, unknown> {
  try {
    return asObject(value, field);
  } catch (error) {
    if (error instanceof GovernanceDataError) throw error;
    throw new GovernanceDataError(
      error instanceof Error ? error.message : `Database ${field} is invalid.`,
      "invalid_database_row",
      500,
    );
  }
}

function stringOrNull(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value;
  return null;
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function validateKey(value: string, label: string, pattern = BUNDLE_KEY_PATTERN): string {
  const cleaned = value.trim();
  if (!pattern.test(cleaned)) {
    throw new GovernanceDataError(
      `${label} must start with a letter and use only letters, numbers, dots, underscores, or hyphens.`,
      "invalid_key",
    );
  }
  return cleaned;
}

function validateNonEmpty(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new GovernanceDataError(`${label} is required.`, "invalid_input");
  }
  return value.trim();
}

function validateStatus(value: unknown): RuleLifecycleStatus {
  if (
    value === "draft" ||
    value === "in_review" ||
    value === "provisional_active" ||
    value === "approved_active" ||
    value === "retired"
  ) {
    return value;
  }
  throw new GovernanceDataError("Invalid lifecycle status.", "invalid_status");
}

type InitialProfileSeed = {
  profileKey: string;
  title: string;
  productFamily: string;
  lifecycleStatus: "provisional_active";
  isProvisional: true;
  enabled: true;
  scope: Record<string, unknown>;
  values: Record<string, unknown>;
};

type InitialAdapterSeed = {
  adapterKey: string;
  title: string;
  productFamily: "METER";
  lifecycleStatus: "provisional_active";
  enabled: true;
  definition: Record<string, unknown>;
};

type InitialFeatureSeed = {
  adapterKey: string;
  featureCode: string;
  productFamily: string;
  valueType: FeatureDefinition["valueType"];
  unit?: string;
  enabled: true;
  definition: Record<string, unknown>;
};

export type InitialSharedConfigurationSeed = {
  settings: SharedSettingsDocument;
  bundle: RuleBundleDocument;
  profile: InitialProfileSeed;
  adapter: InitialAdapterSeed;
  features: InitialFeatureSeed[];
};

function titleFromFeatureCode(code: string): string {
  return code
    .split(/[._]/g)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1).replace(/_/g, " ")}`)
    .join(" ");
}

function featureValueType(expression: RuleExpression): FeatureDefinition["valueType"] {
  if (expression.kind === "predicate") {
    if (typeof expression.value === "boolean") return "boolean";
    if (typeof expression.value === "string") return "string";
    return "number";
  }
  if (expression.kind === "not") return featureValueType(expression.clause);
  return expression.clauses.reduce<FeatureDefinition["valueType"]>((type, clause) => {
    const candidate = featureValueType(clause);
    return type === "string" || candidate === "string" ? "string" : type === "boolean" || candidate === "boolean" ? "boolean" : "number";
  }, "number");
}

function collectBundleFeatureSeeds(bundle: RuleBundleDocument, adapterKey: string): InitialFeatureSeed[] {
  const features = new Map<string, FeatureDefinition["valueType"]>();
  const visit = (expression: RuleExpression) => {
    if (expression.kind === "predicate") {
      const existing = features.get(expression.feature);
      const candidate = featureValueType(expression);
      // A string capability is more permissive than a numeric or boolean
      // inference. The source expression remains authoritative either way.
      features.set(
        expression.feature,
        existing === "string" || candidate === "string" ? "string" : existing === "boolean" || candidate === "boolean" ? "boolean" : "number",
      );
      return;
    }
    if (expression.kind === "not") {
      visit(expression.clause);
      return;
    }
    expression.clauses.forEach(visit);
  };

  bundle.rules.forEach((rule) => visit(rule.when));
  return [...features.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([featureCode, valueType]) => ({
      adapterKey,
      featureCode,
      productFamily: "MULTI",
      valueType,
      enabled: true,
      definition: {
        label: titleFromFeatureCode(featureCode),
        description: "Feature referenced by the version-controlled generic provisional DLMS bundle.",
        source: "rules/bundles/generic-provisional-v1.json",
        enabled: true,
      },
    }));
}

/**
 * The first named administrator installs this version-controlled data into D1.
 * It deliberately keeps configuration in JSON assets rather than in evaluator
 * code, and all later edits remain governed records.
 */
export function buildInitialSharedConfigurationSeed(): InitialSharedConfigurationSeed {
  const bundle = adaptDlmsRuleBundle(genericProvisionalBundleSeed);
  const profileParameters = provisionalProfileSeed.parameters as Record<string, unknown>;
  const profileDescriptions = provisionalProfileSeed.descriptions as Record<string, unknown>;
  const adapterKey = bcsAdapterSeed.id;
  const settings = validateSharedSettings({
    ...cloneDefaultSharedSettings(),
    productMappings: productFamilyMapSeed.mappings.map((mapping, index) => ({
      id: `mapping-${index + 1}`,
      sourceField: mapping.sourceField,
      sourceValue: mapping.sourceValue,
      productFamily: mapping.productFamily,
      basis: mapping.basis,
    })),
    complaintMappings: complaintSynonymSeed.mappings.map((mapping, index) => ({
      id: `complaint-${index + 1}`,
      productFamily: mapping.productFamily,
      phrases: mapping.phrases,
      categoryCode: mapping.classification.categoryCode,
      subcategoryCode: mapping.classification.subcategoryCode,
      reason: mapping.reason,
    })),
    adapterMappings: adapterMappingSeed.mappings.map((mapping, index) => ({
      id: `adapter-${index + 1}`,
      productFamily: mapping.productFamily,
      adapterId: mapping.adapterId,
      evidenceMode: mapping.evidenceMode,
      description: mapping.description,
    })),
    thresholds: {
      profileId: provisionalProfileSeed.id,
      profileVersion: provisionalProfileSeed.version,
      profileTitle: provisionalProfileSeed.title,
      profileStatus: provisionalProfileSeed.status,
      profileParameters,
      profileDescriptions,
    },
    uploadMaxMb: configurationDefaultsSeed.uploadMaxMb,
    pilotAccess: configurationDefaultsSeed.pilotAccess,
    rcaTemplate: configurationDefaultsSeed.rcaTemplate,
    capaTemplate: configurationDefaultsSeed.capaTemplate,
    initialSeed: {
      source: "version-controlled application assets",
      bundle: "rules/bundles/generic-provisional-v1.json",
      profile: "config/dlms-provisional-profile.v1.json",
      adapter: "config/dlms-adapter-bcs-16-sheet.v1.json",
    },
  });

  const profile: InitialProfileSeed = {
    profileKey: provisionalProfileSeed.id,
    title: provisionalProfileSeed.title,
    productFamily: "MULTI",
    lifecycleStatus: "provisional_active",
    isProvisional: true,
    enabled: true,
    scope: {
      adapterKey,
      productFamilies: genericProvisionalBundleSeed.productFamilies,
      source: "config/dlms-provisional-profile.v1.json",
      sourceVersion: provisionalProfileSeed.version,
      fallbackOnly: true,
      meterConfigurationOverrides: ["nominal_voltage_v"],
    },
    values: {
      parameters: profileParameters,
      descriptions: profileDescriptions,
      sourceVersion: provisionalProfileSeed.version,
      sourceStatus: provisionalProfileSeed.status,
    },
  };

  const adapter: InitialAdapterSeed = {
    adapterKey,
    title: bcsAdapterSeed.title,
    productFamily: "METER",
    lifecycleStatus: "provisional_active",
    enabled: true,
    definition: {
      ...bcsAdapterSeed,
      source: "config/dlms-adapter-bcs-16-sheet.v1.json",
    },
  };

  return {
    settings,
    bundle,
    profile,
    adapter,
    features: collectBundleFeatureSeeds(bundle, adapterKey),
  };
}

async function hashContent(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(stableStringify(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

let schemaInitialized = false;

export async function autoMigrateSchema(): Promise<void> {
  if (schemaInitialized) return;
  const db = getD1();
  const statements = [
    `CREATE TABLE IF NOT EXISTS adapter_definitions (id text PRIMARY KEY NOT NULL, adapter_key text NOT NULL, title text NOT NULL, product_family text NOT NULL, version integer DEFAULT 1 NOT NULL, lifecycle_status text DEFAULT 'draft' NOT NULL, enabled integer DEFAULT true NOT NULL, definition_json text NOT NULL, created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL, created_by_user_id text NOT NULL, updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL, updated_by_user_id text);`,
    `CREATE UNIQUE INDEX IF NOT EXISTS adapter_definitions_adapter_key_unique ON adapter_definitions (adapter_key);`,
    `CREATE INDEX IF NOT EXISTS idx_adapter_definitions_family_enabled ON adapter_definitions (product_family, enabled);`,
    `CREATE TABLE IF NOT EXISTS feature_definitions (id text PRIMARY KEY NOT NULL, adapter_key text NOT NULL, feature_code text NOT NULL, product_family text NOT NULL, value_type text NOT NULL, unit text, definition_json text NOT NULL, enabled integer DEFAULT true NOT NULL, created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL, updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL);`,
    `CREATE UNIQUE INDEX IF NOT EXISTS feature_definitions_adapter_feature_unique ON feature_definitions (adapter_key, feature_code);`,
    `CREATE INDEX IF NOT EXISTS idx_feature_definitions_family_enabled ON feature_definitions (product_family, enabled);`,
    `CREATE TABLE IF NOT EXISTS governance_audit_events (id text PRIMARY KEY NOT NULL, action text NOT NULL, entity_type text NOT NULL, entity_id text NOT NULL, detail_json text DEFAULT '{}' NOT NULL, actor_user_id text, actor_email text, created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL);`,
    `CREATE INDEX IF NOT EXISTS idx_governance_audit_events_entity_created ON governance_audit_events (entity_type, entity_id, created_at);`,
    `CREATE INDEX IF NOT EXISTS idx_governance_audit_events_actor_created ON governance_audit_events (actor_user_id, created_at);`,
    `CREATE TABLE IF NOT EXISTS governance_role_assignments (id text PRIMARY KEY NOT NULL, user_id text, email text NOT NULL, role text NOT NULL, enabled integer DEFAULT true NOT NULL, created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL, updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL, created_by_user_id text);`,
    `CREATE UNIQUE INDEX IF NOT EXISTS governance_role_assignments_email_role_unique ON governance_role_assignments (email, role);`,
    `CREATE INDEX IF NOT EXISTS idx_governance_role_assignments_user_id ON governance_role_assignments (user_id);`,
    `CREATE TABLE IF NOT EXISTS governance_settings (key text PRIMARY KEY NOT NULL, value_json text NOT NULL, version integer DEFAULT 1 NOT NULL, updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL, updated_by_user_id text, updated_by_email text);`,
    `CREATE TABLE IF NOT EXISTS rule_bundle_releases (id text PRIMARY KEY NOT NULL, scope_key text NOT NULL, bundle_id text NOT NULL, bundle_version integer NOT NULL, release_kind text NOT NULL, is_current integer DEFAULT true NOT NULL, reason text DEFAULT '' NOT NULL, released_at text DEFAULT CURRENT_TIMESTAMP NOT NULL, released_by_user_id text NOT NULL, released_by_email text NOT NULL, superseded_at text);`,
    `CREATE INDEX IF NOT EXISTS idx_rule_bundle_releases_scope_current ON rule_bundle_releases (scope_key, is_current);`,
    `CREATE INDEX IF NOT EXISTS idx_rule_bundle_releases_bundle_version ON rule_bundle_releases (bundle_id, bundle_version);`,
    `CREATE UNIQUE INDEX IF NOT EXISTS rule_bundle_releases_one_current_scope ON rule_bundle_releases (scope_key) WHERE is_current = 1;`,
    `CREATE TABLE IF NOT EXISTS rule_bundle_versions (id text PRIMARY KEY NOT NULL, bundle_id text NOT NULL, version integer NOT NULL, lifecycle_status text NOT NULL, content_json text NOT NULL, content_hash text NOT NULL, created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL, created_by_user_id text NOT NULL, created_by_email text NOT NULL, updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL, reviewed_at text, reviewed_by_user_id text, reviewed_by_email text, review_note text, content_locked_at text);`,
    `CREATE UNIQUE INDEX IF NOT EXISTS rule_bundle_versions_bundle_version_unique ON rule_bundle_versions (bundle_id, version);`,
    `CREATE INDEX IF NOT EXISTS idx_rule_bundle_versions_bundle_status ON rule_bundle_versions (bundle_id, lifecycle_status);`,
    `CREATE TABLE IF NOT EXISTS rule_bundles (id text PRIMARY KEY NOT NULL, bundle_key text NOT NULL, title text NOT NULL, product_family text NOT NULL, scope_key text NOT NULL, created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL, created_by_user_id text NOT NULL, created_by_email text NOT NULL, updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL);`,
    `CREATE UNIQUE INDEX IF NOT EXISTS rule_bundles_bundle_key_unique ON rule_bundles (bundle_key);`,
    `CREATE INDEX IF NOT EXISTS idx_rule_bundles_scope_key ON rule_bundles (scope_key);`,
    `CREATE TABLE IF NOT EXISTS rule_profiles (id text PRIMARY KEY NOT NULL, profile_key text NOT NULL, title text NOT NULL, product_family text NOT NULL, version integer DEFAULT 1 NOT NULL, lifecycle_status text DEFAULT 'draft' NOT NULL, is_provisional integer DEFAULT false NOT NULL, enabled integer DEFAULT true NOT NULL, scope_json text NOT NULL, values_json text NOT NULL, created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL, created_by_user_id text NOT NULL, updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL, updated_by_user_id text);`,
    `CREATE UNIQUE INDEX IF NOT EXISTS rule_profiles_profile_key_unique ON rule_profiles (profile_key);`,
    `CREATE INDEX IF NOT EXISTS idx_rule_profiles_family_enabled ON rule_profiles (product_family, enabled);`,
    `CREATE TABLE IF NOT EXISTS run_summaries (id text PRIMARY KEY NOT NULL, created_by_user_id text NOT NULL, created_by_email text NOT NULL, case_ref text, meter_serial text, product_family text NOT NULL, identity_status text NOT NULL, bundle_id text, bundle_version integer, profile_key text, profile_version integer, adapter_key text, adapter_version integer, result_status text NOT NULL, findings_count integer DEFAULT 0 NOT NULL, summary_json text NOT NULL, raw_evidence_retained integer DEFAULT false NOT NULL, evidence_object_key text, created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL);`,
    `CREATE INDEX IF NOT EXISTS idx_run_summaries_actor_created ON run_summaries (created_by_user_id, created_at);`,
    `CREATE INDEX IF NOT EXISTS idx_run_summaries_case_created ON run_summaries (case_ref, created_at);`,
    `CREATE INDEX IF NOT EXISTS idx_run_summaries_family_created ON run_summaries (product_family, created_at);`,
    `CREATE TABLE IF NOT EXISTS stored_objects (id text PRIMARY KEY NOT NULL, object_key text NOT NULL, object_type text NOT NULL, content_type text NOT NULL, size_bytes integer NOT NULL, retained integer DEFAULT false NOT NULL, case_ref text, created_by_user_id text NOT NULL, created_by_email text NOT NULL, created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL);`,
    `CREATE UNIQUE INDEX IF NOT EXISTS stored_objects_object_key_unique ON stored_objects (object_key);`,
    `CREATE INDEX IF NOT EXISTS idx_stored_objects_type_created ON stored_objects (object_type, created_at);`,
    `CREATE TABLE IF NOT EXISTS governance_fixtures (id text PRIMARY KEY NOT NULL, fixture_key text NOT NULL, title text NOT NULL, fixture_type text NOT NULL, source_reference text NOT NULL, metadata_json text DEFAULT '{}' NOT NULL, lifecycle_status text DEFAULT 'draft' NOT NULL, enabled integer DEFAULT true NOT NULL, created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL, created_by_user_id text NOT NULL, created_by_email text NOT NULL, updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL, updated_by_user_id text);`,
    `CREATE UNIQUE INDEX IF NOT EXISTS governance_fixtures_fixture_key_unique ON governance_fixtures (fixture_key);`,
    `CREATE INDEX IF NOT EXISTS idx_governance_fixtures_type_enabled ON governance_fixtures (fixture_type, enabled);`,
    `CREATE TABLE IF NOT EXISTS governed_catalogue_releases (id text PRIMARY KEY NOT NULL, entity_type text NOT NULL, scope_key text NOT NULL, entity_key text NOT NULL, entity_version integer NOT NULL, release_kind text NOT NULL, is_current integer DEFAULT true NOT NULL, reason text DEFAULT '' NOT NULL, released_at text DEFAULT CURRENT_TIMESTAMP NOT NULL, released_by_user_id text NOT NULL, released_by_email text NOT NULL, superseded_at text);`,
    `CREATE INDEX IF NOT EXISTS idx_governed_catalogue_releases_scope_current ON governed_catalogue_releases (entity_type, scope_key, is_current);`,
    `CREATE INDEX IF NOT EXISTS idx_governed_catalogue_releases_entity_version ON governed_catalogue_releases (entity_type, entity_key, entity_version);`,
    `CREATE UNIQUE INDEX IF NOT EXISTS governed_catalogue_releases_one_current_scope ON governed_catalogue_releases (entity_type, scope_key) WHERE is_current = 1;`,
    `CREATE TABLE IF NOT EXISTS governed_catalogue_versions (id text PRIMARY KEY NOT NULL, entity_type text NOT NULL, entity_key text NOT NULL, version integer NOT NULL, lifecycle_status text NOT NULL, content_json text NOT NULL, content_hash text NOT NULL, created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL, created_by_user_id text NOT NULL, created_by_email text NOT NULL, updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL, reviewed_at text, reviewed_by_user_id text, reviewed_by_email text, review_note text, content_locked_at text);`,
    `CREATE UNIQUE INDEX IF NOT EXISTS governed_catalogue_versions_entity_version_unique ON governed_catalogue_versions (entity_type, entity_key, version);`,
    `CREATE INDEX IF NOT EXISTS idx_governed_catalogue_versions_entity_status ON governed_catalogue_versions (entity_type, entity_key, lifecycle_status);`
  ];
  for (const stmt of statements) {
    try {
      await db.prepare(stmt).run();
    } catch {}
  }
  schemaInitialized = true;
}

async function all<T extends DbRow>(query: string, params: unknown[] = []): Promise<T[]> {
  try {
    const result = await getD1().prepare(query).bind(...params).all<T>();
    return result.results ?? [];
  } catch (error) {
    if (isDatabaseSchemaError(error)) {
      await autoMigrateSchema();
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
      await autoMigrateSchema();
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
      await autoMigrateSchema();
      const retry = await getD1().prepare(query).bind(...params).run();
      return retry.meta?.changes ?? 0;
    }
    throw error;
  }
}

function parseBundleRow(row: DbRow): RuleBundleVersionRecord {
  return {
    id: asString(row.version_id, "version_id"),
    bundleId: asString(row.bundle_id, "bundle_id"),
    bundleKey: asString(row.bundle_key, "bundle_key"),
    title: asString(row.bundle_title, "bundle_title"),
    productFamily: asString(row.product_family, "product_family"),
    scopeKey: asString(row.scope_key, "scope_key"),
    version: asNumber(row.version, "version"),
    lifecycleStatus: validateStatus(row.lifecycle_status),
    content: safelyParseObject(row.content_json, "content_json") as RuleBundleDocument,
    contentHash: asString(row.content_hash, "content_hash"),
    createdAt: asString(row.created_at, "created_at"),
    createdByUserId: asString(row.created_by_user_id, "created_by_user_id"),
    createdByEmail: asString(row.created_by_email, "created_by_email"),
    updatedAt: asString(row.updated_at, "updated_at"),
    reviewedAt: optionalString(row.reviewed_at),
    reviewedByUserId: optionalString(row.reviewed_by_user_id),
    reviewedByEmail: optionalString(row.reviewed_by_email),
    reviewNote: optionalString(row.review_note),
    contentLockedAt: optionalString(row.content_locked_at),
  };
}

const BUNDLE_VERSION_SELECT = `
  SELECT
    b.id AS bundle_id,
    b.bundle_key,
    b.title AS bundle_title,
    b.product_family,
    b.scope_key,
    v.id AS version_id,
    v.version,
    v.lifecycle_status,
    v.content_json,
    v.content_hash,
    v.created_at,
    v.created_by_user_id,
    v.created_by_email,
    v.updated_at,
    v.reviewed_at,
    v.reviewed_by_user_id,
    v.reviewed_by_email,
    v.review_note,
    v.content_locked_at
  FROM rule_bundles b
  JOIN rule_bundle_versions v ON v.bundle_id = b.id
`;

export function isDatabaseSchemaError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : "";
  return /no such table|no such column|D1 binding `DB` is unavailable/i.test(message);
}

export async function writeAuditEvent(
  actor: GovernanceActor | null,
  action: string,
  entityType: string,
  entityId: string,
  detail: Record<string, unknown> = {},
): Promise<void> {
  await execute(
    `INSERT INTO governance_audit_events
      (id, action, entity_type, entity_id, detail_json, actor_user_id, actor_email)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      makeId(),
      action,
      entityType,
      entityId,
      stableStringify(detail),
      actor?.userId ?? null,
      actor?.email ?? null,
    ],
  );
}

export async function listAuditEvents(limit = 100): Promise<GovernanceAuditEvent[]> {
  const rows = await all<DbRow>(
    `SELECT id, action, entity_type, entity_id, detail_json, actor_user_id, actor_email, created_at
     FROM governance_audit_events
     ORDER BY created_at DESC, id DESC
     LIMIT ?`,
    [Math.max(1, Math.min(200, Math.floor(limit)))],
  );
  return rows.map((row) => ({
    id: asString(row.id, "id"),
    action: asString(row.action, "action"),
    entityType: asString(row.entity_type, "entity_type"),
    entityId: asString(row.entity_id, "entity_id"),
    detail: safelyParseObject(row.detail_json, "detail_json"),
    actorUserId: optionalString(row.actor_user_id),
    actorEmail: optionalString(row.actor_email),
    createdAt: asString(row.created_at, "created_at"),
  }));
}

export async function getAssignedRoles(actor: GovernanceActor): Promise<GovernanceRole[]> {
  const rows = await all<{ role: string }>(
    `SELECT role
     FROM governance_role_assignments
     WHERE enabled = 1 AND (user_id = ? OR email = ?)`,
    [actor.userId, normalizeEmail(actor.email)],
  );
  return rows
    .map((row) => row.role)
    .filter((role): role is GovernanceRole => role === "user" || role === "author" || role === "reviewer");
}

export async function listRoleAssignments(): Promise<
  Array<{ id: string; userId: string | null; email: string; role: GovernanceRole; enabled: boolean; createdAt: string; updatedAt: string }>
> {
  const rows = await all<DbRow>(
    `SELECT id, user_id, email, role, enabled, created_at, updated_at
     FROM governance_role_assignments
     ORDER BY email ASC, role ASC`,
  );
  return rows.map((row) => ({
    id: asString(row.id, "id"),
    userId: optionalString(row.user_id),
    email: asString(row.email, "email"),
    role: asString(row.role, "role") as GovernanceRole,
    enabled: asBoolean(row.enabled),
    createdAt: asString(row.created_at, "created_at"),
    updatedAt: asString(row.updated_at, "updated_at"),
  }));
}

export async function setRoleAssignment(
  actor: GovernanceActor,
  input: { email: string; role: GovernanceRole; enabled: boolean; userId?: string | null },
): Promise<void> {
  const email = normalizeEmail(validateNonEmpty(input.email, "Role email"));
  if (!ALLOWED_ASSIGNABLE_ROLES.has(input.role)) {
    throw new GovernanceDataError(
      "Administrator access is controlled only by the server-side named allowlist and cannot be assigned in the app.",
      "admin_role_not_assignable",
      403,
    );
  }
  const userId = typeof input.userId === "string" && input.userId.trim() ? input.userId.trim() : null;
  const existing = await first<{ id: string }>(
    `SELECT id FROM governance_role_assignments WHERE email = ? AND role = ?`,
    [email, input.role],
  );
  if (existing) {
    await execute(
      `UPDATE governance_role_assignments
       SET enabled = ?, user_id = COALESCE(?, user_id), updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [input.enabled ? 1 : 0, userId, existing.id],
    );
  } else {
    await execute(
      `INSERT INTO governance_role_assignments
       (id, user_id, email, role, enabled, created_by_user_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [makeId(), userId, email, input.role, input.enabled ? 1 : 0, actor.userId],
    );
  }
  await writeAuditEvent(actor, input.enabled ? "role.assigned" : "role.revoked", "role_assignment", `${email}:${input.role}`, {
    email,
    role: input.role,
    userId,
  });
}

export async function getSharedSettings(): Promise<SettingsRecord> {
  const defaults = cloneDefaultSharedSettings();
  await execute(
    `INSERT OR IGNORE INTO governance_settings
      (key, value_json, version, updated_by_user_id, updated_by_email)
     VALUES (?, ?, 1, NULL, NULL)`,
    [SHARED_SETTINGS_KEY, stableStringify(defaults)],
  );
  const row = await first<DbRow>(
    `SELECT key, value_json, version, updated_at, updated_by_user_id, updated_by_email
     FROM governance_settings WHERE key = ?`,
    [SHARED_SETTINGS_KEY],
  );
  if (!row) throw new GovernanceDataError("Shared settings could not be initialized.", "settings_unavailable", 500);
  return {
    key: SHARED_SETTINGS_KEY,
    value: validateSharedSettings(safelyParseObject(row.value_json, "value_json")),
    version: asNumber(row.version, "version"),
    updatedAt: asString(row.updated_at, "updated_at"),
    updatedByUserId: optionalString(row.updated_by_user_id),
    updatedByEmail: optionalString(row.updated_by_email),
  };
}

type CatalogueEntityType = "profile" | "adapter" | "feature";

type SeedCatalogueResult = {
  versionCreated: boolean;
  releaseCreated: boolean;
  collision: boolean;
};

export type SharedConfigurationBootstrapResult = {
  settingsInstalled: boolean;
  bundleInstalled: boolean;
  bundleReleaseInstalled: boolean;
  profileInstalled: boolean;
  profileReleaseInstalled: boolean;
  adapterInstalled: boolean;
  adapterReleaseInstalled: boolean;
  featureDefinitionsInstalled: number;
  featureReleasesInstalled: number;
  fixturesInstalled: number;
  collisions: string[];
};

function configuredNamedAdminEmails(): string[] {
  const raw = getRuntimeBindings().ADMIN_ALLOWLIST;
  if (typeof raw !== "string") return [];
  return [...new Set(raw.split(/[\n,;]/).map(normalizeEmail).filter(Boolean))];
}

function assertNamedAdminForBootstrap(actor: GovernanceActor): void {
  const namedAdmins = configuredNamedAdminEmails();
  if (!namedAdmins.length) {
    throw new GovernanceDataError(
      "A server-side ADMIN_ALLOWLIST is required before shared configuration can be initialized.",
      "setup_required",
      428,
    );
  }
  if (
    namedAdmins.includes("*") ||
    namedAdmins.includes("all") ||
    namedAdmins.includes(normalizeEmail(actor.email))
  ) {
    return;
  }
  throw new GovernanceDataError(
    "Only a named server-side administrator can initialize the shared configuration.",
    "named_admin_required",
    403,
  );
}

function catalogueScope(entityType: CatalogueEntityType, entityKey: string): string {
  return `${entityType.toUpperCase()}:${entityKey}`;
}

function seedCatalogueVersionId(entityType: CatalogueEntityType, entityKey: string): string {
  return `seed:catalogue-version:${entityType}:${entityKey}:1`;
}

function seedCatalogueReleaseId(entityType: CatalogueEntityType, entityKey: string): string {
  return `seed:catalogue-release:${entityType}:${entityKey}`;
}

async function seedCatalogueVersion(
  installer: GovernanceActor,
  entityType: CatalogueEntityType,
  entityKey: string,
  content: Record<string, unknown>,
): Promise<SeedCatalogueResult> {
  const contentHash = await hashContent(content);
  const versionCreated = await execute(
    `INSERT OR IGNORE INTO governed_catalogue_versions
      (id, entity_type, entity_key, version, lifecycle_status, content_json, content_hash,
       created_by_user_id, created_by_email, reviewed_at, reviewed_by_user_id, reviewed_by_email,
       review_note, content_locked_at)
     VALUES (?, ?, ?, 1, 'provisional_active', ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?, CURRENT_TIMESTAMP)`,
    [
      seedCatalogueVersionId(entityType, entityKey),
      entityType,
      entityKey,
      stableStringify(content),
      contentHash,
      INITIAL_SEED_ACTOR.userId,
      INITIAL_SEED_ACTOR.email,
      installer.userId,
      installer.email,
      "Version-controlled initial provisional seed; review required before any approved use.",
    ],
  );
  const version = await first<{ lifecycle_status: string }>(
    `SELECT lifecycle_status FROM governed_catalogue_versions
     WHERE entity_type = ? AND entity_key = ? AND version = 1`,
    [entityType, entityKey],
  );
  if (version?.lifecycle_status !== "provisional_active") {
    return { versionCreated: Boolean(versionCreated), releaseCreated: false, collision: true };
  }
  const releaseCreated = await execute(
    `INSERT OR IGNORE INTO governed_catalogue_releases
      (id, entity_type, scope_key, entity_key, entity_version, release_kind, is_current, reason, released_by_user_id, released_by_email)
     VALUES (?, ?, ?, ?, 1, 'publish', 1, ?, ?, ?)`,
    [
      seedCatalogueReleaseId(entityType, entityKey),
      entityType,
      catalogueScope(entityType, entityKey),
      entityKey,
      "Initial version-controlled provisional seed.",
      installer.userId,
      installer.email,
    ],
  );
  return { versionCreated: Boolean(versionCreated), releaseCreated: Boolean(releaseCreated), collision: false };
}

async function seedInitialSharedSettings(actor: GovernanceActor, settings: SharedSettingsDocument): Promise<boolean> {
  const inserted = await execute(
    `INSERT OR IGNORE INTO governance_settings
      (key, value_json, version, updated_by_user_id, updated_by_email)
     VALUES (?, ?, 1, ?, ?)`,
    [SHARED_SETTINGS_KEY, stableStringify(settings), actor.userId, actor.email],
  );
  if (inserted) return true;

  // A regular user can safely read a pre-allowlist deployment, which may have
  // created the empty defaults row. Upgrade only that untouched default row;
  // never overwrite an administrator's saved configuration.
  const upgraded = await execute(
    `UPDATE governance_settings
     SET value_json = ?, updated_at = CURRENT_TIMESTAMP, updated_by_user_id = ?, updated_by_email = ?
     WHERE key = ? AND version = 1 AND updated_by_user_id IS NULL AND value_json = ?`,
    [
      stableStringify(settings),
      actor.userId,
      actor.email,
      SHARED_SETTINGS_KEY,
      stableStringify(cloneDefaultSharedSettings()),
    ],
  );
  return Boolean(upgraded);
}

async function seedInitialRuleBundle(
  installer: GovernanceActor,
  bundle: RuleBundleDocument,
): Promise<{ installed: boolean; releaseInstalled: boolean; collision: boolean }> {
  const inserted = await execute(
    `INSERT OR IGNORE INTO rule_bundles
      (id, bundle_key, title, product_family, scope_key, created_by_user_id, created_by_email)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      INITIAL_BUNDLE_ID,
      bundle.bundleKey,
      bundle.title,
      bundle.productFamily,
      bundle.scopeKey,
      INITIAL_SEED_ACTOR.userId,
      INITIAL_SEED_ACTOR.email,
    ],
  );
  const identity = await first<{ id: string }>(`SELECT id FROM rule_bundles WHERE bundle_key = ?`, [bundle.bundleKey]);
  if (!identity || identity.id !== INITIAL_BUNDLE_ID) {
    return { installed: false, releaseInstalled: false, collision: true };
  }
  const contentHash = await hashContent(bundle);
  const versionInserted = await execute(
    `INSERT OR IGNORE INTO rule_bundle_versions
      (id, bundle_id, version, lifecycle_status, content_json, content_hash, created_by_user_id, created_by_email,
       reviewed_at, reviewed_by_user_id, reviewed_by_email, review_note, content_locked_at)
     VALUES (?, ?, 1, 'provisional_active', ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?, CURRENT_TIMESTAMP)`,
    [
      INITIAL_BUNDLE_VERSION_ID,
      INITIAL_BUNDLE_ID,
      stableStringify(bundle),
      contentHash,
      INITIAL_SEED_ACTOR.userId,
      INITIAL_SEED_ACTOR.email,
      installer.userId,
      installer.email,
      "Version-controlled initial provisional seed; outputs remain review required.",
    ],
  );
  const version = await first<{ lifecycle_status: string }>(
    `SELECT lifecycle_status FROM rule_bundle_versions WHERE bundle_id = ? AND version = 1`,
    [INITIAL_BUNDLE_ID],
  );
  if (version?.lifecycle_status !== "provisional_active") {
    return { installed: Boolean(inserted || versionInserted), releaseInstalled: false, collision: true };
  }
  const releaseInserted = await execute(
    `INSERT OR IGNORE INTO rule_bundle_releases
      (id, scope_key, bundle_id, bundle_version, release_kind, is_current, reason, released_by_user_id, released_by_email)
     VALUES (?, ?, ?, 1, 'publish', 1, ?, ?, ?)`,
    [
      INITIAL_RELEASE_ID,
      bundle.scopeKey,
      INITIAL_BUNDLE_ID,
      "Initial version-controlled provisional seed.",
      installer.userId,
      installer.email,
    ],
  );
  return {
    installed: Boolean(inserted || versionInserted),
    releaseInstalled: Boolean(releaseInserted),
    collision: false,
  };
}

async function seedInitialProfile(
  installer: GovernanceActor,
  profile: InitialProfileSeed,
): Promise<{ installed: boolean; releaseInstalled: boolean; collision: boolean }> {
  const inserted = await execute(
    `INSERT OR IGNORE INTO rule_profiles
      (id, profile_key, title, product_family, version, lifecycle_status, is_provisional, enabled, scope_json, values_json, created_by_user_id, updated_by_user_id)
     VALUES (?, ?, ?, ?, 1, 'provisional_active', 1, 1, ?, ?, ?, ?)`,
    [
      INITIAL_PROFILE_ID,
      profile.profileKey,
      profile.title,
      profile.productFamily,
      stableStringify(profile.scope),
      stableStringify(profile.values),
      INITIAL_SEED_ACTOR.userId,
      INITIAL_SEED_ACTOR.userId,
    ],
  );
  const identity = await first<{ id: string }>(`SELECT id FROM rule_profiles WHERE profile_key = ?`, [profile.profileKey]);
  if (!identity || identity.id !== INITIAL_PROFILE_ID) {
    return { installed: false, releaseInstalled: false, collision: true };
  }
  const version = await seedCatalogueVersion(installer, "profile", profile.profileKey, profile);
  return {
    installed: Boolean(inserted || version.versionCreated),
    releaseInstalled: version.releaseCreated,
    collision: version.collision,
  };
}

async function seedInitialAdapter(
  installer: GovernanceActor,
  adapter: InitialAdapterSeed,
): Promise<{ installed: boolean; releaseInstalled: boolean; collision: boolean }> {
  const inserted = await execute(
    `INSERT OR IGNORE INTO adapter_definitions
      (id, adapter_key, title, product_family, version, lifecycle_status, enabled, definition_json, created_by_user_id, updated_by_user_id)
     VALUES (?, ?, ?, ?, 1, 'provisional_active', 1, ?, ?, ?)`,
    [
      INITIAL_ADAPTER_ID,
      adapter.adapterKey,
      adapter.title,
      adapter.productFamily,
      stableStringify(adapter.definition),
      INITIAL_SEED_ACTOR.userId,
      INITIAL_SEED_ACTOR.userId,
    ],
  );
  const identity = await first<{ id: string }>(`SELECT id FROM adapter_definitions WHERE adapter_key = ?`, [adapter.adapterKey]);
  if (!identity || identity.id !== INITIAL_ADAPTER_ID) {
    return { installed: false, releaseInstalled: false, collision: true };
  }
  const version = await seedCatalogueVersion(installer, "adapter", adapter.adapterKey, adapter);
  return {
    installed: Boolean(inserted || version.versionCreated),
    releaseInstalled: version.releaseCreated,
    collision: version.collision,
  };
}

async function seedInitialFeatures(
  installer: GovernanceActor,
  features: InitialFeatureSeed[],
): Promise<{ definitionsInstalled: number; releasesInstalled: number; collisions: string[] }> {
  const database = getD1();
  const statements = features.map((feature) =>
    database
      .prepare(
        `INSERT OR IGNORE INTO feature_definitions
          (id, adapter_key, feature_code, product_family, value_type, unit, definition_json, enabled)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      )
      .bind(
        `seed:feature:${feature.adapterKey}:${feature.featureCode}`,
        feature.adapterKey,
        feature.featureCode,
        feature.productFamily,
        feature.valueType,
        feature.unit ?? null,
        stableStringify(feature.definition),
      ),
  );
  if (statements.length) await database.batch(statements);

  const rows = await all<{ id: string; feature_code: string }>(
    `SELECT id, feature_code FROM feature_definitions WHERE adapter_key = ?`,
    [features[0]?.adapterKey ?? ""],
  );
  const ids = new Map(rows.map((row) => [row.feature_code, row.id]));
  let definitionsInstalled = 0;
  let releasesInstalled = 0;
  const collisions: string[] = [];
  for (const feature of features) {
    if (ids.get(feature.featureCode) !== `seed:feature:${feature.adapterKey}:${feature.featureCode}`) {
      collisions.push(`feature:${feature.featureCode}`);
      continue;
    }
    const version = await seedCatalogueVersion(installer, "feature", `${feature.adapterKey}:${feature.featureCode}`, feature);
    if (version.versionCreated) definitionsInstalled += 1;
    if (version.releaseCreated) releasesInstalled += 1;
    if (version.collision) collisions.push(`feature:${feature.featureCode}`);
  }
  return { definitionsInstalled, releasesInstalled, collisions };
}

const INITIAL_FIXTURE_SEEDS: Array<{
  id: string;
  fixtureKey: string;
  title: string;
  fixtureType: "FFR_REGISTER" | "DLMS_REPORT";
  sourceReference: string;
  metadata: Record<string, unknown>;
}> = [
  {
    id: "seed:fixture:260601-ffr-ig",
    fixtureKey: "ffr-ig-260601",
    title: "Supplied FFR IG register",
    fixtureType: "FFR_REGISTER",
    sourceReference: "tests/fixtures/260601-FFR IG.xlsx",
    metadata: {
      purpose: "Staged FFR register parsing and selected-meter identity tests.",
      rawEvidenceRetained: false,
      sourceProvidedBy: "deployment fixture",
    },
  },
  {
    id: "seed:fixture:as2373952-dlms-report",
    fixtureKey: "dlms-as2373952-2026-06-30",
    title: "Supplied BCS/DLMS report",
    fixtureType: "DLMS_REPORT",
    sourceReference: "tests/fixtures/AS2373952_Reports_2026-06-30_16-07-28.xlsx",
    metadata: {
      purpose: "60-check provisional DLMS evaluation, source references, and profile-selection tests.",
      rawEvidenceRetained: false,
      expectedAdapterKey: "bcs-16-sheet-v1",
    },
  },
];

async function seedInitialFixtures(): Promise<number> {
  let installed = 0;
  for (const fixture of INITIAL_FIXTURE_SEEDS) {
    const changes = await execute(
      `INSERT OR IGNORE INTO governance_fixtures
        (id, fixture_key, title, fixture_type, source_reference, metadata_json, lifecycle_status, enabled, created_by_user_id, created_by_email, updated_by_user_id)
       VALUES (?, ?, ?, ?, ?, ?, 'provisional_active', 1, ?, ?, ?)`,
      [
        fixture.id,
        fixture.fixtureKey,
        fixture.title,
        fixture.fixtureType,
        fixture.sourceReference,
        stableStringify(fixture.metadata),
        INITIAL_SEED_ACTOR.userId,
        INITIAL_SEED_ACTOR.email,
        INITIAL_SEED_ACTOR.userId,
      ],
    );
    if (changes) installed += 1;
  }
  return installed;
}

/**
 * Idempotently installs the first shared configuration. This function is
 * intentionally defensive: importing seed JSON does not mutate D1, and the
 * mutation itself requires the request actor to be in the runtime named-admin
 * allowlist. A later bootstrap only repairs missing seed rows; it never
 * overwrites administrator-managed values.
 */
export async function ensureInitialSharedConfiguration(
  actor: GovernanceActor,
): Promise<SharedConfigurationBootstrapResult> {
  assertNamedAdminForBootstrap(actor);
  const seed = buildInitialSharedConfigurationSeed();
  const settingsInstalled = await seedInitialSharedSettings(actor, seed.settings);
  const bundle = await seedInitialRuleBundle(actor, seed.bundle);
  const profile = await seedInitialProfile(actor, seed.profile);
  const adapter = await seedInitialAdapter(actor, seed.adapter);
  const features = await seedInitialFeatures(actor, seed.features);
  const fixturesInstalled = await seedInitialFixtures();
  const collisions = [
    ...(bundle.collision ? ["rule_bundle:generic-provisional-v1"] : []),
    ...(profile.collision ? ["profile:generic-provisional-v1"] : []),
    ...(adapter.collision ? ["adapter:bcs-16-sheet-v1"] : []),
    ...features.collisions,
  ];
  const result: SharedConfigurationBootstrapResult = {
    settingsInstalled,
    bundleInstalled: bundle.installed,
    bundleReleaseInstalled: bundle.releaseInstalled,
    profileInstalled: profile.installed,
    profileReleaseInstalled: profile.releaseInstalled,
    adapterInstalled: adapter.installed,
    adapterReleaseInstalled: adapter.releaseInstalled,
    featureDefinitionsInstalled: features.definitionsInstalled,
    featureReleasesInstalled: features.releasesInstalled,
    fixturesInstalled,
    collisions,
  };
  if (
    settingsInstalled ||
    bundle.installed ||
    bundle.releaseInstalled ||
    profile.installed ||
    profile.releaseInstalled ||
    adapter.installed ||
    adapter.releaseInstalled ||
    features.definitionsInstalled ||
    features.releasesInstalled ||
    fixturesInstalled
  ) {
    await writeAuditEvent(actor, "shared_configuration.bootstrap_seeded", "shared_configuration", "initial-v1", result);
  }
  return result;
}

export async function updateSharedSettings(
  actor: GovernanceActor,
  value: unknown,
  expectedVersion: number,
  options: { allowBrandingObjectUpdate?: boolean } = {},
): Promise<SettingsRecord> {
  if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
    throw new GovernanceDataError("A current settings version is required to save shared settings.", "settings_version_required");
  }
  const requestedSettings = validateSharedSettings(value);
  const currentSettings = await getSharedSettings();
  // Branding object keys are server-owned R2 references. Settings forms can
  // edit the alt text, but only the R2 upload helper may replace the object.
  const settings: SharedSettingsDocument = options.allowBrandingObjectUpdate
    ? requestedSettings
    : {
        ...requestedSettings,
        branding: {
          ...requestedSettings.branding,
          logoObjectKey: currentSettings.value.branding.logoObjectKey,
          logoUrl: currentSettings.value.branding.logoUrl,
          updatedAt: currentSettings.value.branding.updatedAt,
        },
      };
  const changes = await execute(
    `UPDATE governance_settings
     SET value_json = ?, version = version + 1, updated_at = CURRENT_TIMESTAMP,
         updated_by_user_id = ?, updated_by_email = ?
     WHERE key = ? AND version = ?`,
    [stableStringify(settings), actor.userId, actor.email, SHARED_SETTINGS_KEY, expectedVersion],
  );
  if (changes !== 1) {
    throw new GovernanceDataError(
      "Shared settings changed since they were loaded. Reload them before saving.",
      "settings_conflict",
      409,
    );
  }
  const result = await getSharedSettings();
  await writeAuditEvent(actor, "settings.updated", "settings", SHARED_SETTINGS_KEY, {
    version: result.version,
    evidenceRetentionEnabled: result.value.evidenceRetention.enabled,
  });
  return result;
}

export async function getRuleBundleVersion(bundleId: string, version: number): Promise<RuleBundleVersionRecord | null> {
  const row = await first<DbRow>(
    `${BUNDLE_VERSION_SELECT} WHERE b.id = ? AND v.version = ?`,
    [bundleId, version],
  );
  return row ? parseBundleRow(row) : null;
}

export async function getRuleBundleIdByKey(bundleKey: string): Promise<string | null> {
  const row = await first<{ id: string }>(`SELECT id FROM rule_bundles WHERE bundle_key = ?`, [bundleKey.trim()]);
  return row?.id ?? null;
}

export async function listRuleBundleVersions(bundleId: string): Promise<RuleBundleVersionRecord[]> {
  const rows = await all<DbRow>(
    `${BUNDLE_VERSION_SELECT} WHERE b.id = ? ORDER BY v.version DESC`,
    [bundleId],
  );
  return rows.map(parseBundleRow);
}

export async function listRuleBundles(scopeKey?: string | null): Promise<Array<RuleBundleVersionRecord & { isCurrent: boolean }>> {
  const scopeFilter = typeof scopeKey === "string" && scopeKey.trim();
  const rows = await all<DbRow>(
    `${BUNDLE_VERSION_SELECT}
     WHERE v.version = (SELECT MAX(v2.version) FROM rule_bundle_versions v2 WHERE v2.bundle_id = b.id)
       ${scopeFilter ? "AND b.scope_key = ?" : ""}
     ORDER BY b.updated_at DESC, b.bundle_key ASC`,
    scopeFilter ? [scopeKey.trim()] : [],
  );
  const output: Array<RuleBundleVersionRecord & { isCurrent: boolean }> = [];
  for (const row of rows) {
    const record = parseBundleRow(row);
    const current = await first<{ is_current: number }>(
      `SELECT is_current FROM rule_bundle_releases
       WHERE bundle_id = ? AND bundle_version = ? AND is_current = 1
       ORDER BY released_at DESC LIMIT 1`,
      [record.bundleId, record.version],
    );
    output.push({ ...record, isCurrent: Boolean(current && asBoolean(current.is_current)) });
  }
  return output;
}

export async function getCurrentRuleBundle(scopeKey: string): Promise<RuleBundleVersionRecord | null> {
  const row = await first<DbRow>(
    `${BUNDLE_VERSION_SELECT}
     JOIN rule_bundle_releases r ON r.bundle_id = b.id AND r.bundle_version = v.version
     WHERE r.scope_key = ? AND r.is_current = 1
     ORDER BY r.released_at DESC LIMIT 1`,
    [scopeKey.trim()],
  );
  return row ? parseBundleRow(row) : null;
}

export async function createRuleBundle(
  actor: GovernanceActor,
  contentInput: unknown,
): Promise<RuleBundleVersionRecord> {
  const content = validateRuleBundleDocument(contentInput);
  const bundleKey = validateKey(content.bundleKey, "Bundle key");
  const bundleId = makeId();
  const versionId = makeId();
  const contentHash = await hashContent(content);
  const database = getD1();
  await database.batch([
    database
      .prepare(
        `INSERT INTO rule_bundles
          (id, bundle_key, title, product_family, scope_key, created_by_user_id, created_by_email)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(bundleId, bundleKey, content.title, content.productFamily, content.scopeKey, actor.userId, actor.email),
    database
      .prepare(
        `INSERT INTO rule_bundle_versions
          (id, bundle_id, version, lifecycle_status, content_json, content_hash, created_by_user_id, created_by_email)
         VALUES (?, ?, 1, 'draft', ?, ?, ?, ?)`,
      )
      .bind(versionId, bundleId, stableStringify(content), contentHash, actor.userId, actor.email),
  ]);
  const created = await getRuleBundleVersion(bundleId, 1);
  if (!created) throw new GovernanceDataError("Rule bundle could not be created.", "bundle_unavailable", 500);
  await writeAuditEvent(actor, "rule_bundle.created", "rule_bundle", bundleId, {
    bundleKey,
    version: 1,
    lifecycleStatus: "draft",
  });
  return created;
}

export async function createDraftRuleBundleVersion(
  actor: GovernanceActor,
  bundleId: string,
  contentInput?: unknown,
): Promise<RuleBundleVersionRecord> {
  const latestRows = await all<DbRow>(
    `${BUNDLE_VERSION_SELECT} WHERE b.id = ? ORDER BY v.version DESC LIMIT 1`,
    [bundleId],
  );
  const latest = latestRows[0] ? parseBundleRow(latestRows[0]) : null;
  if (!latest) throw new GovernanceDataError("Rule bundle was not found.", "bundle_not_found", 404);
  const content = validateRuleBundleDocument(contentInput ?? latest.content);
  if (
    content.bundleKey !== latest.bundleKey ||
    content.productFamily !== latest.productFamily ||
    content.scopeKey !== latest.scopeKey
  ) {
    throw new GovernanceDataError(
      "A new draft version cannot change its bundle key, product family, or scope. Create a new bundle for a new scope.",
      "immutable_bundle_scope",
    );
  }
  const nextVersion = latest.version + 1;
  const contentHash = await hashContent(content);
  await execute(
    `INSERT INTO rule_bundle_versions
      (id, bundle_id, version, lifecycle_status, content_json, content_hash, created_by_user_id, created_by_email)
     VALUES (?, ?, ?, 'draft', ?, ?, ?, ?)`,
    [makeId(), bundleId, nextVersion, stableStringify(content), contentHash, actor.userId, actor.email],
  );
  await execute(`UPDATE rule_bundles SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [bundleId]);
  const created = await getRuleBundleVersion(bundleId, nextVersion);
  if (!created) throw new GovernanceDataError("Rule bundle draft could not be created.", "bundle_unavailable", 500);
  await writeAuditEvent(actor, "rule_bundle.draft_created", "rule_bundle", bundleId, {
    bundleKey: latest.bundleKey,
    version: nextVersion,
  });
  return created;
}

export async function updateDraftRuleBundleVersion(
  actor: GovernanceActor,
  bundleId: string,
  version: number,
  contentInput: unknown,
): Promise<RuleBundleVersionRecord> {
  const existing = await getRuleBundleVersion(bundleId, version);
  if (!existing) throw new GovernanceDataError("Rule bundle version was not found.", "bundle_version_not_found", 404);
  if (existing.lifecycleStatus !== "draft") {
    throw new GovernanceDataError("Published or reviewed rule bundle versions are immutable. Create a new draft version instead.", "bundle_locked", 409);
  }
  const content = validateRuleBundleDocument(contentInput);
  if (
    content.bundleKey !== existing.bundleKey ||
    content.productFamily !== existing.productFamily ||
    content.scopeKey !== existing.scopeKey
  ) {
    throw new GovernanceDataError(
      "A draft version cannot change its bundle key, product family, or scope. Create a new bundle for a new scope.",
      "immutable_bundle_scope",
    );
  }
  const contentHash = await hashContent(content);
  const changes = await execute(
    `UPDATE rule_bundle_versions
     SET content_json = ?, content_hash = ?, updated_at = CURRENT_TIMESTAMP
     WHERE bundle_id = ? AND version = ? AND lifecycle_status = 'draft'`,
    [stableStringify(content), contentHash, bundleId, version],
  );
  if (changes !== 1) throw new GovernanceDataError("Rule bundle draft changed before it could be saved.", "bundle_conflict", 409);
  await execute(`UPDATE rule_bundles SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [bundleId]);
  const updated = await getRuleBundleVersion(bundleId, version);
  if (!updated) throw new GovernanceDataError("Rule bundle version could not be updated.", "bundle_unavailable", 500);
  await writeAuditEvent(actor, "rule_bundle.draft_updated", "rule_bundle", bundleId, { version, contentHash });
  return updated;
}

export async function transitionRuleBundleVersion(
  actor: GovernanceActor,
  bundleId: string,
  version: number,
  targetStatusInput: unknown,
  reviewNoteInput?: unknown,
): Promise<RuleBundleVersionRecord> {
  const targetStatus = validateStatus(targetStatusInput);
  const existing = await getRuleBundleVersion(bundleId, version);
  if (!existing) throw new GovernanceDataError("Rule bundle version was not found.", "bundle_version_not_found", 404);
  if (!canTransitionRuleVersion(existing.lifecycleStatus, targetStatus)) {
    throw new GovernanceDataError(
      `Rule bundle version cannot transition from ${existing.lifecycleStatus} to ${targetStatus}.`,
      "invalid_lifecycle_transition",
      409,
    );
  }
  if (isReviewApproval(targetStatus) && existing.createdByUserId === actor.userId) {
    throw new GovernanceDataError(
      "The person who drafted a rule version cannot approve that same version.",
      "independent_reviewer_required",
      403,
    );
  }
  const reviewNote = typeof reviewNoteInput === "string" ? reviewNoteInput.trim().slice(0, 4_000) : "";
  const lockContent = isPublishedRuleVersion(targetStatus) ? 1 : 0;
  const reviewer = isReviewApproval(targetStatus) ? actor : null;
  const changes = await execute(
    `UPDATE rule_bundle_versions
     SET lifecycle_status = ?, updated_at = CURRENT_TIMESTAMP,
         reviewed_at = CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE reviewed_at END,
         reviewed_by_user_id = CASE WHEN ? = 1 THEN ? ELSE reviewed_by_user_id END,
         reviewed_by_email = CASE WHEN ? = 1 THEN ? ELSE reviewed_by_email END,
         review_note = CASE WHEN ? = 1 THEN ? ELSE review_note END,
         content_locked_at = CASE WHEN ? = 1 THEN COALESCE(content_locked_at, CURRENT_TIMESTAMP) ELSE content_locked_at END
     WHERE bundle_id = ? AND version = ? AND lifecycle_status = ?`,
    [
      targetStatus,
      reviewer ? 1 : 0,
      reviewer ? 1 : 0,
      reviewer?.userId ?? null,
      reviewer ? 1 : 0,
      reviewer?.email ?? null,
      reviewer ? 1 : 0,
      reviewNote,
      lockContent,
      bundleId,
      version,
      existing.lifecycleStatus,
    ],
  );
  if (changes !== 1) throw new GovernanceDataError("Rule bundle version changed before it could transition.", "bundle_conflict", 409);
  await execute(`UPDATE rule_bundles SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [bundleId]);
  const updated = await getRuleBundleVersion(bundleId, version);
  if (!updated) throw new GovernanceDataError("Rule bundle version could not transition.", "bundle_unavailable", 500);
  await writeAuditEvent(actor, "rule_bundle.transitioned", "rule_bundle", bundleId, {
    version,
    from: existing.lifecycleStatus,
    to: targetStatus,
    reviewNote: reviewNote || null,
  });
  return updated;
}

export async function releaseRuleBundleVersion(
  actor: GovernanceActor,
  bundleId: string,
  version: number,
  input: { scopeKey?: string; reason?: string; releaseKind: "publish" | "rollback" },
): Promise<RuleBundleVersionRecord> {
  const existing = await getRuleBundleVersion(bundleId, version);
  if (!existing) throw new GovernanceDataError("Rule bundle version was not found.", "bundle_version_not_found", 404);
  if (existing.lifecycleStatus !== "provisional_active" && existing.lifecycleStatus !== "approved_active") {
    throw new GovernanceDataError(
      "Only reviewed provisional-active or approved-active versions can be released.",
      "release_requires_reviewed_version",
      409,
    );
  }
  const scopeKey = validateNonEmpty(input.scopeKey ?? existing.scopeKey, "Release scope");
  const reason = typeof input.reason === "string" ? input.reason.trim().slice(0, 4_000) : "";
  const database = getD1();
  await database.batch([
    database
      .prepare(
        `UPDATE rule_bundle_releases
         SET is_current = 0, superseded_at = CURRENT_TIMESTAMP
         WHERE scope_key = ? AND is_current = 1`,
      )
      .bind(scopeKey),
    database
      .prepare(
        `INSERT INTO rule_bundle_releases
          (id, scope_key, bundle_id, bundle_version, release_kind, is_current, reason, released_by_user_id, released_by_email)
         VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)`,
      )
      .bind(makeId(), scopeKey, bundleId, version, input.releaseKind, reason, actor.userId, actor.email),
  ]);
  await writeAuditEvent(actor, input.releaseKind === "rollback" ? "rule_bundle.rolled_back" : "rule_bundle.published", "rule_bundle", bundleId, {
    version,
    scopeKey,
    lifecycleStatus: existing.lifecycleStatus,
    reason: reason || null,
  });
  return existing;
}

export type GovernedCatalogueVersionRecord = {
  id: string;
  entityType: CatalogueEntityType;
  entityKey: string;
  version: number;
  lifecycleStatus: RuleLifecycleStatus;
  content: Record<string, unknown>;
  contentHash: string;
  createdAt: string;
  createdByUserId: string;
  createdByEmail: string;
  updatedAt: string;
  reviewedAt: string | null;
  reviewedByUserId: string | null;
  reviewedByEmail: string | null;
  reviewNote: string | null;
  contentLockedAt: string | null;
};

function catalogueEntityType(value: string): CatalogueEntityType {
  if (value === "profile" || value === "adapter" || value === "feature") return value;
  throw new GovernanceDataError("Unknown governed catalogue type.", "invalid_catalogue_type");
}

function parseCatalogueVersionRow(row: DbRow): GovernedCatalogueVersionRecord {
  return {
    id: asString(row.id, "id"),
    entityType: catalogueEntityType(asString(row.entity_type, "entity_type")),
    entityKey: asString(row.entity_key, "entity_key"),
    version: asNumber(row.version, "version"),
    lifecycleStatus: validateStatus(row.lifecycle_status),
    content: safelyParseObject(row.content_json, "content_json"),
    contentHash: asString(row.content_hash, "content_hash"),
    createdAt: asString(row.created_at, "created_at"),
    createdByUserId: asString(row.created_by_user_id, "created_by_user_id"),
    createdByEmail: asString(row.created_by_email, "created_by_email"),
    updatedAt: asString(row.updated_at, "updated_at"),
    reviewedAt: optionalString(row.reviewed_at),
    reviewedByUserId: optionalString(row.reviewed_by_user_id),
    reviewedByEmail: optionalString(row.reviewed_by_email),
    reviewNote: optionalString(row.review_note),
    contentLockedAt: optionalString(row.content_locked_at),
  };
}

const CATALOGUE_VERSION_SELECT = `
  SELECT id, entity_type, entity_key, version, lifecycle_status, content_json, content_hash,
         created_at, created_by_user_id, created_by_email, updated_at, reviewed_at,
         reviewed_by_user_id, reviewed_by_email, review_note, content_locked_at
  FROM governed_catalogue_versions
`;

export async function getGovernedCatalogueVersion(
  entityTypeInput: string,
  entityKey: string,
  version: number,
): Promise<GovernedCatalogueVersionRecord | null> {
  const entityType = catalogueEntityType(entityTypeInput);
  const row = await first<DbRow>(
    `${CATALOGUE_VERSION_SELECT} WHERE entity_type = ? AND entity_key = ? AND version = ?`,
    [entityType, entityKey, version],
  );
  return row ? parseCatalogueVersionRow(row) : null;
}

export async function listGovernedCatalogueVersions(
  entityTypeInput: string,
  entityKey: string,
): Promise<GovernedCatalogueVersionRecord[]> {
  const entityType = catalogueEntityType(entityTypeInput);
  const rows = await all<DbRow>(
    `${CATALOGUE_VERSION_SELECT} WHERE entity_type = ? AND entity_key = ? ORDER BY version DESC`,
    [entityType, entityKey],
  );
  return rows.map(parseCatalogueVersionRow);
}

async function createGovernedCatalogueDraft(
  actor: GovernanceActor,
  entityType: CatalogueEntityType,
  entityKey: string,
  content: Record<string, unknown>,
): Promise<GovernedCatalogueVersionRecord> {
  const versionRow = await first<{ version: number }>(
    `SELECT COALESCE(MAX(version), 0) AS version
     FROM governed_catalogue_versions WHERE entity_type = ? AND entity_key = ?`,
    [entityType, entityKey],
  );
  const version = asNumber(versionRow?.version ?? 0, "version") + 1;
  const contentHash = await hashContent(content);
  await execute(
    `INSERT INTO governed_catalogue_versions
      (id, entity_type, entity_key, version, lifecycle_status, content_json, content_hash, created_by_user_id, created_by_email)
     VALUES (?, ?, ?, ?, 'draft', ?, ?, ?, ?)`,
    [makeId(), entityType, entityKey, version, stableStringify(content), contentHash, actor.userId, actor.email],
  );
  const created = await getGovernedCatalogueVersion(entityType, entityKey, version);
  if (!created) throw new GovernanceDataError("Catalogue draft could not be created.", "catalogue_unavailable", 500);
  await writeAuditEvent(actor, "catalogue.draft_created", entityType, entityKey, { version, contentHash });
  return created;
}

function validateCatalogueContent(entityType: CatalogueEntityType, content: Record<string, unknown>): Record<string, unknown> {
  if (entityType === "profile") return validateProfileInput(content) as unknown as Record<string, unknown>;
  if (entityType === "adapter") return validateAdapterInput(content) as unknown as Record<string, unknown>;
  return validateFeatureInput(content) as unknown as Record<string, unknown>;
}

export async function transitionGovernedCatalogueVersion(
  actor: GovernanceActor,
  entityTypeInput: string,
  entityKey: string,
  version: number,
  targetStatusInput: unknown,
  reviewNoteInput?: unknown,
): Promise<GovernedCatalogueVersionRecord> {
  const entityType = catalogueEntityType(entityTypeInput);
  const targetStatus = validateStatus(targetStatusInput);
  const existing = await getGovernedCatalogueVersion(entityType, entityKey, version);
  if (!existing) throw new GovernanceDataError("Catalogue version was not found.", "catalogue_version_not_found", 404);
  if (!canTransitionRuleVersion(existing.lifecycleStatus, targetStatus)) {
    throw new GovernanceDataError(
      `Catalogue version cannot transition from ${existing.lifecycleStatus} to ${targetStatus}.`,
      "invalid_lifecycle_transition",
      409,
    );
  }
  if (isReviewApproval(targetStatus) && existing.createdByUserId === actor.userId) {
    throw new GovernanceDataError(
      "The person who drafted a catalogue version cannot approve that same version.",
      "independent_reviewer_required",
      403,
    );
  }
  const reviewNote = typeof reviewNoteInput === "string" ? reviewNoteInput.trim().slice(0, 4_000) : "";
  const reviewer = isReviewApproval(targetStatus) ? actor : null;
  const lockContent = isPublishedRuleVersion(targetStatus) ? 1 : 0;
  const changes = await execute(
    `UPDATE governed_catalogue_versions
     SET lifecycle_status = ?, updated_at = CURRENT_TIMESTAMP,
         reviewed_at = CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE reviewed_at END,
         reviewed_by_user_id = CASE WHEN ? = 1 THEN ? ELSE reviewed_by_user_id END,
         reviewed_by_email = CASE WHEN ? = 1 THEN ? ELSE reviewed_by_email END,
         review_note = CASE WHEN ? = 1 THEN ? ELSE review_note END,
         content_locked_at = CASE WHEN ? = 1 THEN COALESCE(content_locked_at, CURRENT_TIMESTAMP) ELSE content_locked_at END
     WHERE entity_type = ? AND entity_key = ? AND version = ? AND lifecycle_status = ?`,
    [
      targetStatus,
      reviewer ? 1 : 0,
      reviewer ? 1 : 0,
      reviewer?.userId ?? null,
      reviewer ? 1 : 0,
      reviewer?.email ?? null,
      reviewer ? 1 : 0,
      reviewNote,
      lockContent,
      entityType,
      entityKey,
      version,
      existing.lifecycleStatus,
    ],
  );
  if (changes !== 1) throw new GovernanceDataError("Catalogue version changed before it could transition.", "catalogue_conflict", 409);
  const updated = await getGovernedCatalogueVersion(entityType, entityKey, version);
  if (!updated) throw new GovernanceDataError("Catalogue version could not transition.", "catalogue_unavailable", 500);
  await writeAuditEvent(actor, "catalogue.transitioned", entityType, entityKey, {
    version,
    from: existing.lifecycleStatus,
    to: targetStatus,
    reviewNote: reviewNote || null,
  });
  return updated;
}

async function applyReleasedCatalogueProjection(
  actor: GovernanceActor,
  record: GovernedCatalogueVersionRecord,
): Promise<void> {
  const content = validateCatalogueContent(record.entityType, record.content);
  if (record.entityType === "profile") {
    const profile = content as unknown as RuleProfileInput;
    const changes = await execute(
      `UPDATE rule_profiles
       SET title = ?, product_family = ?, version = ?, lifecycle_status = ?, is_provisional = ?, enabled = ?,
           scope_json = ?, values_json = ?, updated_at = CURRENT_TIMESTAMP, updated_by_user_id = ?
       WHERE profile_key = ?`,
      [
        profile.title,
        profile.productFamily,
        record.version,
        record.lifecycleStatus,
        profile.isProvisional ? 1 : 0,
        profile.enabled ? 1 : 0,
        stableStringify(profile.scope),
        stableStringify(profile.values),
        actor.userId,
        profile.profileKey,
      ],
    );
    if (changes !== 1) throw new GovernanceDataError("Profile identity was not found for release.", "profile_not_found", 404);
    return;
  }
  if (record.entityType === "adapter") {
    const adapter = content as unknown as AdapterInput;
    const changes = await execute(
      `UPDATE adapter_definitions
       SET title = ?, product_family = ?, version = ?, lifecycle_status = ?, enabled = ?, definition_json = ?,
           updated_at = CURRENT_TIMESTAMP, updated_by_user_id = ?
       WHERE adapter_key = ?`,
      [
        adapter.title,
        adapter.productFamily,
        record.version,
        record.lifecycleStatus,
        adapter.enabled ? 1 : 0,
        stableStringify(adapter.definition),
        actor.userId,
        adapter.adapterKey,
      ],
    );
    if (changes !== 1) throw new GovernanceDataError("Adapter identity was not found for release.", "adapter_not_found", 404);
    return;
  }
  const feature = content as unknown as FeatureInput;
  const changes = await execute(
    `UPDATE feature_definitions
     SET product_family = ?, value_type = ?, unit = ?, definition_json = ?, enabled = ?, updated_at = CURRENT_TIMESTAMP
     WHERE adapter_key = ? AND feature_code = ?`,
    [
      feature.productFamily,
      feature.valueType,
      feature.unit,
      stableStringify(feature.definition),
      feature.enabled ? 1 : 0,
      feature.adapterKey,
      feature.featureCode,
    ],
  );
  if (changes !== 1) throw new GovernanceDataError("Feature identity was not found for release.", "feature_not_found", 404);
}

export async function releaseGovernedCatalogueVersion(
  actor: GovernanceActor,
  entityTypeInput: string,
  entityKey: string,
  version: number,
  input: { reason?: string; releaseKind: "publish" | "rollback" },
): Promise<GovernedCatalogueVersionRecord> {
  const entityType = catalogueEntityType(entityTypeInput);
  const existing = await getGovernedCatalogueVersion(entityType, entityKey, version);
  if (!existing) throw new GovernanceDataError("Catalogue version was not found.", "catalogue_version_not_found", 404);
  if (existing.lifecycleStatus !== "provisional_active" && existing.lifecycleStatus !== "approved_active") {
    throw new GovernanceDataError("Only reviewed active catalogue versions can be released.", "release_requires_reviewed_version", 409);
  }
  const scopeKey = catalogueScope(entityType, entityKey);
  const reason = typeof input.reason === "string" ? input.reason.trim().slice(0, 4_000) : "";
  const database = getD1();
  await database.batch([
    database
      .prepare(
        `UPDATE governed_catalogue_releases
         SET is_current = 0, superseded_at = CURRENT_TIMESTAMP
         WHERE entity_type = ? AND scope_key = ? AND is_current = 1`,
      )
      .bind(entityType, scopeKey),
    database
      .prepare(
        `INSERT INTO governed_catalogue_releases
          (id, entity_type, scope_key, entity_key, entity_version, release_kind, is_current, reason, released_by_user_id, released_by_email)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
      )
      .bind(makeId(), entityType, scopeKey, entityKey, version, input.releaseKind, reason, actor.userId, actor.email),
  ]);
  await applyReleasedCatalogueProjection(actor, existing);
  await writeAuditEvent(actor, input.releaseKind === "rollback" ? "catalogue.rolled_back" : "catalogue.published", entityType, entityKey, {
    version,
    lifecycleStatus: existing.lifecycleStatus,
    reason: reason || null,
  });
  return existing;
}

function parseProfileRow(row: DbRow): RuleProfile {
  return {
    id: asString(row.id, "id"),
    profileKey: asString(row.profile_key, "profile_key"),
    title: asString(row.title, "title"),
    productFamily: asString(row.product_family, "product_family"),
    version: asNumber(row.version, "version"),
    lifecycleStatus: validateStatus(row.lifecycle_status),
    isProvisional: asBoolean(row.is_provisional),
    enabled: asBoolean(row.enabled),
    scope: safelyParseObject(row.scope_json, "scope_json"),
    values: safelyParseObject(row.values_json, "values_json"),
    createdAt: asString(row.created_at, "created_at"),
    updatedAt: asString(row.updated_at, "updated_at"),
  };
}

type RuleProfileInput = {
  profileKey: string;
  title: string;
  productFamily: string;
  lifecycleStatus?: RuleLifecycleStatus;
  isProvisional?: boolean;
  enabled?: boolean;
  scope: Record<string, unknown>;
  values: Record<string, unknown>;
};

function validateProfileInput(input: unknown): RuleProfileInput {
  if (!isRecord(input)) throw new GovernanceDataError("Profile must be a JSON object.", "invalid_input");
  if (!isRecord(input.scope) || !isRecord(input.values)) {
    throw new GovernanceDataError("Profile scope and values must be JSON objects.", "invalid_input");
  }
  return {
    profileKey: validateKey(validateNonEmpty(input.profileKey, "Profile key"), "Profile key", PROFILE_KEY_PATTERN),
    title: validateNonEmpty(input.title, "Profile title"),
    productFamily: validateNonEmpty(input.productFamily, "Profile product family"),
    lifecycleStatus: input.lifecycleStatus ? validateStatus(input.lifecycleStatus) : "draft",
    isProvisional: input.isProvisional === true,
    enabled: input.enabled !== false,
    scope: input.scope,
    values: input.values,
  };
}

export async function listRuleProfiles(productFamily?: string | null): Promise<RuleProfile[]> {
  const filter = typeof productFamily === "string" && productFamily.trim();
  const rows = await all<DbRow>(
    `SELECT id, profile_key, title, product_family, version, lifecycle_status, is_provisional, enabled,
            scope_json, values_json, created_at, updated_at
     FROM rule_profiles ${filter ? "WHERE product_family = ?" : ""}
     ORDER BY product_family ASC, profile_key ASC`,
    filter ? [productFamily.trim()] : [],
  );
  return rows.map(parseProfileRow);
}

export async function upsertRuleProfile(actor: GovernanceActor, input: unknown): Promise<RuleProfile> {
  const profile = validateProfileInput(input);
  const draftProfile: RuleProfileInput = { ...profile, lifecycleStatus: "draft" };
  let existing = await first<{ id: string }>(`SELECT id FROM rule_profiles WHERE profile_key = ?`, [profile.profileKey]);
  if (!existing) {
    const id = makeId();
    await execute(
      `INSERT INTO rule_profiles
       (id, profile_key, title, product_family, version, lifecycle_status, is_provisional, enabled, scope_json, values_json, created_by_user_id, updated_by_user_id)
       VALUES (?, ?, ?, ?, 1, 'draft', ?, ?, ?, ?, ?, ?)`,
      [
        id,
        draftProfile.profileKey,
        draftProfile.title,
        draftProfile.productFamily,
        draftProfile.isProvisional ? 1 : 0,
        draftProfile.enabled ? 1 : 0,
        stableStringify(draftProfile.scope),
        stableStringify(draftProfile.values),
        actor.userId,
        actor.userId,
      ],
    );
    existing = { id };
  }
  const draft = await createGovernedCatalogueDraft(
    actor,
    "profile",
    draftProfile.profileKey,
    draftProfile as unknown as Record<string, unknown>,
  );
  const saved: RuleProfile = {
    id: existing.id,
    profileKey: draftProfile.profileKey,
    title: draftProfile.title,
    productFamily: draftProfile.productFamily,
    version: draft.version,
    lifecycleStatus: "draft",
    isProvisional: draftProfile.isProvisional === true,
    enabled: draftProfile.enabled !== false,
    scope: draftProfile.scope,
    values: draftProfile.values,
    createdAt: draft.createdAt,
    updatedAt: draft.updatedAt,
  };
  await writeAuditEvent(actor, "rule_profile.draft_created", "rule_profile", saved.id, {
    profileKey: saved.profileKey,
    version: saved.version,
    replacesLiveProfile: Boolean(existing),
  });
  return saved;
}

function parseAdapterRow(row: DbRow): AdapterDefinition {
  return {
    id: asString(row.id, "id"),
    adapterKey: asString(row.adapter_key, "adapter_key"),
    title: asString(row.title, "title"),
    productFamily: asString(row.product_family, "product_family"),
    version: asNumber(row.version, "version"),
    lifecycleStatus: validateStatus(row.lifecycle_status),
    enabled: asBoolean(row.enabled),
    definition: safelyParseObject(row.definition_json, "definition_json"),
    createdAt: asString(row.created_at, "created_at"),
    updatedAt: asString(row.updated_at, "updated_at"),
  };
}

type AdapterInput = {
  adapterKey: string;
  title: string;
  productFamily: string;
  lifecycleStatus?: RuleLifecycleStatus;
  enabled?: boolean;
  definition: Record<string, unknown>;
};

function validateAdapterInput(input: unknown): AdapterInput {
  if (!isRecord(input) || !isRecord(input.definition)) {
    throw new GovernanceDataError("Adapter and its definition must be JSON objects.", "invalid_input");
  }
  return {
    adapterKey: validateKey(validateNonEmpty(input.adapterKey, "Adapter key"), "Adapter key"),
    title: validateNonEmpty(input.title, "Adapter title"),
    productFamily: validateNonEmpty(input.productFamily, "Adapter product family"),
    lifecycleStatus: input.lifecycleStatus ? validateStatus(input.lifecycleStatus) : "draft",
    enabled: input.enabled !== false,
    definition: input.definition,
  };
}

export async function listAdapterDefinitions(productFamily?: string | null): Promise<AdapterDefinition[]> {
  const filter = typeof productFamily === "string" && productFamily.trim();
  const rows = await all<DbRow>(
    `SELECT id, adapter_key, title, product_family, version, lifecycle_status, enabled, definition_json, created_at, updated_at
     FROM adapter_definitions ${filter ? "WHERE product_family = ?" : ""}
     ORDER BY product_family ASC, adapter_key ASC`,
    filter ? [productFamily.trim()] : [],
  );
  return rows.map(parseAdapterRow);
}

export async function upsertAdapterDefinition(actor: GovernanceActor, input: unknown): Promise<AdapterDefinition> {
  const adapter = validateAdapterInput(input);
  const draftAdapter: AdapterInput = { ...adapter, lifecycleStatus: "draft" };
  let existing = await first<{ id: string }>(`SELECT id FROM adapter_definitions WHERE adapter_key = ?`, [adapter.adapterKey]);
  if (!existing) {
    const id = makeId();
    await execute(
      `INSERT INTO adapter_definitions
       (id, adapter_key, title, product_family, version, lifecycle_status, enabled, definition_json, created_by_user_id, updated_by_user_id)
       VALUES (?, ?, ?, ?, 1, 'draft', ?, ?, ?, ?)`,
      [
        id,
        draftAdapter.adapterKey,
        draftAdapter.title,
        draftAdapter.productFamily,
        draftAdapter.enabled ? 1 : 0,
        stableStringify(draftAdapter.definition),
        actor.userId,
        actor.userId,
      ],
    );
    existing = { id };
  }
  const draft = await createGovernedCatalogueDraft(
    actor,
    "adapter",
    draftAdapter.adapterKey,
    draftAdapter as unknown as Record<string, unknown>,
  );
  const saved: AdapterDefinition = {
    id: existing.id,
    adapterKey: draftAdapter.adapterKey,
    title: draftAdapter.title,
    productFamily: draftAdapter.productFamily,
    version: draft.version,
    lifecycleStatus: "draft",
    enabled: draftAdapter.enabled !== false,
    definition: draftAdapter.definition,
    createdAt: draft.createdAt,
    updatedAt: draft.updatedAt,
  };
  await writeAuditEvent(actor, "adapter.draft_created", "adapter", saved.id, {
    adapterKey: saved.adapterKey,
    version: saved.version,
  });
  return saved;
}

function parseFeatureRow(row: DbRow): FeatureDefinition {
  const definition = safelyParseObject(row.definition_json, "definition_json");
  return {
    ...definition,
    id: asString(row.id, "id"),
    adapterKey: asString(row.adapter_key, "adapter_key"),
    code: asString(row.feature_code, "feature_code"),
    label:
      typeof definition.label === "string" && definition.label.trim()
        ? definition.label
        : asString(row.feature_code, "feature_code"),
    productFamily: asString(row.product_family, "product_family"),
    valueType: asString(row.value_type, "value_type") as FeatureDefinition["valueType"],
    unit: optionalString(row.unit) ?? undefined,
    enabled: asBoolean(row.enabled),
  };
}

export async function listFeatureDefinitions(adapterKey?: string | null): Promise<FeatureDefinition[]> {
  const filter = typeof adapterKey === "string" && adapterKey.trim();
  const rows = await all<DbRow>(
    `SELECT id, adapter_key, feature_code, product_family, value_type, unit, definition_json, enabled
     FROM feature_definitions ${filter ? "WHERE adapter_key = ?" : ""}
     ORDER BY adapter_key ASC, feature_code ASC`,
    filter ? [adapterKey.trim()] : [],
  );
  return rows.map(parseFeatureRow);
}

type FeatureInput = {
  adapterKey: string;
  featureCode: string;
  productFamily: string;
  valueType: string;
  unit: string | null;
  enabled: boolean;
  definition: Record<string, unknown>;
};

function validateFeatureInput(input: unknown): FeatureInput {
  if (!isRecord(input) || !isRecord(input.definition)) {
    throw new GovernanceDataError("Feature and its definition must be JSON objects.", "invalid_input");
  }
  return {
    adapterKey: validateKey(validateNonEmpty(input.adapterKey, "Feature adapter key"), "Feature adapter key"),
    featureCode: validateNonEmpty(input.featureCode, "Feature code"),
    productFamily: validateNonEmpty(input.productFamily, "Feature product family"),
    valueType: validateNonEmpty(input.valueType, "Feature value type"),
    unit: typeof input.unit === "string" && input.unit.trim() ? input.unit.trim() : null,
    enabled: input.enabled !== false,
    definition: input.definition,
  };
}

export async function upsertFeatureDefinition(actor: GovernanceActor, input: unknown): Promise<FeatureDefinition> {
  const feature = validateFeatureInput(input);
  let existing = await first<{ id: string }>(
    `SELECT id FROM feature_definitions WHERE adapter_key = ? AND feature_code = ?`,
    [feature.adapterKey, feature.featureCode],
  );
  if (!existing) {
    const id = makeId();
    await execute(
      `INSERT INTO feature_definitions
       (id, adapter_key, feature_code, product_family, value_type, unit, definition_json, enabled)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        feature.adapterKey,
        feature.featureCode,
        feature.productFamily,
        feature.valueType,
        feature.unit,
        stableStringify(feature.definition),
        feature.enabled ? 1 : 0,
      ],
    );
    existing = { id };
  }
  const draft = await createGovernedCatalogueDraft(
    actor,
    "feature",
    `${feature.adapterKey}:${feature.featureCode}`,
    feature as unknown as Record<string, unknown>,
  );
  const saved: FeatureDefinition = {
    ...feature.definition,
    id: existing.id,
    adapterKey: feature.adapterKey,
    code: feature.featureCode,
    label: typeof feature.definition.label === "string" && feature.definition.label.trim() ? feature.definition.label : feature.featureCode,
    productFamily: feature.productFamily,
    valueType: feature.valueType as FeatureDefinition["valueType"],
    unit: feature.unit ?? undefined,
    enabled: feature.enabled,
    version: draft.version,
    lifecycleStatus: "draft",
  };
  await writeAuditEvent(actor, "feature.draft_created", "feature", saved.id as string, {
    adapterKey: feature.adapterKey,
    featureCode: feature.featureCode,
    version: draft.version,
  });
  return saved;
}

function parseRunSummary(row: DbRow): RunSummary {
  const summary = safelyParseObject(row.summary_json, "summary_json") as EvaluationSummary;
  return {
    id: asString(row.id, "id"),
    caseRef: optionalString(row.case_ref),
    meterSerial: optionalString(row.meter_serial),
    productFamily: asString(row.product_family, "product_family"),
    identityStatus: asString(row.identity_status, "identity_status"),
    bundleId: optionalString(row.bundle_id),
    bundleVersion: row.bundle_version === null || row.bundle_version === undefined ? null : asNumber(row.bundle_version, "bundle_version"),
    profileKey: optionalString(row.profile_key),
    profileVersion: row.profile_version === null || row.profile_version === undefined ? null : asNumber(row.profile_version, "profile_version"),
    adapterKey: optionalString(row.adapter_key),
    adapterVersion: row.adapter_version === null || row.adapter_version === undefined ? null : asNumber(row.adapter_version, "adapter_version"),
    resultStatus: asString(row.result_status, "result_status"),
    findingsCount: asNumber(row.findings_count, "findings_count"),
    summary,
    // This route never accepts raw evidence payloads. Raw evidence is only stored by the explicit retention helper.
    rawEvidenceRetained: false,
    createdAt: asString(row.created_at, "created_at"),
  };
}

type CreateRunSummaryInput = {
  caseRef?: string | null;
  meterSerial?: string | null;
  productFamily: string;
  identityStatus: string;
  bundleId?: string | null;
  bundleVersion?: number | null;
  profileKey?: string | null;
  profileVersion?: number | null;
  adapterKey?: string | null;
  adapterVersion?: number | null;
  resultStatus: string;
  summary: EvaluationSummary;
};

function nullableInteger(value: unknown, label: string): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (!Number.isInteger(value) || Number(value) < 1) throw new GovernanceDataError(`${label} must be a positive integer.`, "invalid_input");
  return Number(value);
}

function validateRunSummaryInput(input: unknown): CreateRunSummaryInput {
  if (!isRecord(input) || !isRecord(input.summary)) {
    throw new GovernanceDataError("Run summary and summary payload are required.", "invalid_input");
  }
  if (!Array.isArray(input.summary.findings)) {
    throw new GovernanceDataError("Run summary findings must be an array.", "invalid_input");
  }
  const json = stableStringify(input.summary);
  if (new TextEncoder().encode(json).byteLength > 1_000_000) {
    throw new GovernanceDataError("Run summary exceeds the 1 MB limit.", "invalid_input");
  }
  return {
    caseRef: stringOrNull(input.caseRef),
    meterSerial: stringOrNull(input.meterSerial),
    productFamily: validateNonEmpty(input.productFamily, "Run product family"),
    identityStatus: validateNonEmpty(input.identityStatus, "Run identity status"),
    bundleId: stringOrNull(input.bundleId),
    bundleVersion: nullableInteger(input.bundleVersion, "Bundle version"),
    profileKey: stringOrNull(input.profileKey),
    profileVersion: nullableInteger(input.profileVersion, "Profile version"),
    adapterKey: stringOrNull(input.adapterKey),
    adapterVersion: nullableInteger(input.adapterVersion, "Adapter version"),
    resultStatus: validateNonEmpty(input.resultStatus, "Run result status"),
    summary: input.summary as EvaluationSummary,
  };
}

export async function createRunSummary(actor: GovernanceActor, input: unknown): Promise<RunSummary> {
  const run = validateRunSummaryInput(input);
  const id = makeId();
  await execute(
    `INSERT INTO run_summaries
      (id, created_by_user_id, created_by_email, case_ref, meter_serial, product_family, identity_status,
       bundle_id, bundle_version, profile_key, profile_version, adapter_key, adapter_version,
       result_status, findings_count, summary_json, raw_evidence_retained, evidence_object_key)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL)`,
    [
      id,
      actor.userId,
      actor.email,
      run.caseRef,
      run.meterSerial,
      run.productFamily,
      run.identityStatus,
      run.bundleId,
      run.bundleVersion,
      run.profileKey,
      run.profileVersion,
      run.adapterKey,
      run.adapterVersion,
      run.resultStatus,
      run.summary.findings.length,
      stableStringify(run.summary),
    ],
  );
  const row = await first<DbRow>(
    `SELECT id, case_ref, meter_serial, product_family, identity_status, bundle_id, bundle_version,
            profile_key, profile_version, adapter_key, adapter_version, result_status, findings_count,
            summary_json, raw_evidence_retained, created_at
     FROM run_summaries WHERE id = ?`,
    [id],
  );
  if (!row) throw new GovernanceDataError("Run summary could not be created.", "run_unavailable", 500);
  const created = parseRunSummary(row);
  await writeAuditEvent(actor, "run_summary.created", "run_summary", id, {
    caseRef: created.caseRef,
    productFamily: created.productFamily,
    findingsCount: created.findingsCount,
    rawEvidenceRetained: false,
  });
  return created;
}

export async function listRunSummaries(
  actor: GovernanceActor,
  includeAll: boolean,
  limit = 50,
): Promise<RunSummary[]> {
  const boundedLimit = Math.max(1, Math.min(200, Math.floor(limit)));
  const rows = await all<DbRow>(
    `SELECT id, case_ref, meter_serial, product_family, identity_status, bundle_id, bundle_version,
            profile_key, profile_version, adapter_key, adapter_version, result_status, findings_count,
            summary_json, raw_evidence_retained, created_at
     FROM run_summaries
     ${includeAll ? "" : "WHERE created_by_user_id = ?"}
     ORDER BY created_at DESC, id DESC LIMIT ?`,
    includeAll ? [boundedLimit] : [actor.userId, boundedLimit],
  );
  return rows.map(parseRunSummary);
}

export async function recordStoredObject(
  actor: GovernanceActor,
  input: { objectKey: string; objectType: "branding_logo" | "evidence"; contentType: string; sizeBytes: number; retained: boolean; caseRef?: string | null },
): Promise<void> {
  await execute(
    `INSERT INTO stored_objects
      (id, object_key, object_type, content_type, size_bytes, retained, case_ref, created_by_user_id, created_by_email)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      makeId(),
      input.objectKey,
      input.objectType,
      input.contentType,
      input.sizeBytes,
      input.retained ? 1 : 0,
      input.caseRef ?? null,
      actor.userId,
      actor.email,
    ],
  );
}

export async function removeStoredObject(objectKey: string): Promise<void> {
  await execute(`DELETE FROM stored_objects WHERE object_key = ?`, [objectKey]);
}

function parseFixtureRow(row: DbRow): GovernanceFixture {
  return {
    id: asString(row.id, "id"),
    fixtureKey: asString(row.fixture_key, "fixture_key"),
    title: asString(row.title, "title"),
    fixtureType: asString(row.fixture_type, "fixture_type"),
    sourceReference: asString(row.source_reference, "source_reference"),
    metadata: safelyParseObject(row.metadata_json, "metadata_json"),
    lifecycleStatus: validateStatus(row.lifecycle_status),
    enabled: asBoolean(row.enabled),
    createdAt: asString(row.created_at, "created_at"),
    updatedAt: asString(row.updated_at, "updated_at"),
  };
}

export async function listGovernanceFixtures(): Promise<GovernanceFixture[]> {
  const rows = await all<DbRow>(
    `SELECT id, fixture_key, title, fixture_type, source_reference, metadata_json, lifecycle_status, enabled, created_at, updated_at
     FROM governance_fixtures ORDER BY fixture_type ASC, fixture_key ASC`,
  );
  return rows.map(parseFixtureRow);
}

export async function upsertGovernanceFixture(
  actor: GovernanceActor,
  input: unknown,
): Promise<GovernanceFixture> {
  if (!isRecord(input) || !isRecord(input.metadata)) {
    throw new GovernanceDataError("Fixture and its metadata must be JSON objects.", "invalid_input");
  }
  const fixtureKey = validateKey(validateNonEmpty(input.fixtureKey, "Fixture key"), "Fixture key");
  const title = validateNonEmpty(input.title, "Fixture title");
  const fixtureType = validateNonEmpty(input.fixtureType, "Fixture type");
  const sourceReference = validateNonEmpty(input.sourceReference, "Fixture source reference");
  const lifecycleStatus = input.lifecycleStatus ? validateStatus(input.lifecycleStatus) : "draft";
  const enabled = input.enabled !== false;
  const existing = await first<{ id: string }>(`SELECT id FROM governance_fixtures WHERE fixture_key = ?`, [fixtureKey]);
  if (existing) {
    await execute(
      `UPDATE governance_fixtures
       SET title = ?, fixture_type = ?, source_reference = ?, metadata_json = ?, lifecycle_status = ?, enabled = ?,
           updated_at = CURRENT_TIMESTAMP, updated_by_user_id = ?
       WHERE id = ?`,
      [title, fixtureType, sourceReference, stableStringify(input.metadata), lifecycleStatus, enabled ? 1 : 0, actor.userId, existing.id],
    );
  } else {
    await execute(
      `INSERT INTO governance_fixtures
        (id, fixture_key, title, fixture_type, source_reference, metadata_json, lifecycle_status, enabled, created_by_user_id, created_by_email, updated_by_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        makeId(),
        fixtureKey,
        title,
        fixtureType,
        sourceReference,
        stableStringify(input.metadata),
        lifecycleStatus,
        enabled ? 1 : 0,
        actor.userId,
        actor.email,
        actor.userId,
      ],
    );
  }
  const row = await first<DbRow>(
    `SELECT id, fixture_key, title, fixture_type, source_reference, metadata_json, lifecycle_status, enabled, created_at, updated_at
     FROM governance_fixtures WHERE fixture_key = ?`,
    [fixtureKey],
  );
  if (!row) throw new GovernanceDataError("Fixture metadata could not be saved.", "fixture_unavailable", 500);
  const saved = parseFixtureRow(row);
  await writeAuditEvent(actor, existing ? "fixture.updated" : "fixture.created", "fixture", saved.id, {
    fixtureKey,
    fixtureType,
    sourceReference,
    rawEvidenceStored: false,
  });
  return saved;
}
