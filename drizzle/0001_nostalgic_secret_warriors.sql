CREATE TABLE `governance_fixtures` (
	`id` text PRIMARY KEY NOT NULL,
	`fixture_key` text NOT NULL,
	`title` text NOT NULL,
	`fixture_type` text NOT NULL,
	`source_reference` text NOT NULL,
	`metadata_json` text DEFAULT '{}' NOT NULL,
	`lifecycle_status` text DEFAULT 'draft' NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_by_user_id` text NOT NULL,
	`created_by_email` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_by_user_id` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `governance_fixtures_fixture_key_unique` ON `governance_fixtures` (`fixture_key`);--> statement-breakpoint
CREATE INDEX `idx_governance_fixtures_type_enabled` ON `governance_fixtures` (`fixture_type`,`enabled`);--> statement-breakpoint
CREATE TABLE `governed_catalogue_releases` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_type` text NOT NULL,
	`scope_key` text NOT NULL,
	`entity_key` text NOT NULL,
	`entity_version` integer NOT NULL,
	`release_kind` text NOT NULL,
	`is_current` integer DEFAULT true NOT NULL,
	`reason` text DEFAULT '' NOT NULL,
	`released_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`released_by_user_id` text NOT NULL,
	`released_by_email` text NOT NULL,
	`superseded_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_governed_catalogue_releases_scope_current` ON `governed_catalogue_releases` (`entity_type`,`scope_key`,`is_current`);--> statement-breakpoint
CREATE INDEX `idx_governed_catalogue_releases_entity_version` ON `governed_catalogue_releases` (`entity_type`,`entity_key`,`entity_version`);--> statement-breakpoint
-- Each catalogue entity has a single live projection; historical releases remain auditable.
CREATE UNIQUE INDEX `governed_catalogue_releases_one_current_scope` ON `governed_catalogue_releases` (`entity_type`,`scope_key`) WHERE `is_current` = 1;--> statement-breakpoint
CREATE TABLE `governed_catalogue_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_type` text NOT NULL,
	`entity_key` text NOT NULL,
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
CREATE UNIQUE INDEX `governed_catalogue_versions_entity_version_unique` ON `governed_catalogue_versions` (`entity_type`,`entity_key`,`version`);--> statement-breakpoint
CREATE INDEX `idx_governed_catalogue_versions_entity_status` ON `governed_catalogue_versions` (`entity_type`,`entity_key`,`lifecycle_status`);
