# FFR View — Why It Feels Unfinished, and What Production Looks Like

**Companion to** `FFR_FLOW_UX_UI_TEARDOWN.md`. That document lists the defects. This one answers the harder question: *why does it feel novice, and what would make it feel like a product?*

---

## 0. The one-line diagnosis

> **It reads instruments and prints essays.**

One DLMS workbook carries ~3,700 timestamped measurements. The app renders **four integers and sixty sentences**, and not a single chart. That is the entire feeling you're describing. It isn't a UI over an analysis engine — it's a validation harness that prints paragraphs, wearing a UI.

---

## 1. The measurement

### 1.1 What goes in

I opened the real fixture (`tests/fixtures/AS2373952_Reports_2026-06-30_16-07-28.xlsx`):

| Sheet | Rows | What it actually is |
|---|---:|---|
| `BlockLoadProfile` | **3,365** | Timestamped voltage/current samples — `30-06-2026 16:00:00 │ 221.900 V` |
| `VoltageRelatedEvent` | 55 | `01-06-2026 21:38:43 │ Low Voltage – Restoration │ 205.920 V │ 2.480 A │ PF 0.990` |
| `PowerRelatedEvent` | 55 | Timestamped power failures and restorations |
| `CurrentRelatedEvent` | 55 | Reverse-current, unbalance events |
| `DailyLoadProfile` | 75 | ~2.5 months of daily aggregates |
| `TransactionEvent` | 24 | Every programming/config change with a timestamp |
| + 10 more | | Configuration, self-diagnostic, billing, control events |

**~3,700 timestamped data points over roughly 70 days**, including the exact voltage at the moment of every voltage event.

### 1.2 What comes out

```
┌────────┬────────┬────────┬────────┐
│   60   │   24   │   4    │   2    │
│ checks │ review │  high  │  gaps  │
└────────┴────────┴────────┴────────┘

▸ CHECK PASSED   Expected workbook sheet coverage   DLMS-FND-001 · sheets detected: 16
▸ REVIEW         Low profile voltage excursion      DLMS-PRF-009 · min voltage: 198.4
▸ REVIEW         Recurring undervoltage events      DLMS-EVT-004 · events: 12
… 57 more lines of the same shape
```

Four integers. Sixty sentences. **Zero charts, zero sparklines, zero timelines, zero progress indicators** — I grepped the entire app: the only SVG is Lucide icons.

That's the asymmetry. 3,700 measurements in, 64 facts out, and the 64 facts are prose.

### 1.3 The chart that should exist and doesn't

Every ingredient is already parsed and in memory today:

```
  253 ┤ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  upper band
      │        ╭╮
  230 ┤╌╌╌╌╌╌╌╌╯╰╮╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌  nominal (FALLBACK)
      │          ╰─╮      ╭──╮        ╭╮
  207 ┤ ─ ─ ─ ─ ─ ─╰─╮─ ─ ╯─ ╰─╮─ ─ ─ ╯╰─ ─ ─ ─ ─ ─ ─  lower band
      │             ╰─────────╯▼▼  ▼        ▼
  198 ┤                        ██████            ← 4 excursions, 11h total
      └──┬─────────┬─────────┬─────────┬─────────┬──
       1 Apr    20 Apr    10 May    ⚑30 May    20 Jun
                                    defect reported
      ▼ = voltage event (55)   ⚑ = FFR defect date   ██ = below lower band
```

One picture answers what "min voltage: 198.4" cannot: **when**, **how often**, **how long**, and **did it precede the reported failure**. That is the analyst's actual question. Today they must open the spreadsheet in Excel to answer it — which means the app added a step to their job instead of removing one.

---

## 2. The app never gives an answer

### 2.1 Its vocabulary is refusal

Counted across `app/`, `rules/`, `config/`:

| Word | Occurrences |
|---|---:|
| `provisional` | **126** |
| `required` | 90 |
| `must` | 34 |
| `does not` | 30 |
| `cannot` | 20 |
| `never` | 19 |
| `unavailable` | 17 |
| `not assessed` | 11 |

Plus **60 hardcoded explanatory sentences — 791 words** of static prose embedded in the five screens. Three pages of essay, in the chrome.

Every finding carries three mandatory fields: `limitation` ("what it cannot prove"), `followUp` ("required next validation"), and `why`. Every status badge says `PROVISIONAL FINDING`. The homepage headline is *"Development proof of concept."* The sidebar footer is a legal caveat. The topbar strapline is *"Staged evidence and governed rules."*

The dominant register of this product is **apology**. An analyst spends twenty minutes in it and leaves with nothing she can write in a return report.

### 2.2 That's the "not solving the purpose" part

The purpose is: **decide why this meter failed, with evidence you can defend.**

The app was built to do the opposite — to enumerate, at maximum verbosity, everything it is not willing to conclude. The 60 checks are not the product. They are the *evidence layer underneath* the product. The product — a ranked, cited, reviewable answer — was never built.

There is no RCA record, no CAPA, no conclusion field, no reviewer sign-off, no export. The final card on the case screen says the case *"is eligible for provisional interpretation"* and then links you to the rule library. That is where the flow ends.

**Caution is right. Silence is not caution.** A defensible product says:

> *Most consistent with **sustained under-voltage stress**.
> Supported by 4 findings · contradicted by 0 · 2 evidence gaps.
> Confidence is limited because the voltage threshold was derived from a fallback nominal, not this meter's configuration.
> Requires: confirm supply-side voltage at site. — Draft, needs reviewer.*

That is more honest than 126 uses of the word "provisional", and it is actually usable.

---

## 3. It never tells you what is happening

You named this directly. Here is the complete inventory of system feedback in the app today:

| Moment | What the user sees |
|---|---|
| App loads | Blank shell, then content pops in after 3–4 sequential fetches |
| Case list loading | A section heading that reads `Loading cases…` |
| Case loading | `<p>Loading case…</p>` |
| Register parsing | Button label changes to `Reading FFR register…` |
| **60 rules evaluating** | Button label changes to `Reading DLMS report…` |
| Analysis complete | A grey inline bar with `inspection.messages[0]` |
| Save succeeded | Sometimes nothing |
| Anything failed | `UNRECOGNIZED_FILE: …` — including network errors and server 500s |

**That's it.** No progress bar. No step indicator. No elapsed time. No cancel. No queue position. No "3,365 rows read." No confirmation that anything was stored.

Parsing 3,365 rows and evaluating 60 rules happens **synchronously on the main thread**, so the UI is frozen while a button says "Reading…". The user cannot distinguish working from hung.

### What a production app owes the user

Seven feedback moments, none optional:

1. **On file select** — "AS2373952_Reports.xlsx · 1.2 MB · reading…"
2. **On parse** — "16 sheets · 3,365 profile rows · 244 events · meter AS2373952 detected"
3. **On identity check** — pass/stop, immediately, before any rule runs
4. **During evaluation** — a real pipeline with per-step state, not a spinner
5. **On completion** — what changed: "Run 3 created · 24 findings need review · 2 more than run 2"
6. **On persistence** — "Saved to case 13644 · bundle v2 · 19 Aug 14:02"
7. **On failure** — which step failed, why, and the one action that fixes it

The pipeline, visible, on screen:

```
  ✓ File read          16 sheets · 1.2 MB · sha256 9b3ac41f…
  ✓ Adapter matched    BCS 16-sheet v1
  ✓ Identity           AS2373952 = case 13644 old meter
  ✓ Features derived   3,365 profile rows → 41 features
  ⣷ Rules evaluating   38 / 60 · bundle v2 · 1.4s
  ○ Hypotheses
  ○ Draft conclusion
                                                    [ Cancel ]
```

Eight lines. It removes every "is this thing working?" question and it makes the engineering legible — right now the app does an enormous amount of work and shows none of the effort.

---

## 4. The novice tells

You said it feels vibe-coded. These are the specific signals a reviewer picks up in the first ninety seconds:

| Tell | What it is |
|---|---|
| **60 amber badges as the resting state** | Every enabled rule renders `tone="warning"`. A healthy page is 60 warnings, so amber now means nothing — including in the findings panel where it means "needs review". |
| **Machine codes as headlines** | `MULTIPLE_FFR_REGISTERS: upload one FFR register at a time.` The error code is the first thing the user reads. |
| **Loading states written as content** | `Loading cases…` is the section *title*. `<p>Loading case…</p>` is the whole page. |
| **The same topbar hardcoded 7 times** in 5 files | Identical static markup, copy-pasted, instead of living in the layout. |
| **A convention invented to justify a shortcut** | `use-shared-governance.ts:16-22` cites "this project's no-shared-context convention." No such convention exists — no CLAUDE.md, no contributing guide, no other mention anywhere in the repo. |
| **Tailwind installed, imported, and never used** | `@import "tailwindcss"` at the top of a 1,023-line hand-rolled stylesheet. Zero utility classes in any `.tsx`. |
| **Everything is a client component** | 10 of 10. Nothing server-rendered. Four duplicate API calls per navigation, one of them just to look up a logo URL. |
| **Static prose where controls belong** | The Governance page opens with five paragraph cards titled "Control 1–5". The actual draft/review/release buttons are 1,400 px below them. |
| **Fully built APIs wired to nothing** | `/api/governance/runs` and `/api/governance/fixtures` — role-gated, tested, zero client references. |
| **Config editors split across two screens** | Create an adapter in Settings, approve it in Governance, come back to Settings to map it. Eight steps, two screens, no breadcrumb. |
| **Five pages, four of them one endless scroll** | 5,408 px · 4,113 px · 3,568 px · 2,017 px. |
| **Nothing renders below 900 px** | At 390 px only the navy sidebar is visible. |

None of these is individually fatal. Together they are the texture of something assembled rather than designed.

---

## 5. What production looks like

### 5.1 The reframe

| | Today | Production |
|---|---|---|
| **What it produces** | 60 caveats | 1 cited, ranked, reviewable answer |
| **What it shows** | Sentences | Instruments — then sentences as backing |
| **What it says while working** | A button label | A pipeline |
| **Where it ends** | "eligible for provisional interpretation" | A signed conclusion and an exported report |
| **Who it addresses** | A compliance reviewer | An analyst with 30 meters to clear today |
| **Its tone** | Apology | Evidence |

### 5.2 The screen that has to exist — Case → Analysis

This replaces the 4,113 px scroll. It is one screen with three bands: **verdict**, **instrument**, **evidence**.

```
┌────────────────────────────────────────────────────────────────────────────────┐
│ ‹ Queue    CASE 13644  ● ANALYSED       AS2373952 → SC10231275 · Meter burnt   │ ← sticky
│            Run 3 · 19 Aug 14:02 · bundle v2 · profile v1        [ Re-run ▾ ]   │
├────────────────────────────────────────────────────────────────────────────────┤
│                                                                                │
│  MOST CONSISTENT WITH                                            ▓▓▓▓▓▓░░ 4/6  │
│  Sustained under-voltage stress on the supply side                             │
│  4 findings support · 0 contradict · 2 evidence gaps        [ Draft report → ] │
│                                                                                │
│  ⚠ Confidence limited — voltage threshold derived from a FALLBACK nominal of   │
│    230 V. MeterConfiguration held no usable rated voltage.        [ Why? ]     │
│                                                                                │
├────────────────────────────────────────────────────────────────────────────────┤
│  VOLTAGE · 3,365 samples · 1 Apr – 30 Jun 2026        [Voltage][Current][PF]   │
│                                                                                │
│   253 ─────────────────────────────────────────────────────────────  upper     │
│        ╭╮                                                                      │
│   230 ╌╌╯╰─╮╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌  nominal ⚠  │
│             ╰──╮     ╭──╮       ╭─╮                                            │
│   207 ──────────╰─────╯──╰───────╯ ╰──────────────────────────────  lower      │
│                   ▼▼▼     ▼    ▼▼   ▼                                          │
│   198 ═══════════▓▓▓▓▓▓══▓▓▓▓══▓▓▓══════════════════════ 4 excursions · 11h    │
│        └────┬───────┬───────┬──────┬───────⚑──────┬────┘                       │
│           1 Apr  20 Apr  10 May  25 May   30 May  20 Jun                       │
│                                          defect reported                       │
│   ▼ voltage event (55)   ⚑ FFR defect date   ▓ below band                      │
│                                                                                │
├──────────────────────────────┬─────────────────────────────────────────────────┤
│ EVIDENCE  ⌕                  │ DLMS-PRF-009  Low profile voltage excursion     │
│ [All 60][Review 24][Gaps 2]  │ ● HIGH · supports the leading hypothesis        │
│ ──────────────────────────── │ ─────────────────────────────────────────────── │
│ ▾ SUPPORTS (4)               │ MEASURED    min 198.4 V · 4 excursions · 11.2 h │
│   ● Low V excursion       ◀  │             ▪ source  Profile!D14–D3374 (blue)  │
│   ● Recurring undervoltage   │ THRESHOLD   lower band 207.0 V                  │
│   ● Power failure clustering │             ▪ FALLBACK nominal 230 V (amber)    │
│   ● Low PF at meaningful load│ EVALUATED   min(V) 198.4 < 207.0 → attention    │
│ ▾ CONTRADICTS (0)            │ CANNOT PROVE  a low reading does not establish  │
│ ▾ GAPS (2)                   │             a physical fault in the meter       │
│   ○ Rated voltage missing    │ NEXT        confirm supply-side voltage at site │
│   ○ No image evidence        │                                                 │
│ ▾ PASSED (34)                │            [ Cite in report ]  [ Copy DLMS-… ]  │
└──────────────────────────────┴─────────────────────────────────────────────────┘
```

Four changes carry the whole difference:

1. **The verdict is first.** Not a caveat — a ranked hypothesis with its support/contradiction/gap counts and an honest confidence qualifier. The caveat becomes a *line inside the verdict*, which is where a caveat belongs.

2. **The instrument is second.** The voltage trace with threshold bands, event markers, and the FFR defect date. Built entirely from data the app already parses.

3. **Findings are grouped by what they do to the verdict** — supports / contradicts / gaps / passed — not by which sheet they came from. "Foundation / Profile & data quality / Events / Complaint context" is the *engine's* taxonomy, not the analyst's.

4. **Provenance is visible.** `source` in blue, `fallback` in amber, inside the detail panel. `profileSources` is computed today and thrown away today; rendering it is the highest value-per-hour change available in the repo.

### 5.3 The prose budget

Cut 791 words of static copy to a hard budget:

| Where | Budget |
|---|---|
| Page header | 1 line, ≤ 12 words |
| Section header | Title only. No description by default. |
| Explanatory prose | Behind a `[ Why? ]` popover or a help drawer. Never inline. |
| Legal caveat | Once, in the exported report. Not in the sidebar of every screen. |
| Finding `limitation` / `followUp` | In the detail panel, on the selected finding only |

Rule of thumb: **if the same sentence renders on more than one screen, it is chrome, and chrome is not content.** The five "Control 1–5" cards, the sidebar note, and the topbar strapline all fail this test.

### 5.4 Language rewrite

| Now | Production |
|---|---|
| `Development proof of concept` | *(delete)* |
| `Staged evidence and governed rules` | *(delete — replace with the case ref)* |
| `PROVISIONAL FINDING` | `Draft · needs review` |
| `MULTIPLE_FFR_REGISTERS: upload one FFR register at a time.` | **Upload one register at a time.** <br><small>You selected 3 files. `MULTIPLE_FFR_REGISTERS`</small> |
| `IDENTITY_NO_MATCH — case-level analysis is blocked` | **This report is for meter AS2373110. Case 13644 expects AS2373952.** |
| `Case context is eligible for provisional interpretation` | **Ready to draft a conclusion.** `[ Draft → ]` |
| `NOT ASSESSED` | `No evidence` |
| `Unresolved — add a shared mapping` | `Unmapped` + inline `[ Map now ]` |
| `Shared configuration required` | **Set up rules before your first analysis.** `[ Set up → ]` |

Every label states what happened or what to do. No label states what the system declines to do.

---

## 6. The three things that would change the feel most

Ordered by effect per day of work.

### ① Render the instrument — 3–4 days

One chart component: line series + threshold bands + event markers + a date marker. Use it for voltage, current, and power factor on the Analysis tab, and as a 60 px sparkline in the queue row. All data already parsed.

**Effect:** the app stops looking like a form and starts looking like a diagnostic tool. This is the single biggest change to the "feels like HTML" problem.

### ② Show the pipeline and produce a verdict — 4–5 days

The eight-line pipeline from §3, plus a hypothesis ranking above the findings. Hypotheses can be derived deterministically from the existing rule groups and severities — no model required for v1.

**Effect:** the app stops being a validator and starts being an answer. This is the "not solving the purpose" problem.

### ③ Cut the prose and fix the semantics — 2–3 days

Delete the 791 words to the §5.3 budget. Invert every error message. Make `enabled` neutral so amber means one thing. Group findings by their effect on the verdict.

**Effect:** the app stops apologising, and colour starts carrying information.

Ten to twelve working days, no schema migration, no new dependency beyond a chart primitive. Everything else in `FFR_FLOW_UX_UI_TEARDOWN.md` — the flow, the queue, server-side analysis, the responsive fix — still needs doing, but these three are what change the *impression* from "an intern's HTML" to "a product."

---

## 7. One thing to keep

`app/lib/dlms-analysis.ts` — 1,631 lines of source-linked, provenance-aware, configuration-driven rule evaluation, where every check declares what it cannot prove and what must be verified next. That is genuinely careful engineering and it is the reason this is worth rebuilding rather than restarting.

The mistake was not the engineering. The mistake was believing that **printing the engineering** counted as designing a product. It doesn't. The engine computes a meter's story; the interface has to *tell* it.
