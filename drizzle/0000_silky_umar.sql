CREATE TABLE `adapter_definitions` (
	`id` text PRIMARY KEY NOT NULL,
	`adapter_key` text NOT NULL,
	`title` text NOT NULL,
	`product_family` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`lifecycle_status` text DEFAULT 'draft' NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`definition_json` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_by_user_id` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_by_user_id` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `adapter_definitions_adapter_key_unique` ON `adapter_definitions` (`adapter_key`);--> statement-breakpoint
CREATE INDEX `idx_adapter_definitions_family_enabled` ON `adapter_definitions` (`product_family`,`enabled`);--> statement-breakpoint
CREATE TABLE `feature_definitions` (
	`id` text PRIMARY KEY NOT NULL,
	`adapter_key` text NOT NULL,
	`feature_code` text NOT NULL,
	`product_family` text NOT NULL,
	`value_type` text NOT NULL,
	`unit` text,
	`definition_json` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `feature_definitions_adapter_feature_unique` ON `feature_definitions` (`adapter_key`,`feature_code`);--> statement-breakpoint
CREATE INDEX `idx_feature_definitions_family_enabled` ON `feature_definitions` (`product_family`,`enabled`);--> statement-breakpoint
CREATE TABLE `governance_audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`detail_json` text DEFAULT '{}' NOT NULL,
	`actor_user_id` text,
	`actor_email` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_governance_audit_events_entity_created` ON `governance_audit_events` (`entity_type`,`entity_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_governance_audit_events_actor_created` ON `governance_audit_events` (`actor_user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `governance_role_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`email` text NOT NULL,
	`role` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_by_user_id` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `governance_role_assignments_email_role_unique` ON `governance_role_assignments` (`email`,`role`);--> statement-breakpoint
CREATE INDEX `idx_governance_role_assignments_user_id` ON `governance_role_assignments` (`user_id`);--> statement-breakpoint
CREATE TABLE `governance_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value_json` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_by_user_id` text,
	`updated_by_email` text
);
--> statement-breakpoint
CREATE TABLE `rule_bundle_releases` (
	`id` text PRIMARY KEY NOT NULL,
	`scope_key` text NOT NULL,
	`bundle_id` text NOT NULL,
	`bundle_version` integer NOT NULL,
	`release_kind` text NOT NULL,
	`is_current` integer DEFAULT true NOT NULL,
	`reason` text DEFAULT '' NOT NULL,
	`released_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`released_by_user_id` text NOT NULL,
	`released_by_email` text NOT NULL,
	`superseded_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_rule_bundle_releases_scope_current` ON `rule_bundle_releases` (`scope_key`,`is_current`);--> statement-breakpoint
CREATE INDEX `idx_rule_bundle_releases_bundle_version` ON `rule_bundle_releases` (`bundle_id`,`bundle_version`);--> statement-breakpoint
-- A scope has one live deployment; releases retain history for audit and rollback.
CREATE UNIQUE INDEX `rule_bundle_releases_one_current_scope` ON `rule_bundle_releases` (`scope_key`) WHERE `is_current` = 1;--> statement-breakpoint
CREATE TABLE `rule_bundle_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`bundle_id` text NOT NULL,
	`version` integer NOT NULL,
	`lifecycle_status` text NOT NULL,
	`content_json` text NOT NULL,
	`content_hash` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_by_user_id` text NOT NULL,
	`created_by_email` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`reviewed_at` text,
	`reviewed_by_user_id` text,
	`reviewed_by_email` text,
	`review_note` text,
	`content_locked_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rule_bundle_versions_bundle_version_unique` ON `rule_bundle_versions` (`bundle_id`,`version`);--> statement-breakpoint
CREATE INDEX `idx_rule_bundle_versions_bundle_status` ON `rule_bundle_versions` (`bundle_id`,`lifecycle_status`);--> statement-breakpoint
CREATE TABLE `rule_bundles` (
	`id` text PRIMARY KEY NOT NULL,
	`bundle_key` text NOT NULL,
	`title` text NOT NULL,
	`product_family` text NOT NULL,
	`scope_key` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_by_user_id` text NOT NULL,
	`created_by_email` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rule_bundles_bundle_key_unique` ON `rule_bundles` (`bundle_key`);--> statement-breakpoint
CREATE INDEX `idx_rule_bundles_scope_key` ON `rule_bundles` (`scope_key`);--> statement-breakpoint
CREATE TABLE `rule_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_key` text NOT NULL,
	`title` text NOT NULL,
	`product_family` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`lifecycle_status` text DEFAULT 'draft' NOT NULL,
	`is_provisional` integer DEFAULT false NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`scope_json` text NOT NULL,
	`values_json` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_by_user_id` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_by_user_id` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rule_profiles_profile_key_unique` ON `rule_profiles` (`profile_key`);--> statement-breakpoint
CREATE INDEX `idx_rule_profiles_family_enabled` ON `rule_profiles` (`product_family`,`enabled`);--> statement-breakpoint
CREATE TABLE `run_summaries` (
	`id` text PRIMARY KEY NOT NULL,
	`created_by_user_id` text NOT NULL,
	`created_by_email` text NOT NULL,
	`case_ref` text,
	`meter_serial` text,
	`product_family` text NOT NULL,
	`identity_status` text NOT NULL,
	`bundle_id` text,
	`bundle_version` integer,
	`profile_key` text,
	`profile_version` integer,
	`adapter_key` text,
	`adapter_version` integer,
	`result_status` text NOT NULL,
	`findings_count` integer DEFAULT 0 NOT NULL,
	`summary_json` text NOT NULL,
	`raw_evidence_retained` integer DEFAULT false NOT NULL,
	`evidence_object_key` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_run_summaries_actor_created` ON `run_summaries` (`created_by_user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_run_summaries_case_created` ON `run_summaries` (`case_ref`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_run_summaries_family_created` ON `run_summaries` (`product_family`,`created_at`);--> statement-breakpoint
CREATE TABLE `stored_objects` (
	`id` text PRIMARY KEY NOT NULL,
	`object_key` text NOT NULL,
	`object_type` text NOT NULL,
	`content_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`retained` integer DEFAULT false NOT NULL,
	`case_ref` text,
	`created_by_user_id` text NOT NULL,
	`created_by_email` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `stored_objects_object_key_unique` ON `stored_objects` (`object_key`);--> statement-breakpoint
CREATE INDEX `idx_stored_objects_type_created` ON `stored_objects` (`object_type`,`created_at`);--> statement-breakpoint
PRAGMA optimize;
