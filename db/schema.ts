import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

/**
 * Durable, shared governance data. Large evidence bytes remain in R2; D1 only
 * records the searchable metadata and governed decisions around them.
 */
export const governanceSettings = sqliteTable("governance_settings", {
  key: text("key").primaryKey(),
  valueJson: text("value_json").notNull(),
  version: integer("version").notNull().default(1),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedByUserId: text("updated_by_user_id"),
  updatedByEmail: text("updated_by_email"),
});

export const governanceRoleAssignments = sqliteTable(
  "governance_role_assignments",
  {
    id: text("id").primaryKey(),
    userId: text("user_id"),
    email: text("email").notNull(),
    role: text("role").notNull(),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    createdByUserId: text("created_by_user_id"),
  },
  (table) => [
    uniqueIndex("governance_role_assignments_email_role_unique").on(table.email, table.role),
    index("idx_governance_role_assignments_user_id").on(table.userId),
  ],
);

export const ruleBundles = sqliteTable(
  "rule_bundles",
  {
    id: text("id").primaryKey(),
    bundleKey: text("bundle_key").notNull(),
    title: text("title").notNull(),
    productFamily: text("product_family").notNull(),
    scopeKey: text("scope_key").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    createdByUserId: text("created_by_user_id").notNull(),
    createdByEmail: text("created_by_email").notNull(),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("rule_bundles_bundle_key_unique").on(table.bundleKey),
    index("idx_rule_bundles_scope_key").on(table.scopeKey),
  ],
);

export const ruleBundleVersions = sqliteTable(
  "rule_bundle_versions",
  {
    id: text("id").primaryKey(),
    bundleId: text("bundle_id").notNull(),
    version: integer("version").notNull(),
    lifecycleStatus: text("lifecycle_status").notNull(),
    contentJson: text("content_json").notNull(),
    contentHash: text("content_hash").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    createdByUserId: text("created_by_user_id").notNull(),
    createdByEmail: text("created_by_email").notNull(),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    reviewedAt: text("reviewed_at"),
    reviewedByUserId: text("reviewed_by_user_id"),
    reviewedByEmail: text("reviewed_by_email"),
    reviewNote: text("review_note"),
    contentLockedAt: text("content_locked_at"),
  },
  (table) => [
    uniqueIndex("rule_bundle_versions_bundle_version_unique").on(table.bundleId, table.version),
    index("idx_rule_bundle_versions_bundle_status").on(table.bundleId, table.lifecycleStatus),
  ],
);

export const ruleBundleReleases = sqliteTable(
  "rule_bundle_releases",
  {
    id: text("id").primaryKey(),
    scopeKey: text("scope_key").notNull(),
    bundleId: text("bundle_id").notNull(),
    bundleVersion: integer("bundle_version").notNull(),
    releaseKind: text("release_kind").notNull(),
    isCurrent: integer("is_current", { mode: "boolean" }).notNull().default(true),
    reason: text("reason").notNull().default(""),
    releasedAt: text("released_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    releasedByUserId: text("released_by_user_id").notNull(),
    releasedByEmail: text("released_by_email").notNull(),
    supersededAt: text("superseded_at"),
  },
  (table) => [
    index("idx_rule_bundle_releases_scope_current").on(table.scopeKey, table.isCurrent),
    index("idx_rule_bundle_releases_bundle_version").on(table.bundleId, table.bundleVersion),
  ],
);

export const ruleProfiles = sqliteTable(
  "rule_profiles",
  {
    id: text("id").primaryKey(),
    profileKey: text("profile_key").notNull(),
    title: text("title").notNull(),
    productFamily: text("product_family").notNull(),
    version: integer("version").notNull().default(1),
    lifecycleStatus: text("lifecycle_status").notNull().default("draft"),
    isProvisional: integer("is_provisional", { mode: "boolean" }).notNull().default(false),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    scopeJson: text("scope_json").notNull(),
    valuesJson: text("values_json").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    createdByUserId: text("created_by_user_id").notNull(),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedByUserId: text("updated_by_user_id"),
  },
  (table) => [
    uniqueIndex("rule_profiles_profile_key_unique").on(table.profileKey),
    index("idx_rule_profiles_family_enabled").on(table.productFamily, table.enabled),
  ],
);

export const adapterDefinitions = sqliteTable(
  "adapter_definitions",
  {
    id: text("id").primaryKey(),
    adapterKey: text("adapter_key").notNull(),
    title: text("title").notNull(),
    productFamily: text("product_family").notNull(),
    version: integer("version").notNull().default(1),
    lifecycleStatus: text("lifecycle_status").notNull().default("draft"),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    definitionJson: text("definition_json").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    createdByUserId: text("created_by_user_id").notNull(),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedByUserId: text("updated_by_user_id"),
  },
  (table) => [
    uniqueIndex("adapter_definitions_adapter_key_unique").on(table.adapterKey),
    index("idx_adapter_definitions_family_enabled").on(table.productFamily, table.enabled),
  ],
);

export const featureDefinitions = sqliteTable(
  "feature_definitions",
  {
    id: text("id").primaryKey(),
    adapterKey: text("adapter_key").notNull(),
    featureCode: text("feature_code").notNull(),
    productFamily: text("product_family").notNull(),
    valueType: text("value_type").notNull(),
    unit: text("unit"),
    definitionJson: text("definition_json").notNull(),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("feature_definitions_adapter_feature_unique").on(table.adapterKey, table.featureCode),
    index("idx_feature_definitions_family_enabled").on(table.productFamily, table.enabled),
  ],
);

/**
 * Append-only revisions for profiles, adapters, and feature definitions. The
 * compact catalogue tables above are live projections only; this history is
 * the source for draft, review, release, and rollback decisions.
 */
export const governedCatalogueVersions = sqliteTable(
  "governed_catalogue_versions",
  {
    id: text("id").primaryKey(),
    entityType: text("entity_type").notNull(),
    entityKey: text("entity_key").notNull(),
    version: integer("version").notNull(),
    lifecycleStatus: text("lifecycle_status").notNull(),
    contentJson: text("content_json").notNull(),
    contentHash: text("content_hash").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    createdByUserId: text("created_by_user_id").notNull(),
    createdByEmail: text("created_by_email").notNull(),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    reviewedAt: text("reviewed_at"),
    reviewedByUserId: text("reviewed_by_user_id"),
    reviewedByEmail: text("reviewed_by_email"),
    reviewNote: text("review_note"),
    contentLockedAt: text("content_locked_at"),
  },
  (table) => [
    uniqueIndex("governed_catalogue_versions_entity_version_unique").on(table.entityType, table.entityKey, table.version),
    index("idx_governed_catalogue_versions_entity_status").on(table.entityType, table.entityKey, table.lifecycleStatus),
  ],
);

export const governedCatalogueReleases = sqliteTable(
  "governed_catalogue_releases",
  {
    id: text("id").primaryKey(),
    entityType: text("entity_type").notNull(),
    scopeKey: text("scope_key").notNull(),
    entityKey: text("entity_key").notNull(),
    entityVersion: integer("entity_version").notNull(),
    releaseKind: text("release_kind").notNull(),
    isCurrent: integer("is_current", { mode: "boolean" }).notNull().default(true),
    reason: text("reason").notNull().default(""),
    releasedAt: text("released_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    releasedByUserId: text("released_by_user_id").notNull(),
    releasedByEmail: text("released_by_email").notNull(),
    supersededAt: text("superseded_at"),
  },
  (table) => [
    index("idx_governed_catalogue_releases_scope_current").on(table.entityType, table.scopeKey, table.isCurrent),
    index("idx_governed_catalogue_releases_entity_version").on(table.entityType, table.entityKey, table.entityVersion),
  ],
);

/** Metadata only: supplied fixtures are referenced by repository path, never stored as raw evidence in D1. */
export const governanceFixtures = sqliteTable(
  "governance_fixtures",
  {
    id: text("id").primaryKey(),
    fixtureKey: text("fixture_key").notNull(),
    title: text("title").notNull(),
    fixtureType: text("fixture_type").notNull(),
    sourceReference: text("source_reference").notNull(),
    metadataJson: text("metadata_json").notNull().default("{}"),
    lifecycleStatus: text("lifecycle_status").notNull().default("draft"),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    createdByUserId: text("created_by_user_id").notNull(),
    createdByEmail: text("created_by_email").notNull(),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedByUserId: text("updated_by_user_id"),
  },
  (table) => [
    uniqueIndex("governance_fixtures_fixture_key_unique").on(table.fixtureKey),
    index("idx_governance_fixtures_type_enabled").on(table.fixtureType, table.enabled),
  ],
);

export const runSummaries = sqliteTable(
  "run_summaries",
  {
    id: text("id").primaryKey(),
    createdByUserId: text("created_by_user_id").notNull(),
    createdByEmail: text("created_by_email").notNull(),
    caseRef: text("case_ref"),
    meterSerial: text("meter_serial"),
    productFamily: text("product_family").notNull(),
    identityStatus: text("identity_status").notNull(),
    bundleId: text("bundle_id"),
    bundleVersion: integer("bundle_version"),
    profileKey: text("profile_key"),
    profileVersion: integer("profile_version"),
    adapterKey: text("adapter_key"),
    adapterVersion: integer("adapter_version"),
    resultStatus: text("result_status").notNull(),
    findingsCount: integer("findings_count").notNull().default(0),
    summaryJson: text("summary_json").notNull(),
    rawEvidenceRetained: integer("raw_evidence_retained", { mode: "boolean" }).notNull().default(false),
    evidenceObjectKey: text("evidence_object_key"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_run_summaries_actor_created").on(table.createdByUserId, table.createdAt),
    index("idx_run_summaries_case_created").on(table.caseRef, table.createdAt),
    index("idx_run_summaries_family_created").on(table.productFamily, table.createdAt),
  ],
);

export const storedObjects = sqliteTable(
  "stored_objects",
  {
    id: text("id").primaryKey(),
    objectKey: text("object_key").notNull(),
    objectType: text("object_type").notNull(),
    contentType: text("content_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    retained: integer("retained", { mode: "boolean" }).notNull().default(false),
    caseRef: text("case_ref"),
    createdByUserId: text("created_by_user_id").notNull(),
    createdByEmail: text("created_by_email").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("stored_objects_object_key_unique").on(table.objectKey),
    index("idx_stored_objects_type_created").on(table.objectType, table.createdAt),
  ],
);

export const cases = sqliteTable(
  "cases",
  {
    id: text("id").primaryKey(),
    caseRef: text("case_ref").notNull(),
    registerArtifactName: text("register_artifact_name").notNull(),
    registerRowNumber: integer("register_row_number").notNull(),
    registerRowJson: text("register_row_json").notNull(),
    productFamily: text("product_family"),
    complaintKey: text("complaint_key"),
    complaintLabel: text("complaint_label"),
    createdByUserId: text("created_by_user_id").notNull(),
    createdByEmail: text("created_by_email").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_cases_case_ref").on(table.caseRef, table.createdAt),
    index("idx_cases_created").on(table.createdAt),
  ],
);

export const caseMeters = sqliteTable(
  "case_meters",
  {
    id: text("id").primaryKey(),
    caseId: text("case_id").notNull(),
    role: text("role").notNull(),
    meterSerial: text("meter_serial"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("case_meters_case_role_unique").on(table.caseId, table.role),
    index("idx_case_meters_serial").on(table.meterSerial),
  ],
);

export const dlmsReports = sqliteTable(
  "dlms_reports",
  {
    id: text("id").primaryKey(),
    caseId: text("case_id").notNull(),
    caseMeterId: text("case_meter_id").notNull(),
    meterRole: text("meter_role").notNull(),
    meterSerial: text("meter_serial"),
    expectedMeterId: text("expected_meter_id").notNull().default(""),
    identityState: text("identity_state").notNull(),
    artifactJson: text("artifact_json").notNull(),
    featuresJson: text("features_json").notNull(),
    messagesJson: text("messages_json").notNull(),
    analysisJson: text("analysis_json"),
    bundleId: text("bundle_id"),
    bundleVersion: integer("bundle_version"),
    profileKey: text("profile_key"),
    profileVersion: integer("profile_version"),
    adapterKey: text("adapter_key"),
    adapterVersion: integer("adapter_version"),
    findingsCount: integer("findings_count").notNull().default(0),
    attentionCount: integer("attention_count").notNull().default(0),
    highCount: integer("high_count").notNull().default(0),
    createdByUserId: text("created_by_user_id").notNull(),
    createdByEmail: text("created_by_email").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_dlms_reports_case_created").on(table.caseId, table.createdAt),
    index("idx_dlms_reports_meter_created").on(table.caseMeterId, table.createdAt),
  ],
);

export const governanceAuditEvents = sqliteTable(
  "governance_audit_events",
  {
    id: text("id").primaryKey(),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    detailJson: text("detail_json").notNull().default("{}"),
    actorUserId: text("actor_user_id"),
    actorEmail: text("actor_email"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_governance_audit_events_entity_created").on(table.entityType, table.entityId, table.createdAt),
    index("idx_governance_audit_events_actor_created").on(table.actorUserId, table.createdAt),
  ],
);
