# FFR — Build Specification

**This document is the app.** Build exactly what is described here. Nothing in it is a suggestion.

---

## 0. Before you write any code

### 0.1 Start clean

Create a new project. Do **not** open, import from, or adapt the existing `app/` directory. There is nothing in it to reuse at the UI layer.

You may copy exactly these files, unchanged, into the new project:

| Copy | To | Why |
|---|---|---|
| `app/lib/dlms-analysis.ts` | `server/rules/` | Rule evaluation. Good code. Runs on the server now. |
| `app/lib/workbook-parser.ts` | `server/ingest/` | Workbook parsing. Runs on the server now. |
| `rules/bundles/generic-provisional-v1.json` | `server/rules/bundles/` | The 60 rule definitions |
| `config/*.json` | `server/config/` | Adapter and contract definitions |
| `tests/fixtures/*.xlsx` | `tests/fixtures/` | **The ground truth. Test everything against these.** |

Do **not** copy: any `page.tsx`, any file in `app/components/`, `app/globals.css`, `use-shared-governance.ts`, or anything under `app/api/governance/`.

### 0.2 Non-negotiable rules

1. **Parsing and analysis run on the server.** The browser never opens a workbook. `xlsx` must not appear in the client bundle.
2. **Uploading a file never triggers analysis.** They are two separate user actions with two separate buttons.
3. **No page scrolls past ~2,000 px.** If a screen needs more, it needs tabs.
4. **Every async region shows a skeleton shaped like its final content.** Never a spinner, never a "Loading…" sentence.
5. **No screen contains more than one paragraph of explanatory text.** Explanations live behind a `[?]` popover.
6. **The app works at 1280, 1024, and 768 px.** Verify at all three before calling anything done.
7. **No governance lifecycle.** No draft/review/release/rollback UI. It does not exist in this product.
8. **No LLM at analysis time.** Analysis is `f(evidence, ruleset@v, mechanisms@v)` and must be byte-identical on re-run.

### 0.3 Background

Read `FFR_FIRST_PRINCIPLES.md` once for context on *why* the inference stack is shaped this way. Then build from this document. If the two disagree on a screen, this document wins.

---

## 1. What the app is for

A returned electricity meter arrives with a customer complaint. The app decides, from the meter's own recorded data, **why it failed** — and routes that answer to a warranty decision, a quality decision, and a cohort exposure question.

Three users:

| User | Does | Lives on |
|---|---|---|
| **Analyst** | Clears returns. 20–40 a day. | Queue, Case |
| **Quality engineer** | Confirms causes, raises CAPA | Cohort, Case |
| **Domain expert** | Owns the failure-mode library, teaches new rules | Knowledge |

---

## 2. Route map

```
/                              → redirect /queue
/queue                         Screen 1 · Work queue
/imports/new                   Flow F1 · Upload a register
/imports/:id                   Flow F1 · Reconciliation preview
/cases/:id                     → redirect /cases/:id/verdict
/cases/:id/verdict             Screen 2A · Verdict            [default]
/cases/:id/timeline            Screen 2B · Timeline instrument
/cases/:id/evidence            Screen 2C · Evidence
/cases/:id/runs                Screen 2D · Run history
/cases/:id/report              Screen 2E · RCA report
/cohorts/:axis/:key            Screen 3  · Cohort
/knowledge/mechanisms          Screen 4A · Mechanism library
/knowledge/rules               Screen 4B · Rule library
/knowledge/rules/forge         Screen 4C · Rule forge
```

Nine routes. That is the whole application.

---

## 3. Application shell

```
┌─ 248px ────┬──────────────────────────────────────────────────────┐
│            │  page header                                    64px │
│  KIMBAL    │──────────────────────────────────────────────────────│
│            │                                                      │
│  ▸ Queue   │  page content                                        │
│  ▸ Cohorts │  max-width 1440, centred, 24px gutters               │
│  ▸ Know…   │                                                      │
│            │                                                      │
│  ─────     │                                                      │
│  SS  ▾     │                                                      │
└────────────┴──────────────────────────────────────────────────────┘
```

- Rail: 248 px, `position: fixed`, dark. Three items. No descriptions under the labels. No notes, no chips, no caveats in the rail.
- Page header: 64 px, sticky. Left = page title or case identity. Right = the single primary action for that screen.
- **Responsive:**

| Width | Rail | Behaviour |
|---|---|---|
| ≥ 1280 | 248 px fixed | Full layout |
| 1024–1279 | 64 px, icons only | Tooltips on hover |
| < 1024 | Off-canvas drawer | Hamburger in header. `.app-shell` sets `flex-direction: column`. Content is never pushed off-screen. |

Test at 768 px on every screen. If content is not visible, it is not done.

---

## 4. Screen 1 — Queue

**Purpose:** answer "what needs me, and what is blocking it," in under three seconds.
**Default route.** This is the app's home.

### 4.1 Layout

```
┌────────────────────────────────────────────────────────────────────────────┐
│ Queue                                              [ Import register ]     │ 64
├────────────────────────────────────────────────────────────────────────────┤
│ ⌕ case ref, meter serial     Status▾  Owner▾  Mechanism▾  Age▾   Views▾    │ 52
├────────────────────────────────────────────────────────────────────────────┤
│  ▌12 Needs me   ▌8 Blocked   ▌23 Awaiting review   ▌41 Closed              │ 56
├────────────────────────────────────────────────────────────────────────────┤
│ ☐ CASE   METER      COMPLAINT    VOLTAGE      LEADING CAUSE   CONF  STATUS │
│ ☐ 13644  AS2373952  Burnt        ▁▃▅▂▁✕──     Terminal deg.   ▓▓▓░  ●Draft │
│ ☐ 13643  AS2373110  Display def. ▃▄▄▃▄▄▃▄     Grid overvolt.  ▓▓░░  ●Draft │
│ ☐ 13640  AS2371882  No comms     ▁▁▁────      —               ░░░░  ○Open  │
│                                                                            │
│                                          Blocker shown inline when present │
├────────────────────────────────────────────────────────────────────────────┤
│ 1–25 of 214                                              ‹ 1 2 3 … 9 ›     │
└────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Columns — exactly these, in this order

| # | Column | Format | Notes |
|---|---|---|---|
| 1 | select | checkbox | Enables bulk assign / export |
| 2 | Case | mono, 600 | Click anywhere in row to open |
| 3 | Meter | mono | Old / defective serial |
| 4 | Complaint | code + label | `METER:B · Meter burnt` |
| 5 | **Voltage** | **sparkline 88×24** | Last 90 days. Red where below band, amber above, grey where no data, `✕` at truncation |
| 6 | Leading cause | text + family chip | `—` if not yet analysed |
| 7 | Confidence | 4 micro-bars | Never a percentage. Order: completeness, discrimination, provenance, cohort |
| 8 | Status | pill | See 4.3 |
| 9 | Blocker | text, `--muted` | Only rendered when status is Blocked. Otherwise the cell is empty, not `—` |
| 10 | Owner | initials chip | Unassigned = dashed outline |
| 11 | Age | days, tabular-nums, right | Red if > 14 |

The sparkline is **required**, not a nice-to-have. It is what makes this a diagnostic queue rather than a list. It renders from stored daily aggregates — never by parsing a workbook in the browser.

### 4.3 Status values

```
○ Open              imported, no evidence attached
◐ Evidence ready    evidence attached, not yet analysed
● Analysed          verdict computed, awaiting adjudication
⛔ Blocked          identity mismatch or missing evidence — blocker column populated
◑ In review         adjudicated by analyst, awaiting quality
✓ Closed            concluded and exported
```

### 4.4 States

| State | Render |
|---|---|
| Loading | 8 skeleton rows with correct column widths, including a grey sparkline block |
| Empty — no cases | Centred: "No cases yet." · "Import an FFR register to create your first batch." · `[ Import register ]` |
| Empty — filters exclude all | "No cases match these filters." · `[ Clear filters ]` |
| Error | Inline banner above the table. Last-good data stays visible. `[ Retry ]` |

### 4.5 Interactions

- Row click → `/cases/:id/verdict`
- Sparkline hover → tooltip: min V, max V, % below band, truncation date
- Bulk select → header bar swaps to `n selected · [ Assign ] [ Export ]`
- **Saved views** in the `Views▾` menu: *Needs me* (default), *Blocked > 7 days*, *High confidence, unadjudicated*, *All*

### 4.6 Acceptance criteria

- [ ] 214 seeded cases; page 9 is reachable; pagination is server-side
- [ ] Search by meter serial returns in < 300 ms
- [ ] Sparklines render without any workbook parsing in the browser
- [ ] Every Blocked row states its blocker in words
- [ ] At 768 px the table becomes a card list; nothing is clipped
- [ ] Skeleton rows are visible on a throttled connection

---

## 5. Screen 2 — Case

### 5.1 The sticky header — present on all five tabs

```
┌────────────────────────────────────────────────────────────────────────────┐
│ ‹ Queue    13644    ● ANALYSED · draft verdict          [ Adjudicate ▾ ]   │
│ AS2373952 → SC10231275 · METER:B Meter burnt · Lakhipur_bec               │
│ died 5 Jun 18:30 · reported 16 Jun · 11-day lag · 76 days old             │
├────────────────────────────────────────────────────────────────────────────┤
│  Verdict │ Timeline │ Evidence 3 │ Runs 4 │ Report                         │
└────────────────────────────────────────────────────────────────────────────┘
```

96 px, sticky, always visible. The user must never scroll and lose track of which meter they are looking at.

Right-hand action changes with status:

| Status | Primary action |
|---|---|
| Open | `[ Attach evidence ]` → Evidence tab |
| Evidence ready | `[ Run analysis ]` |
| Blocked | `[ Resolve ]` → stop state |
| Analysed | `[ Adjudicate ▾ ]` |
| In review / Closed | `[ Export ▾ ]` |

### 5.2 Tab A — Verdict `/cases/:id/verdict` · default

Four stacked bands. Total height ≈ 1,600 px. Nothing else on this tab.

```
┌────────────────────────────────────────────────────────────────────────────┐
│ ① LEADING CAUSE                                                            │
│                                                                            │
│   Progressive supply-terminal degradation             [ INSTALLATION ]     │
│   ████████████████████░░░░░░░░  0.71                                       │
│                                                                            │
│   Contact resistance at an incoming terminal rises, heats, intermittently  │
│   opens under load, then fails fully.                              [ ? ]   │
│                                                                            │
│   Completeness ▓▓▓░   Discrimination ▓▓░░   Provenance ▓▓░░   Cohort ░░░░  │
│                                                                            │
│   ┌──────────────────────────────────────────────────────────────────┐    │
│   │ NEXT BEST TEST                                                    │    │
│   │ Feeder cohort — power-failure rate 31 May–5 Jun across 38 meters  │    │
│   │ expected shift LARGE · cost: seconds        [ Run this now → ]    │    │
│   └──────────────────────────────────────────────────────────────────┘    │
├────────────────────────────────────────────────────────────────────────────┤
│ ② ALTERNATIVES                                                             │
│   Overvoltage thermal stress          GRID          0.19   ▸               │
│   SMPS component defect               PRODUCT       0.07   ▸               │
│   No fault found                      NO-FAULT      0.02   ▸               │
│   ▸ expands to that mechanism's own ledger                                 │
├────────────────────────────────────────────────────────────────────────────┤
│ ③ WHAT HAPPENED                                                            │
│   28 Mar   Recording begins. 9.1% of samples above 253 V.                  │
│    9 May   First zero-voltage samples appear.                              │
│   19 May   Low-PF event buffer saturates — 50 events in 17 days.           │
│   31 May   Power-failure buffer saturates — 50 events in 30 days.          │
│    1 Jun   Three event streams converge within 24 hours.                   │
│  ▸ 5 Jun   18:30 — last record, 0 V.        TIME OF DEATH                  │
│   16 Jun   Field reports the defect.        11-DAY DETECTION LAG           │
│   29 Jun   Depot power-up. Still 0 V. Not a recovery.                      │
│   Each line links to the timeline at that moment.                          │
├────────────────────────────────────────────────────────────────────────────┤
│ ④ EVIDENCE LEDGER                                                          │
│   [ Supports 5 ]  [ Against 1 ]  [ Gaps 2 ]  [ Passed 34 ]                 │
│                                                                            │
│   ▾ Power-failure rate escalating          LR 6.0    P-PWR-ESC             │
│       measured   1.67/day over final 30 days (buffer saturated)            │
│       source     PowerRelatedEvent!C14:C63          ← blue                 │
│   ▾ Truncation at zero volts               LR 8.0    P-TRUNC-0V            │
│       measured   last 3 samples 0 V, 5 Jun 18:30                           │
│       source     BlockLoadProfile!C3348:D3350       ← blue                 │
│   ▾ Voltage threshold from fallback        LR 1.0    GAP                   │
│       ⚠ nominal 230 V assumed — MeterConfiguration had no rated voltage    │
│                                                     ← amber                │
└────────────────────────────────────────────────────────────────────────────┘
```

**Rules for this tab:**

- The posterior bar is the only large number. No other percentage appears anywhere.
- Confidence is **four bars, never one number.** Hovering each explains what would improve it.
- Every ledger row expands to: measured value → the observation that produced it → the sheet and cell range. Three clicks maximum from verdict to spreadsheet cell.
- Evidence colour: **blue** = read from a cell · **teal** = calculated · **amber** = assumed or fallback · **grey dashed** = missing. These four colours mean nothing else anywhere in the app.
- If no run exists yet, the whole tab is replaced by a single centred block: "No analysis yet." + `[ Run analysis ]`.

### 5.3 Tab B — Timeline `/cases/:id/timeline`

The instrument. Full width, ~640 px tall.

```
┌────────────────────────────────────────────────────────────────────────────┐
│ [ Voltage ] [ Current ] [ Power factor ]        28 Mar ──────── 30 Jun  ⟳  │
├────────────────────────────────────────────────────────────────────────────┤
│ 260 ┤ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  amber band (>253)      │
│     │  ╱╲    ╱╲      ╱╲                                                    │
│ 230 ┤─╱──╲──╱──╲────╱──╲───────────────────────────  nominal (assumed ⚠)   │
│     │      ╲╱    ╲──╱    ╲╱╲                                               │
│ 207 ┤ ░░░░░░░░░░░░░░░░░░░░░░╲░░░░░░░░░░░░░░░░░░░░░░  amber band (<207)     │
│   0 ┤                        ╰──────✕                                      │
│     └──┬──────┬──────┬──────┬──────┬──────┬──────┬──                       │
│      28Mar  11Apr  25Apr  9May  23May  ✕5Jun  16Jun⚑  30Jun                │
│                                                                            │
│ voltage  ▪    ▪  ▪      ▪▪   ▪                        ← event lanes        │
│ power                          ▪▪▪▪▪▪▪▪▪▪▪▪▪                              │
│ low PF                    ▪▪▪▪▪▪▪▪▪▪▪▪                                    │
│ current  (no events in 18 months)                                          │
├────────────────────────────────────────────────────────────────────────────┤
│ Drag to select a window.     ✕ truncation   ⚑ defect reported              │
└────────────────────────────────────────────────────────────────────────────┘
```

- Series switcher: voltage / current / power factor
- Threshold bands as shaded regions. If the band came from a fallback, label it `assumed` in amber.
- **Event lanes** below the chart, one per stream. A lane whose buffer is saturated shows a `⟨` at its left edge meaning "earlier events lost."
- `✕` at truncation. `⚑` at the FFR defect date. Both labelled.
- **Brush a window** → floating action bar: `[ Explain this window ]` · `[ Teach a rule from this ]` (→ Flow F5)
- Hover → crosshair with timestamp and value

At < 1024 px the chart stays full width and the event lanes collapse into a single combined lane.

### 5.4 Tab C — Evidence `/cases/:id/evidence`

```
┌────────────────────────────────────────────────────────────────────────────┐
│ Evidence                                          [ Attach files ]         │
├────────────────────────────────────────────────────────────────────────────┤
│ 📊 AS2373952_Reports_2026-06-30.xlsx                          DLMS · old   │
│    1.2 MB · sha256 9b3ac41f…0d4d5df2 · SS · 19 Aug 14:01                   │
│    16 sheets · 3,360 profile rows · 244 events · meter AS2373952           │
│                                                              [ Preview ]   │
│ 🖼 burn_terminal_01.jpg                                      IMAGE         │
│    2.1 MB · sha256 4d1e…8b2a · SS · 19 Aug 14:03                           │
├────────────────────────────────────────────────────────────────────────────┤
│  Evidence is attached. Nothing has been analysed yet.                      │
│                                              [ Run analysis → ]            │
└────────────────────────────────────────────────────────────────────────────┘
```

Attaching a file **never** starts an analysis. The `[ Run analysis ]` button is the only thing that does.

### 5.5 Tab D — Runs `/cases/:id/runs`

```
RUN 4   19 Aug 14:02   ruleset v3 · mechanisms v2   terminal-deg 0.71   ● current
RUN 3   12 Aug 09:15   ruleset v2 · mechanisms v2   terminal-deg 0.64
RUN 2   04 Aug 16:40   ruleset v2 · mechanisms v1   grid-ov      0.51
RUN 1   28 Jul 11:22   ruleset v1 · mechanisms v1   inconclusive  —

☑ Run 4  ☑ Run 2                                        [ Compare → ]
```

Compare view: side-by-side ledgers, changed rows highlighted, with the reason (`ruleset v2→v3: P-PWR-ESC added`).

Re-running must always be possible — the workbook is stored server-side, not held in browser memory.

### 5.6 Tab E — Report `/cases/:id/report`

The 16-field RCA structure from `FFR_PRODUCT_ARCHITECTURE_SPEC.md` §14, prefilled from the verdict. Each field shows its evidence type (direct / inferred / contradictory / unavailable). Empty deeper fields render as `Not established from available evidence` — never blank, never invented.

Actions: `[ Export FFR IG ]` · `[ Export PDF ]` · `[ Send to quality ]`

### 5.7 Stop state — replaces tabs A and B entirely

When identity does not match, the Verdict and Timeline tabs render **only this**. No findings, no partial analysis, no "review anyway" link.

```
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                            │
│   ⛔  This report is for a different meter                                 │
│                                                                            │
│   Workbook contains      AS2373110                                         │
│   Case 13644 expects     AS2373952   defective / old                       │
│                          SC10231275  replacement / new                     │
│                                                                            │
│   File   AS2373110_Reports_2026-06-30.xlsx · 1.2 MB                         │
│          sha256 9b3ac41f…0d4d5df2                                          │
│                                                                            │
│   [ Attach the correct report ]      [ Correct the serial on this case ]   │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

Two actions. Nothing else on the screen.

---

## 6. Screen 3 — Cohort `/cohorts/:axis/:key`

**Purpose:** confirm or kill a mechanism using the population. A single case proposes; only the cohort confirms.

```
┌────────────────────────────────────────────────────────────────────────────┐
│ Cohort · Feeder Lakhipur_bec · 38 returns          [ Change axis ▾ ]       │
├────────────────────────────────────────────────────────────────────────────┤
│ MECHANISM DISTRIBUTION                    vs BASELINE                      │
│ ████████████████ Terminal degradation 27  71%   baseline 12%   ▲ 5.9×      │
│ ████ Grid overvoltage                  6  16%   baseline 22%   ▼           │
│ ██ SMPS defect                         3   8%   baseline 31%   ▼           │
│ █ No fault found                       2   5%                              │
├────────────────────────────────────────────────────────────────────────────┤
│ ⚑ Terminal degradation is 5.9× baseline in this cohort.                    │
│   Potentially related — not confirmed.            [ Raise CAPA ]           │
├────────────────────────────────────────────────────────────────────────────┤
│ [ table of the 38 cases, same columns as the Queue ]                       │
└────────────────────────────────────────────────────────────────────────────┘
```

Axes: feeder · firmware · manufacturing batch · install month · contractor · model. Dimensions come from `FFR_PRODUCT_ARCHITECTURE_SPEC.md` §16.1.

Never label a population "affected." Use "potentially related" until a human confirms — §16.3.

---

## 7. Screen 4 — Knowledge

### 7.1 Mechanisms `/knowledge/mechanisms`

List + detail. Each mechanism is a YAML-backed record owned by a domain engineer: narrative, signature (requires / supports / contradicts / disqualifiers), discriminators, confirmations, routes. Schema in `FFR_FIRST_PRINCIPLES.md` Part VI.

Detail view shows: `used in 214 runs · leading in 61 · adjudicated correct in 52 (85%)`.

### 7.2 Rules `/knowledge/rules`

```
⌕ search 60 rules      Group▾  Status▾              [ Teach a new rule ]
┌──────────────────────────────┬─────────────────────────────────────────┐
│ DLMS-PRF-009           on    │ Low profile voltage excursion    ● HIGH  │ sticky
│ DLMS-EVT-004           on    │ ─────────────────────────────────────── │
│ P-PWR-ESC              on    │ Detects │ Fixtures 3 │ Impact           │
│ P-TRUNC-0V             on    │                                         │
│                              │ fires on 34/214 · precision 0.82        │
└──────────────────────────────┴─────────────────────────────────────────┘
```

The detail panel is **sticky**. Enabled state is a neutral toggle, never an amber badge.

### 7.3 Forge `/knowledge/rules/forge`

Reached from `[ Teach a new rule ]` or from a timeline brush.

```
┌─ WHAT YOU'RE LOOKING FOR ──────────┬─ CANDIDATE ────────────────────────┐
│                                    │ pattern    power_failure_rate      │
│ From case 13644 · voltage          │ window     30d before truncation   │
│ 1 Jun 00:00 → 6 Jun 00:00          │ threshold  1.5 /day                │
│ [ thumbnail of the brushed window ]│            ← p92 of corpus         │
│                                    │                                    │
│ Describe what matters here:        │ BACKTEST                           │
│ ┌────────────────────────────────┐ │ fires on      34 of 214            │
│ │ power failures accelerating    │ │ precision     0.82                 │
│ │ right before the log stops     │ │ recall        0.61                 │
│ └────────────────────────────────┘ │ verdicts changed  6  [ review ]    │
│                                    │                                    │
│ AGENT                              │ FIXTURES                           │
│ › Grounded to 3 existing features. │ ✓ positive  13644                  │
│ › Threshold set from p92, not      │ ✓ negative  13643                  │
│   invented.                        │ ✗ boundary  13701 — expected pass  │
│ › 6 stored verdicts change.        │                                    │
│   Review before shipping.          │ [ Reject ]  [ Approve & ship ]     │
└────────────────────────────────────┴────────────────────────────────────┘
```

The analyst never writes JSON. The agent proposes; a human approves. The agent may author rules and patterns — never mechanisms, never verdicts.

---

## 8. Flows

### F1 · Import a register

| # | User does | System shows |
|---|---|---|
| 1 | `[ Import register ]` from Queue | Drop zone. One file. |
| 2 | Drops `FFR_IG_Aug2026.xlsx` | `Uploading… 1.4 MB` then `Reading…` |
| 3 | — | **Reconciliation preview** (below) |
| 4 | `[ Create 19 cases ]` | `Creating… 19 of 19` → Queue, filtered to the new batch, toast `19 cases created` |

```
Import · FFR_IG_Aug2026.xlsx · sha256 4a1c…82ef
24 rows found      19 new      4 already imported      1 rejected

✓ 13650  AS2374001  Meter burnt         will create
✓ 13651  AS2374002  Display defective   will create
⊘ 13644  AS2373952  Meter burnt         exists — imported 6 Aug   [ open ]
✗ 13652  —          Meter dead          rejected: Old_Meter_Number is empty

                                        [ Cancel ]  [ Create 19 cases ]
```

**Idempotent on `(registerHash, rowNumber)`.** Re-importing the same file creates nothing and says so. Never create a duplicate case.

### F2 · Attach evidence and run analysis

| # | User does | System shows |
|---|---|---|
| 1 | Case → Evidence → `[ Attach files ]` | File picker |
| 2 | Selects DLMS workbook | `Uploading… 1.2 MB` → `Reading…` |
| 3 | — | `16 sheets · 3,360 profile rows · 244 events · meter AS2373952` — **facts, immediately** |
| 4 | — | Identity check runs first. Mismatch → **F3**, stop. |
| 5 | `[ Run analysis ]` | The pipeline (below) |
| 6 | — | Redirect to Verdict tab. Toast: `Run 4 complete · 5 findings support terminal degradation` |

```
✓ File read           16 sheets · 1.2 MB · sha256 9b3ac41f…
✓ Adapter matched     BCS 16-sheet v1
✓ Identity            AS2373952 = case 13644 defective meter
✓ Features derived    3,360 profile rows → 41 features
⣷ Rules evaluating    38 / 60 · ruleset v3 · 1.4s
○ Patterns
○ Hypotheses
                                                        [ Cancel ]
```

Every step shows real state. No step is marked complete because a boolean flipped.

### F3 · Identity mismatch

Triggered at F2 step 4. Renders §5.7. Two exits only: attach the correct file, or correct the serial. Case status becomes `Blocked`, blocker = `Identity mismatch`, and it appears in the Queue's Blocked strip.

### F4 · Adjudicate

| # | User does | System shows |
|---|---|---|
| 1 | `[ Adjudicate ▾ ]` from the case header | Menu: Confirm leading · Choose different · Inconclusive |
| 2 | Confirms | Optional note field, `[ Confirm ]` |
| 3 | — | Status → `In review`. Toast: `Adjudicated. Added to the training corpus.` |

Adjudication is **one click and always available.** Every adjudication becomes a labelled case that the forge backtests against. A product that does not close this loop stops improving.

### F5 · Teach a rule from a timeline selection

| # | User does | System shows |
|---|---|---|
| 1 | Brushes 1–6 Jun on the Timeline | Floating bar: `[ Explain this ] [ Teach a rule from this ]` |
| 2 | `[ Teach a rule from this ]` | Forge, pre-loaded with the selection |
| 3 | Types "power failures accelerating right before the log stops" | Agent grounds to features, drafts a candidate, backtests |
| 4 | Reviews the 6 changed verdicts | Side-by-side before/after |
| 5 | `[ Approve & ship ]` | Rule live. Toast: `P-PWR-ESC shipped. 6 cases re-queued for review.` |

---

## 9. Data contracts

```ts
GET  /api/cases?status=&owner=&q=&cursor=&limit=25
     → { cases: CaseRow[], nextCursor, total }

GET  /api/cases/:id            → { case, meters, evidence[], latestRun }
POST /api/imports              → multipart file        → { importId, preview }
POST /api/imports/:id/commit   → { created: 19, skipped: 4 }
POST /api/cases/:id/evidence   → multipart file        → { evidence, parseSummary, identity }
POST /api/cases/:id/runs       → {}                    → { runId } + SSE progress
GET  /api/cases/:id/runs       → { runs: RunSummary[] }
GET  /api/runs/:id             → { verdict, ledger, timeline, patterns, observations }
GET  /api/cases/:id/series?channel=voltage&from=&to=   → { points[], bands, events[], truncation }
POST /api/cases/:id/adjudicate → { mechanismId, note } → { case }
GET  /api/cohorts/:axis/:key   → { distribution, baseline, cases[] }
```

**The client never receives a workbook.** `/series` returns downsampled points ready to plot.

### Database — the parts that must exist

```sql
cases        id, case_ref, register_hash, register_row, status, blocked_reason,
             assignee_email, priority, meter_old, meter_new, complaint_key,
             product_family, created_at, concluded_at, closed_at
             UNIQUE (register_hash, register_row)      ← prevents duplicates

evidence     id, case_id, kind, role, filename, sha256, size, storage_key,
             parse_summary_json, uploaded_by, uploaded_at

runs         id, case_id, evidence_hash, ruleset_v, mechanisms_v, adapter_v,
             status, started_at, finished_at

meter_reading  meter_id, run_id, ts, channel, value, quality, source_ref
meter_event    meter_id, run_id, ts, code, class, saturated, payload, source_ref
observation    run_id, rule_id, status, value, unit, source_refs
pattern        run_id, pattern_id, window_start, window_end, magnitude, evidence
hypothesis     run_id, mechanism_id, prior, posterior, ledger, confidence_dials
adjudication   run_id, mechanism_id, verdict, note, by, at
```

`source_ref` on every reading and event = sheet + cell range. That is how a chart point traces back to a spreadsheet cell.

`saturated` on `meter_event` is one boolean that fixes censoring blindness across all sixteen event streams. **Do not omit it.**

---

## 10. Design tokens

```css
/* type — 7 roles, floor is 11px, body is 14px */
--t-display: 28px/34px 600;   --t-title:    20px/27px 600;
--t-subtitle:16px/24px 600;   --t-body:     14px/21px 400;
--t-data:    13px/19px 400;   --t-meta:     12px/17px 400;
--t-label:   11px/15px 600 +0.06em uppercase;

/* spacing — 4px scale only. no other values. */
--s1:4 --s2:8 --s3:12 --s4:16 --s5:20 --s6:24 --s8:32 --s10:40 --s12:48

/* geometry */
--h-control:36px  --h-control-lg:44px  --h-header:64px
--w-rail:248px    --w-rail-min:64px    --w-content:1440px
--r-sm:4px --r-md:8px --r-lg:12px
--bp-rail:1024px  --bp-drawer:768px

/* three separate colour axes — never mix them */
accent    Kimbal blue      primary button, active nav, focus ring — nothing else
semantic  good/warn/danger/neutral    status pills, finding severity
evidence  blue=source  teal=calculated  amber=assumed  grey-dashed=missing
```

Choose Tailwind **or** hand-written CSS. Not both. If Tailwind, no parallel stylesheet.

---

## 11. Copy rules

- Every label says what happened or what to do. Never what the system declines to do.
- Errors: human sentence first, machine code second in `--t-meta` mono with a copy button.
- No word appears on more than one screen unless it is navigation. If it does, it is chrome, and chrome is not content.
- Banned from the UI: *provisional*, *proof of concept*, *staged*, *governed*, *cannot prove*, *not assessed*.
- Replacements: `NOT ASSESSED` → `No evidence` · `PROVISIONAL FINDING` → `Draft` · `Unresolved` → `Unmapped` + `[ Map ]`.
- Uncertainty is stated as a next action: not "cannot prove X" but "confirm Y — it moves this from 0.41 to 0.90 or 0.08."

---

## 12. Build order and definition of done

| Stage | Build | Done when |
|---|---|---|
| **1** | Server ingest → feature store. Existing 60 rules re-pointed at it. `saturated` flag. `source_ref` everywhere. | Fixture parses server-side; `AS2373952` yields 3,360 readings, 244 events, 4 saturated streams. No `xlsx` in the client bundle. |
| **2** | Shell + Queue + Import flow (F1) | 214 cases paginate; duplicate import creates nothing; works at 768 px |
| **3** | Case shell, Evidence tab, run pipeline (F2), stop state (F3) | Upload and run are two actions; pipeline shows real per-step state; mismatch replaces content |
| **4** | Timeline instrument (Tab B) | Voltage renders with bands, event lanes, truncation ✕, defect ⚑; brushing works |
| **5** | Patterns → mechanisms → verdict (Tab A) | `AS2373952` produces a ranked verdict with a ledger; every row traces to a cell in 3 clicks |
| **6** | Runs + compare, Report, adjudication (F4) | Re-run after restart works; two runs diff; RCA exports |
| **7** | Cohort screen | Feeder axis shows distribution vs baseline |
| **8** | Knowledge + Forge (F5) | Brush → rule → backtest → ship, without writing JSON |

**Stages 1–5 are the product.** Do not start stage 4 before stage 1 is complete. Do not add a panel to a screen that is not in this document.

### Gate before every stage is called done

- [ ] Renders correctly at 1280, 1024, 768 px
- [ ] Loading state is a shaped skeleton
- [ ] Empty state names the next action
- [ ] Error state is human-readable and recoverable
- [ ] No page exceeds ~2,000 px
- [ ] No new colour, font size, or spacing value outside §10
- [ ] Tested against `tests/fixtures/AS2373952_Reports_2026-06-30_16-07-28.xlsx`

---

## 13. What not to build

| Don't | Why |
|---|---|
| Governance draft/review/release/rollback UI | Not in this product. Determinism plus versioned runs gives auditability. |
| Any LLM call during analysis | Runs must reproduce byte-for-byte. The agent authors rules offline only. |
| A JSON rule editor for humans | The forge exists so nobody writes JSON. |
| A single confidence percentage | Four dials or nothing. |
| Per-case chat | Answers must be structured, cited, replayable. |
| Free-text RCA box | Structured verdict renders to prose; prose does not render to structure. |
| Settings page | Configuration lives in Knowledge or in server config. |
| More than nine routes | If you need a tenth, ask first. |

---

## 14. The one test that matters

Load `tests/fixtures/AS2373952_Reports_2026-06-30_16-07-28.xlsx` against case 13644. The app must, without any human input, produce:

1. **Time of death: 5 June 2026, 18:30**, at 0 V — derived from where the profile *stops*, not from a value in it
2. **Detection lag: 11 days** — against the FFR defect date of 16 June
3. **Four saturated event buffers** flagged as censored, with rates: power 1.67/day, low-PF 2.9/day, voltage 0.35/day, current stale by 560 days
4. **A voltage chart** showing 9.1% of samples above 253 V, the zero-volt collapse, and a truncation marker
5. **A ranked verdict** with an evidence ledger where every row traces to a sheet and cell range
6. **A next-best-test** naming the feeder cohort query

If it produces all six, the architecture is right. If it produces a list of sixty sentences, start over.
