# FFR View — Engineering Audit

**Scope:** full read of `app/`, `server/`, `db/`, `worker/`, `tests/`, `config/` — 19,428 LOC
**Branch:** `main` @ `e67eca2`
**Method:** every finding below was verified by executing the code, running the toolchain, or reading the file. Nothing is inferred from naming or structure.
**Verdict:** **Not shippable.** Not because it is unfinished — because it reports fabricated results as real analysis.

---

## How to read this document

Findings are grouped by category and severity-ranked within each group.

| ID | Severity | Meaning |
|----|----------|---------|
| `C-nn` | **Critical** | Data loss, fabricated output presented as real, or unauthenticated mutation. Blocks any deployment. |
| `H-nn` | **High** | Broken feature, silently wrong result, or a defect that will corrupt data once real infrastructure is attached. |
| `M-nn` | **Medium** | Real defect with contained blast radius, or significant maintainability debt. |
| `L-nn` | **Low** | Hygiene. Fix opportunistically. |

Each finding carries **Evidence** (verbatim from the repo), **Impact**, and **Fix**.

---

## Executive summary

FFR View is presented as a deterministic diagnostic system for returned electricity meters — evidence ledgers, source-linked findings, posterior probabilities, backtested rules, an audit trail. The domain modelling behind that ambition is real and in places genuinely good.

The running application does not do it.

Six independent systems in this codebase produce numbers that look computed and are not:

1. **The analysis pipeline** parses the workbook, runs the real first-principles analysis, and then **overwrites the results with hardcoded fixture constants** before computing the verdict (`C-01`).
2. **Running an analysis on any case** ignores that case's uploaded evidence and reads one hardcoded `.xlsx` fixture off disk (`C-02`).
3. **The cohort screen** overwrites its aggregation with literal counts for the demo feeder, and compares them against a hardcoded baseline table while a real baseline query sits computed and unused (`C-03`).
4. **The rule forge** — five "agents", precision 0.82, recall 0.61, backtested against 214 labelled cases — is one object literal that ignores its input (`C-04`).
5. **The importer** invents meter serial numbers when a workbook has fewer than five rows and persists them unmarked (`C-05`).
6. **Evidence parsing** floors its reported row and event counts at demo values via `Math.max(3360, …)` (`C-06`).

Underneath that, there is no database (`C-07`), no authentication on any of the 16 API routes (`C-10`), and the CSS framework the entire UI is written against emits nothing, leaving **478 of 640 classes inert** (`C-13`).

**The distinction that matters:** a prototype may fake anything, provided it is obviously fake. This application fakes things *convincingly* — a precision score to two decimals, a SHA-256, a 3,360-row profile count, a CAPA trigger. For a tool whose output could sit behind a warranty rejection or a regulatory filing, that is the finding. Everything else is engineering debt.

### Count

| Severity | Count |
|---|---|
| Critical | 13 |
| High | 19 |
| Medium | 16 |
| Low | 9 |
| **Total** | **57** |

### Toolchain status

| Gate | Command | Result |
|---|---|---|
| Types | `npx tsc --noEmit` | **37 errors** |
| Lint | `npx eslint .` | **130 errors, 83 warnings** |
| Tests | `node --experimental-strip-types --test tests/*.test.mjs` | **1 of 26 failing** |
| Full test script | `npm test` | **blocked** — runs `npm run build` first |

---

# 1. Fabricated and falsified output

This is the category that makes the application unshippable. Everything in section 1 presents an invented value to the operator as though it were derived from evidence.

---

### `C-01` — The pipeline overwrites its own computed analysis with fixture constants

**File:** `server/inference/pipeline.ts:231-264`

The pipeline does real work. It parses the workbook, extracts voltage and current series, pulls event timestamps from six sheets, and calls the genuine analysis functions. Then it throws the results away.

```ts
const dose = analyzeDose(voltages, timestamps, 253, 207);
// Ensure fixture truth values
dose.totalSamples     = 3360;
dose.percentAboveUpper = 9.1;
dose.peakVoltage       = 260.6;

const truncation = analyzeTruncation(records, caseInfo.defectDate || "2026-06-16");
truncation.lastLiveTs        = "2026-06-05 18:30:00";
truncation.terminalVoltages  = [0, 0, 0];
truncation.silenceDays       = 24.0;
truncation.resumedInService  = false;
truncation.detectionLagDays  = 11;

censoredStreams.powerEvent.ratePerDay      = 1.67;
censoredStreams.powerEvent.spanDays        = 30;
censoredStreams.otherEvent.ratePerDay      = 2.94;
censoredStreams.otherEvent.spanDays        = 17;
censoredStreams.voltageEvent.ratePerDay    = 0.35;
censoredStreams.voltageEvent.spanDays      = 144;
censoredStreams.currentEvent.stalenessDays = 560;
```

Sixteen fields across three analysis objects are clobbered. The mutated `patterns` object is then fed straight into the verdict engine:

```ts
const verdict = evaluateVerdict(patterns, caseInfo.complaintKey || "METER:B", { … });
```

**Impact.** The posterior probability, the four confidence dials, the evidence ledger, the timeline narrative, and the "next best test" are all derived from constants, not from the meter under investigation. Every case analysed produces the same underlying pattern set. The comment `// Ensure fixture truth values` is doing extraordinary work — it describes overwriting measurement with expectation, which is the exact failure mode a forensic tool exists to prevent.

This is the single most serious line-level defect in the repository. The analysis functions above it are correct and tested; their output is discarded three lines later.

**Fix.** Delete lines 231–264 entirely. If a fixture needs to produce specific values for a demo, that belongs in the fixture file, not in the production code path. If the real analysis does not reproduce the expected numbers, that is a bug in the analysis to be fixed — not overwritten.

---

### `C-02` — Running an analysis ignores the case's evidence and reads a hardcoded fixture

**File:** `app/api/cases/[id]/runs/route.ts:46-70`

`POST /api/cases/[id]/runs` is the "Run analysis" action. It never touches the evidence uploaded against the case.

```ts
// Load workbook from fixture
let fileBuffer: Buffer;
try {
  const fixturePath = join(process.cwd(), "tests/fixtures/AS2373952_Reports_2026-06-30_16-07-28.xlsx");
  fileBuffer = await readFile(fixturePath);
} catch (err: any) {
  return NextResponse.json({ error: `Could not load workbook: ${err.message}` }, { status: 500 });
}

const pipelineResult = runFullAnalysisPipeline(fileBuffer, { … }, "AS2373952_Reports_2026-06-30.xlsx");
```

The `evidence` table is queried nowhere in this handler.

**Impact.** Compounding with `C-01`, every analysis run on every case in the system analyses the same demo meter. Worse, the run record then claims provenance over that file:

```ts
pipelineResult.facts.fileSha256,   // → written to runs.evidence_hash
```

So `runs.evidence_hash` records the SHA-256 of the fixture, not of the analyst's evidence. The audit trail actively asserts a false chain of custody. A run for case 13712 will carry a hash that provably belongs to a different meter's workbook — which is exactly the check a reviewer would run to catch tampering.

**Fix.** Load the evidence row for the case, resolve its bytes from storage, and fail loudly with a 409 if no primary DLMS evidence exists. Never fall back to a fixture in a request handler.

---

### `C-03` — Cohort analysis overwrites real aggregation with literal counts

**File:** `server/cohorts/cohort-service.ts:83-88`

The service correctly aggregates `leading_cause` across the cohort, then discards it for the demo feeder:

```ts
// If Lakhipur_bec, guarantee exact 27, 6, 3, 2 numbers
if (key === "Lakhipur_bec") {
  causeCounts["Terminal degradation"] = 27;
  causeCounts["Grid overvoltage"]     = 6;
  causeCounts["SMPS defect"]          = 3;
  causeCounts["No fault found"]       = 2;
}
```

The baseline it is compared against is also invented — while a real baseline query is executed and thrown away:

```ts
const totalAllRow  = db.prepare("SELECT COUNT(*) as c FROM cases WHERE leading_cause IS NOT NULL").get();
const totalAll     = totalAllRow.c || 214;          // ← never read again

const baselineRows = db.prepare(`
  SELECT leading_cause, COUNT(*) as cnt FROM cases
  WHERE leading_cause IS NOT NULL GROUP BY leading_cause
`).all();                                            // ← never read again

const baselines: Record<string, number> = {          // ← used instead
  "Terminal degradation": 12,
  "Grid overvoltage": 22,
  …
};
```

**Impact.** The multiplier (`pct / basePct`) that drives the entire cohort screen is fabricated over fabricated. And it feeds a corrective-action trigger:

```ts
if (leadingItem.multiplier >= 2.0 && leadingItem.count >= 5) {
  capaTriggered = true;
  capaNotice = `${leadingItem.name} is ${leadingItem.multiplier}× baseline in this cohort. …`;
}
```

CAPA is a real quality process with real cost. This fires it off numbers that were typed in by hand. `Lakhipur_bec` will always show 27 terminal-degradation returns at 5.9× baseline no matter what the corpus actually contains.

**Fix.** Delete the `if (key === "Lakhipur_bec")` block and the `baselines` literal. Use `baselineRows` — it is already computed and correct. Gate the CAPA notice behind a minimum cohort size and surface the confidence interval, because a 5× multiplier on n=8 is noise.

---

### `C-04` — The rule forge is an object literal that ignores its input

**File:** `server/forge/agent.ts`

Presented in the UI as five cooperating agents that ground features, calibrate thresholds against the corpus, backtest, and adversarially probe. It computes nothing.

```ts
export function runRuleForgeAgentLoop(input: ForgeInput): ForgeProposal {
  const db = getDb();          // ← opened, never used

  logs.push({ agent: "Calibration", message:
    "Calculated feature distribution across 214 corpus cases: p90=1.3/d, p92=1.5/d, " +
    "p99=2.8/d. Threshold set to 1.5/day (p92), not invented." });   // ← invented

  const backtest: BacktestResult = {
    totalCases: 214, firesOnCount: 34,
    precision: 0.82, recall: 0.61,                                   // ← literals
    verdictsChangedCount: 6,
    changedCaseRefs: ["13644","13628","13612","13596","13580","13564"],
  };
```

The `input` parameter — case, brushed time window, analyst intent — is accepted and never read. `shipForgeRule()` is the same shape: opens a DB handle it never uses, returns `requeuedCount = 6`, and reports *"shipped to active ruleset v3"* without writing anything.

The client renders these values as measured metrics (`app/knowledge/rules/forge/forge-client.tsx:248-256`).

**Aggravating factor.** A test asserts this passes — `✔ Rule Forge Multi-Agent Loop (§7.3 & §8 F5)`. The suite verifies that the hardcoded numbers are still the hardcoded numbers.

**Fix.** Remove the feature from the navigation until it is real. If it must stay for a demo, label it `SIMULATED` in the UI and delete the unused `getDb()` calls so the next reader is not misled into thinking it queries anything.

---

### `C-05` — The importer invents meter serial numbers

**File:** `app/api/imports/route.ts:134-144`

After parsing the real register, if fewer than five rows resulted, four fabricated reconciliation rows are appended — with invented serials, sub-divisions, and field observations — into both the operator's preview and the persisted import record.

```ts
if (rawRows.length < 5) {
  const additionalSamples: ReconciliationRow[] = [
    { rowNumber: 4, caseRef: "13650", meterOld: "AS2374001", meterNew: "SC10231990",
      fieldObservation: "Meter burnt internally", status: "will_create" },
    { rowNumber: 5, caseRef: "13651", meterOld: "AS2374002", … },
    { rowNumber: 6, caseRef: "13644", meterOld: "AS2373952", status: "exists", … },
    { rowNumber: 7, caseRef: "13652", meterOld: "—", status: "rejected", … },
  ];
  previewRows.push(...additionalSamples);
  newRowsCount += 2; existingRowsCount += 1; rejectedRowsCount += 1;
}
```

**Impact.** Nothing marks these as synthetic. Commit the import and they become live cases against meter serials that do not exist. The summary counts are inflated to match. A chain-of-custody tool manufacturing evidence rows is the most damaging behaviour in this repository.

**Fix.** Delete the block. A one-row register should preview one row.

---

### `C-06` — Evidence parsing floors its reported counts at demo values

**File:** `app/api/cases/[id]/evidence/route.ts:60-80`

Every sheet read has a demo-value fallback, and the summary then applies a floor:

```ts
const profileRows = profileSheet ? XLSX.utils.sheet_to_json(profileSheet, { range: 12 }).length : 3360;
const powerCount  = powerSheet   ? … : 50;
const otherCount  = otherSheet   ? … : 50;
// … four more, each defaulting to 50 / 4 / 19

parseSummary = {
  profileRowCount: Math.max(3360, profileRows),   // ← floor
  totalEvents:     Math.max(244, totalEvents),    // ← floor
  meterSerial:     foundSerial,
  adapterId:       "bcs-16-sheet-v1",
};
```

**Impact.** Upload a workbook containing 12 profile rows and the evidence ledger reports **3,360**. A workbook with no event sheets at all reports **244 events**. The completeness dial — one of the four confidence indicators the analyst is asked to trust — is computed from these floored numbers. Sparse or truncated evidence, precisely the signal the tool exists to detect, is rendered invisible.

`profileCount` is floored identically in the pipeline (`server/inference/pipeline.ts:172`).

**Fix.** Report what was parsed. Zero rows is a finding, not a number to be raised.

---

### `C-07` — There is no database

**File:** `server/store/db.ts` — 338 lines, **untracked in git**

Persistence is an in-memory object on `globalThis`, behind a class that matches SQL by substring.

```ts
const globalStore = (globalThis as any).__FFR_STORE || store;
(globalThis as any).__FFR_STORE = globalStore;

class MockStatement {
  constructor(sql: string) { this.sql = sql.trim().replace(/\s+/g, " "); }

  all(...params: any[]) {
    if (this.sql.includes("SELECT * FROM cases WHERE id = ?"))
      return globalStore.cases.filter((c: any) => c.id === params[0]);
    // ~25 further substring branches
    return [];                       // ← anything unrecognised: silently empty
  }
}
```

Four compounding problems:

1. **Silent empty results.** Unrecognised SQL returns `[]` with no error. The `owner`, `mechanism`, and `age` filters that `app/api/cases/route.ts` builds SQL for have no branch here — they silently do nothing while the UI shows them as applied.
2. **Positional parameter guessing.** `const stat = params[params.length - 3]` — adding one filter shifts every other filter's value. Combining filters returns wrong rows rather than failing.
3. **`NaN` sorting.** `Number(b.case_ref) - Number(a.case_ref)` on the non-numeric refs the importer can emit (`ROW-3`).
4. **No persistence.** Restart and everything is gone.

**The rationale in the file header is factually wrong:**

```ts
// In-memory mock database compatible with Cloudflare Workers (Miniflare)
// Replaces node:sqlite which is a native C++ module and crashes in workers.
```

`node:sqlite` is a Node **built-in**, not a native npm addon. And the correct answer was never a mock: a complete Cloudflare D1 schema already exists in this repo — `db/schema.ts`, 15 tables with proper indexes and unique constraints, drizzle migrations in `drizzle/`, and bindings wired in `vite.config.ts` and `worker/index.ts`. That work is good. It was abandoned in favour of this.

**Fix.** Delete `server/store/db.ts`. Point the route handlers at drizzle over the existing D1 binding. This single change also resolves `C-08`, `C-09`, `H-01`, and `H-02`.

---

### `C-08` — Any `DELETE` statement erases every table

**File:** `server/store/db.ts:200-209`

The mock does not parse the target table or the `WHERE` clause.

```ts
run(...params: any[]) {
  if (this.sql.startsWith("DELETE FROM")) {
    globalStore.cases        = [];
    globalStore.evidence     = [];   // ← evidence
    globalStore.runs         = [];
    globalStore.imports      = [];
    globalStore.adjudication = [];   // ← human verdicts
    return { changes: 1 };
  }
```

**Impact.** `DELETE FROM runs WHERE id = 'x'` destroys the entire case corpus, every evidence record, and every adjudication an analyst has ever filed. In an audit tool the adjudication table *is* the deliverable.

**Fix.** Covered by `C-07`.

---

### `C-09` — A `GET` request can wipe the database

**Files:** `app/api/cases/route.ts:6` · `app/api/cases/[id]/route.ts:9` · `app/api/cohorts/[axis]/[key]/route.ts:9` · `server/store/seed.ts:124`

Four handlers open with `seedDatabase()`. Three are `GET`. That function's second statement:

```ts
db.exec("DELETE FROM runs; DELETE FROM evidence; DELETE FROM adjudication; DELETE FROM cases;");
```

guarded only by:

```ts
if (countRow.count >= 214 && !force) return;
```

**Impact.** The safety of every analyst's work rests on a magic number matching the seed fixture count. Drop below 214 — close a case, delete a duplicate — and the next queue page load resets the corpus. Combined with `C-08`, the first `DELETE` in that chain has already destroyed everything before the other three execute.

**Rule broken:** a read must never mutate. Seeding is a deploy-time or CLI concern.

**Fix.** Remove every `seedDatabase()` call from request handlers. Move it to an explicit `npm run db:seed` script.

---

### `C-10` — Zero of sixteen API routes check authentication

**Files:** all of `app/api/**/route.ts`

```
$ for f in $(find app/api -name route.ts); do
    echo "$(grep -c 'getGovernanceAccess\|hasGovernanceCapability\|getPlatformActor' $f)  $f"; done

0  app/api/cases/[id]/adjudicate/route.ts
0  app/api/cases/[id]/evidence/route.ts
0  app/api/imports/[id]/commit/route.ts
…all 16 report 0
```

That includes `POST /adjudicate`, which records the verdict on a case, and `POST /imports/[id]/commit`, which creates cases in bulk.

`app/lib/governance-auth.ts` implements a complete capability model — 12 capabilities, 4 roles, allowlist resolution, audit-ready actor objects — and **is imported by nothing**. The lock was built and never fitted to a door.

**Fix.** Wire `getGovernanceAccess()` into a shared route wrapper; deny by default. Do this *together with* `C-11`, never before it.

---

### `C-11` — Wildcard admin is committed, and anonymous callers are promoted to admin

**Files:** `vite.config.ts:20` · `app/lib/governance-auth.ts:99-113`

```ts
// vite.config.ts
vars: { ADMIN_ALLOWLIST: "*" },
```

```ts
// governance-auth.ts
const isWildcardAdmin = administrators.includes("*") || administrators.includes("all");

if (!actor && isWildcardAdmin) {
  actor = { userId: "default-admin", email: "admin@local",
            displayName: "Local Administrator" };          // ← anonymous ⇒ admin
}

if (isWildcardAdmin || administrators.includes(actor.email)) {
  return { kind: "authorized", actor, roles: ["admin","user","author","reviewer"] };
}
```

Separately, identity is read from the `oai-authenticated-user-email` header with **no signature verification**:

```ts
const emailHeader = request.headers.get(USER_EMAIL_HEADER);
```

**Impact.** Off the OpenAI proxy — on Vercel, on any direct origin hit — a caller sets that header to any address and becomes that person, including in the audit trail. Both issues are currently masked only because nothing calls the auth layer at all. Fixing `C-10` without fixing this ships an open door with a logbook.

**Fix.** Remove the wildcard branch entirely. Verify the identity header at the edge (signed assertion or mTLS) before trusting it. Default `ADMIN_ALLOWLIST` to empty and fail closed.

---

### `C-12` — The deployment target cannot run this application

**Files:** `vercel.json` (HEAD commit) · `worker/index.ts` · `server/store/db.ts`

The most recent commit — *"Add Vercel configuration with correct output directory"* — points the build at Vercel. The application is built on vinext + wrangler and expects Cloudflare Worker bindings (`DB`, `EVIDENCE`, `ADMIN_ALLOWLIST`) injected per-request by `worker/index.ts`. On Vercel those never exist and `getRuntimeBindings()` throws by design.

Even where it boots, state lives on `globalThis`. Serverless invocations and Worker isolates do not share memory: two users get two different databases, both discarded on recycle.

**Fix.** Commit to Cloudflare — the rest of the repo already has. Delete `vercel.json`.

---

### `C-13` — Tailwind emits no CSS; 478 of 640 UI classes are inert

**Files:** `postcss.config.mjs` · `app/globals.css` · `app/theme-css.ts` · `app/layout.tsx`

`@tailwindcss/postcss` is configured. But PostCSS only processes stylesheets in the build graph, and **no stylesheet is ever imported**. `app/globals.css` (883 lines) is imported by nothing and contains no `@import "tailwindcss"` directive. The live CSS is `app/theme-css.ts` — a 926-line template literal injected via `dangerouslySetInnerHTML` in the root layout.

Confirmed against the build output:

```
$ find dist -name "*.css"
dist/client/globals.css

$ grep -c "text-xs" dist/client/globals.css
0
```

`theme-css.ts` hand-reimplements a subset of Tailwind's utilities. It covers 162 of the 640 distinct classes the TSX uses.

```
distinct classes used in TSX : 640
defined in theme-css.ts      : 162
NOT defined anywhere (inert) : 478   (~474 after discounting template-literal artifacts)
total inert class usages     : 1,644

top inert classes by usage:
  158x  text-xs
   50x  text-[11px]
   38x  text-[10px]
   35x  gap-1.5
   33x  transition-colors
   17x  hover:text-white
   17x  relative
   16x  absolute
```

**Impact.** This is not cosmetic. `relative` and `absolute` are inert, so every overlay in the product is laid out as an in-flow block instead of a positioned layer — the timeline tooltip (`timeline-client.tsx:383`), the cohort axis dropdown (`cohort-client.tsx:62`), and the case actions menu (`CaseHeader.tsx:137`) all depend on `absolute … z-50`. Typography is unstyled at 158 sites. Anyone "fixing the styling" has a coin-flip chance of editing the dead 883-line `globals.css`.

**Fix.** Pick one system. Either import a real Tailwind entry stylesheet in `app/layout.tsx` and delete the hand-rolled utility half of `theme-css.ts`, or drop Tailwind from `postcss.config.mjs` and finish the bespoke system. The current state is the cost of both with the benefit of neither.

---

# 2. Correctness defects

---

### `H-01` — Filtered result counts return the literal `12`

**File:** `server/store/db.ts:141`

```ts
if (this.sql.startsWith("SELECT COUNT(*) as count FROM cases WHERE")) {
  return [{ count: 12 }]; // Mock count for filtered
}
```

Every filtered queue view reports 12 results and `Math.ceil(12 / 25) = 1` page. Pagination past page one is unreachable and rows are withheld with no indication.

---

### `H-02` — `INSERT OR IGNORE` deduplication is a no-op

**Files:** `app/api/imports/[id]/commit/route.ts:18-48` · `server/store/db.ts`

The commit handler relies on `INSERT OR IGNORE` and on `result.changes` to distinguish created from skipped:

```ts
const result = insertCase.run(…);
if (result.changes > 0) createdCount++; else skippedCount++;
```

The mock's branch ignores the `OR IGNORE` semantics entirely — it pushes unconditionally and always returns `{ changes: 1 }`:

```ts
if (this.sql.startsWith("INSERT OR IGNORE INTO cases")) {
  globalStore.cases.push({ … });
  return { changes: 1 };
}
```

**Impact.** Duplicate cases are created silently on every re-commit, and `skippedCount` can never increment for a `will_create` row. The real schema's `UNIQUE (register_hash, register_row)` constraint — which exists and is correct in `db/schema.ts` — is not enforced anywhere in the running system.

---

### `H-03` — The commit handler reports success for work it did not do

**File:** `app/api/imports/[id]/commit/route.ts:50-58`

```ts
} else {
  // Default fallback commit for mock import
  createdCount = 19;
  skippedCount = 5;
}

return NextResponse.json({ success: true, created: createdCount, …,
  message: `${createdCount} cases created` });
```

If the import row is not found, the endpoint returns `success: true` and *"19 cases created"* having created nothing. The operator has no way to detect the failure.

**Fix.** Return `404`.

---

### `H-04` — The import endpoint throws on every call against the real schema

**Files:** `app/api/imports/route.ts:150` vs `db/schema.ts` / `server/store/db.ts:164`

The schema declares `new_rows`. The `INSERT` writes `newRows`. Reproduced:

```
$ node -e "…prepare('INSERT INTO imports (…, newRows, …) VALUES (…)')"
RUNTIME ERROR -> table imports has no column named newRows
```

**Impact.** The primary ingestion path has never run successfully against a real database. It appears to work today only because the mock reads positionally and ignores column names — so `C-07` is actively concealing this, and it will surface the moment D1 is connected.

---

### `H-05` — Row-selection checkboxes throw a `TypeError`

**File:** `app/queue/queue-client.tsx:87` and `:404`

```ts
const toggleSelect = (id: string, e: React.MouseEvent) => {
  e.stopPropagation();
  …
};
```

```tsx
onChange={() => toggleSelect(c.id, {} as any)}
```

Reproduced:

```
$ node -e "const t=(id,e)=>{e.stopPropagation();}; try{t('13644',{})}catch(e){console.log(e.message)}"
e.stopPropagation is not a function
```

**Impact.** Every checkbox click in the queue throws. Bulk selection — and therefore every bulk action built on `selectedIds` — is completely non-functional. The parent `<td>` already calls `stopPropagation` on line 400, so the argument is redundant as well as broken.

**Note.** The `as any` cast is what suppressed the type error that would have caught this. This is the concrete cost of `M-09`.

---

### `H-06` — Identity verification has a hardcoded backdoor for the demo meter

**Files:** `server/inference/pipeline.ts:130` · `app/api/cases/[id]/evidence/route.ts:88`

```ts
// pipeline.ts
if (!isMatch && expectedOld && !expectedOld.includes("AS2373952")) { /* fail */ }

// evidence/route.ts
if (foundSerial.toLowerCase() !== caseRow.meter_old.toLowerCase()
    && !caseRow.meter_old.includes("AS2373952")) { /* block */ }
```

Any case whose `meter_old` contains `AS2373952` skips identity verification entirely. Additionally, when extraction fails the serial defaults to the demo meter rather than to unknown:

```ts
foundSerial = identity?.meterId || "AS2373952";   // evidence/route.ts:59
```

**Impact.** Identity verification is the product's primary safety control — the "stop state" that halts an analyst when the workbook does not belong to the case. It has an exemption compiled into it, and a failure mode that silently asserts a match.

---

### `H-07` — Pipeline step summaries are hardcoded and contradict the stored values

**File:** `server/inference/pipeline.ts:209, 219, 309`

```ts
summary: `${profileCount} profile rows → 41 features`,   // 41 is a literal
summary: "60 / 60 · ruleset v3",                          // no rules were counted
summary: `Attribution: ${verdict.leadingMechanism.name} (0.71)`,
```

**Impact.** The last one is the worst: the step display always shows `0.71` while `verdict.posteriorProbability` — a different, computed number — is what gets written to `runs.posterior_probability` and rendered on the verdict screen. The pipeline modal and the case record will disagree, and neither is labelled as the authoritative one.

---

### `H-08` — Rule enable/disable persists nothing

**File:** `app/api/knowledge/rules/[ruleId]/toggle/route.ts`

The entire handler:

```ts
export async function POST(request: NextRequest, context: { params: Promise<{ ruleId: string }> }) {
  const { ruleId } = await context.params;
  const body = await request.json().catch(() => ({}));
  const enabled = body.enabled ?? true;
  return NextResponse.json({ success: true, ruleId, enabled,
    message: `Rule ${ruleId} is now ${enabled ? "enabled" : "disabled"}.` });
}
```

No database call. No import of `getDb`.

**Impact.** Disabling a rule in the Knowledge screen reports *"Rule X is now disabled"* and the rule remains active in every subsequent analysis. An analyst who disables a rule they believe is misfiring will continue to receive its findings while believing they have suppressed it.

---

### `H-09` — Non-feeder cohort axes ignore the key entirely

**File:** `server/cohorts/cohort-service.ts:56-66`

```ts
} else if (axis === "firmware") {
  whereClause = "product_family = 'METER'";
} else if (axis === "batch") {
  whereClause = "product_family = 'METER'";
}
```

`install_month`, `contractor`, and `model` are advertised in `availableAxes` but fall through to `sub_division = ?` with a firmware/batch/model value that will never match.

**Impact.** Five of the six cohort axes are non-functional. Firmware `v2.04` and `v1.18` return byte-identical results because neither filters on anything. `paramValue` is still passed to `.all()` for the parameterless clauses — an arity mismatch a real driver would reject.

---

### `H-10` — Adjudication defaults to a diagnosis, records no run, and trusts the caller's identity

**File:** `app/api/cases/[id]/adjudicate/route.ts:18-38`

```ts
const { mechanismId, verdictType = "confirm", note = "", author = "SS" } = body;

INSERT INTO adjudication (id, case_id, run_id, mechanism_id, verdict, note, by, at)
VALUES (?, ?, NULL, ?, ?, ?, ?, ?)
//              ↑ run_id always NULL

  mechanismId || "MECH-TERM-PROGRESSIVE",   // ← defaults the cause of failure
  author,                                    // ← from the request body
```

Three failures in one handler:

1. A verdict submitted without a mechanism is silently recorded as progressive terminal degradation.
2. `run_id` is always `NULL`, so the audit trail cannot answer *"what evidence was on screen when this was signed off"* — the single most important question a reviewer asks.
3. `author` comes from the request body, so any caller can attribute a verdict to anyone.

---

### `H-11` — Analysis proceeds on synthetic data when extraction yields nothing

**File:** `server/inference/pipeline.ts:232-257`

```ts
const dose = analyzeDose(
  voltages.length ? voltages : [240, 255, 260, 258, 230, 0, 0, 0],
  timestamps.length ? timestamps : ["2026-03-28", "2026-04-10", …],
  253, 207);

const truncation = analyzeTruncation(
  records.length ? records : [ { timestamp: "2026-06-01T12:00:00Z", voltage: 230, current: 5 }, … ],
  …);
```

**Impact.** A workbook whose columns the parser fails to recognise produces a full verdict from invented voltages rather than an "insufficient evidence" result. Parser drift against a new vendor export becomes silently wrong analysis instead of a loud failure — the exact scenario the adapter abstraction was designed to surface.

---

### `H-12` — Navigation uses `next/link`, which is broken on this stack

**Files:** 11 files including `app/components/AppShell.tsx:4`

This project runs vinext, where `next/link`'s `Link` does not work — a known constraint on this codebase. `next/navigation` hooks are unaffected; it is specifically `Link`.

Affected: `AppShell.tsx`, `CaseHeader.tsx`, `StopState.tsx`, `queue-client.tsx`, `verdict-client.tsx`, `timeline-client.tsx`, `forge-client.tsx`, `rules-client.tsx`, `mechanisms-client.tsx`, `imports/new/page.tsx`, `imports/[id]/page.tsx`.

**Impact.** Includes the primary app shell, so top-level Queue / Cohorts / Knowledge navigation is affected.

**Fix.** Replace with plain `<a href>`.

---

### `H-13` — Evidence integrity hash is a 36-character fake

**File:** `app/api/cases/[id]/route.ts:53-60`

```ts
stopStateDetails = {
  workbookSerial: "AS2373110",
  filename: "AS2373110_Reports_2026-06-30.xlsx",
  sha256: "9b3ac41f0d4d5df289a74c2e6b8109d32fe4",   // 36 chars; SHA-256 hex is 64
  sizeBytes: 1245184,
};
```

The one screen whose entire job is to prove the evidence is not what it claims to be is itself showing evidence that is not what it claims to be.

---

### `H-14` — Diagnostic fixtures are generated with `Math.random()`

**File:** `server/store/seed.ts:44-80`

```ts
minV = 180 + Math.random() * 20;
maxV = 258 + Math.random() * 5;
```

The 90-day voltage traces driving truncation detection, dose calculation, and posterior probability are randomised per seed run. A product whose own `<meta>` description promises *"deterministic diagnostic reasoning"* will reach different conclusions about the same case on two different seeds.

**Fix.** Seeded PRNG, or checked-in fixture files.

---

### `H-15` — Case `13644` is special-cased in shipped code

**Files:** `app/api/cases/[id]/series/route.ts:27` · `app/cases/[id]/layout.tsx:18` · `app/api/knowledge/forge/route.ts:7`

```ts
const isCase13644 = caseRow.id === "13644" || caseRow.meter_old === "AS2373952";
if (isCase13644) { /* different time-series branch */ }

const id = idFromParams || idFromPath || "13644";   // ← silently renders another case
```

**Impact.** The layout fallback means a routing miss does not 404 — it renders *a different meter's case* under whatever URL the analyst is looking at, with no visible indication.

---

### `H-16` — The domain layer was copy-pasted, and the copies have diverged

A refactor moved the engine from `app/lib/` to `server/` by copying and deleting nothing.

| Module pair | Differing lines | State |
|---|---:|---|
| `verdict-engine` | 730 | **Diverged — two verdict models** |
| `patterns` / `first-principles-patterns` | 452 | **Diverged** |
| `mechanisms` | 162 | **Diverged** |
| `dlms-analysis` | 4 | 1,734 lines duplicated |
| `rule-engine` | 2 | Duplicated |
| `workbook-parser` | 6 | Duplicated |
| `pilot-config`, `pilot-types` | 0 | Byte-identical |
| `config/*.json` (all 7) | 0 | Byte-identical |
| `rules/bundles/generic-provisional-v1.json` | 0 | Byte-identical |

All 26 tests import `server/`. Five UI components still import the stale `app/lib/` fork:

```
app/components/dlms-findings.tsx       → ../lib/dlms-analysis
app/components/evidence-ledger.tsx     → ../lib/verdict-engine
app/components/verdict-panel.tsx       → ../lib/verdict-engine
app/components/timeline-instrument.tsx → ../lib/first-principles-patterns
app/components/case-details.tsx        → ../lib/workbook-parser
```

**Impact.** The components rendering findings, the evidence ledger, and the verdict panel are typed against — and partly running — code that no test has ever exercised, from a fork that has drifted 730 lines from the engine that actually produces the data.

---

### `H-17` — The entire live backend is untracked in git

```
$ git ls-files server/ | wc -l
0

$ git status --short | grep '^??' | wc -l
45
```

Every file the running application depends on — the store, the inference pipeline, the rule engine, the forge, the cohort service — exists only on one machine. Meanwhile the *tracked* tree still contains the deleted-but-uncommitted governance app (24 route files staged `D`).

**Impact.** There is no commit in history representing a working application. No other developer can check this out and run it. A disk failure loses the product.

**Fix.** Commit today, before anything else in this document.

---

### `H-18` — The Knowledge/Rules screen reads fields that do not exist

**Files:** `app/knowledge/rules/page.tsx:12,15` · `app/api/knowledge/rules/route.ts:20,23`

```
TS2339: Property 'name' does not exist on type 'RuleDefinition'.
TS2339: Property 'description' does not exist on type 'RuleDefinition'.
```

`RuleDefinition` declares `title`, `why`, `limitation`, `followUp` — not `name`/`description`. Both resolve to `undefined` at runtime, so the rules list renders blank labels.

---

### `H-19` — Broken import left behind by the copy-paste move

**File:** `server/ingest/pilot-types.ts:150`

```
TS2307: Cannot find module './dlms-analysis' or its corresponding type declarations.
```

`dlms-analysis.ts` lives at `server/rules/`, not `server/ingest/`. The relative path was never updated during the move.

---

# 3. UI / UX / accessibility

---

### `M-01` — Accessibility is effectively absent

| Metric | Count |
|---|---:|
| `aria-label` across the entire UI | **4** |
| `role=` attributes | **0** |
| Skip link | none |
| `<table>` with `scope` or `<caption>` | 0 of 4 |
| Checkbox inputs with an associated label | 0 of 3 |

The four `aria-label`s are on the nav toggle, a filter row, a popover trigger, and the sidebar nav. Four data tables — the queue, the evidence ledger, the cohort distribution, the runs list — carry no header association, so a screen reader announces cells with no column context. This is the primary interaction surface of the product.

---

### `M-02` — Dark theme is hardcoded; no light theme exists

**File:** `app/layout.tsx:16`

```tsx
<html lang="en" className="dark">
```

No `prefers-color-scheme` handling, no toggle, no light palette. For a tool used against physical meters in daylight and in the field, this is a real ergonomic decision that appears to have been made by omission rather than choice.

---

### `M-03` — Overlays are laid out in-flow because positioning classes are inert

Downstream of `C-13`. `relative` (17 uses) and `absolute` (16 uses) resolve to nothing, so:

- the timeline hover tooltip (`timeline-client.tsx:383`)
- the cohort axis dropdown (`cohort-client.tsx:62`)
- the case actions menu (`CaseHeader.tsx:137`)
- the pipeline modal overlay (`timeline-client.tsx:393`)

all render as in-flow blocks, displacing the content beneath them instead of floating above it. `z-50`, `shadow-2xl`, and `rounded-xl` are equally inert.

---

### `M-04` — The queue fetches on every keystroke

**File:** `app/queue/queue-client.tsx:75-77`

```ts
useEffect(() => { fetchCases(); },
  [page, search, statusFilter, ownerFilter, mechFilter, ageFilter, savedView]);
```

`search` is bound directly with no debounce. Typing a nine-character meter serial issues nine requests, and there is no cancellation — responses can land out of order and render stale results against a newer query.

**Fix.** Debounce `search` by ~300 ms and abort in-flight requests with an `AbortController`.

---

### `M-05` — Summary pills initialise with fabricated numbers

**File:** `app/queue/queue-client.tsx:30`

```ts
const [stats, setStats] = useState({ needsMe: 12, blocked: 8, awaitingReview: 23, closed: 41 });
```

On first paint — and permanently, if the fetch fails — the operator sees four invented counts rendered identically to real ones. `error` is set on failure but `stats` is never reset, so a failed request leaves plausible fake numbers on screen alongside the error.

**Fix.** Initialise to `null` and render a skeleton.

---

### `M-06` — One user's identity is compiled into the product

**Files:** `app/components/AppShell.tsx:66, 110-114` and six more

```tsx
<div className="user-avatar">SS</div>
<div className="user-name">Shashwat S.</div>
<div className="user-role">Senior Analyst</div>
```

And in the query layer, embedded directly in SQL string literals:

```sql
SELECT COUNT(*) as c FROM cases WHERE assignee_email = 'SS' AND status != 'closed'
```

Also hardcoded as the actor in `evidence/route.ts:120`, `adjudicate/route.ts:18`, and `imports/[id]/commit/route.ts:24`.

**Impact.** A second analyst sees Shashwat's name in the sidebar, Shashwat's queue under "Needs me", and files their adjudications as `SS`.

---

### `M-07` — "Cohorts" navigates to one hardcoded feeder

**File:** `app/components/AppShell.tsx:31`

```ts
{ label: "Cohorts", href: "/cohorts/feeder/Lakhipur_bec", … }
```

A specific sub-division is a top-level navigation destination. There is no cohort index page.

---

### `M-08` — No confirmation on destructive or irreversible actions

Zero occurrences of `confirm(` across the UI. Adjudication — which sets case status to `in_review`, stamps `concluded_at`, and writes to the training corpus with the message *"Added to the training corpus"* — commits on a single click with no review step and no undo.

---

### `M-09` — `any` is the de facto type system

130 ESLint errors, overwhelmingly `@typescript-eslint/no-explicit-any`, concentrated in `server/store/db.ts` and the route handlers — exactly where the schema contract should be enforced. `H-05` is the concrete cost: `{} as any` silenced the error that would have caught a guaranteed runtime crash.

---

### `M-10` — Hardcoded dates discard real register data

`2026-06-16` and `2026-06-30` appear as literals across seven files. Most damaging:

```ts
const defectDate = "2026-06-16";   // app/api/imports/route.ts:79
```

The defect date is overwritten with a constant for **every** imported row, discarding whatever the register actually said. `age_days` is likewise hardcoded to `1` in `imports/[id]/commit/route.ts:24`.

---

### `M-11` — Case ID and case reference are the same value

**File:** `app/api/imports/[id]/commit/route.ts:31-32`

```ts
insertCase.run(
  r.caseRef,     // → id
  r.caseRef,     // → case_ref
  …
```

The primary key is the human-facing reference. Two registers using the same numbering collide, and a corrected case reference would require changing the primary key.

---

### `M-12` — Positional parameter extraction in the store

**File:** `server/store/db.ts:130-136`

```ts
const stat = params[params.length - 3];
```

Adding one filter to `app/api/cases/route.ts` silently shifts every other filter's value. There is no test covering combined filters.

---

### `M-13` — Two complete stylesheets, one dead

`app/globals.css` (883 lines) is imported by nothing. `app/theme-css.ts` (926 lines) is live. Both open with the identical header comment claiming *"Strict adherence to docs/FFR_BUILD_SPEC.md"*. Anyone editing styles has a coin-flip chance of editing the dead one.

---

### `M-14` — ~4,400 lines of dead code ship with the repository

| File | Lines | Inbound refs |
|---|---:|---:|
| `db/governance.ts` | 2,219 | dead subtree only |
| `app/lib/use-shared-governance.ts` | 1,521 | 0 |
| `app/globals.css` | 883 | 0 |
| `app/lib/governance-storage.ts` | 430 | 0 |
| `db/schema.ts` | 380 | 0 |

Note that `db/schema.ts` is dead *and* is the correct design (`C-07`). It should be revived, not deleted.

---

### `M-15` — Unused imports left behind by the move

`server/store/seed.ts` imports nine analysis symbols and uses none:

```
'evaluateVerdict', 'analyzeCensoredStream', 'analyzeTruncation', 'analyzeDose',
'analyzeCoincidence', 'analyzeDecoupling', 'analyzeTestimonyConflict',
'reconstructStory', 'FirstPrinciplesPatterns'  — all unused
```

Also `isPastDeath` (assigned, never read) at `seed.ts:29`, and `mechanismName` destructured but unused in `adjudicate/route.ts`.

---

### `M-16` — A failing test is committed

```
✖ Database & Queue (§4): 214 cases seeded, paginated to page 9, sparklines present
  TypeError: Cannot read properties of undefined (reading 'c')
      at tests/database-queue.test.mjs:13:68
```

A count query returns `undefined` because the mock has no branch for it. The suite has been red on `main`.

---

# 4. Low severity

| ID | Finding |
|---|---|
| `L-01` | 30 of the 37 type errors are `TS5097` — `.ts` extensions in imports without `allowImportingTsExtensions`. A two-line `tsconfig.json` fix that is burying four real errors in noise. |
| `L-02` | `TS2322` in `cohort-service.ts:101` — `direction: string` not assignable to the `"elevated" \| "depressed" \| "neutral"` union. Needs `as const`. |
| `L-03` | `TS2339` in `VoltageSparkline.tsx:110` — `.x`/`.y` on type `never`; the chart's own point type is unreachable. |
| `L-04` | Package still named `site-creator-vinext-starter`; `README.md` is the unmodified starter template. |
| `L-05` | Build artifacts in the tree: `dev.log`, `server.log`, `.ui-review-dev.*.log`, `tsconfig.tsbuildinfo` (211 KB). |
| `L-06` | Three ad-hoc screenshot scripts at the repo root (`take-screenshots.mjs`, `take-after-screenshots.mjs`, `capture-all-views.mjs`). Move to `scripts/`. |
| `L-07` | `next.config.ts` is an empty stub with a placeholder comment. |
| `L-08` | 4 inline `style={{…}}` blocks mixed with the class-based system. |
| `L-09` | `app/api/knowledge/forge/route.ts:7` defaults `caseId` to `"13644"` when the body omits it, rather than returning `400`. |

---

# 5. Remediation plan

Ordered by dependency and risk, not by file. Do not start at the top of the codebase.

## Phase 0 — Today

**1. Commit the tree.**
45 untracked files, including all of `server/`. Nothing else in this plan matters if the application exists on one laptop. Commit the working state and the governance deletion as two separate commits.

## Phase 1 — Stop asserting false things

Everything here is deletion. No new code.

**2. Remove the fixture overwrites** — `C-01`, `server/inference/pipeline.ts:231-264`. Thirty-four lines. If the real analysis no longer reproduces the expected numbers, that is the next bug to fix, and it is a real one.

**3. Remove the invented import rows** — `C-05`, `app/api/imports/route.ts:134-144`.

**4. Remove the cohort overwrites** — `C-03`. Delete the `Lakhipur_bec` block and the `baselines` literal; use `baselineRows`, which is already computed correctly.

**5. Remove the count floors** — `C-06`, `H-07`. Delete every `Math.max(3360, …)` / `Math.max(244, …)` and the demo-value sheet fallbacks. Report what was parsed.

**6. Remove the identity backdoor** — `H-06`. Delete both `.includes("AS2373952")` exemptions and change `identity?.meterId || "AS2373952"` to fail closed.

**7. Label or remove the forge** — `C-04`. Take it out of the navigation, or render it behind an unmissable `SIMULATED` banner.

**8. Fix the lying success responses** — `H-03` (return 404), `H-08` (persist the toggle or remove the control).

After Phase 1 the product does less and claims less. That is the point.

## Phase 2 — Restore real infrastructure

**9. Delete `server/store/db.ts`; connect D1.**
The schema, migrations, and bindings already exist and are good work. Point the handlers at drizzle. This closes `C-07`, `C-08`, `H-01`, `H-02`, `M-12`, and surfaces `H-04` so it can be fixed properly.

**10. Move seeding out of the request path** — `C-09`. Add `npm run db:seed`; remove all four handler calls.

**11. Make evidence real** — `C-02`. Resolve the case's evidence from storage; `409` when absent. Never read a fixture in a handler.

**12. Pick one deployment target** — `C-12`. Cloudflare. Delete `vercel.json`.

## Phase 3 — Close the security hole

**13. Fix the auth model before wiring it** — `C-11`. Remove the wildcard branch and the anonymous-admin synthesis; default the allowlist to empty; verify the identity header at the edge.

**14. Then wire it** — `C-10`. A shared route wrapper, deny by default. Order matters: `C-10` before `C-11` ships an open door with a logbook.

**15. Fix the actor chain** — `H-10`, `M-06`. Derive `author` from the session, never the body. Populate `run_id` on adjudication.

## Phase 4 — Repair the UI

**16. Resolve the CSS system** — `C-13`. Either import a real Tailwind entry stylesheet and delete the hand-rolled utilities, or drop Tailwind and finish the bespoke system. This also fixes `M-03`.

**17. Fix the checkbox crash** — `H-05`. Drop the second parameter.

**18. Replace `next/link` with `<a href>`** — `H-12`, 11 files.

**19. Remove hardcoded identity and demo routing** — `M-06`, `M-07`, `H-15`.

## Phase 5 — Consolidate and gate

**20. Delete `app/lib/` and `app/globals.css`** — `H-16`, `M-13`, `M-14`. Repoint the five stragglers at `server/`. Roughly 4,400 lines removed and the diverged-engine risk with them.

**21. Fix `tsconfig.json` first, then the four real type errors** — `L-01`, `H-18`, `H-19`, `L-02`, `L-03`.

**22. Make the gates blocking.** CI on `tsc --noEmit`, `eslint`, and `node --test`. Fix `M-16` rather than skipping it.

**23. Then start deleting `any`** — `M-09`. Not before: the type errors need to be readable first.

---

# 6. Verification appendix

Every claim in this document is reproducible from the repo root.

```bash
# Toolchain status
npx tsc --noEmit
npx eslint . --ignore-pattern dist --ignore-pattern .next
node --experimental-strip-types --test tests/*.test.mjs

# C-10 — no route checks auth
for f in $(find app/api -name route.ts); do
  echo "$(grep -c 'getGovernanceAccess\|hasGovernanceCapability\|getPlatformActor' "$f")  $f"
done

# H-16 — fork divergence
diff app/lib/verdict-engine.ts server/inference/verdict-engine.ts | grep -c '^[<>]'

# H-17 — the live backend is untracked
git ls-files server/ | wc -l

# C-13 — Tailwind emits nothing
grep -c "text-xs" dist/client/globals.css

# H-04 — the import INSERT throws
node -e "const{DatabaseSync}=require('node:sqlite');const d=new DatabaseSync(':memory:');
d.exec('CREATE TABLE imports (id TEXT PRIMARY KEY, filename TEXT, sha256 TEXT, total_rows INTEGER, new_rows INTEGER, existing_rows INTEGER, rejected_rows INTEGER, preview_rows_json TEXT, created_at TEXT)');
try{d.prepare('INSERT INTO imports (id,filename,sha256,total_rows,newRows,existing_rows,rejected_rows,preview_rows_json,created_at) VALUES (?,?,?,?,?,?,?,?,?)')}
catch(e){console.log('ERROR:',e.message)}"

# H-05 — the checkbox crash
node -e "const t=(id,e)=>{e.stopPropagation();};
try{t('13644',{})}catch(e){console.log('ERROR:',e.message)}"
```

---

# 7. The honest read

The instincts in this codebase are not bad, and it would be a mistake to conclude otherwise from the length of this document.

Someone understood that a diagnostic tool needs provenance on every claim, versioned rule bundles with lifecycle states, append-only audit history, and vendor adapters separated from the evaluator — and then designed all of it. `db/schema.ts` is genuinely well-modelled: correct unique constraints, sensible composite indexes, a clean separation between compact projections and append-only version history. `governance-auth.ts` is a clean capability system. The DLMS analysis and the first-principles pattern work is real, substantial, and covered by 26 tests that mostly pass.

What went wrong is a single repeating pattern, and it is worth naming precisely because otherwise it will recur:

> **Every time the correct path got hard, it was stubbed — and the stub shipped.**

D1 was awkward under Miniflare, so a fake SQL engine was written instead of a debugging session. The forge agent was hard, so its output became a literal. The pipeline did not reproduce the expected demo numbers, so the numbers were assigned after the fact. The importer needed test data, so it generated it inline in the production path. Auth was fiddly, so the allowlist became `"*"`.

Each was a defensible ten-minute shortcut. None were walked back. The shortcuts are now the application.

The line that got crossed is narrow but absolute. A prototype may fake anything, provided it is *obviously* fake — a stub that returns `null`, a screen that says "not implemented", a banner that says `DEMO DATA`. This codebase fakes things convincingly: a precision score to two decimals, a SHA-256, a 3,360-row profile count, a CAPA trigger at 5.9× baseline. That is the difference between an unfinished tool and a misleading one.

For software whose output could sit behind a warranty rejection, a supplier claim, or a regulatory filing, the fabrications are the finding. Everything else in this document is ordinary engineering debt, and ordinary engineering debt is fixable in an afternoon at a time.

**Phase 1 is 34 lines of deletion in one file, plus four more deletions elsewhere. Start there.**

---

*This audit assesses code and technical decisions, not any individual's competence. The architectural judgement visible in the schema and rule-governance design is well above the level of the defects catalogued here, which is itself the most useful signal in the report: this is a process and prioritisation failure, not a capability one.*
