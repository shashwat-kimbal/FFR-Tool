import assert from "node:assert/strict";
import test from "node:test";

async function loadWorker() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("active-configuration-test", `${process.pid}-${Date.now()}`);
  return (await import(workerUrl.href)).default;
}

test("active configuration is protected while the named-admin allowlist is not configured", async () => {
  const worker = await loadWorker();
  const response = await worker.fetch(
    new Request("http://localhost/api/governance/active-configuration", {
      headers: {
        "oai-authenticated-user-id": "test-user",
        "oai-authenticated-user-email": "tester@example.com",
      },
    }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );

  assert.equal(response.status, 428);
  const payload = await response.json();
  assert.equal(payload.error, "setup_required");
  assert.equal(payload.bootstrap.mode, "setup_required");
  assert.equal(payload.bootstrap.requiredRuntimeVariable, "ADMIN_ALLOWLIST");
});
