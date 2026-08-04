import assert from "node:assert/strict";
import test from "node:test";

async function loadWorker() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("governance-bootstrap-test", `${process.pid}-${Date.now()}`);
  return (await import(workerUrl.href)).default;
}

test("bootstrap safely reports setup mode when the named-admin allowlist is absent", async () => {
  const worker = await loadWorker();
  const response = await worker.fetch(
    new Request("http://localhost/api/governance/bootstrap", {
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
  assert.equal(payload.mode, "setup_required");
  assert.equal(payload.requiredRuntimeVariable, "ADMIN_ALLOWLIST");
  assert.equal(payload.authenticated, true);
});
