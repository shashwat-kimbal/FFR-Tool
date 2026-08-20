import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import * as XLSX from "xlsx";

const {
  analyzeDlmsWorkbook,
  bcs16SheetAdapter,
  defaultProvisionalRuleProfile,
  extractAdapterIdentity,
  genericProvisionalBundle,
  inspectAdapterWorkbookStructure,
} = await import("../server/rules/dlms-analysis.ts");
const { evaluateGovernedExpression } = await import(
  "../server/rules/rule-engine.ts"
);

async function fixtureWorkbook() {
  const data = await readFile(
    new URL(
      "./fixtures/AS2373952_Reports_2026-06-30_16-07-28.xlsx",
      import.meta.url,
    ),
  );
  return XLSX.read(data, { type: "buffer", cellDates: true });
}

test("generic provisional bundle exposes exactly 60 editable checks", () => {
  assert.equal(genericProvisionalBundle.rules.length, 60);
  assert.equal(genericProvisionalBundle.lifecycle, "provisional_active");
  assert.ok(
    genericProvisionalBundle.rules.every(
      (rule) => rule.why && rule.limitation && rule.followUp,
    ),
  );
  assert.equal(defaultProvisionalRuleProfile.parameters.nominal_voltage_v, 230);
  assert.deepEqual(
    Object.fromEntries(
      [
        "Foundation",
        "Profile & data quality",
        "Events",
        "Complaint context",
      ].map((group) => [
        group,
        genericProvisionalBundle.rules.filter((rule) => rule.group === group)
          .length,
      ]),
    ),
    {
      Foundation: 12,
      "Profile & data quality": 18,
      Events: 15,
      "Complaint context": 15,
    },
  );
});

test("DLMS fixture receives source-linked technical analysis without an FFR case", async () => {
  const analysis = analyzeDlmsWorkbook(
    await fixtureWorkbook(),
    "AS2373952 fixture.xlsx",
  );
  assert.equal(analysis.summary.total, 60);
  assert.equal(analysis.findings.length, 60);
  assert.equal(analysis.bundle.lifecycle, "provisional_active");
  assert.ok(
    analysis.features.some(
      (feature) =>
        feature.code === "configuration.meter_serial" &&
        feature.value === "AS2373952",
    ),
  );
  assert.ok(analysis.findings.every((finding) => finding.sources.length > 0));
  assert.ok(
    analysis.findings.every(
      (finding) =>
        finding.evaluation && finding.threshold.includes("Profile source:"),
    ),
  );
  const overVoltage = analysis.findings.find(
    (finding) => finding.id === "DLMS-EVT-003",
  );
  assert.equal(overVoltage?.status, "attention");
  assert.match(
    overVoltage?.limitation ?? "",
    /does not identify a failed component/i,
  );
  assert.match(overVoltage?.why ?? "", /Matched because/i);
});

test("unmatched identity keeps technical checks visible but blocks every complaint-context check", async () => {
  const analysis = analyzeDlmsWorkbook(
    await fixtureWorkbook(),
    "unmatched.xlsx",
    defaultProvisionalRuleProfile,
    genericProvisionalBundle,
    {
      productFamily: "METER",
      complaintKey: "METER:D",
      identityMatched: false,
      productMappingValid: true,
      complaintMappingValid: true,
    },
  );
  const technical = analysis.findings.filter(
    (finding) => finding.group !== "Complaint context",
  );
  const complaintContext = analysis.findings.filter(
    (finding) => finding.group === "Complaint context",
  );
  assert.equal(technical.length, 45);
  assert.equal(complaintContext.length, 15);
  assert.ok(technical.some((finding) => finding.status === "attention"));
  assert.ok(
    technical.every(
      (finding) =>
        !/case-specific complaint context requires/i.test(finding.evaluation),
    ),
  );
  assert.ok(
    complaintContext.every((finding) => finding.status === "not_assessed"),
  );
  assert.ok(
    complaintContext.every((finding) =>
      /exact DLMS identity match/i.test(finding.evaluation),
    ),
  );
});

test("complaint and product scopes gate case-context rules after identity is matched", async () => {
  const scopedBundle = structuredClone(genericProvisionalBundle);
  const onlyRtc = scopedBundle.rules.find((rule) => rule.id === "DLMS-CTX-002");
  onlyRtc.complaintKeys = ["METER:R"];
  const analysis = analyzeDlmsWorkbook(
    await fixtureWorkbook(),
    "scoped.xlsx",
    defaultProvisionalRuleProfile,
    scopedBundle,
    {
      productFamily: "METER",
      complaintKey: "METER:D",
      identityMatched: true,
      productMappingValid: true,
      complaintMappingValid: true,
    },
  );
  const rtcFinding = analysis.findings.find(
    (finding) => finding.id === "DLMS-CTX-002",
  );
  assert.equal(rtcFinding?.status, "not_assessed");
  assert.match(
    rtcFinding?.evaluation ?? "",
    /outside this rule's configured complaint scope/i,
  );

  const directNic = analyzeDlmsWorkbook(
    await fixtureWorkbook(),
    "nic-direct.xlsx",
    defaultProvisionalRuleProfile,
    genericProvisionalBundle,
    {
      productFamily: "NIC",
      complaintKey: "NIC:C",
      identityMatched: true,
      productMappingValid: true,
      complaintMappingValid: true,
      dedicatedAdapterConfigured: true,
    },
  );
  assert.equal(
    directNic.findings.find((finding) => finding.id === "DLMS-FND-008")?.status,
    "not_assessed",
  );
  assert.match(
    directNic.findings.find((finding) => finding.id === "DLMS-FND-008")
      ?.evaluation ?? "",
    /scoped to METER/i,
  );
});

test("adapter definitions control identity, mandatory sheets, and configured headers", async () => {
  const adapter = {
    ...bcs16SheetAdapter,
    id: "custom-meter-v1",
    title: "Custom Meter export",
    mandatorySheets: ["Identity", "Health", "Instant"],
    optionalSheets: [],
    identitySheet: "Identity",
    identityHeader: "Asset ID",
    sheetMappings: {
      configuration: "Identity",
      selfDiagnostic: "Health",
      instantaneous: "Instant",
    },
    headerMappings: {
      model: "Device Model",
      ratedVoltage: "Nominal V",
      selfDiagnosticStatus: "Health Flag",
      voltage: "Live V",
    },
  };
  // The generic bundle keeps its BCS default. A released shared mapping may
  // explicitly select this custom adapter without product-specific evaluator code.
  const bundle = structuredClone(genericProvisionalBundle);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      ["Asset ID", "Device Model", "Nominal V"],
      ["CUSTOM-1", "MX", 230],
    ]),
    "Identity",
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([["Health Flag"], ["OK"]]),
    "Health",
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([["Live V"], [230]]),
    "Instant",
  );
  const structure = inspectAdapterWorkbookStructure(workbook, adapter);
  const identity = extractAdapterIdentity(workbook, adapter);
  const analysis = analyzeDlmsWorkbook(
    workbook,
    "custom.xlsx",
    defaultProvisionalRuleProfile,
    bundle,
    {
      productFamily: "METER",
      complaintKey: "METER:D",
      identityMatched: true,
      productMappingValid: true,
      complaintMappingValid: true,
      adapter,
    },
  );
  assert.equal(structure.supported, true);
  assert.equal(structure.detectedExpectedSheets.length, 3);
  assert.equal(identity.meterId, "CUSTOM-1");
  assert.equal(analysis.adapter.id, adapter.id);
  assert.equal(
    analysis.features.find(
      (feature) => feature.code === "configuration.meter_serial",
    )?.source,
    "Identity",
  );
});

test("meter configuration overrides the provisional voltage fallback at a boundary", () => {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      ["Meter Serial Number", "Rated Voltage"],
      ["BOUNDARY-1", 240],
    ]),
    "MeterConfiguration",
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([["Status"], ["OK"]]),
    "SelfDiagnostic",
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([["Voltage"], [264]]),
    "IP",
  );
  const analysis = analyzeDlmsWorkbook(
    workbook,
    "boundary.xlsx",
    defaultProvisionalRuleProfile,
    genericProvisionalBundle,
    {
      productFamily: "METER",
      complaintKey: "METER:D",
      identityMatched: true,
      productMappingValid: true,
      complaintMappingValid: true,
    },
  );
  assert.equal(analysis.profile.parameters.nominal_voltage_v, 240);
  assert.equal(analysis.profileSources.nominal_voltage_v, "workbook");
  assert.equal(
    analysis.findings.find((finding) => finding.id === "DLMS-CTX-004")?.status,
    "pass",
  );
});

test("NIC and Gateway retain Meter DLMS only as contextual evidence without a dedicated adapter", async () => {
  const workbook = await fixtureWorkbook();
  for (const productFamily of ["NIC", "GATEWAY"]) {
    const analysis = analyzeDlmsWorkbook(
      workbook,
      `${productFamily}.xlsx`,
      defaultProvisionalRuleProfile,
      genericProvisionalBundle,
      { productFamily, dedicatedAdapterConfigured: false },
    );
    assert.equal(analysis.scope.evidenceMode, "context_only");
    assert.equal(analysis.scope.manualVerificationRequired, true);
    assert.ok(analysis.findings.every((finding) => finding.contextOnly));
  }
});

test("governed expression engine supports all, any, not, parameters and missing evidence", () => {
  const features = [
    { code: "ip.voltage", value: 251 },
    { code: "self_diagnostic.main_battery", value: false },
  ];
  const matched = evaluateGovernedExpression(
    {
      all: [
        { feature: "ip.voltage", operator: "gte", value: "$warning" },
        {
          not: {
            feature: "self_diagnostic.main_battery",
            operator: "equals",
            value: true,
          },
        },
      ],
    },
    features,
    { warning: 250 },
  );
  assert.equal(matched.passed, true);

  const unavailable = evaluateGovernedExpression(
    { feature: "rtc.offset", operator: "gte", value: 1 },
    features,
  );
  assert.equal(unavailable.passed, null);
});
