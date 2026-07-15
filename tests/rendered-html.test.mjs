import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html", host: "localhost" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the Kimbal FFR prototype", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>Kimbal FFR Intelligence<\/title>/i);
  assert.match(html, /Kimbal/);
  assert.match(html, /FFR Intelligence/);
  assert.match(html, /Field failures into/);
  assert.match(html, /DEMO DATA/);
  assert.match(html, /FFR-2026-04782/);
  assert.match(html, /og\.png/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|Codex is working/i);
});

test("keeps the complete prototype and project assets wired", async () => {
  const [page, layout, css, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  assert.match(page, /Run next recommended test/);
  assert.match(page, /exportPdf/);
  assert.match(page, /exportDocx/);
  assert.match(page, /Quality Reviewer/);
  assert.match(page, /Synthetic evidence/);
  assert.match(layout, /generateMetadata/);
  assert.match(css, /--blue:\s*#087ef8/i);
  assert.match(packageJson, /"jspdf"/);
  assert.match(packageJson, /"docx"/);
  await Promise.all([
    access(new URL("../public/evidence/meter-exterior.png", import.meta.url)),
    access(new URL("../public/evidence/terminal-closeup.png", import.meta.url)),
    access(new URL("../public/evidence/meter-opened.png", import.meta.url)),
    access(new URL("../public/evidence/pcb-power-supply.png", import.meta.url)),
    access(new URL("../public/og.png", import.meta.url)),
    access(new URL("../public/stakeholder-overview.html", import.meta.url)),
  ]);
  await assert.rejects(access(new URL("../app/_sites-preview", import.meta.url)));
  assert.doesNotMatch(page, /SkeletonPreview/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
});

test("stakeholder overview is a complete standalone system blueprint", async () => {
  const html = await readFile(new URL("../public/stakeholder-overview.html", import.meta.url), "utf8");
  assert.match(html, /<!doctype html>/i);
  assert.match(html, /What comes from where[\s\S]*What the system does next/i);
  assert.match(html, /Which system provides which data/);
  assert.match(html, /Sourcing \/ return creation/);
  assert.match(html, /Store receipt & custody/);
  assert.match(html, /Diagnostic analysis/);
  assert.match(html, /CAPA & commercial closure/);
  assert.match(html, /Back-tracing & learning/);
  assert.match(html, /FFR-2026-04782/);
  assert.match(html, /Cases & Intake/);
  assert.match(html, /Store & Physical Tracking/);
  assert.match(html, /Agentic Analysis/);
  assert.match(html, /RCA, Reports & Approval/);
  assert.match(html, /No fault reproduced/);
  assert.match(html, /Identity mismatch, missing evidence, unsafe condition/);
  assert.match(html, /@media print/);
  assert.match(html, /HES is intentionally not part of this initial trace/);
  assert.match(html, /One case, three independent endings/);
});
