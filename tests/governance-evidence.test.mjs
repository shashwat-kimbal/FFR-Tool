import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function loadWorker() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("governance-evidence-test", `${process.pid}-${Date.now()}`);
  return (await import(workerUrl.href)).default;
}

function disabledRetentionD1() {
  const settingsRow = {
    key: "shared_settings",
    value_json: JSON.stringify({
      schemaVersion: "governance-settings-v1",
      branding: { logoObjectKey: null, logoUrl: null, altText: "Kimbal logo" },
      evidenceRetention: { enabled: false, retentionDays: null },
      productMappings: [],
      complaintMappings: [],
      adapterMappings: [],
      thresholds: {},
      ai: { provider: null, model: null, credentialsConfigured: false },
    }),
    version: 1,
    updated_at: "2026-08-04 00:00:00",
    updated_by_user_id: null,
    updated_by_email: null,
  };
  return {
    prepare() {
      return {
        bind() { return this; },
        async run() { return { success: true, meta: { changes: 0 } }; },
        async first() { return settingsRow; },
        async all() { return { results: [], success: true }; },
      };
    },
    async batch() { return []; },
  };
}

test("disabled retention rejects an evidence POST before endpoint parsing", async () => {
  const worker = await loadWorker();
  const request = new Request("http://localhost/api/governance/evidence", {
      method: "POST",
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "oai-authenticated-user-id": "test-user",
        "oai-authenticated-user-email": "admin@example.com",
      },
      body: new Uint8Array([0x50, 0x4b, 0x03, 0x04]),
    });
  const response = await worker.fetch(
    request,
    {
      ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
      DB: disabledRetentionD1(),
      EVIDENCE: {},
      ADMIN_ALLOWLIST: "admin@example.com",
    },
    { waitUntil() {}, passThroughOnException() {} },
  );

  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), {
    error: "evidence_retention_disabled",
    message: "Raw evidence retention is disabled by the shared administrator policy. No file bytes were accepted.",
  });
});

test("evidence endpoint gates setup/auth before it reads or retains raw evidence", async () => {
  const source = await readFile(new URL("../app/api/governance/evidence/route.ts", import.meta.url), "utf8");
  const gate = source.indexOf('requireGovernanceCapability(request, "save_run_summary")');
  const policy = source.indexOf("requireEvidenceRetentionPolicy()");
  const read = source.indexOf("readEvidenceUpload(request)");
  const retain = source.indexOf("retainRawEvidenceIfEnabled(gate.access.actor");

  assert.ok(gate >= 0, "ordinary shared-governance access is mandatory");
  assert.ok(policy > gate, "the retention policy is checked after access is established");
  assert.ok(policy < read, "disabled retention rejects the request before raw bytes are read");
  assert.ok(read > gate, "the request body is not read before the access gate");
  assert.ok(retain > read, "only the retention helper can decide whether raw evidence is stored");
  assert.match(source, /readRawEvidenceBody/);
  assert.match(source, /MAX_MULTIPART_EVIDENCE_REQUEST_BYTES/);
  assert.match(source, /manage_shared_settings/);
  assert.match(source, /purgeRetainedEvidence/);
  assert.match(source, /jsonNoStore\(\{ evidence \}, 201\)/);
});

test("raw-evidence storage is allow-listed, bounded, expiring, and audit-preserving", async () => {
  const source = await readFile(new URL("../app/lib/governance-storage.ts", import.meta.url), "utf8");

  assert.match(source, /MAX_EVIDENCE_BYTES = 25 \* 1024 \* 1024/);
  assert.match(source, /MAX_IMAGE_EVIDENCE_BYTES = 10 \* 1024 \* 1024/);
  assert.match(source, /application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet/);
  assert.match(source, /image\/webp/);
  assert.match(source, /unsupported_evidence_type/);
  assert.match(source, /invalid_evidence_signature/);
  assert.match(source, /evidence_retention_disabled/);
  assert.match(source, /datetime\(created_at\) <= datetime\(\?\)/);
  assert.match(source, /evidence\.purged/);
  assert.match(source, /expiresAfterDays/);
  assert.match(source, /evidence\/\$\{crypto\.randomUUID\(\)\}/);
  assert.doesNotMatch(source, /evidence\/\$\{actor\.userId\}/);
});
