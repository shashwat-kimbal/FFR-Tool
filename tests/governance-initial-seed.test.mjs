import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("initial shared configuration seeds the version-controlled 60-check catalogue", async () => {
  const [bundleText, profileText, adapterText, governanceSource] = await Promise.all([
    readFile(new URL("../rules/bundles/generic-provisional-v1.json", import.meta.url), "utf8"),
    readFile(new URL("../config/dlms-provisional-profile.v1.json", import.meta.url), "utf8"),
    readFile(new URL("../config/dlms-adapter-bcs-16-sheet.v1.json", import.meta.url), "utf8"),
    readFile(new URL("../db/governance.ts", import.meta.url), "utf8"),
  ]);
  const bundle = JSON.parse(bundleText);
  const profile = JSON.parse(profileText);
  const adapter = JSON.parse(adapterText);

  assert.equal(bundle.id, "generic-provisional-v1");
  assert.equal(bundle.rules.length, 60);
  assert.equal(profile.id, "generic-provisional-v1");
  assert.equal(adapter.id, "bcs-16-sheet-v1");
  assert.match(governanceSource, /buildInitialSharedConfigurationSeed/);
  assert.match(governanceSource, /seedInitialRuleBundle/);
  assert.match(governanceSource, /seedInitialProfile/);
  assert.match(governanceSource, /seedInitialAdapter/);
  assert.match(governanceSource, /seedInitialFeatures/);
  assert.match(governanceSource, /INITIAL_FIXTURE_SEEDS/);
});

test("admin bootstrap is the only route that invokes the initial shared configuration writer", async () => {
  const bootstrap = await readFile(new URL("../app/api/governance/bootstrap/route.ts", import.meta.url), "utf8");
  const activeConfiguration = await readFile(
    new URL("../app/api/governance/active-configuration/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(bootstrap, /access\.roles\.includes\("admin"\)/);
  assert.match(bootstrap, /ensureInitialSharedConfiguration\(access\.actor\)/);
  assert.match(activeConfiguration, /gate\.access\.roles\.includes\("admin"\)/);
  assert.match(activeConfiguration, /ensureInitialSharedConfiguration\(gate\.access\.actor\)/);
});

test("catalogue history and fixture metadata migrations are present", async () => {
  const migration = await readFile(new URL("../drizzle/0001_nostalgic_secret_warriors.sql", import.meta.url), "utf8");
  assert.match(migration, /governed_catalogue_versions/);
  assert.match(migration, /governed_catalogue_releases/);
  assert.match(migration, /governance_fixtures/);
  assert.match(migration, /one_current_scope/);
});
