# FFR — First Principles

*What we are actually trying to do, why the current shape cannot do it, and the architecture that can.*

Governance is deliberately out of scope. Section 9 explains why the design makes most of it unnecessary rather than merely deferring it.

---

# Part I — The problem, from the physics up

## 1. What is physically happening

A meter is installed at a premise. It runs for months or years, sampling voltage and current every 30 minutes and writing events into small fixed-size logs. Something goes wrong. A customer complains or a field team notices. The meter is removed, a new one installed, and the failed unit is shipped back with a paper trail — the FFR register row.

The returned object arrives with three testimonies:

| Source | Who is speaking | Reliability |
|---|---|---|
| FFR register row | The field team, hours-to-weeks after the fact | Low. Free text, non-expert, incentive to close the ticket |
| DLMS workbook | The meter, about itself, up to the moment it stopped | High fidelity, **but it stops exactly when it matters** |
| Physical unit + images | The object itself | Highest, but requires a bench and time |

## 2. The question that is actually being asked

Not *"why did this meter fail."* That is the analyst's question. The business question underneath it is:

> **Whose fault is this, and how many more are coming?**

Four decisions hang off every return, and each has a different owner and a different cost of being wrong:

| Decision | Owner | Cost of error |
|---|---|---|
| **Warranty attribution** — ours, the grid's, the installer's, or nobody's | Commercial | Direct margin, per unit, at scale |
| **CAPA trigger** — is this a design or process defect | Quality | Missed = recall exposure. False = wasted engineering |
| **Cohort exposure** — how many field units share the cause | Quality / Ops | The single largest financial number in the process |
| **Customer response** — what we tell the DISCOM | Account | Contractual failure-rate penalties, relationship |

A tool that produces a beautifully caveated technical description and routes to none of these four decisions has produced nothing.

**Axiomatic consequence:** the output of this system is not a report. It is *an attribution, a confidence, and a routed action.*

## 3. Where we are coming from

The process being replaced: a senior engineer opens two spreadsheets side by side, scrolls, recognises a shape, and writes a paragraph.

That process has four properties worth naming precisely, because the software must fix all four and preserve the fifth:

- **Inconsistent** — two engineers, two answers; same engineer on a Friday, a third
- **Unauditable** — the reasoning is in the paragraph, not in the evidence
- **Unscalable** — 20–40 minutes per unit against hundreds of returns a month
- **Perishable** — when that engineer leaves, the capability leaves
- **…but genuinely expert** — they are right most of the time, via pattern recognition they cannot fully articulate

The fifth property is the one that matters. The engineer's skill is **perceptual, not procedural.** They recognise the shape of a failing termination the way a radiologist recognises a tumour — instantly, and without being able to write down the rule.

**Axiomatic consequence:** the central design problem is not "encode the rules." It is **"convert tacit perception into an executable asset, without requiring the expert to formalise it."** That is what Part IX is for, and it is why the agentic component is core architecture rather than a feature.

## 4. The epistemic character of the evidence

This is the crux, and getting it wrong is what produced the current app.

> **The DLMS log is testimony from a witness who fell unconscious at the moment of the crime.**

Three consequences follow, and all three are load-bearing:

**(a) The failure moment has no data by construction.** A meter that dies stops logging. The record always ends *before* or *at* the event of interest. The most informative instant in the file is the one with no row in it.

**(b) Absence is systematically ambiguous.** No voltage records could mean: the supply was fine and nothing was logged; the meter was dead; comms failed; memory corrupted; or the log wrapped. These are wildly different conclusions from an identical absence of rows.

**(c) The logs are censored, not sampled.** Every event stream in the real fixture holds **exactly 50 entries** — fixed circular buffers. A count of 50 is not a measurement. It is a *ceiling*, and the true count is unknown and larger.

**Axiomatic consequence:** this is an **abductive** problem — inference to the best explanation from incomplete evidence — not a **deductive** one. Rules are deductive. Applying a deductive engine to an abductive problem produces exactly what the current app produces: 60 individually-true statements, no conclusion, and 126 uses of the word "provisional" standing in for the answer.

You cannot fix that with better rules. It needs a different layer.

---

# Part II — The axioms

Everything downstream is derived from these. If one is wrong, the architecture built on it is wrong.

**A1 · The subject is a physical object with a history.**
The primitive is a timeline, not a checklist. Every observation carries a timestamp; the failure has a moment; RCA is reconstructing what happened in what order.

**A2 · Silence is data.**
Where a log stops, what it does *not* contain, and how fast a fixed buffer filled are first-class measurements. They are often the most informative ones.

**A3 · Rules observe. Only hypotheses conclude.**
A rule may never name a root cause. It produces a fact with provenance. Attribution happens in a separate layer that weighs facts against competing physical mechanisms.

**A4 · Every number must trace to a cell.**
Provenance is not a feature, it is the substrate. A chart pixel, a finding, a verdict clause — each resolves to sheet, range, and the transform applied.

**A5 · Confidence is decomposed, never scalar.**
"87%" is a lie. Evidence completeness, discrimination margin, provenance quality, and cohort corroboration are four separate dials, each of which implies a different next action.

**A6 · One meter is an anecdote; the cohort is the evidence.**
A single case *proposes* a cause. Only the population *confirms* it. Root cause without a cohort query is an opinion.

**A7 · An output that changes no decision should not be produced.**
Every finding must connect, through a mechanism, to one of the four decisions in §2 — or be suppressed to a detail panel.

**A8 · The model authors; it never adjudicates.**
An LLM may write rules, propose features, and narrate results. It is never in the inference path at analysis time. Analysis is a pure, replayable function of (evidence, ruleset version, mechanism version).

**A9 · Uncertainty is stated as a next action, not as a disclaimer.**
"Cannot prove X" is worthless. "Confirm supply voltage at site — it moves the leading hypothesis from 41% to either 90% or 8%" is the same honesty, made useful.

---

# Part III — Why the current shape cannot get there

Stated once, briefly, because Part IV onward is the actual work.

| Current | Consequence |
|---|---|
| 60 deductive rules, no inference layer | Cannot conclude. Correctly senses this, and substitutes caveats for an answer |
| Each rule reads one series in isolation | Cannot see coincidence, ordering, decoupling, or contradiction — where cause actually lives |
| Event counts read as measurements | **Every event stream in the fixture is a saturated 50-entry buffer.** Zero of 60 rules are censoring-aware. Every event rule is quietly reading a ceiling as a value |
| Single-case scope | Cannot distinguish grid from product, which is a population question by definition |
| Rules hand-authored in a JSON textarea | The expert's tacit perception never gets captured, so the library cannot improve |
| FFR text and DLMS data never meet in one evaluation | Cannot detect the highest-value finding of all: the field's account contradicting the meter's |

---

# Part IV — The inference stack

Six layers. The current app implements L0→L1 and stops.

```
L5  VERDICT       attribution · confidence · routed action · next best test
       ▲                                              ← what the business consumes
L4  HYPOTHESES    ranked mechanisms, each with an evidence ledger
       ▲                                              ← abductive; where cause is decided
L3  MECHANISMS    physical failure modes + expected signatures   [human-owned]
       ▲
L2  PATTERNS      temporal & cross-series motifs, censoring-aware
       ▲                                              ← "reading under the line"
L1  OBSERVATIONS  deterministic facts with provenance            [today's 60 rules]
       ▲
L0  SIGNALS       normalised series + events + attributes        [feature store]
```

Two boundaries are non-negotiable:

- **L1 may not reference L3.** A rule cannot know what mechanism it supports. Otherwise thresholds get tuned to force a conclusion and the evidence stops being independent.
- **L3 is human-owned.** The agent (Part IX) may author L1 and L2, and may *propose* an L3 linkage, but a person owns the mechanism library. That is the whole safety boundary, and it is enough.

---

# Part V — Reading under the line

This is the layer that turns facts into cause. Below are the pattern classes, each worked against the **real fixture** — `AS2373952_Reports_2026-06-30`, the meter in case 13644, complaint *"Meter Burnt / internally burnt."*

## 5.1 Censoring and buffer-rate — the biggest miss

Every event stream in the file holds exactly 50 rows. They are circular buffers. The *span* of a saturated buffer measures the event rate; the *count* measures nothing.

| Stream | Rows | Span covered | Saturated? | True signal |
|---|---:|---|---|---|
| `CurrentRelatedEvent` | 50 | 14–18 Dec **2024** | yes, stale | Hasn't wrapped in **18 months** → current-axis events ≈ zero |
| `VoltageRelatedEvent` | 50 | 8 Jan – 1 Jun 2026 | yes | 50 events / 144 d ≈ **0.35/day** |
| `OtherEvent` (low PF) | 50 | 19 May – 5 Jun 2026 | yes | 50 / 17 d ≈ **2.9/day** |
| `PowerRelatedEvent` | 50 | 31 May – 30 Jun 2026 | yes | 50 / 30 d ≈ **1.7/day** |
| `ControlEvent` | 4 | Dec 2024 – Feb 2026 | no | True count = 4 |
| `TransactionEvent` | 19 | Jun 2024 – Feb 2026 | no | True count = 19 |

Read that table as an instrument and the failure announces itself: **the current axis is silent for eighteen months while the power-factor and power-failure axes saturate in the final two to four weeks.** The fault is on the supply side, not the load side, and it is *recent and accelerating*.

The current app reports `Recurring power-failure events: 50` and `Recurring current-reversal events: 50` as if they were comparable numbers. They are opposites.

> **Pattern primitive:** `censored(stream) → { saturated, span, rate, staleness }`. Any stream at buffer capacity yields a rate and a lower bound, never a count.

## 5.2 Truncation — the time of death

The profile runs 28 Mar → 30 Jun, 3,360 samples. It stops at **5 Jun 18:30** and resumes **29 Jun 19:00** — a 24.0-day silence.

The three samples before the stop read **0 V, 0 V, 0 V**. The three after read **0 V, 0 V, 0 V**.

That is not a data gap. That is:

- **Time of death: 5 June 2026, 18:30**, at zero volts
- The 29 June "resumption" is a depot power-up for readout, not a recovery
- **Detection lag: 11 days** — the field reported the defect on 16 June

Time of death and detection lag are two of the most decision-relevant numbers in the entire file. Neither is producible by any of the 60 rules. The closest is `Long profile gaps: 1`.

> **Pattern primitive:** `truncation(series) → { last_live_ts, terminal_values[], silence_duration, resumed_in_service: bool }`. Distinguish *gap* from *end*. They are different events.

## 5.3 Coincidence — independent streams agreeing in time

On 1 June: power failures at 01:08, 03:14, 06:25; low-PF occurrences interleaved at 00:32, 01:28, 03:28; a low-voltage event at 15:47. Four days later the meter is dead.

No single rule sees this. All of them pass individually. The *convergence* of three independent streams inside one 24-hour window, four days before truncation, is the signature.

> **Pattern primitive:** `coincidence(streams[], window) → { streams_agreeing, window, distance_to_truncation }`.

## 5.4 Dose, not threshold

307 of 3,360 samples (**9.1%**) sit above 253 V, with events repeatedly at 260.1–260.6 V. 23 samples sit below 207 V.

"Voltage exceeded the band" is a boolean. **Volt-hours above band, and its trend**, is a stress measurement. Chronic 9% overvoltage across 94 days is a real background stressor — but note what it is *not*: the meter did not die at a voltage peak. It died at 0 V. That distinction is the entire discrimination between two mechanisms.

> **Pattern primitive:** `dose(series, band) → { hours_above, volt_hours, episodes, trend, peak, peak_ts }`.

## 5.5 Decoupling — relationships between series

56 zero-voltage samples begin **9 May**, a month before death. Voltage present but current absent, or energy registers frozen while the profile advances, are cross-series relationships that per-series rules cannot express.

> **Pattern primitive:** `decoupling(a, b, window) → { expected_relation, observed, divergence_start }`.

## 5.6 Contradiction between testimonies

The field says *"internally burnt."* The meter says: chronic overvoltage, then a power-failure storm, then death at zero volts. Those are consistent — but the same test run on a meter that logged healthily through its reported defect date would yield the single highest-value finding available: **the wrong unit was returned, or the complaint is cosmetic.**

The FFR row and the DLMS series must be evaluated in the same pass. Today they never meet.

> **Pattern primitive:** `testimony_conflict(ffr_claim, meter_record) → { conflict_type, confidence }`.

## 5.7 Cohort deviation

Everything above describes one object. None of it separates *grid* from *product* — see Part VIII.

## 5.8 The narrative these produce

Assembled, the patterns give a story the current app cannot express in any form:

```
28 Mar        Recording begins. Chronic overvoltage — 9.1% of samples > 253 V,
              repeated excursions to 260 V. Current-axis events: none in 18 months.
 9 May        First zero-voltage samples appear.
19 May →      Power-factor events saturate a 50-entry buffer in 17 days (2.9/day).
31 May →      Power-failure events saturate a 50-entry buffer in 30 days (1.7/day).
 1 Jun        Convergence: 3 power failures, 3 low-PF episodes, 1 low-voltage event.
 5 Jun 18:30  Last record. 0 V. ── TIME OF DEATH
              24 days of silence.
16 Jun        Field reports the defect.        ── 11-DAY DETECTION LAG
29 Jun 19:00  Depot power-up. Still 0 V. Not a recovery.
30 Jun        Read out.
```

Reading it as an engineer would: the meter did **not** die from an overvoltage thermal event — it would have died at a voltage peak. It died at zero volts, at the end of an accelerating sequence of supply interruptions and power-factor collapse, with no load-side events at all. That signature points to **progressive degradation of the supply connection at the meter — a loose or corroded terminal or neutral** — where contact resistance heats, intermittently opens, and eventually produces the internal burn the field observed.

*Illustrative, not adjudicated.* I am not the domain expert and this is exactly the judgement that must live in a human-owned mechanism library (Part VI). The point is that the evidence supports a specific, testable, actionable mechanism — and that the current system cannot represent it at any level.

---

# Part VI — Mechanisms (L3)

The knowledge asset. Not code, not rules — a versioned library of physical failure modes, owned by domain engineers.

```yaml
id: MECH-TERM-PROGRESSIVE
name: Progressive supply-terminal degradation
family: installation          # product | grid | installation | customer | no-fault
narrative: >
  Contact resistance at an incoming terminal or neutral rises through
  oxidation, loosening or under-torque. Ohmic heating accelerates the
  degradation. The connection intermittently opens under load, producing
  power-failure events and power-factor disturbance, then fails fully.
  Heat damage presents as internal burning near the terminal block.

signature:
  requires:                    # absence materially weakens the hypothesis
    - PWR_FAIL_ESCALATING      # power-failure rate rising toward truncation
    - TRUNCATION_AT_ZERO_V     # died at 0 V, not at a voltage peak
  supports:
    - PF_COLLAPSE_LATE
    - ZERO_V_EPISODES_PRECEDING
    - COINCIDENCE_MULTI_STREAM
    - FFR_CLAIM_BURN
  contradicts:
    - TRUNCATION_AT_PEAK_V     # points to thermal overvoltage instead
    - CURRENT_AXIS_ACTIVE      # load-side involvement argues elsewhere
  disqualifiers:
    - METER_ALIVE_PAST_DEFECT_DATE

discriminators:
  - vs: MECH-GRID-OV-THERMAL
    test: cohort.same_feeder.power_failure_rate
    reading: elevated across feeder → grid; isolated to this meter → termination
  - vs: MECH-PROD-SMPS
    test: cohort.same_batch.termination_failure_rate
    reading: batch-clustered → product; spatially clustered → installation

confirmations:
  - visual: burn localised at terminal block, not at SMPS
  - bench: contact resistance / torque check on incoming terminals

routes:
  warranty: installer
  capa: none unless terminal design margin implicated
  cohort_query: same_feeder AND same_install_contractor
```

Roughly 15–25 mechanisms cover the overwhelming majority of returns. Building that library **is** the product's moat. Everything else is plumbing around it.

---

# Part VII — From observations to a verdict

## 7.1 Evidence ledger, not a score

Each pattern contributes a **likelihood ratio** per mechanism — how much more likely this observation is under mechanism M than under the alternatives.

```
posterior_odds(M) = prior_odds(M) × Π  LR(pattern_i | M)
```

Likelihood ratios rather than weighted points, for three reasons that matter:

1. **Contradiction is expressible.** LR < 1 pushes a mechanism down. A weighted sum can only ever add.
2. **Missing evidence is neutral by construction.** LR = 1. It cannot silently penalise, and it surfaces as a *gap* rather than a lowered score.
3. **Every number is individually defensible.** "Truncation at 0 V is ~8× more likely under progressive-termination than under overvoltage-thermal" is a claim a domain engineer can argue with. "Weight 0.7" is not.

**Priors** come from adjudicated history, conditioned on complaint category and region — not from intuition. For `METER:B` (burnt) they are simply the historical base rates of each family.

## 7.2 The independence problem, handled honestly

Naive multiplication over correlated evidence produces absurd confidence. Overvoltage dose and overvoltage event count are *the same evidence counted twice*.

Patterns are therefore grouped into **evidence families**, and a family contributes once:

```
LR(family) = max(LR_i in family) × corroboration_bonus(n)     bonus capped at 1.3×
```

Families: `voltage-stress` · `termination` · `timing/truncation` · `load-side` · `physical` · `tamper` · `cohort`.

Posterior is additionally **capped at 0.95** for any mechanism lacking a physical confirmation, because no purely log-based inference should ever present as certainty about a physical object.

## 7.3 Confidence, decomposed (A5)

| Dial | Question | Implied action |
|---|---|---|
| **Completeness** | How much of the expected signature was observable? | Fetch missing evidence |
| **Discrimination** | Posterior gap between #1 and #2 | Run the discriminating test |
| **Provenance** | Thresholds from meter config, or from fallbacks? | Repair the mapping |
| **Corroboration** | Does the cohort agree? | Widen the cohort query |

Four dials, four different next moves. One percentage would collapse all of them into a number nobody can act on.

## 7.4 Value of information — the feature that makes it a tool

For each candidate next observation, compute the expected shift in the posterior distribution, and rank by expected-shift ÷ cost.

For our fixture, the ranking is:

```
NEXT BEST TEST
1.  Feeder cohort: power-failure rate, 31 May – 5 Jun, meters on this feeder
    cost: 1 query (seconds)     expected shift: LARGE
    elevated  → grid mechanism leads      isolated → termination leads
2.  Photograph: burn location, terminal block vs SMPS
    cost: 5 min                 expected shift: MODERATE
3.  Bench: incoming terminal contact resistance
    cost: 30 min                expected shift: MODERATE — confirms, lifts the 0.95 cap
```

The top-ranked test costs seconds and moves the answer more than anything else available. **That is the whole product in one panel** — and it is only computable because mechanisms declare their discriminators.

## 7.5 What the verdict object contains

```
attribution      mechanism id + family
posterior        with the ledger that produced it
confidence       four dials
timeline         the reconstructed narrative (§5.8)
evidence         patterns for / against / missing, each → observations → cells
next_best_test   ranked, with expected shift and cost
routes           warranty class · CAPA flag · cohort query
provenance       ruleset@v · mechanisms@v · adapter@v · input hashes
status           draft → analyst confirmed → adjudicated
```

---

# Part VIII — The population layer

**A6 in practice.** A single case *proposes*; the cohort *confirms*. Without this, "product defect versus grid stress" is undecidable in principle — the two produce identical single-meter signatures.

Once features live in a queryable store keyed by meter (Part X), cohorts are one query:

| Cohort axis | Separates |
|---|---|
| Firmware version | Firmware-induced faults |
| Manufacturing batch / year | Component lots, process excursions |
| Feeder / sub-division | **Grid vs. product** — the single most valuable axis |
| Install month + contractor | Workmanship |
| Meter model / rating | Design margin |

Two queries the system should run automatically on every verdict:

- **Confirmation:** "Of returns sharing this cohort, how many carry the same leading mechanism?" — 3/40 is noise; 27/40 is a CAPA trigger.
- **Surveillance:** "Is this mechanism's rate in this cohort rising above its historical baseline?" — this is the early-warning system, and it is the highest-value thing the product can eventually do, because it detects a field problem *before* the returns arrive in volume.

Answering "how many more are coming" — §2's largest number — requires nothing beyond the same feature store.

---

# Part IX — The rule forge: agentic authoring grounded in real workbooks

## 9.1 Why this is core, not a feature

From §3: the expert's skill is perceptual. They recognise the shape and cannot formalise it. Today the app asks them to express that perception as JSON in a textarea, with no test, no data, and a minutes-long blind feedback loop. Nobody will ever do this. The rule library is therefore frozen at whatever the first author guessed, and the product's accuracy is capped on day one.

**The forge inverts the interaction: the analyst points at what they noticed; the agent writes, tests, and calibrates the rule.**

## 9.2 Two entry points — the second is the important one

**A · From intent.** *"Flag meters where the log stops within an hour of a power-failure event."*

**B · From an example — programming by demonstration.** The analyst is on case 13644's voltage chart. They brush 1–6 June and click **"This is what I'm looking for."**

Entry B is the right primary interaction, because an example is a far better specification than a sentence, and because it matches how the expertise actually exists in the person's head. They cannot describe the shape. They can point at it.

## 9.3 What "context of the workbook" must mean

**Not** the workbook. Never 3,365 rows in a prompt — it is expensive, lossy, and invites the model to hallucinate structure. The agent receives a compact **context object** plus **tools to query the corpus**.

```json
{
  "workbook": { "adapter":"bcs-16-sheet-v1", "meter":"AS2373952",
                "firmware":"TEST 1.22", "model":"6", "rating":"(5-30)A", "mfgYear":2023 },
  "coverage": {
    "profile": { "rows":3360, "span":["2026-03-28","2026-06-30"],
                 "channels":["voltage","current","pf","activePower"], "nullRate":0.0 },
    "events": {
      "voltage": { "n":50, "saturated":true, "span":["2026-01-08","2026-06-01"], "rate_per_day":0.35 },
      "power":   { "n":50, "saturated":true, "span":["2026-05-31","2026-06-30"], "rate_per_day":1.67 },
      "current": { "n":50, "saturated":true, "span":["2024-12-14","2024-12-18"], "stale_days":560 },
      "control": { "n":4,  "saturated":false },
      "transaction": { "n":19, "saturated":false } } },
  "features": [
    { "key":"profile.voltage.min", "value":0,     "source":"BlockLoadProfile!D14:D3373" },
    { "key":"profile.voltage.p99", "value":259.5, "source":"BlockLoadProfile!D14:D3373" },
    { "key":"profile.truncation.last_live_ts", "value":"2026-06-05T18:30", "source":"BlockLoadProfile!C3350" }
  ],
  "selection": { "series":"voltage", "from":"2026-06-01T00:00", "to":"2026-06-06T00:00" },
  "case": { "complaint":"METER:B", "fieldObservation":"internally burnt", "defectDate":"2026-06-16" },
  "cohort": { "same_firmware":214, "same_feeder":38, "same_batch":61 }
}
```

About 2 KB. Schema, statistics, provenance, and the analyst's selection — everything needed to *write* a rule, nothing that invites guessing.

## 9.4 Tool surface

The agent works over the feature store, not over spreadsheets:

| Tool | Returns |
|---|---|
| `describe_corpus()` | Adapters, channels, feature inventory, coverage across all workbooks |
| `feature_distribution(key, cohort)` | Percentiles, null rate, histogram — **so thresholds come from data, not invention** |
| `sample_windows(query, k)` | Representative windows matching a rough predicate, for grounding |
| `evaluate(expression, cohort)` | Fire rate, precision, recall, confusion against adjudicated labels |
| `explain_on_case(expression, caseId)` | Why it fired or didn't, with the actual values and cells |
| `collides_with(expression)` | Overlap and redundancy against existing rules |
| `propose_feature(spec)` | When the needed measurement doesn't exist yet — a feature proposal, not a rule |

## 9.5 The loop

```
1  GROUND       Resolve the selection to features that actually exist.
                Missing? → propose_feature, stop, ask.
2  DRAFT        Candidate expression. Thresholds read off feature_distribution,
                never invented.
3  BACKTEST     evaluate() over the adjudicated corpus.
                "Fires on 34/214. Precision 0.82, recall 0.61 against
                 termination-adjudicated cases. Flips 6 stored verdicts."
4  ADVERSARIAL  Auto-generate boundary + negative fixtures. Surface every
                case where it fires and shouldn't, with explain_on_case.
5  CALIBRATE    Offer the threshold curve; analyst picks the operating point
                by stating the tradeoff, not the number.
6  ATTACH       Propose which mechanisms this supports/contradicts and at
                what LR — as a *proposal* requiring human sign-off.
7  EXPLAIN      Plain-English statement of what it detects, what it cannot
                prove, and the confirmations it requires.
8  APPROVE      Human accepts. Rule ships with its fixtures attached.
```

Seconds per iteration, grounded in real data. The analyst never opens JSON.

## 9.6 Hard boundaries

- The agent authors **L1 observations and L2 patterns.** It may *propose* an L3 attachment. It may never author a mechanism or a verdict.
- Every agent output is a **candidate** until a human approves it. Approval is an ordinary review step — one person, one screen — not a governance ceremony.
- **The model is never in the inference path at analysis time.** Analysis is `f(evidence, ruleset@v, mechanisms@v)` — deterministic, replayable, diffable. Re-running an 18-month-old case reproduces it exactly.

That last constraint is what lets us drop governance. Determinism plus versioned artifacts plus replay *is* auditability. Four-eyes approval workflows, immutable release ceremonies, and lifecycle state machines were the current app's attempt to buy trust procedurally, at enormous UI cost, because the analysis itself was not reproducible. Make it reproducible and the ceremony becomes unnecessary.

## 9.7 Two further agentic surfaces

**Corpus mining — the compounding loop.** Point the agent at the adjudicated corpus: *"What distinguishes cases adjudicated as termination-failure from those adjudicated as grid?"* It mines candidate patterns, backtests them, and proposes the discriminators nobody had articulated. This is how the library grows without waiting for someone to notice something.

**The narrator.** Once the verdict is computed deterministically, an agent renders timeline + ledger into report prose — constrained to cite only pattern and observation IDs present in that run. A renderer, strictly downstream, never a reasoner.

---

# Part X — Data architecture

One decision unlocks everything above: **parse once, on the server, into a queryable feature store.** Rules, patterns, charts, cohorts, and the agent all read from it. Today there is no such layer, so every consumer re-parses and nothing can be asked across meters.

```sql
-- L0
meter_reading  (meter_id, run_id, ts, channel, value, quality, source_ref)
meter_event    (meter_id, run_id, ts, code, class, saturated, payload, source_ref)
meter_attr     (meter_id, run_id, key, value, source_ref)

-- L1 / L2 / L4
observation    (run_id, rule_id, status, value, unit, source_refs[])
pattern        (run_id, pattern_id, window_start, window_end, magnitude, evidence[])
hypothesis     (run_id, mechanism_id, prior, posterior, ledger, confidence_dials)

-- provenance
run            (id, case_id, evidence_hash, ruleset_v, mechanisms_v, adapter_v, started, finished)
```

`source_ref` on every row is the sheet + cell range. That gives provenance for free, end to end: click a point on the voltage chart → the finding that cites it → the cell it came from.

`saturated` on `meter_event` is one boolean that fixes the censoring blindness across all sixteen event rules at once.

---

# Part XI — The product: three screens

Governance removed, the surface collapses.

**1 · Queue** — what needs me. Status, age, leading mechanism, confidence, blocker, cohort flag. Sparkline of the meter's voltage in the row.

**2 · Case** — one screen, four bands:
```
VERDICT      leading mechanism · four dials · next best test · [ Adjudicate ]
TIMELINE     the instrument. voltage/current/PF, bands, event markers,
             truncation marker, defect date, brushable
LEDGER       supports / contradicts / gaps, each expanding to observations → cells
COHORT       "27 of 40 same-feeder returns share this mechanism"  [ Open cohort ]
```

**3 · Knowledge** — mechanisms, rules, corpus, and the forge workbench. Where the expert's time is invested rather than spent.

That is the entire application.

---

# Part XII — The learning loop and how we know it works

```
returns → analysis → verdict → analyst adjudicates (confirm / correct)
   → labelled case joins the corpus
   → forge proposes new patterns and recalibrates thresholds
   → analysis improves
```

Every adjudication is training data. A product that does not close this loop decays; one that does compounds. **Adjudication must therefore be one click and always present** — never a separate workflow, never optional.

| Metric | Meaning | Target |
|---|---|---|
| Time to verdict | Analyst minutes per routine return | < 4 min |
| Agreement rate | Verdict vs. expert adjudication | > 85% on routine |
| Auto-clear rate | Cases needing no expert time | > 50% |
| Coverage | Returns reaching actionable confidence | > 80% |
| Learning rate | Rules/patterns added per month from corrections | > 4 |
| Surveillance lead time | First occurrence → cohort alert | < 14 days |

The last one is where this stops being a case tool and becomes a quality system.

---

# Part XIII — Build order

**Stage 1 · The substrate.** Server-side parsing into the feature store. `saturated` on every event stream. Provenance refs throughout. Existing 60 rules re-pointed at the store, unchanged. *Nothing visible changes; everything becomes possible.*

**Stage 2 · The instrument.** Timeline component: series, bands, event markers, truncation marker, defect date, brushing. This is the single largest change in perceived quality.

**Stage 3 · Patterns.** The primitives from Part V — censoring, truncation, coincidence, dose, decoupling, testimony conflict. Roughly a dozen, each with fixtures.

**Stage 4 · Mechanisms and verdict.** Sit with the domain engineer, build 15–25 mechanisms, implement the ledger, the four dials, and next-best-test. *The product now answers questions.*

**Stage 5 · Cohort.** Population queries, auto-confirmation, surveillance alerts.

**Stage 6 · The forge.** Context object, tool surface, the eight-step loop, brush-to-rule from the timeline.

Stages 1–2 are prerequisites for everything. Stage 4 is where it becomes a product. Stage 6 is where it stops needing us.

---

# Part XIV — What we deliberately do not build

| Not building | Why |
|---|---|
| Governance lifecycle, four-eyes release, immutable version ceremony | Replaced by determinism + versioned artifacts + replay (§9.6) |
| An LLM anywhere in the analysis path | A9/A8. Verdicts must be reproducible byte-for-byte |
| A human-facing rule DSL | Nobody will write it. The forge exists precisely so nobody has to |
| A single confidence percentage | A5. Four dials or nothing |
| Per-case chat | Answers must be structured, cited, and replayable. Chat is none of those |
| Free-text RCA | A structured verdict renders to prose. Prose does not render to a structure |
| Mobile-first | This is a desk job on two screens. Tablet must *work*; it need not lead |

---

# Coda

The current system was built on an unexamined premise: *that the job is to check the meter's data against rules.*

The job is to **reconstruct what happened to a physical object from an incomplete record, attribute it, and find out how many more are coming.** Rules are one layer of evidence in that reconstruction — necessary, and nowhere near sufficient.

Everything here follows from taking A1 through A9 seriously. The most encouraging thing about the existing codebase is that L0 and L1 are already largely built, and built carefully. What is missing is the four layers above them — and the loop that lets a domain expert teach the system what they can see but cannot say.
