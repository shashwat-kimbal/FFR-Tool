import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

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

test("server-renders the configurable FFR pilot", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>Kimbal FFR Intelligence<\/title>/i);
  assert.match(html, /Kimbal/);
  assert.match(html, /FFR Intelligence/);
  assert.match(html, /Register-first case intake/);
  assert.match(html, /FFR register/);
  assert.match(html, /Case and meter/);
  assert.match(html, /Rule bundle/);
  assert.match(html, /Development proof of concept/);
  assert.doesNotMatch(html, /og-v2\.png/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|Codex is working/i);
});

test("keeps the configurable pilot and project assets wired", async () => {
  const [page, parser, layout, css, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/workbook-parser.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  assert.match(page, /inspectFfrRegister/);
  assert.match(page, /inspectDlmsWorkbook/);
  assert.match(page, /inspectImageEvidence/);
  assert.match(page, /READY_TO_ANALYZE/);
  assert.match(page, /Upload the Kimbal logo/);
  assert.match(page, /Deepu return-module enrichment is not connected/);
  assert.match(page, /RULE_BUNDLE_INPUT_REQUIRED/);
  assert.match(page, /Readiness checklist/);
  assert.doesNotMatch(page, /RULE_BUNDLE_UNAVAILABLE/);
  assert.match(page, /MULTIPLE_FFR_REGISTERS/);
  assert.match(parser, /canonicalField/);
  assert.match(parser, /imageMimeFromSignature/);
  assert.match(parser, /Rows after detected Meter RTC data header/);
  assert.match(layout, /generateMetadata/);
  assert.match(css, /--brand:/i);
  assert.match(packageJson, /"xlsx"/);
  assert.match(packageJson, /"jspdf"/);
  assert.match(packageJson, /"docx"/);
  await Promise.all([
    access(new URL("../public/evidence/meter-exterior.png", import.meta.url)),
    access(new URL("../public/evidence/terminal-closeup.png", import.meta.url)),
    access(new URL("../public/evidence/meter-opened.png", import.meta.url)),
    access(new URL("../public/evidence/pcb-power-supply.png", import.meta.url)),
    access(new URL("../public/og.png", import.meta.url)),
    access(new URL("../public/og-v2.png", import.meta.url)),
    access(new URL("../public/stakeholder-overview.html", import.meta.url)),
  ]);
  await assert.rejects(access(new URL("../app/_sites-preview", import.meta.url)));
  assert.doesNotMatch(page, /SkeletonPreview/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
});

test("stakeholder overview is a complete standalone system blueprint", async () => {
  const html = await readFile(new URL("../public/stakeholder-overview.html", import.meta.url), "utf8");
  assert.match(html, /<!doctype html>/i);
  assert.match(html, /Proposed end-to-end[\s\S]*FFR and RCA system/i);
  assert.doesNotMatch(html, /Data enters/);
  assert.doesNotMatch(html, /Evidence becomes RCA/);
  assert.doesNotMatch(html, /hero-rule/);
  assert.match(html, /intake module being developed by Deepu/);
  assert.match(html, /controlled Excel-sheet import/);
  assert.match(html, /GRN; return order or repair order/);
  assert.match(html, /no WMS/i);
  assert.match(html, /BOM; NPC\/product configuration reference/);
  assert.match(html, /BCS \/ optical DLMS/);
  assert.match(html, /Vision-based AI analysis/);
  assert.match(html, /BCS\/DLMS data-based AI analysis/);
  assert.match(html, /Equipment-reading AI analysis/);
  assert.match(html, /Diagnostic reasoning/);
  assert.match(html, /Frame the possibilities/);
  assert.match(html, /Select the next test/);
  assert.match(html, /Learn from the result/);
  assert.match(html, /Exit with a governed outcome/);
  assert.match(html, /Structured RCA record/);
  assert.match(html, /CAPA and back-tracing close the learning loop/);
  assert.doesNotMatch(html, /Case paths/);
  assert.match(html, /@media print/);
  assert.match(html, /HES is a later-phase addition/);
  assert.match(html, /--type-display:/);
  assert.match(html, /--type-section:/);
  assert.match(html, /--type-title:/);
  assert.match(html, /--type-body:/);
  assert.match(html, /--type-supporting:/);
  assert.match(html, /--type-label:/);
  assert.doesNotMatch(html, /font-size:(?!var\()/);
  assert.doesNotMatch(html, /font-weight:(?!var\()/);
  assert.doesNotMatch(html, /letter-spacing:(?!var\()/);
  assert.doesNotMatch(html, /line-height:(?!var\()/);
  assert.doesNotMatch(html, /\.rca-stage\{[^}]*background:var\(--color-navy\)/);
  assert.doesNotMatch(html, /\.reasoner\{[^}]*background:#102f50/);
  assert.match(html, /\.engine\{[^}]*border:1px solid var\(--color-border\)/);
  assert.match(html, /\.reasoner\{[^}]*background:var\(--color-white\)/);
  assert.doesNotMatch(html, /Store operations happen inside Kimbal/);
  assert.doesNotMatch(html, /How Kimbal receives/);
});
