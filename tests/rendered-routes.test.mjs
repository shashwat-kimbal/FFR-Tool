import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function renderRoute(path = "/queue") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`http://localhost${path}`, { headers: { accept: "text/html", host: "localhost" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("Server renders /queue with shell, brand KIMBAL, and diagnostic headers", async () => {
  const response = await renderRoute("/queue");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /KIMBAL/);
  assert.match(html, /Queue/);
  assert.match(html, /Import register/);
  assert.match(html, /Needs me/);
  assert.match(html, /Blocked/);
  assert.match(html, /Awaiting review/);
});

test("Server renders /cases/13644/verdict with shell and route metadata", async () => {
  const response = await renderRoute("/cases/13644/verdict");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /KIMBAL/);
  assert.match(html, /13644/);
  assert.match(html, /verdict/);
});

test("Server renders /cohorts/feeder/Lakhipur_bec with shell and route metadata", async () => {
  const response = await renderRoute("/cohorts/feeder/Lakhipur_bec");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /KIMBAL/);
  assert.match(html, /Cohorts/);
  assert.match(html, /Lakhipur_bec/);
});

test("Server renders /knowledge/mechanisms and /knowledge/rules", async () => {
  const [mechRes, ruleRes] = await Promise.all([
    renderRoute("/knowledge/mechanisms"),
    renderRoute("/knowledge/rules"),
  ]);
  assert.equal(mechRes.status, 200);
  assert.equal(ruleRes.status, 200);
  const mechHtml = await mechRes.text();
  const ruleHtml = await ruleRes.text();
  assert.match(mechHtml, /Mechanisms/);
  assert.match(ruleHtml, /Rules/);
  assert.match(ruleHtml, /Teach a new rule/);
});
