import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import * as XLSX from "xlsx";

const fixture = (name) => new URL(`./fixtures/${name}`, import.meta.url);
const normalise = (value) => String(value ?? "").trim().replace(/\s+/g, " ").toUpperCase();
const canonicalField = (value) => normalise(value).replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
const meterKey = (value) => normalise(value).replace(/[\s-]/g, "");

async function workbook(name) {
  return XLSX.read(await readFile(fixture(name)), { type: "buffer", cellDates: true });
}

function rowsFor(book, sheetName) {
  return XLSX.utils.sheet_to_json(book.Sheets[sheetName], { header: 1, defval: "", raw: false });
}

function meterSerial(book) {
  const rows = rowsFor(book, "MeterConfiguration");
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const column = rows[rowIndex].findIndex((value) => normalise(value).includes("METER SERIAL NUMBER"));
    if (column === -1) continue;
    for (let valueRow = rowIndex + 1; valueRow < rows.length; valueRow += 1) {
      const candidate = String(rows[valueRow][column] ?? "").trim();
      if (candidate) return candidate;
    }
  }
  return null;
}

test("FFR fixture exposes all selectable meter cases", async () => {
  const book = await workbook("260601-FFR IG.xlsx");
  const rows = rowsFor(book, "Sheet1");
  const headers = rows[0].map(String);
  const cases = rows.slice(1)
    .filter((row) => row.some((value) => String(value ?? "").trim()))
    .map((row) => Object.fromEntries(headers.map((header, index) => [canonicalField(header), String(row[index] ?? "").trim()])));

  assert.equal(headers.length, 32);
  assert.deepEqual(cases.map((row) => ({
    caseRef: row.S_NO,
    defectiveMeter: row.OLD_METER_NUMBER,
    replacementMeter: row.NEW_METER_NUMBER,
  })), [
    { caseRef: "13643", defectiveMeter: "SC10222714", replacementMeter: "SC10228262" },
    { caseRef: "13644", defectiveMeter: "SC10226881", replacementMeter: "SC10231275" },
    { caseRef: "13647", defectiveMeter: "SC10222115", replacementMeter: "SC10224569" },
  ]);
});

test("DLMS fixture is a deliberate negative identity case", async () => {
  const [ffr, dlms] = await Promise.all([
    workbook("260601-FFR IG.xlsx"),
    workbook("AS2373952_Reports_2026-06-30_16-07-28.xlsx"),
  ]);
  const rows = rowsFor(ffr, "Sheet1");
  const headers = rows[0].map(String);
  const candidates = rows.slice(1).flatMap((row) => headers.flatMap((header, index) =>
    ["OLD_METER_NUMBER", "NEW_METER_NUMBER"].includes(canonicalField(header)) ? [row[index]] : []));
  const serial = meterSerial(dlms);

  assert.equal(serial, "AS2373952");
  assert.equal(candidates.some((candidate) => meterKey(candidate) === meterKey(serial)), false);
  assert.equal(dlms.SheetNames.length, 16);
});
