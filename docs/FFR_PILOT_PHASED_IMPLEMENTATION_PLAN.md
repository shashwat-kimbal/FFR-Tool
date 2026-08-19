# Kimbal FFR Intelligence

## File-First Pilot and Phased Implementation Plan

| Document field | Value |
| --- | --- |
| Purpose | Define the smallest end-to-end pilot that needs only two Excel files and meter images |
| Phase 1 input | One FFR IG register workbook, one BCS/DLMS workbook and one or more images |
| Phase 1 output | Draft RCA, draft CAPA, audit package and an updated copy of the FFR IG workbook |
| Last updated | 4 August 2026 |
| Product specification | `docs/FFR_PRODUCT_ARCHITECTURE_SPEC.md` |
| UI/UX guide | `docs/FFR_UI_UX_DESIGN_SYSTEM.md` |

---

## 1. Pilot objective

The pilot must prove one narrow promise:

> A user uploads the current FFR IG Excel register, the corresponding BCS/DLMS Excel report and a few meter images. Without completing another data-entry form, the application identifies the correct meter case, analyzes the supplied evidence, applies the approved Phase 1 rule catalogue, generates a traceable draft RCA and CAPA, updates the correct row in a copy of the FFR IG workbook and returns all outputs for download.

The pilot is not an integration project. It is a file-first diagnostic workflow that validates whether the rules, evidence model, image analysis and RCA/CAPA output are useful before SAP, MES, HES, Deepu's module or laboratory equipment are connected.

---

## 2. Non-negotiable Phase 1 behavior

### 2.1 Only required user input

The upload screen accepts one analysis package containing:

1. `FFR IG workbook` — `.xlsx` register containing the customer/field case row.
2. `BCS/DLMS workbook` — `.xlsx` technical meter report in the current 16-sheet format.
3. `Meter images` — one or more `.jpg`, `.jpeg`, `.png` or `.webp` files.

The user does not manually enter meter number, complaint, product family, RCA fields, CAPA fields or status for the normal happy path.

### 2.2 One deliberate user action

After automatic validation, the user clicks `Run analysis`. This confirms that the detected files and matched row are the intended analysis package; it does not request additional technical information.

### 2.3 Outputs

The run produces:

- matched FFR case summary;
- original complaint classification;
- BCS/DLMS data-quality report;
- deterministic signals;
- image observations;
- rule evaluation log;
- ranked hypotheses;
- evidence-linked draft RCA;
- draft correction, corrective action and CAPA;
- analysis/audit JSON for reproducibility;
- internal RCA PDF/DOCX when report generation is enabled;
- updated copy of the uploaded FFR IG workbook.

All results are labelled `Pilot-generated draft — review required`. The pilot does not claim Quality approval merely because the files were processed.

---

## 3. What the attached workbooks contain

### 3.1 FFR IG register

The supplied `260601-FFR IG.xlsx` contains one sheet, `Sheet1`, with columns `A:AF` and three data rows.

The row provides:

- case serial number and subdivision;
- defect and replacement dates;
- old and new meter numbers;
- meter type/stage/make;
- defect trigger, symptom and field observations;
- dispatch, receipt and replacement information;
- Kimbal observation and RCA fields;
- correction, corrective action and CAPA fields.

### 3.2 BCS/DLMS report

The supplied `AS2373952_Reports_2026-06-30_16-07-28.xlsx` contains 16 sheets:

1. Active Season Profile
2. Passive Season Profile
3. MeterConfiguration
4. SelfDiagnostic
5. IP
6. BillingProfile
7. BlockLoadProfile
8. DailyLoadProfile
9. BillingConsumption
10. DailyLoadConsumption
11. CurrentRelatedEvent
12. OtherEvent
13. ControlEvent
14. PowerRelatedEvent
15. TransactionEvent
16. VoltageRelatedEvent

This workbook provides meter identity, configuration, self-diagnostics, instantaneous values, billing/load profiles, energy registers and event history.

### 3.3 Important mismatch in the supplied files

The DLMS report identifies meter `AS2373952`. The FFR register contains these old meter numbers:

- `SC10222714`;
- `SC10226881`;
- `SC10222115`.

There is no exact match in `Old_Meter_Number` or `New_Meter_Number`. The application therefore cannot know which customer complaint belongs to `AS2373952` without another input.

For the zero-entry happy-path demo, provide either:

- an FFR IG workbook containing exactly one row whose old/new meter number is `AS2373952`; or
- a BCS/DLMS workbook for exactly one of the meter numbers present in the FFR IG file.

The mismatch is a valid Phase 1 identity-exception test and must never be bypassed automatically.

---

## 4. Phase 1 automatic input detection

The user may drop all files together. The application identifies file roles from workbook signatures, not file names.

### 4.1 FFR IG signature

An Excel file is recognized as an FFR IG register when a sheet contains required normalized headers including:

- `S.No`;
- `Old_Meter_Number`;
- `New_Meter_Number`;
- `Defect Trigger`;
- `Symptoms of the problem New`;
- `Field Observation`;
- `Root Cause Analysis Details from Kimbal`;
- `Corrective Action`;
- `CAPA No.`;
- `Status Of CAPA`.

Header normalization may ignore leading/trailing whitespace, repeated newlines and case. It must not guess a mapping when two columns normalize to the same name.

### 4.2 DLMS signature

An Excel file is recognized as the current DLMS format when it contains:

- `MeterConfiguration`;
- `SelfDiagnostic`;
- `IP`;
- at least one profile sheet;
- at least one event sheet;
- a meter serial number object/value.

The adapter records which expected sheets are present, missing, empty or structurally incompatible.

### 4.3 Image signature

Supported image MIME types are detected from file content, not extension alone. Image view type is initially inferred by the vision model:

- exterior/front;
- display/nameplate;
- terminal area;
- opened assembly;
- PCB full view;
- power-supply region;
- communication/NIC region;
- relay/current path;
- unknown.

Unknown views remain available as evidence and reduce coverage; the pilot does not force the user to label them before analysis.

### 4.4 Package validation result

Before `Run analysis`, show only derived information:

- detected FFR workbook and row count;
- detected DLMS workbook and meter ID;
- matched FFR row and complaint, if unique;
- inferred product family;
- image count and inferred views;
- blocking errors and non-blocking warnings.

---

## 5. Case matching without manual input

### 5.1 Identity extraction

Extract the canonical DLMS meter serial from the `MeterConfiguration` identity row. Cross-check the same value in other sheets when present.

Normalize for matching only:

- trim whitespace;
- convert to uppercase;
- remove approved visual separators such as spaces and hyphens if the configured meter-number policy allows them.

Preserve the original strings.

### 5.2 Matching order

1. Exact normalized match against `Old_Meter_Number`.
2. If none, exact normalized match against `New_Meter_Number`.
3. If exactly one candidate exists, select it.
4. If zero candidates exist, stop with `IDENTITY_NO_MATCH`.
5. If more than one candidate exists, stop with `IDENTITY_AMBIGUOUS`.

Do not use fuzzy matching, complaint similarity, row order or image appearance to select a customer row.

### 5.3 Phase 1 identity exceptions

The exception page may display candidate rows and detected IDs, but resolving it is outside the zero-input happy path. The run remains safely incomplete and no workbook columns are updated.

---

## 6. Product-family and complaint classification

### 6.1 Product families

The catalogue supports:

- Meter;
- NIC, the communication module;
- Gateway.

The versioned source is `rules/catalogues/customer-issue-catalogue.v1.json`.

### 6.2 Product-family detection

Phase 1 detects product family deterministically from an approved mapping table over:

- FFR `Meter type`;
- FFR `Old_Meter_Type`;
- known model/type values in the DLMS package;
- workbook adapter type.

`LTCT DT` is initially mapped to `METER`. Stakeholders must provide the remaining actual values used for NIC and Gateway. When no unique mapping exists, the run stops at `PRODUCT_FAMILY_UNRESOLVED`; AI does not choose the family in Phase 1.

### 6.3 Complaint source fields

Read complaint evidence from these FFR columns:

1. `Defect Trigger`;
2. `Symptoms of the problem New`;
3. `Field Observation`;
4. `Field Person visit Observation Report`.

The original text is preserved and shown together.

### 6.4 Deterministic complaint mapping

Phase 1 uses an approved synonym/mapping table. It may resolve:

- an exact subcategory, such as `METER:T:T9`;
- a category-only complaint, such as `METER:D` when `Display Defective` does not distinguish D1–D6;
- `OTHER` with preserved original text;
- `UNCLASSIFIED` when no safe mapping exists.

Category-only mapping is valid. The system must not invent a detailed customer symptom that was not in the FFR row.

### 6.5 Complaint is not RCA

The complaint only selects an initial rule pack and supplies context. A customer report of `Meter Burnt` does not prove burn location, mechanism, origin or liability.

---

## 7. Phase 1 analysis pipeline

```text
Upload package
  -> Detect file roles
  -> Validate workbook/image formats
  -> Extract DLMS identity
  -> Match exactly one FFR row
  -> Determine product family
  -> Classify complaint deterministically
  -> Normalize DLMS data
  -> Calculate deterministic features
  -> Analyze images into observations
  -> Select applicable approved rules deterministically
  -> Execute every applicable rule
  -> Build evidence graph and candidate hypotheses
  -> Use AI to synthesize/rank within the approved hypothesis set
  -> Generate draft RCA and CAPA
  -> Write mapped values into a copy of the FFR workbook
  -> Offer output downloads
```

### 7.1 No hidden data dependency

Phase 1 must not require SAP, MES, HES, Deepu's API, WMS, laboratory equipment, an external case database or a manual form to complete the happy path.

### 7.2 Missing evidence

If images are few or a DLMS sheet is empty, the run continues when technically possible. Missing evidence is explicit and affects evidence coverage and the allowed RCA depth.

### 7.3 Stop behavior

The pilot may stop safely as:

- `DRAFT_CONFIRMED_FROM_SUPPLIED_EVIDENCE`;
- `DRAFT_HIGHLY_PROBABLE`;
- `DRAFT_PROBABLE`;
- `NO_FAULT_REPRODUCED`;
- `INCONCLUSIVE`;
- `MANUAL_VALIDATION_RECOMMENDED`.

Only the first three generate a cause-specific CAPA draft. NFR/inconclusive cases create an investigation or data-quality action rather than pretending a corrective action is known.

---

## 8. Phase 1 BCS/DLMS feature library

The engine calculates features before rules run. Rules reference stable feature codes rather than workbook cells.

### 8.1 Identity and configuration

- meter serial and cross-sheet agreement;
- manufacturer/device ID;
- firmware version;
- meter type/category/current rating/year;
- configuration completeness;
- MD integration period;
- unexpected configuration variation when a reference is configured.

### 8.2 Self-diagnostic

- overall diagnostic status;
- RTC battery status;
- main battery status;
- NVM status;
- cross-sheet retrieval-time consistency.

### 8.3 Instantaneous and register data

- meter RTC/retrieval offset;
- voltage/current/frequency/PF/apparent and active power;
- phase-neutral difference;
- import/export cumulative energy;
- maximum demand and timestamps;
- power-on duration;
- tamper/billing/programming counts;
- load-limit status/value.

### 8.4 Profiles and consumption

- record count and time window;
- expected interval;
- missing, duplicate and out-of-order intervals;
- long gaps;
- zero-voltage and zero-current periods;
- voltage/current distribution and configured excursions;
- import/export increments;
- monotonicity;
- PF proxy with small-value safeguards;
- impossible or suspicious repeated values;
- profile-versus-register consistency where comparable.

### 8.5 Events

- occurrence/restoration pairing;
- duration and open/unrestored events;
- overvoltage/undervoltage;
- power failure;
- current reversal;
- low PF;
- connect/disconnect;
- load-limit enable/disable;
- RTC/date-time transactions;
- activity-calendar/configuration changes;
- event chronology relative to complaint/defect date.

### 8.6 Data-quality signals

- missing required sheet/header;
- unparseable date/number;
- conflicting identity;
- invalid scaler/unit;
- duplicate record;
- implausible interval value;
- event-pair ambiguity;
- incomplete data window;
- workbook-version uncertainty.

---

## 9. Phase 1 deterministic rule engine

### 9.1 Core principle

Phase 1 does not ask AI which rules to apply. The engine loads the active approved bundle, filters by deterministic applicability and runs every applicable rule.

### 9.2 Applicability filter

A rule is applicable when all of these are true:

- product family matches;
- complaint key or category matches, or rule is global/data-quality;
- meter model/variant matches when constrained;
- required source/features exist;
- rule is active for the run date;
- no exclusion condition applies.

### 9.3 Rule evaluation output

Each evaluation stores:

- rule ID/version;
- applicable/not-applicable decision and reason;
- input feature values;
- condition results;
- observations created;
- hypotheses strengthened, weakened or ruled out;
- recommended evidence/manual validation;
- maximum supported outcome;
- analyst/report-safe explanation.

### 9.4 Rule packs

Build the catalogue in this order:

#### Foundation pack

- workbook/data-quality rules;
- identity/configuration rules;
- RTC/retrieval alignment;
- profile completeness and register consistency;
- event occurrence/restoration quality.

#### Meter diagnostic packs

- D: Display Defective;
- F: No Display;
- S: Meter Dead;
- C: Communication Issue;
- E: Abnormal Reading;
- A: Accuracy Failure;
- R: RTC Failure;
- T: Tampered Event;
- O: Output Issue;
- M: Physically Damaged;
- B: Burnt;
- Other/unclassified.

#### NIC packs

- C: Communication Issue;
- M: Physical Damage;
- Other.

#### Gateway packs

- F: No Display;
- S: Dead;
- C: Communication Issue;
- M: Physical Damage;
- B: Burnt;
- Other.

### 9.5 Rule coverage screen

The application/admin build shows a read-only matrix:

- product family;
- complaint category/subcategory;
- number of active rules;
- required DLMS fields/images;
- fixture count;
- reviewer;
- last version;
- coverage status: none, partial or pilot-approved.

Phase 1 cannot claim `all rules present` until every supported pilot complaint has a reviewed status and the release owner accepts any intentionally unsupported codes.

### 9.6 Rule-building sessions

For each complaint code, Kimbal domain experts and the implementation team will jointly record:

1. What facts in the BCS workbook support the complaint?
2. What facts contradict it?
3. What data-quality failures can mimic it?
4. What image observations are relevant?
5. What hypotheses should be considered?
6. What thresholds/boundaries apply by model?
7. What can be concluded without laboratory validation?
8. What CAPA patterns are allowed for each confirmed/probable mechanism?
9. What positive, negative and boundary historical cases validate the rule?

The source template is `rules/templates/bcs-diagnostic-rule.template.yaml`.

---

## 10. Phase 1 AI responsibilities

### 10.1 AI may

- classify uploaded images by view type;
- extract visible observations using the failure-point ontology;
- describe image quality and missing views;
- summarize the deterministic DLMS findings;
- rank the hypotheses produced by approved rules;
- identify supporting, contradictory and missing evidence references;
- draft RCA wording within the supported causal depth;
- draft correction/corrective-action/CAPA wording from approved templates.

### 10.2 AI may not

- select the rule pack or suppress an applicable rule;
- create an unapproved rule;
- change feature values;
- match an ambiguous FFR row;
- invent a product family or detailed complaint;
- convert a customer complaint into a confirmed cause;
- claim component-level failure without supporting evidence;
- mark an output Quality-approved;
- overwrite the uploaded FFR workbook.

### 10.3 AI provider

Use the existing admin-managed Vertex/OpenRouter provider abstraction. Phase 1 can use separate configured models for image analysis and structured reasoning. Every response must pass a strict schema and retain provider, model and prompt version.

---

## 11. RCA generation in Phase 1

### 11.1 RCA fields

The draft contains:

- customer-reported complaint;
- product family and complaint classification;
- supported symptom from supplied evidence;
- failed function;
- subsystem/failure region;
- component/node only when supported;
- mechanism only when supported;
- initiating cause only when supported;
- contributing factors;
- origin only when supported;
- contradictory/missing evidence;
- outcome level;
- AI hypothesis score plus deterministic rule/evidence support;
- source references and rule versions.

### 11.2 Draft wording policy

- Use `Evidence indicates`, `Evidence supports` or `Probable` when appropriate.
- Use `Not established from supplied evidence` for unsupported causal levels.
- Never write `confirmed` solely because the hypothesis has the highest AI score.
- Separate data-quality anomalies from meter faults.
- A workbook mapping/scaler anomaly must not be reported as a physical meter failure without corroboration.

---

## 12. CAPA generation in Phase 1

### 12.1 Generated fields

- CAPA ID;
- linked case/run/RCA draft;
- containment proposal;
- case correction;
- corrective action;
- preventive action where supported;
- recommended internal owner role/department, not a fabricated person's name;
- due-date policy placeholder;
- implementation evidence requirement;
- effectiveness metric and observation window;
- status.

### 12.2 CAPA numbering

Use a collision-safe application ID such as:

`CAPA-PILOT-2026-000001`

Do not imitate an existing customer CAPA number sequence without confirmed ownership rules.

### 12.3 CAPA status after automatic analysis

The default Excel write-back value is:

`Draft - review required`

No automatic run writes `Closed` or `Effective`.

---

## 13. FFR IG Excel write-back contract

### 13.1 General rules

- Never overwrite the uploaded original.
- Export a new `.xlsx` copy.
- Preserve the original sheet name, row order, formulas, formatting, widths, dates and untouched values.
- Update exactly one uniquely matched row.
- Write values only to approved target cells.
- Keep an application-side audit record containing old/new values and cell addresses.
- Name output using the original name plus `_Kimbal_Analyzed_<timestamp>.xlsx`.

### 13.2 Phase 1 target columns

| Column | Existing header | Phase 1 output |
| --- | --- | --- |
| Z | Initial Observation at KIMBAL | Concise factual DLMS and image summary; no cause language |
| AA | Root Cause Analysis Details from Kimbal | Draft RCA, supported causal depth, outcome level and material missing/contradictory evidence |
| AB | Correction by KIMBAL | Meter/case-specific correction proposal |
| AC | Corrective Action | System/process corrective-action proposal |
| AD | CAPA No. | Generated pilot CAPA ID |
| AE | Status Of CAPA | `Draft - review required` |

Do not update these fields from file analysis alone:

- Q/T/Y physical send/receipt milestones;
- V/W/AF replacement status/dates;
- P fault responsibility;
- SAP/logistics values.

### 13.3 Example cell content

`Z — Initial Observation at KIMBAL`

> DLMS package validated. Self-diagnostics report OK. Repeated overvoltage, power-failure and current-reversal events were detected; a long profile gap and an export-value mapping anomaly reduce data confidence. Image review identified [accepted observations / no visible anomaly].

`AA — Root Cause Analysis Details from Kimbal`

> Pilot draft — review required. Available evidence supports [subsystem/mechanism] as [probable/highly probable]. Exact component and initiating cause are not established without direct validation. Supporting rules: [...]. Contradictory or missing evidence: [...].

Content length must be capped or summarized so the existing workbook remains usable. The full result stays in the application/report.

### 13.4 Export validation

Before download:

- reopen the exported workbook;
- confirm target row and values;
- confirm all other cells are unchanged by value/formula;
- confirm source formatting is preserved;
- scan for formula errors;
- render `A1:AF<last-row>` or the updated row area for visual verification.

---

## 14. Phase 1 user experience

### Screen 1 — New pilot analysis

- One drop zone labelled `Upload FFR IG, BCS/DLMS and meter images`.
- File-role detection cards.
- No technical form.
- `Run analysis` enabled only after a unique identity match and valid minimum package.

### Screen 2 — Processing

Show a logical checklist:

1. Files validated
2. Meter identity matched
3. Complaint classified
4. DLMS features calculated
5. Images analyzed
6. Rules evaluated
7. Hypotheses ranked
8. RCA drafted
9. CAPA drafted
10. FFR IG export prepared

Each failed step shows the exact reason. Processing is a background job; refreshing must not lose it.

### Screen 3 — Results

Sections in this order:

1. Matched FFR row and customer complaint
2. Analysis outcome and disclaimer
3. Important DLMS/image observations
4. Applied rules
5. Ranked hypotheses and evidence
6. Draft RCA
7. Draft CAPA
8. Downloads

Primary action: `Download updated FFR IG`.

Secondary downloads:

- internal RCA report;
- CAPA report;
- analysis JSON/audit bundle.

### Screen 4 — Identity/data exception

Show detected identifiers, candidate rows, failing file/sheet and reason. Do not produce an updated workbook.

---

## 15. Phase 1 technical build slices

### Phase 1A — File pipeline and workbook round-trip

Goal: prove that the correct row can be matched and updated without damaging Excel.

Build:

- upload/storage/job foundation;
- FFR IG detector/parser;
- DLMS detector and identity extraction;
- exact row matcher;
- image upload preservation;
- result/run state;
- safe FFR IG copy/export;
- identity/format exception screens.

Acceptance:

- matched files update only Z:AE in the correct row;
- mismatched attached files stop safely;
- exported workbook reopens and retains style/formulas.

### Phase 1B — Deterministic DLMS intelligence

Goal: convert the workbook into stable technical facts.

Build:

- versioned 16-sheet adapter;
- normalized meter data model;
- deterministic feature library;
- data-quality findings;
- event pairing;
- profiles/register calculations;
- analysis summary and source trace.

Acceptance:

- golden fixture outputs are repeatable;
- every feature links to source records and calculation version;
- impossible/mapping anomalies are not mislabeled as physical faults.

### Phase 1C — Complaint catalogue and rules

Goal: run reviewed engineering logic for supported complaints.

Build:

- product-family mapping;
- complaint mapping/synonyms;
- rule schema/loader/evaluator;
- rule-fixture test harness;
- rule coverage matrix;
- initial foundation and Meter rule packs developed jointly.

Acceptance:

- every run records applicable/non-applicable rules and versions;
- rule selection is deterministic;
- unsupported complaints end honestly as unclassified/inconclusive.

### Phase 1D — Vision and hybrid RCA/CAPA

Goal: produce the full pilot output from supplied files.

Build:

- Vertex/OpenRouter configuration;
- image view/finding schemas;
- vision analysis;
- evidence graph;
- AI hypothesis ranking over rule-generated candidates;
- RCA/CAPA drafting;
- Excel write-back text generation;
- PDF/DOCX and audit export.

Acceptance:

- upload-to-download flow completes with no extra data entry;
- all AI outputs are schema-validated and evidence-linked;
- drafts clearly distinguish observation, inference and unsupported depth.

### Phase 1E — Pilot hardening

Goal: make the demo repeatable and safe.

Build:

- authentication/RBAC;
- run history;
- retries and provider failure handling;
- file limits and security checks;
- accessibility/tablet layouts;
- deterministic reset/demo fixtures;
- reviewed rule/model version pinning.

Acceptance:

- the golden package succeeds repeatedly;
- mismatch, invalid workbook, insufficient image and AI failure scenarios are demonstrated;
- no original source file is modified.

---

## 16. Phase 2 — AI-assisted rule orchestration and offline testing

Phase 2 adds evidence and decision support; it does not remove the Phase 1 engine.

### 16.1 AI recommends which approved rules to apply

AI receives:

- product family and complaint;
- available source/feature inventory;
- active approved rule metadata;
- prior rule results;
- image observations;
- current hypotheses and missing evidence.

AI returns an ordered rule recommendation with reasons. Before execution, the deterministic engine verifies:

- rule is active and approved;
- product/model applicability;
- prerequisites available;
- safety/evidence-preservation constraints;
- no prohibited combination;
- no required rule was omitted.

The system records AI-recommended, engine-added mandatory, rejected and executed rules separately.

### 16.2 Offline machine/test data

Users may run approved tests on offline equipment and enter or upload results later.

Required capabilities:

- versioned test catalogue;
- product/model applicability;
- test instructions and safety prerequisites;
- equipment and calibration metadata;
- manual measurement entry;
- CSV/Excel result upload;
- units/ranges/pass-fail validation;
- image/file attachments;
- operator and timestamp;
- hypothesis/rule update after result;
- immutable test execution history.

Offline equipment is not controlled by the application in Phase 2. The application records results and provenance only.

### 16.3 Phase 2 rule loop

```text
Existing evidence
  -> AI recommends approved rule/test sequence
  -> deterministic policy validates it
  -> analyst performs offline test
  -> result entered/uploaded
  -> feature and rule evaluations update
  -> hypotheses reranked
  -> RCA depth/confidence updates
```

### 16.4 Other Phase 2 candidates

- analyst/Quality review workflow and report approval;
- multiple analysis versions per case;
- Deepu return-module synchronization;
- SAP GRN/return/repair/scrap status;
- MES genealogy and population back-tracing;
- richer CAPA assignment/effectiveness;
- batch/master RCA;
- dashboards and operational queues;
- SSO adapter;
- historical-case retrieval and similarity;
- model/rule performance monitoring.

These must be prioritized after Phase 1 evidence and rule quality are proven.

---

## 17. Later phases

### Phase 3 — Enterprise workflow and population learning

- production Deepu/SAP/MES adapters;
- stable RBAC/SSO;
- reviewer-approved batch RCA;
- affected-population analysis;
- CAPA effectiveness trends;
- integration monitoring;
- production reporting and retention.

### Phase 4 — HES evidence

- HES source adapter;
- communications/outage/command chronology;
- timestamp alignment with DLMS and complaint;
- completeness and external-request states;
- HES-specific rules.

HES remains later by design and must not block Phase 1 or Phase 2.

### Phase 5 — Controlled laboratory automation

- direct equipment integration where APIs exist;
- automatic raw-reading capture;
- calibration enforcement;
- guided test execution;
- safety and evidence-preservation gates;
- approved next-best-test orchestration.

---

## 18. Pilot data model

Minimum Phase 1 entities:

- `PilotRun`;
- `UploadedArtifact`;
- `FFRRegisterSnapshot`;
- `FFRRegisterRow`;
- `DLMSPackage`;
- `DLMSFeature`;
- `ImageEvidence`;
- `VisualFinding`;
- `ComplaintClassification`;
- `RuleBundle`;
- `RuleEvaluation`;
- `Hypothesis`;
- `EvidenceLink`;
- `RCADraft`;
- `CAPADraft`;
- `ExportArtifact`;
- `AIRun`;
- `AuditEvent`.

`PilotRun` is the root aggregate. An upload may fail before an FFR case is created, so validation/identity exceptions must still be stored against the run.

---

## 19. Phase 1 state machine

```text
CREATED
  -> UPLOADING
  -> DETECTING_FILES
  -> VALIDATING_FILES
  -> MATCHING_IDENTITY
  -> READY_TO_ANALYZE
  -> EXTRACTING_DLMS
  -> ANALYZING_IMAGES
  -> EVALUATING_RULES
  -> RANKING_HYPOTHESES
  -> DRAFTING_RCA_CAPA
  -> GENERATING_EXPORTS
  -> COMPLETE
```

Exception states:

- `MISSING_REQUIRED_FILE`;
- `UNRECOGNIZED_WORKBOOK`;
- `INVALID_FFR_SCHEMA`;
- `INVALID_DLMS_SCHEMA`;
- `IDENTITY_NO_MATCH`;
- `IDENTITY_AMBIGUOUS`;
- `PRODUCT_FAMILY_UNRESOLVED`;
- `COMPLAINT_UNCLASSIFIED` as non-blocking when rules permit;
- `IMAGE_ANALYSIS_FAILED` as non-blocking when DLMS-only analysis remains possible;
- `RULE_BUNDLE_UNAVAILABLE`;
- `AI_PROVIDER_FAILED`;
- `EXPORT_FAILED`.

Retry resumes from the failed stage and never repeats successful irreversible storage steps.

---

## 20. Phase 1 acceptance scenarios

### Scenario A — Happy path

- FFR register contains exactly one row matching the DLMS meter ID.
- Complaint maps to a supported Meter category.
- DLMS workbook validates.
- At least one usable image is present.
- Rules run and generate hypotheses.
- RCA/CAPA drafts are generated.
- Z:AE in the matched row are updated in an exported copy.
- Original remains byte-for-byte unchanged.

### Scenario B — Supplied attachment mismatch

- DLMS ID `AS2373952` has no matching FFR row.
- Run stops at `IDENTITY_NO_MATCH`.
- No RCA/CAPA or updated FFR workbook is produced.
- UI clearly lists detected ID and FFR row identities.

### Scenario C — Multiple matching rows

- Two rows share the same old/new meter number.
- Run stops at `IDENTITY_AMBIGUOUS`.
- No first-row or latest-row assumption is allowed.

### Scenario D — Generic complaint

- FFR says only `Display Defective`.
- Complaint maps to Meter/Display category, not a fabricated D1–D6 subcategory.
- Category-level rules run.

### Scenario E — Sparse images

- Image view cannot be classified or lacks the relevant region.
- DLMS/rules continue.
- Visual evidence coverage is low and RCA depth is constrained.

### Scenario F — AI unavailable

- Deterministic feature/rule results remain available.
- Run may retry AI or end with `AI_PROVIDER_FAILED`.
- It does not fabricate RCA/CAPA text.

### Scenario G — Inconclusive evidence

- No hypothesis reaches the allowed evidence threshold.
- Draft states `Inconclusive` and lists missing validation.
- CAPA becomes an investigation/data-quality action, not a false cause-specific corrective action.

### Scenario H — Workbook preservation

- Only the six approved cells in one row change.
- Date formats, colors, widths, formulas and other rows remain unchanged.
- Export reopens and renders correctly.

---

## 21. Decisions still required for Phase 1

### Blocking for the happy-path demo package

1. A matched pair of FFR IG row and BCS/DLMS workbook.
2. The meter images for that same physical unit.

### Blocking for rule completeness

3. Failure-point image/ontology.
4. Product-family mapping values used in actual FFR IG files.
5. Complaint synonym mappings from actual field wording.
6. BCS diagnostic rule definitions, thresholds and model exceptions created with domain experts.
7. At least one positive and negative reviewed case for each activated rule pack.

### Blocking for final output wording

8. Approved RCA wording/template.
9. Approved correction/corrective-action distinctions.
10. CAPA numbering owner and status vocabulary.
11. Maximum acceptable cell text for Z:AC.
12. Whether the pilot export should generate comments or a separate audit sheet in addition to Z:AE updates.

### Configuration decisions

13. Initial Vertex/OpenRouter models and credentials.
14. Maximum workbook/image size and image count.
15. Pilot retention period and user access list.

---

## 22. Recommended immediate next actions

1. Replace one FFR IG row with a matched `AS2373952` pilot case or supply its actual FFR row.
2. Upload the images for that same meter.
3. Approve the Phase 1 write-back columns Z:AE and `Draft - review required` status.
4. Confirm actual FFR values that map to Meter, NIC and Gateway.
5. Conduct the first rule session for the matched complaint category.
6. Build Phase 1A workbook round-trip before adding AI.
7. Lock the golden fixture and expected deterministic feature manifest.
8. Implement the remaining phases in the order defined above.
