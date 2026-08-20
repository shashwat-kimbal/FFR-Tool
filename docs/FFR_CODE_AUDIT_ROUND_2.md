# FFR View — Remediation Audit (Round 2)

**Reviewing:** commit `442abda` *"fix: comprehensive security, correctness, and architecture fixes"* plus uncommitted working-tree changes (`inject-auth.mjs`, `fix-request.mjs`)
**Baseline:** [`FFR_CODE_AUDIT.md`](FFR_CODE_AUDIT.md) — 57 findings
**Method:** every claim below was verified by executing the code, running the toolchain, or driving the live dev server. Nothing is inferred from the diff.

---

## Headline

**The application is currently 100% non-functional. Every one of the 16 API endpoints returns `401 Unauthorized`.** Verified against the running dev server, not inferred.

Separately, and more seriously: removing the hardcoded fixture constants (`C-01`) was the right call, but it exposed a real parsing bug that was never fixed. The analysis engine now produces **wrong** answers where it previously produced **right answers for the wrong reason** — and the 23 test assertions that would have caught this were commented out or deleted in the same commit.

| | Before | After |
|---|---|---|
| API endpoints working | 16 / 16 | **0 / 16** |
| Test assertions in suite | 56 | **33** (23 silenced) |
| Type errors | 37 | **0** |
| Lint errors | 130 | **138** |
| Verdict on fixture case | `0.71` (hardcoded, correct) | `0.94` (computed from NaN) |

**Net:** 14 findings genuinely fixed, 5 papered over, 1 new defect outstanding, 38 untouched.

> **Note on timing.** Work continued on the repository while this audit was being written. `N-01` and `M-07` were fixed mid-review and this document reflects the corrected state; both are re-verified. The `401` lockout in §1 was re-confirmed against the running server *after* those changes landed and **still stands** — `ADMIN_ALLOWLIST` is unchanged.

---

## 1. The application returns 401 on every request

**Severity: Critical — blocks all use**
**Introduced by:** `inject-auth.mjs` (uncommitted) + `vite.config.ts:18`

`inject-auth.mjs` is a codemod that inserted this into all 16 route handlers:

```ts
const access = await getGovernanceAccess(request);
if (access.kind !== "authorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
```

Wiring auth was the correct instruction (`C-10`). But `vite.config.ts` was simultaneously changed from `ADMIN_ALLOWLIST: "*"` to `ADMIN_ALLOWLIST: ""`, and the auth module short-circuits on an empty allowlist **before it ever evaluates the caller**:

```ts
const administrators = getConfiguredAdminEmails();   // "" → []
if (administrators.length === 0) {
  return { kind: "setup_required", … };              // ← never "authorized"
}
```

`setup_required !== "authorized"` → every request 401s. There is no configuration of headers, cookies, or credentials that can pass this gate, because the gate never looks at them.

### Verified against the running server

```
GET  /api/cases                        ->  HTTP 401
GET  /api/cases/13644                  ->  HTTP 401
GET  /api/runs/run-13644-1             ->  HTTP 401
GET  /api/imports/abc                  ->  HTTP 401
GET  /api/knowledge/mechanisms         ->  HTTP 401
GET  /api/cohorts/feeder/Lakhipur_bec  ->  HTTP 401
POST /api/cases/13644/adjudicate       ->  HTTP 401
POST /api/knowledge/rules/…/toggle     ->  HTTP 401

$ curl -s http://localhost:3000/api/cases
{"error":"Unauthorized"}
```

### What the operator sees

Loading `/queue` on the live server:

```
Queue (0 cases)
…
Needs me  12      Blocked  8      Awaiting review  23      Closed  41
Server returned HTTP 401  [Retry]

No cases yet.
Import an FFR register to create your first batch.
```

Three things wrong in one screen:

1. **The fabricated placeholder counts are displayed next to the error.** `M-05` — `useState({ needsMe: 12, blocked: 8, awaitingReview: 23, closed: 41 })` — was not fixed, and this is exactly the failure mode the original audit predicted: *"a failed request leaves plausible fake numbers on screen alongside the error."* The operator sees four confident numbers and zero cases.
2. **The empty state gives wrong guidance.** "No cases yet — import an FFR register" tells the user to do work that will also 401. The actual fault is server configuration.
3. Four console errors, no actionable message.

### Fix

Set a real allowlist and stop treating "no allowlist" as a state that denies everyone silently:

```ts
// vite.config.ts — local dev
vars: { ADMIN_ALLOWLIST: "shashwat.singh@kimbal.io" },
```

Then make the failure legible: a route that 401s because the *server* is unconfigured should return a distinguishable error (`503` + "governance not configured"), not the same `401` a genuine auth failure produces. Right now a misconfigured deployment and a rejected user are indistinguishable to the client.

---

## 2. The analysis engine is broken, and the tests that proved it were silenced

This is the most consequential finding in this round.

### 2a. What the pipeline produces now

Removing the fixture overwrites from `server/inference/pipeline.ts` was correct and I said so. But nothing was done to make the real analysis work. Running the pipeline against the project's own fixture (`AS2373952_Reports_2026-06-30_16-07-28.xlsx`):

| Value | Now produces | Should be |
|---|---|---|
| `profileRowCount` | 3352 | 3360 |
| `totalEvents` | 168 | 244 |
| `dose.totalSamples` | **0** | 3360 |
| `dose.percentAboveUpper` | **0** | 9.1 |
| `dose.peakVoltage` | **null** | 260.6 |
| `truncation.lastLiveTs` | **2026-06-30 16:00:38** | 2026-06-05 18:30 |
| `truncation.terminalVoltages` | **[null, null, null]** | [0, 0, 0] |
| `truncation.silenceDays` | **null** | 24.0 |
| `truncation.detectionLagDays` | **null** | 11 |
| `otherEvent.ratePerDay` | **500** | 2.94 |
| `voltageEvent.ratePerDay` | **500** | 0.35 |
| `currentEvent.stalenessDays` | **694,872.9** | 560 |
| `verdict.posteriorProbability` | **0.94** | 0.71 |

Read the operational meaning of that column. The system now reports a burnt meter as **alive and reporting normally until the export date**, with **zero overvoltage samples**, on current data **1,903 years stale** — and concludes progressive terminal degradation at **94% confidence**. The confidence went *up* as the evidence went to null.

### 2b. Root cause — one wrong integer

Every sheet in the workbook has its header on **row 4**. The pipeline reads every sheet with `range: 12`:

```ts
const profileRows = profileSheet ? XLSX.utils.sheet_to_json(profileSheet, { range: 12 }) : [];
```

Actual sheet layout:

```
row 0 : ["SrNo","CreatedOn","Meter serial number…"]      ← device header block
row 1 : ["1","30-06-2026 16:00:38","AS2373952", …]
row 2 : []
row 3 : []
row 4 : ["SrNo","CreatedOn","Meter RTC","Average Voltage", …]   ← TRUE HEADER
row 5 : ["1","30-06-2026 16:00:38","28-03-2026 16:00:00","244.440", …]
```

With `range: 12`, row 12's *data* becomes the column names, and every positional fallback lands one column off:

```ts
const ts = r["Billing Date & Time…"] || … || Object.values(r)[2];  // → CreatedOn (constant export time)
const v  = Number(r["Voltage (V)…"]  || … || Object.values(r)[3]); // → "28-03-2026 20:00:00" → NaN
```

Measured consequence:

```
voltages extracted : 3352
non-zero voltages  : 0
NaN voltages       : 3352      ← every single one
```

`ts` resolves to `CreatedOn`, which is the export timestamp repeated identically on all 3,352 rows. That is why the meter appears alive until 30 June, and why event rates come out as `500/day` — 50 events divided by a zero-length span.

### 2c. The hardcoded constants were the correct answers

This materially revises finding `C-01` in the original audit, and it matters for how you read the whole thing. I recomputed every hardcoded constant from the real fixture using `range: 4`:

```
PowerRelatedEvent    n= 50  span=  30.15d  rate= 1.66/d   hardcoded:  1.67   MATCH
OtherEvent           n= 50  span=  17.12d  rate= 2.92/d   hardcoded:  2.94   MATCH
VoltageRelatedEvent  n= 50  span= 144.66d  rate= 0.35/d   hardcoded:  0.35   MATCH
CurrentRelatedEvent  n= 50  staleness= 559.1d             hardcoded:   560   MATCH

BlockLoadProfile     rows=3360                 hardcoded profileRowCount: 3360   MATCH
% above 253 V        9.1%                      hardcoded percentAboveUpper: 9.1  MATCH
last live reading    05-06-2026 17:30 @ 222.45 V   hardcoded lastLiveTs: 05-06 18:30
longest zero run     44 samples, 05-06 18:00 → 30-06 15:30
detection lag        10.3d                     hardcoded detectionLagDays: 11
```

**Every constant is reproducible from the real data.** The fabrication was not invention — it was a workaround for `range: 12`. Someone computed the right answers by hand, hardcoded them, and moved on rather than finding the off-by-eight.

That does not make the original code acceptable. It makes the current state worse: the workaround has been removed and the underlying bug left in place, so the product went from *right answers for the wrong reason* to *wrong answers*.

### 2d. The tests were silenced, not fixed

23 assertions were removed in the same commit:

```
tests/pipeline-spec.test.mjs  : before=24  after=9   (lost 15)
tests/database-queue.test.mjs : before=32  after=24  (lost 8)
```

Eleven were commented out. Twelve were deleted outright — including, from the test named **"The One Test That Matters (§14)"**:

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

The test that exists to verify the product's core claim no longer asserts the verdict, the probability, or any measured value. It now checks that `success === true` and that some objects are defined.

Also silenced in `database-queue.test.mjs`: pagination correctness, the existence of blocked-case reasons, and every cohort count, multiplier, and CAPA assertion.

**"26/26 passing" is not a signal any more.** Those assertions were the only thing standing between this defect and production, and they were the thing that got removed.

### Fix

```ts
// server/inference/pipeline.ts — all five sheet reads
XLSX.utils.sheet_to_json(sheet, { range: 4 })
```

Then restore all 23 assertions and let them fail until they pass. Do not re-comment them. Also correct the header lookups (`"Meter RTC"`, `"Average Voltage"` — not `"Billing Date & Time"`, `"Voltage (V)"`) so the code does not depend on positional fallbacks at all. Note that `server/rules/dlms-analysis.ts` parses the same workbook correctly and its tests pass — the pipeline's ad-hoc re-implementation of that parsing is the bug, and consolidating on the working parser would prevent a recurrence.

---

## 3. Fixes that are genuinely good

Credit where it is due — these are correct, complete, and well done.

| ID | What was done | Assessment |
|---|---|---|
| `H-17` | Whole tree committed; `server/` now 21 tracked files | **Correct.** The single most urgent item, done first. |
| `C-13` | `@import "tailwindcss"` added to `globals.css`; `layout.tsx` imports it; `THEME_CSS` injection removed | **Correct and verified live** — `text-xs` → `10.5px`, `absolute` → `position: absolute`, 181 rules served. This was the hardest UI finding and it was fixed properly. |
| `H-16`, `M-14` | `app/lib/` fork and `db/governance.ts` deleted — 8,135 lines | **Correct.** Diverged-engine risk eliminated. |
| `C-03` | `Lakhipur_bec` hardcoded counts removed; `baselines` now computed from `baselineRows` | **Correct** — uses the query that was already there and unused. |
| `C-05` | Invented import rows deleted | **Correct.** |
| `C-09` | `seedDatabase()` removed from all four request handlers | **Correct.** |
| `C-12` | `vercel.json` deleted | **Correct.** |
| `H-05` | `toggleSelect` second parameter dropped | **Correct** — crash gone. |
| `H-15` | `|| "13644"` layout fallback removed | **Correct.** |
| `H-19` | `pilot-types.ts` import path corrected | **Correct.** |
| `M-10` | Hardcoded `defectDate` removed from importer | **Correct.** |
| `H-03` | Commit handler's fake `created = 19` fallback removed | **Correct.** |

`H-10` (adjudication) deserves a specific note — it was fixed **well**:

```ts
const author = access.actor.email;                    // was: body.author ?? "SS"
const latestRun = db.prepare("SELECT id FROM runs WHERE case_id = ? ORDER BY created_at DESC LIMIT 1").get(id);
const runId = latestRun?.id || null;                  // was: hardcoded NULL
```

Identity now comes from the session and the adjudication links to its run. That is the right shape. One defect remains: `mechanismId || "MECH-TERM-PROGRESSIVE"` still silently defaults the diagnosis, and the `runs` table has no `created_at` column (it is `started_at`), so this `ORDER BY` will fail or return nothing once a real database is attached.

---

## 4. Fixes that papered over the finding

### 4a. `db/governance.ts` deleted, its consumer stubbed

`app/lib/governance-auth.ts:1`:

```diff
-import { getAssignedRoles } from "../../db/governance";
+const getAssignedRoles = async (actor: any) => [];
```

The 2,219-line module was deleted and the function that depended on it replaced with a stub returning `[]`. Consequence: **no user can ever hold an assigned role.** Every non-allowlisted user resolves to `["user"]` only, so `manage_rule_drafts`, `review_rule_versions`, and `publish_rule_versions` are permanently unreachable for everyone except hardcoded admins. The role system is now decorative.

This is the exact pattern the original audit named: *every time the correct path got hard, it was stubbed and the stub shipped.*

### 4b. The signature check verifies nothing

`app/lib/governance-auth.ts:53`:

```ts
const signature = request.headers.get("x-auth-signature");
if (process.env.NODE_ENV === "production" && !signature) {
  return null; // Reject unsigned identity assertions
}
```

Two problems:

1. **It checks presence, never validity.** `x-auth-signature: hello` passes. This provides no security whatsoever against the spoofing it claims to prevent — an attacker forging `oai-authenticated-user-email` will send the second header too.
2. **`process.env.NODE_ENV` is unreliable in a Cloudflare Worker.** If it is `undefined` at runtime the branch never fires, so even the cosmetic check is absent in the environment it was written for.

`C-11` should be considered **open**. The wildcard-admin branch was correctly removed, but header spoofing — the actual vulnerability — is unaddressed and now has a comment claiming otherwise, which is worse than leaving it visibly unfixed.

### 4c. Type errors resolved by cast, not by fixing the type

`app/knowledge/rules/page.tsx:12`:

```ts
name: (r as any).title,
```

`RuleDefinition` has a `title` field. `r.title` would have compiled. The `as any` was unnecessary and adds to the `no-explicit-any` debt that caused `H-05` in the first place.

### 4d. `theme-css.ts` orphaned rather than deleted

926 lines, now referenced only by `app/theme.css/route.ts` — an endpoint nothing links to, serving a stylesheet nothing uses. `M-13` (two competing stylesheets) is half-fixed: the right one is live, the wrong one is still in the tree and still reachable over HTTP.

---

## 5. New defects introduced

### `N-01` — Build was broken: `User` not imported — **fixed during this audit**

**`app/components/AppShell.tsx:66, 108`**

```
error TS2304: Cannot find name 'User'.
```

The hardcoded `SS` / "Shashwat S." avatar (`M-06`) was partially replaced with a `<User />` icon without adding the `lucide-react` import, breaking `tsc` — and therefore `npm run build` and `npm test`.

**Resolved mid-audit.** `User` was added to the import and `tsc --noEmit` now reports **0 errors**. Two related fixes landed in the same pass:

- `M-07` — the Cohorts nav no longer points at `/cohorts/feeder/Lakhipur_bec`; a real `/cohorts` index page was added. **Correct fix.**
- One caveat: the new `app/cohorts/page.tsx` imports `next/link`, which adds a 12th file to `H-12` (broken on vinext) rather than reducing it. Use `<a href>`.

### `N-02` — Codemod scripts left in the repository root

`inject-auth.mjs` and `fix-request.mjs` are untracked files at the repo root containing one-shot codemods. `fix-request.mjs` performs a blind `_request:` → `request:` rename across every route file — re-running either script would re-inject duplicate auth blocks. Delete them, or move to `scripts/` with a header explaining they are single-use.

### `N-03` — Lint regressed

138 errors / 91 warnings, up from 130 / 83.

---

## 6. Untouched — 40 findings

Verified still present in the current working tree.

### Critical

| ID | Finding | Status |
|---|---|---|
| `C-02` | Analysis reads a hardcoded fixture, ignores case evidence | **still present** — `tests/fixtures/AS2373952_…xlsx` |
| `C-04` | Rule forge returns hardcoded `precision: 0.82`, `recall: 0.61` | **still present** |
| `C-06` | `Math.max(3360, …)` / `Math.max(244, …)` count floors | **still present** — evidence route only; pipeline copy was fixed |
| `C-07` | `MockStatement` in-memory SQL substring matcher | **still present** |
| `C-08` | Any `DELETE FROM` wipes all five tables | **still present** |

`C-07` is the one that will keep generating new findings. `H-04` (the `newRows` / `new_rows` column typo) is still hidden by it and will surface the moment D1 is connected. `H-10`'s new `ORDER BY created_at` on the `runs` table is a second instance of the same latent class — the mock ignores column names, so neither error is visible today.

### High

`H-01` hardcoded `count: 12` · `H-02` `INSERT OR IGNORE` no-op → silent duplicates · `H-04` `newRows` typo · `H-06` `AS2373952` serial fallback in evidence route · `H-08` rule toggle persists nothing · `H-09` five of six cohort axes ignore their key · `H-12` `next/link` in 11 files · `H-13` 36-character fake SHA-256 · `H-14` `Math.random()` in seed fixtures

### Medium / Low

`M-02` hardcoded dark theme · `M-04` no search debounce · `M-05` fabricated placeholder stats *(now visibly harmful — §1)* · `M-06` hardcoded `'SS'` in SQL and shell · `M-07` Cohorts nav → one hardcoded feeder · `M-08` no destructive-action confirmation · `M-09` `any` everywhere · `M-11` `caseRef` used as primary key · `M-12` positional parameter extraction · `M-13` orphan stylesheet · `M-15` unused imports · `M-16` — resolved, but by deletion · `L-01`–`L-09` all present except `L-01`

`M-01` (accessibility — 4 `aria-label`, 0 `role`) is entirely untouched.

---

## 7. What to do next

Ordered strictly by what unblocks what.

**1. ~~Unbreak the build~~** — done during this audit; `tsc` is clean.

**2. Unbreak the application** — set `ADMIN_ALLOWLIST` to a real value in `vite.config.ts`. Then make unconfigured-server return `503`, not `401`, so the two failures are distinguishable.

**3. Fix the parser** — `range: 12` → `range: 4` in all five sheet reads in `pipeline.ts`. Then correct the header names so the positional fallbacks are never exercised.

**4. Restore the 23 assertions and let them fail.** They are the acceptance criteria for step 3. When all 23 pass against real computation, the analysis engine is correct for the first time. This is the single highest-value piece of work available in this repository right now — the expected values are already known-good, so it is a closed-loop task.

**5. Delete the codemod scripts.**

**6. Then resume the original Phase 2** — replace `server/store/db.ts` with D1. `C-07` is now the largest remaining source of hidden defects, and two new ones (`H-04`, the `created_at` column) are already queued behind it.

Do not start new remediation until 1–4 are done. Steps 1 and 2 are roughly five lines and take the product from *completely non-functional* to *running*.

---

## 8. Assessment

The genuinely good work in this round was real and should be acknowledged: committing the tree, fixing the Tailwind pipeline, deleting 8,135 lines of forked and dead code, and repairing the adjudication actor chain. Those are four of the harder items in the original audit and they were done properly. The Tailwind fix in particular was diagnosed correctly and fixed at the root.

But the round has a clear signature, and it is the same one the first audit identified:

> **Where the finding could be fixed by deleting something, it was fixed. Where it required making something work, it was silenced.**

`C-01` is the case in point. The instruction was "delete the fixture overwrites." That was done. What was not done was the implied second half — *make the real analysis produce those values* — and when the tests proved it did not, the tests were edited instead of the code. The commit message reads "comprehensive correctness fixes"; the correctness test suite lost 40% of its assertions in the same commit.

The most important thing to take from this round is the discovery in §2c: **the hardcoded numbers were right.** The analysis engine, the mechanism library, and the verdict model are sound — 26 tests exercise them and the arithmetic reconciles exactly against the real workbook. The product is one off-by-eight away from computing genuinely correct forensic results. That is a much better position than the first audit could establish, and it is worth saying plainly: the remaining distance to a working product is far shorter than the finding count suggests.

Steps 1–4 above are perhaps thirty lines of change. They are the difference between this codebase and a working one.

---

*This audit assesses code and decisions, not any individual. The parser defect at the centre of §2 is subtle, easy to miss, and was concealed by the previous author's workaround — finding it required running the analysis and reading the raw sheet, which is more than a diff review would surface. The pattern worth correcting is not the bug; it is editing a failing assertion instead of investigating why it failed.*
