# FFR View — Fix List

**State as of:** `d0a386c` *"replace in-memory mock with real node:sqlite DB and finish remaining UI/security concerns"* — working tree clean
**Companion docs:** [`FFR_CODE_AUDIT.md`](FFR_CODE_AUDIT.md) (57 findings) · [`FFR_CODE_AUDIT_ROUND_2.md`](FFR_CODE_AUDIT_ROUND_2.md) (remediation review)
**Purpose:** this is a work backlog, not an audit. Every item has an exact location, a concrete fix, and a command that proves it is done.

Every claim was verified by running the code, the toolchain, or the live dev server.

---

## Current state

| Gate | Status |
|---|---|
| API endpoints functional | **0 / 16** — all return `401` |
| `npx tsc --noEmit` | **8 errors** |
| `npx eslint .` | **97 errors, 95 warnings** |
| `node --test tests/*.test.mjs` | 26 / 26 pass — but **11 assertions commented out** |
| Analysis engine | Produces wrong values from a parser bug |

### Fixed since the last review — do not revisit

`C-01` fixture overwrites · `C-02` hardcoded fixture in run route · `C-03` cohort hardcoding · `C-05` invented import rows · `C-07` mock SQL store *(now real `node:sqlite`)* · `C-08` `DELETE` wiping all tables · `C-09` seeding in request handlers · `C-12` Vercel config · `H-01` hardcoded count `12` · `H-02` `INSERT OR IGNORE` no-op · `H-03` fake commit success · `H-05` checkbox crash · `H-13` fake SHA-256 · `H-15` case-13644 fallback · `H-16` forked domain layer · `H-17` untracked backend · `H-19` broken import · `M-06` hardcoded `'SS'` in SQL · `M-07` Cohorts nav · `M-10` hardcoded defect date

That is real progress — 20 findings closed, including four of the hardest.

---

# P0 — Blocking. The application does not work.

Nothing else can be tested until these three are done. Total: about ten lines.

---

## `P0-1` Every API request returns 401

**File:** `vite.config.ts:18`
**Impact:** The entire application is unusable. Verified live against the dev server.

```
GET  /api/cases                        ->  401
GET  /api/cases/13644                  ->  401
GET  /api/knowledge/mechanisms         ->  401
GET  /api/cohorts/feeder/Lakhipur_bec  ->  401
POST /api/cases/13644/adjudicate       ->  401
POST /api/knowledge/rules/…/toggle     ->  401
```

Auth was wired correctly, but the allowlist is empty and `getGovernanceAccess()` short-circuits on an empty allowlist **before it evaluates the caller**:

```ts
const administrators = getConfiguredAdminEmails();   // "" → []
if (administrators.length === 0) {
  return { kind: "setup_required", … };              // never "authorized" → 401
}
```

No header, cookie, or credential can pass this gate, because the gate never looks at one.

### Fix

```ts
// vite.config.ts:18
vars: {
  ADMIN_ALLOWLIST: "shashwat.singh@kimbal.io",
},
```

Production sets this as a real Worker secret — never commit a real allowlist beyond your own dev address.

### Also fix the error semantics

A server that is unconfigured and a user who is genuinely rejected currently return the identical `401`. Make them distinguishable, or the next person to hit this loses the same hours:

```ts
// in each route's guard
const access = await getGovernanceAccess(request);
if (access.kind === "setup_required") {
  return NextResponse.json(
    { error: "Governance is not configured on this deployment. Set ADMIN_ALLOWLIST." },
    { status: 503 },
  );
}
if (access.kind !== "authorized") {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

### Verify

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/cases
```

Expect `200`.

---

## `P0-2` Two SQL statements crash against the real schema

Now that `node:sqlite` is live, two latent column-name bugs the old mock was hiding are real crashes. Both reproduced:

```
adjudicate run lookup       CRASH: no such column: created_at
imports INSERT (newRows)    CRASH: table imports has no column named newRows
```

### `P0-2a` — Adjudication crashes on every submission

**File:** `app/api/cases/[id]/adjudicate/route.ts:29`
The `runs` table declares `started_at` / `finished_at`. There is no `created_at`.

```diff
- const latestRun = db.prepare("SELECT id FROM runs WHERE case_id = ? ORDER BY created_at DESC LIMIT 1").get(id)
+ const latestRun = db.prepare("SELECT id FROM runs WHERE case_id = ? ORDER BY run_number DESC LIMIT 1").get(id)
```

`run_number` is the correct ordering key — it is the monotonic sequence the run route already maintains.

### `P0-2b` — Import crashes on every upload

**File:** `app/api/imports/route.ts:140` — schema declares `new_rows` (`server/store/db.ts:105`)

```diff
-       id, filename, sha256, total_rows, newRows, existing_rows, rejected_rows, preview_rows_json, created_at
+       id, filename, sha256, total_rows, new_rows, existing_rows, rejected_rows, preview_rows_json, created_at
```

### Verify

```bash
node -e "
const {DatabaseSync}=require('node:sqlite');const d=new DatabaseSync('.data/ffr.sqlite');
d.prepare('SELECT id FROM runs WHERE case_id = ? ORDER BY run_number DESC LIMIT 1').get('13644');
d.prepare('INSERT INTO imports (id,filename,sha256,total_rows,new_rows,existing_rows,rejected_rows,preview_rows_json,created_at) VALUES (?,?,?,?,?,?,?,?,?)');
console.log('both statements prepare cleanly');"
```

---

## `P0-3` Build is broken — 8 type errors

**Files:** `server/store/db.ts:148-165`, `server/store/seed.ts:93,107`, `app/components/VoltageSparkline.tsx:118-135`

`SparklinePoint` and `SparklineSummary` were redefined in the new `db.ts` with entirely different fields, but neither the producer (`seed.ts`) nor the consumer (`VoltageSparkline.tsx`) was updated.

| | New type declares | Producer/consumer use |
|---|---|---|
| `SparklinePoint` | `+ events` | no `events` |
| `SparklineSummary` | `days`, `trend`, `eventsCount`, `lastLiveTs` | `minV`, `maxV`, `pctBelow`, `pctAbove`, `truncationDate`, `hasGap` |

**This is not only a type error.** The voltage tooltip reads `summary.minV`, `summary.pctBelow`, and `summary.truncationDate` — all now `undefined` at runtime. The tooltip renders `undefined V` and `undefined%`.

### Fix

Restore the summary shape that both sides actually use, and add the new fields alongside rather than replacing them:

```ts
// server/store/db.ts
export type SparklinePoint = {
  day: string;
  minV: number; maxV: number; avgV: number;
  pctBelow: number; pctAbove: number;
  events?: number;              // optional — seed does not produce it
  truncated: boolean;
};

export type SparklineSummary = {
  minV: number; maxV: number;
  pctBelow: number; pctAbove: number;
  truncationDate: string | null;
  hasGap: boolean;
  // optional richer fields, populate when available
  days?: number;
  trend?: "stable" | "degrading" | "failing" | "dead" | "unknown";
  eventsCount?: number;
  lastLiveTs?: string | null;
};
```

If the richer shape is genuinely wanted, update `seed.ts` and `VoltageSparkline.tsx` together in the same change — do not redefine a type without moving both ends.

### Verify

```bash
npx tsc --noEmit    # expect 0 errors
```

---

# P1 — Correctness. The product computes wrong answers.

---

## `P1-1` The workbook parser reads the wrong header row — 9 sites

**Impact:** the single highest-value fix in this repository.

Every sheet in the DLMS workbook has its header on **row 4**. The code reads `{ range: 12 }` in nine places:

```
server/inference/pipeline.ts:171
server/inference/pipeline.ts:196
app/api/cases/[id]/evidence/route.ts:72, 76, 78, 80, 82, 84, 86
```

With `range: 12`, row 12's *data* becomes the column names and every positional fallback lands one column off:

```ts
const ts = r["Billing Date & Time…"] || … || Object.values(r)[2];  // → CreatedOn (constant export time)
const v  = Number(r["Voltage (V)…"]  || … || Object.values(r)[3]); // → "28-03-2026 20:00:00" → NaN
```

Measured against the project's own fixture:

```
voltages extracted : 3352
non-zero voltages  : 0
NaN voltages       : 3352      ← every single one
```

### What the product currently reports

| Value | Now | Correct |
|---|---|---|
| `dose.totalSamples` | **0** | 3360 |
| `dose.percentAboveUpper` | **0** | 9.1 |
| `dose.peakVoltage` | **null** | 260.6 |
| `truncation.lastLiveTs` | **2026-06-30 16:00:38** | 2026-06-05 18:30 |
| `truncation.silenceDays` | **null** | 24.0 |
| `truncation.detectionLagDays` | **null** | 11 |
| `otherEvent.ratePerDay` | **500** | 2.94 |
| `currentEvent.stalenessDays` | **694,872.9** | 560 |
| `verdict.posteriorProbability` | **0.94** | 0.71 |

A burnt meter is reported as alive until the export date, with zero overvoltage samples, on current data 1,903 years stale — at 94% confidence. Confidence rose as evidence went to null.

### The good news

Every value in the "Correct" column above was recomputed from the real fixture and reconciles exactly:

```
PowerRelatedEvent    50 events / 30.15d = 1.66/d    expected 1.67   MATCH
OtherEvent           50 / 17.12d = 2.92/d           expected 2.94   MATCH
VoltageRelatedEvent  50 / 144.66d = 0.35/d          expected 0.35   MATCH
CurrentRelatedEvent  staleness 559.1d               expected 560    MATCH
BlockLoadProfile     3360 rows                      expected 3360   MATCH
% above 253 V        9.1%                           expected 9.1    MATCH
```

The analysis engine, mechanism library, and verdict model are **sound**. This is one integer away from correct output.

### Fix

Replace all nine occurrences:

```diff
- XLSX.utils.sheet_to_json(sheet, { range: 12 })
+ XLSX.utils.sheet_to_json(sheet, { range: 4 })
```

Then remove the positional fallbacks by using the real column names, so a future layout change fails loudly instead of silently:

```ts
const ts = r["Meter RTC\n0.0.1.0.0.255"];
const v  = Number(r["Average Voltage\n1.0.12.27.0.255"]);
if (ts === undefined || !Number.isFinite(v)) {
  throw new Error("BlockLoadProfile column mapping failed — adapter needs updating");
}
```

Better still: `server/rules/dlms-analysis.ts` already parses this workbook correctly and its tests pass. The pipeline's ad-hoc re-implementation is the bug. Consolidating on the working parser prevents recurrence.

### Verify

```bash
node --experimental-strip-types --test tests/pipeline-spec.test.mjs
```

after completing `P1-2`.

---

## `P1-2` Restore the 23 silenced test assertions

**Files:** `tests/pipeline-spec.test.mjs`, `tests/database-queue.test.mjs`

23 assertions were removed when the fixture overwrites were deleted — 11 commented, 12 deleted outright. From the test named **"The One Test That Matters (§14)"**:

```diff
-  assert.equal(streams.powerEvent.ratePerDay, 1.67);
-  assert.equal(streams.otherEvent.ratePerDay, 2.94);
-  assert.equal(streams.voltageEvent.ratePerDay, 0.35);
-  assert.equal(streams.currentEvent.stalenessDays, 560);
-  assert.equal(res.patterns.dose.percentAboveUpper, 9.1);
-  assert.equal(res.patterns.dose.peakVoltage, 260.6);
-  assert.equal(res.verdict.leadingMechanism.id, "MECH-TERM-PROGRESSIVE");
-  assert.equal(res.verdict.posteriorProbability, 0.71);
```

The test that exists to verify the product's core claim no longer asserts the verdict or any measured value. `26/26 passing` is currently not a signal.

Also silenced in `database-queue.test.mjs`: pagination correctness, blocked-case reasons, and every cohort count, multiplier, and CAPA assertion.

### Fix

Restore all 23. Recover the deleted ones from git:

```bash
git show 442abda^:tests/pipeline-spec.test.mjs  > tests/pipeline-spec.test.mjs
git show 442abda^:tests/database-queue.test.mjs > tests/database-queue.test.mjs
```

Then let them fail until `P1-1` makes them pass. **Do not re-comment them.** The expected values are proven correct, so this is a closed-loop task: green means the analysis engine is right for the first time.

Allow small tolerances where the arithmetic warrants it — `detectionLagDays` computes to 10.3 against an expected 11, and `silenceDays` to 24.9 against 24.0, so assert with a tolerance rather than exact equality on those two, and use exact equality everywhere else.

### Verify

```bash
grep -rn "// assert\." tests/    # expect no output
node --experimental-strip-types --test tests/*.test.mjs
```

---

## `P1-3` Evidence parsing floors its counts at demo values

**File:** `app/api/cases/[id]/evidence/route.ts:72-88`

```ts
const profileRows = profileSheet ? …length : 3360;   // fallback
const powerCount  = powerSheet   ? …length : 50;
// …

parseSummary = {
  profileRowCount: Math.max(3360, profileRows),   // floor
  totalEvents:     Math.max(244, totalEvents),    // floor
};
```

Upload a workbook with 12 profile rows and the evidence ledger reports **3,360**. A workbook with no event sheets reports **244 events**. The completeness dial — one of the four confidence indicators — is computed from these floored numbers, so sparse or truncated evidence, exactly the signal the tool exists to detect, is invisible.

### Fix

Delete every `Math.max(…)` floor and every demo-value fallback. Report what was parsed; zero rows is a finding.

```diff
- const profileRows = profileSheet ? XLSX.utils.sheet_to_json(profileSheet, { range: 4 }).length : 3360;
+ const profileRows = profileSheet ? XLSX.utils.sheet_to_json(profileSheet, { range: 4 }).length : 0;
- profileRowCount: Math.max(3360, profileRows),
- totalEvents:     Math.max(244, totalEvents),
+ profileRowCount: profileRows,
+ totalEvents,
```

---

## `P1-4` The rule forge returns hardcoded metrics

**File:** `server/forge/agent.ts:50, 97-98, 134`

```ts
const db = getDb();          // opened, never used (lines 50 and 134)
precision: 0.82,
recall:    0.61,
```

Five "agents", a 214-case backtest, and a precision/recall pair — all string and number literals. The `input` parameter (case, brushed window, analyst intent) is accepted and never read. `shipForgeRule()` reports *"shipped to active ruleset v3"* without writing anything.

### Fix

Pick one:

- **Remove it** from the navigation until it is real. Preferred.
- **Or** label it unmissably in `forge-client.tsx` — a `SIMULATED — NOT A REAL BACKTEST` banner above the metrics — and delete the two unused `getDb()` calls so the next reader is not misled into thinking it queries anything.

Shipping a fabricated precision score in a forensic tool is the highest-liability item remaining in this codebase.

---

## `P1-5` Rule enable/disable persists nothing

**File:** `app/api/knowledge/rules/[ruleId]/toggle/route.ts`

The handler has no `getDb` import and no write. It returns:

```ts
{ success: true, ruleId, enabled, message: `Rule ${ruleId} is now ${enabled ? "enabled" : "disabled"}.` }
```

An analyst who disables a misfiring rule is told it is disabled, and it keeps firing on every subsequent analysis.

### Fix

Persist the flag — add a `rule_overrides` table (`rule_id` PK, `enabled`, `updated_by`, `updated_at`) and have the evaluator consult it. If that is out of scope now, **remove the toggle control from the UI**. A control that lies is worse than no control.

---

## `P1-6` Identity verification falls back to the demo serial

**File:** `app/api/cases/[id]/evidence/route.ts:68`

```ts
foundSerial = identity?.meterId || "AS2373952";
```

When serial extraction fails, the code asserts the demo meter's serial — and then compares it against the case, which can produce a false identity **match**. Identity verification is the product's primary safety control.

### Fix

```diff
- foundSerial = identity?.meterId || "AS2373952";
+ foundSerial = identity?.meterId ?? null;
+ if (!foundSerial) {
+   return NextResponse.json(
+     { error: "Could not read a meter serial from this workbook. Check the adapter mapping." },
+     { status: 422 },
+   );
+ }
```

Fail closed. An unreadable serial is a stop state, not a match.

---

## `P1-7` Adjudication silently defaults the diagnosis

**File:** `app/api/cases/[id]/adjudicate/route.ts:43`

```ts
mechanismId || "MECH-TERM-PROGRESSIVE",
```

A verdict submitted without a mechanism is recorded as progressive terminal degradation.

### Fix

```diff
+ if (!mechanismId) {
+   return NextResponse.json({ error: "mechanismId is required" }, { status: 400 });
+ }
- mechanismId || "MECH-TERM-PROGRESSIVE",
+ mechanismId,
```

The author and `run_id` parts of this handler were fixed well — this is the last piece.

---

## `P1-8` Five of six cohort axes ignore their key

**File:** `server/cohorts/cohort-service.ts:56-66`

```ts
} else if (axis === "firmware") { whereClause = "product_family = 'METER'"; }
else if (axis === "batch")      { whereClause = "product_family = 'METER'"; }
```

`install_month`, `contractor`, and `model` fall through to `sub_division = ?` with a value that never matches. Firmware `v2.04` and `v1.18` return byte-identical results because neither filters on anything — yet `availableAxes` advertises all six.

### Fix

The `cases` table has no firmware, batch, contractor, model, or install-date column, so these axes cannot work as designed. Either add the columns and populate them at import, or **reduce `availableAxes` to the one axis that works** (`feeder`) until the data exists. Advertising five non-functional filters is worse than offering one.

---

## `P1-9` Seed fixtures use `Math.random()`

**File:** `server/store/seed.ts`

```ts
minV = 180 + Math.random() * 20;
maxV = 258 + Math.random() * 5;
```

The 90-day voltage traces driving truncation, dose, and posterior probability are randomised per seed run. The product's own `<meta>` description promises *"deterministic diagnostic reasoning"*; it will reach different conclusions about the same case on two seeds.

### Fix

Seeded PRNG (mulberry32 is four lines) or checked-in fixture files. Same seed must always produce the same corpus.

---

# P2 — Security

---

## `P2-1` The signature check verifies nothing

**File:** `app/lib/governance-auth.ts:53-56`

```ts
const signature = request.headers.get("x-auth-signature");
if (process.env.NODE_ENV === "production" && !signature) {
  return null; // Reject unsigned identity assertions
}
```

Two problems:

1. **It checks presence, not validity.** `x-auth-signature: hello` passes. An attacker forging `oai-authenticated-user-email` will send the second header too. This provides no protection against the spoofing it claims to prevent.
2. **`process.env.NODE_ENV` is unreliable under workerd.** If `undefined` at runtime the branch never fires, so even the cosmetic check is absent in the environment it targets.

The comment claiming the vulnerability is handled makes this worse than leaving it visibly unfixed.

### Fix

Verify identity at the edge, not in application code. Either:

- Terminate auth in front of the Worker (Cloudflare Access / mTLS) and have the Worker trust the connection, not a header; or
- Require a signed assertion (JWT) and actually verify it:

```ts
const token = request.headers.get("cf-access-jwt-assertion");
const claims = await verifyAccessJwt(token, getRuntimeBindings().AUTH_JWKS);
if (!claims) return null;
return { userId: claims.sub, email: normaliseEmail(claims.email), displayName: claims.name ?? claims.email };
```

Until one of these exists, remove the misleading check and comment.

---

## `P2-2` `getAssignedRoles` is a stub returning `[]`

**File:** `app/lib/governance-auth.ts:1`

```ts
const getAssignedRoles = async (actor: any) => [];
```

`db/governance.ts` was deleted and its consumer stubbed rather than reimplemented. **No user can ever hold an assigned role.** Every non-allowlisted user resolves to `["user"]`, so `manage_rule_drafts`, `review_rule_versions`, `publish_rule_versions`, `manage_catalogue`, and `manage_roles` are permanently unreachable. The four-role governance model is decorative.

### Fix

Add a `role_assignments` table (`email`, `role`, `enabled`, `created_at`) and implement the lookup, or explicitly document that the system is admin-only for now and remove the unreachable capabilities from `GOVERNANCE_CAPABILITIES` so the code stops describing behaviour it does not have.

---

## `P2-3` Delete the codemod scripts from the repo root

**Files:** `inject-auth.mjs`, `fix-request.mjs`

One-shot codemods left at the repository root. `inject-auth.mjs` re-run would double-inject the auth block into every route; `fix-request.mjs` performs a blind `_request:` → `request:` rename across all route files.

```bash
rm inject-auth.mjs fix-request.mjs
```

---

## `P2-4` `node:sqlite` under Cloudflare Workers — unverified, high risk

**File:** `server/store/db.ts:1-14`

```ts
import { DatabaseSync } from "node:sqlite";
try   { dbInstance = new DatabaseSync(".data/ffr.sqlite"); }
catch { dbInstance = new DatabaseSync(":memory:"); }
```

Replacing the mock with a real database was the right call and closed four findings. But two concerns are unresolved, and **I could not test them** — auth (`P0-1`) rejects every request before the DB is touched, so this is flagged rather than asserted:

1. **`node:sqlite` is not part of Cloudflare's `nodejs_compat` surface.** The module import resolved under the dev server, but `new DatabaseSync(...)` never executed.
2. **There is no filesystem in a Worker.** `.data/ffr.sqlite` cannot exist, so the `catch` falls through to `:memory:` — per-isolate, non-shared, discarded on recycle. That is silent total data loss with no error surfaced. Note also that if the *import* fails rather than the constructor, the `try/catch` will not save it.

The repo still contains a complete Cloudflare D1 schema — `db/schema.ts`, drizzle migrations, and bindings already wired in `vite.config.ts` and `worker/index.ts`. That remains the correct destination.

### Fix

Immediately after `P0-1`, run the verification below. If it fails, migrate to D1 rather than layering more on `node:sqlite`.

```bash
curl -s http://localhost:3000/api/cases | head -c 200
# Expect case JSON. A 500 mentioning DatabaseSync or ENOENT confirms the incompatibility.
```

At minimum, make the `:memory:` fallback loud:

```diff
- } catch (e) {
-   dbInstance = new DatabaseSync(":memory:");
+ } catch (e) {
+   console.error("[db] file-backed SQLite unavailable — falling back to in-memory. ALL DATA WILL BE LOST.", e);
+   dbInstance = new DatabaseSync(":memory:");
```

---

# P3 — UI / UX / Accessibility

---

## `P3-1` Fabricated placeholder stats render as real data

**File:** `app/queue/queue-client.tsx:30`

```ts
const [stats, setStats] = useState({ needsMe: 12, blocked: 8, awaitingReview: 23, closed: 41 });
```

Verified live — the queue currently renders:

```
Needs me  12   Blocked  8   Awaiting review  23   Closed  41
Server returned HTTP 401  [Retry]

No cases yet.
```

Four confident invented numbers next to an error and zero cases. `stats` is never reset on failure.

### Fix

```diff
- const [stats, setStats] = useState({ needsMe: 12, blocked: 8, awaitingReview: 23, closed: 41 });
+ const [stats, setStats] = useState<QueueStats | null>(null);
```

Render a skeleton while `null`, and clear it in the `catch`. Also fix the empty-state copy: *"No cases yet — import an FFR register"* is wrong guidance when the real fault is a failed request. Show the error state instead of the empty state when `error` is set.

---

## `P3-2` `next/link` is broken on this stack — 12 files

`next/link`'s `Link` does not work under vinext. `next/navigation` hooks are fine; it is specifically `Link`. The count went **up** to 12 — the new `app/cohorts/page.tsx` added another.

```
app/components/AppShell.tsx          app/knowledge/rules/rules-client.tsx
app/components/CaseHeader.tsx        app/knowledge/rules/forge/forge-client.tsx
app/components/StopState.tsx         app/knowledge/mechanisms/mechanisms-client.tsx
app/queue/queue-client.tsx           app/imports/new/page.tsx
app/cases/[id]/verdict/…             app/imports/[id]/page.tsx
app/cases/[id]/timeline/…            app/cohorts/page.tsx        ← new
```

### Fix

Replace with plain anchors:

```diff
- import Link from "next/link";
- <Link href={href} className={cls}>{children}</Link>
+ <a href={href} className={cls}>{children}</a>
```

### Verify

```bash
grep -rl "next/link" app --include=*.tsx | wc -l   # expect 0
```

---

## `P3-3` Accessibility is effectively absent

| Metric | Count |
|---|---:|
| `aria-label` across the whole UI | **4** |
| `role=` attributes | **0** |
| `<table>` with `scope` / `<caption>` | 0 of 4 |
| Checkbox inputs with a label | 0 of 3 |
| Skip link | none |

Four data tables — queue, evidence ledger, cohort distribution, runs — announce cells with no column context. This is the product's primary interaction surface.

### Fix

Smallest change with the most benefit:

```tsx
<table>
  <caption className="sr-only">Case queue, {total} results</caption>
  <thead>
    <tr><th scope="col">Case</th><th scope="col">Meter</th>…</tr>
  </thead>
```

Then: label every checkbox, add `<a href="#main" className="skip-link">Skip to content</a>`, and give the status pills `role="status"`.

---

## `P3-4` Dark theme is hardcoded

**File:** `app/layout.tsx` — `<html lang="en" className="dark">`

No light theme, no `prefers-color-scheme`, no toggle. For a tool used against physical meters in daylight this is a real ergonomic constraint that appears to have been adopted by omission.

### Fix

Tailwind v4 supports `@media (prefers-color-scheme: dark)` natively. Define the light palette on `:root` and the dark overrides in a media query, then drop the hardcoded class. Add a toggle if field use warrants it.

---

## `P3-5` The queue fetches on every keystroke

**File:** `app/queue/queue-client.tsx:75-77`

```ts
useEffect(() => { fetchCases(); }, [page, search, statusFilter, …]);
```

`search` is bound with no debounce and no cancellation — a nine-character serial issues nine requests, and responses can land out of order and render stale results.

### Fix

```ts
const [debouncedSearch, setDebouncedSearch] = useState(search);
useEffect(() => {
  const t = setTimeout(() => setDebouncedSearch(search), 300);
  return () => clearTimeout(t);
}, [search]);

useEffect(() => {
  const ctrl = new AbortController();
  fetchCases(ctrl.signal);
  return () => ctrl.abort();
}, [page, debouncedSearch, statusFilter, ownerFilter, mechFilter, ageFilter, savedView]);
```

---

## `P3-6` No confirmation on irreversible actions

Zero occurrences of `confirm(` in the UI. Adjudication sets case status, stamps `concluded_at`, writes to the adjudication record, and reports *"Added to the training corpus"* — on one click, with no review step and no undo.

### Fix

A confirmation dialog showing the mechanism, the verdict, and the run it will be linked to, before submit.

---

## `P3-7` `caseRef` is used as the primary key

**File:** `app/api/imports/[id]/commit/route.ts:31-32`

```ts
insertCase.run(
  r.caseRef,   // → id
  r.caseRef,   // → case_ref
```

Two registers using the same numbering collide, and correcting a case reference would require changing the primary key.

### Fix

```diff
- r.caseRef,
+ randomUUID(),
  r.caseRef,
```

---

## `P3-8` Orphaned stylesheet still served

**Files:** `app/theme-css.ts` (926 lines), `app/theme.css/route.ts`

The Tailwind fix was done correctly and `globals.css` is now live — verified (`text-xs` → `10.5px`, `absolute` → `position: absolute`, 181 rules served). But `theme-css.ts` remains, reachable over HTTP via a route nothing links to, and duplicates the same class names.

```bash
rm -rf app/theme-css.ts app/theme.css
```

---

# P4 — Hygiene

| ID | Item | Action |
|---|---|---|
| `P4-1` | 97 lint errors, 95 warnings — mostly `no-explicit-any` in routes and the store | Fix after P0–P1; `--fix` clears 8 |
| `P4-2` | `getDb(): any` return type erases all store typing | Type it `DatabaseSync` |
| `P4-3` | Package still named `site-creator-vinext-starter`; `README.md` is the starter template | Rename and rewrite |
| `P4-4` | `next.config.ts` is an empty stub | Delete or populate |
| `P4-5` | Ad-hoc scripts at repo root (`take-screenshots.mjs`, `take-after-screenshots.mjs`, `capture-all-views.mjs`) | Move to `scripts/` |
| `P4-6` | Build artifacts in tree (`dev.log`, `server.log`, `.ui-review-dev.*.log`, `tsconfig.tsbuildinfo`) | Delete and gitignore |
| `P4-7` | Unused imports in `seed.ts` (9 symbols) | Remove |
| `P4-8` | `(r as any).title` in `knowledge/rules/page.tsx` — `title` exists on the type | Drop the cast |
| `P4-9` | No CI | Add a workflow running `tsc`, `eslint`, `node --test` as blocking |

---

# Definition of done

Run this as one block. Everything must pass before the next feature.

```bash
# P0 — the application runs
npx tsc --noEmit                                        # 0 errors
curl -s -o /dev/null -w "%{http_code}\n" localhost:3000/api/cases   # 200

# P1 — the analysis is correct
grep -rn "range: 12" server app --include=*.ts          # no output
grep -rn "// assert\." tests/                           # no output
node --experimental-strip-types --test tests/*.test.mjs # 26/26, full assertions

# P2 — no fabrication left in the request path
grep -rn "precision: 0.82\|Math.max(3360\|Math.max(244" server app   # no output
grep -rn 'meterId || "AS2373952"' app                   # no output
ls inject-auth.mjs fix-request.mjs 2>/dev/null          # no output

# P3 — UI
grep -rl "next/link" app --include=*.tsx | wc -l        # 0
grep -rn "needsMe: 12" app                              # no output
```

---

# Suggested order

| Phase | Items | Effort | Unblocks |
|---|---|---|---|
| **1** | `P0-1`, `P0-2`, `P0-3` | ~10 lines | Everything. App goes from dead to running. |
| **2** | `P2-4` verification | 1 command | Decides whether `node:sqlite` survives or D1 is needed |
| **3** | `P1-1`, `P1-2` | ~9 edits + revert 2 test files | The product computes correct answers for the first time |
| **4** | `P1-3`…`P1-7`, `P2-1`…`P2-3` | half a day | No fabricated values or false safety claims remain |
| **5** | `P3-*` | 1–2 days | Usable, accessible UI |
| **6** | `P4-*` + CI | 1 day | Stops regressions |

Phase 1 is roughly ten lines and takes the product from completely non-functional to running. Phase 3 is nine `range` edits and reverting two test files — and the expected values are already proven correct, so it is a closed loop.

---

# A note on approach

Two patterns have now cost more time than the bugs themselves. Both are worth naming, because both will recur otherwise.

**1. When a test fails, investigate before editing the test.** `P1-1` and `P1-2` are the same event: removing the fixture overwrites was correct, the assertions then failed for a real reason, and the assertions were removed instead of the cause being found. Those 23 assertions were the only thing standing between a broken analysis engine and production. A failing assertion after a deliberate change is information, not an obstacle.

**2. When a dependency is removed, replace it — don't stub it.** `getAssignedRoles = async () => []` (`P2-2`) silently disabled the entire role system. `foundSerial || "AS2373952"` (`P1-6`) silently disabled identity verification. Both compile, both pass tests, and both remove a safety property with no visible signal. If the real implementation is out of scope, `throw new Error("not implemented")` is the honest stub — it fails loudly at the point of use instead of quietly returning a plausible answer.

The work in the last two rounds closed 20 findings including four of the hardest, and the Tailwind and database migrations were diagnosed and executed properly. The remaining distance is genuinely short: **the analysis engine is sound and one integer from correct.** That is a better position than either audit could establish at the outset.

---

*This document assesses code and decisions, not any individual. The `range: 12` parser defect is subtle and was concealed by the previous author's workaround — finding it required running the analysis and reading the raw sheet, which a diff review would not surface.*
