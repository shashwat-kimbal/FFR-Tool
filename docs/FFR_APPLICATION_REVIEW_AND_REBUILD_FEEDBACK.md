# Kimbal FFR Intelligence

## Application Review and Rebuild Feedback

| Field | Value |
| --- | --- |
| Review basis | Phase 1 file-first pilot plan, product architecture specification, UI/UX design system, current source code and supplied pilot workbooks |
| Review date | 4 August 2026 |
| Current status | Front-end proof of concept; not ready for pilot acceptance |
| Intended audience | Product, engineering, quality and design teams |

---

## 1. Executive assessment

The current application is not yet the end-to-end Phase 1 pilot defined in the approved plan. It is a useful visual shell containing partial workbook detection, exact meter matching, a small DLMS feature extractor and a basic rule-evaluation demonstration. It does not yet implement the evidence pipeline, vision analysis, governed rule bundle, competing hypotheses, structured RCA, structured CAPA, workbook write-back, downloadable reports, persistent history, audit trail or RBAC required for pilot completion.

The primary concern is not styling alone. The interface currently describes capabilities such as immutable evidence, pinned versions, server-side credentials, retained history and enforced access policies even though those controls do not exist in the implementation. A prototype may simulate future capabilities, but every simulated or unavailable capability must be explicitly labelled.

### 1.1 Readiness scorecard

| Area | Assessment |
| --- | ---: |
| Visual application shell | 6/10 |
| Workflow clarity | 3/10 |
| Workbook handling | 3/10 |
| BCS/DLMS analysis | 2/10 |
| Deterministic rule engine | 2/10 |
| Image and AI analysis | 0/10 |
| RCA and CAPA integrity | 1/10 |
| Persistence, audit and RBAC | 0/10 |
| Automated testing | 2/10 |
| Estimated Phase 1 completion | 20–25% |

The production build, lint command and existing tests pass. The existing tests, however, are predominantly string-presence checks and do not prove the required business workflow.

---

## 2. Work completed in the right direction

The following foundations should be retained and improved:

- The navy sidebar, white surfaces, pale canvas and Kimbal blue broadly follow the supplied product reference.
- Workbook roles are inferred partly from workbook structure rather than filenames alone.
- Exact meter-number matching is enforced.
- An identity mismatch does not provide an unsafe `Continue anyway` action.
- Meter, NIC and Gateway complaint catalogues are represented as configuration.
- Rule evaluation attempts to display conditions and explanations.
- Generated RCA and CAPA text is labelled as requiring review.
- HES, SAP, MES and laboratory integrations have not been added to the Phase 1 path. This is correct because they belong to later phases.
- Status indicators generally combine color with text.
- Visible keyboard focus styling and reduced-motion support are present.

These are foundations only and should not be presented as completed Phase 1 capabilities.

---

## 3. P0 functional blockers

### 3.1 The end-to-end Phase 1 output is missing

The required Phase 1 journey is:

> Upload one FFR IG workbook, one matching BCS/DLMS workbook and meter images; perform one analysis action; receive evidence, image findings, rule results, ranked hypotheses, draft RCA, draft CAPA, an audit package and an updated copy of the FFR IG workbook.

The current application ends with two generated paragraphs. It does not create:

- an updated copy of the FFR IG workbook;
- write-back to the approved Z:AE columns;
- a CAPA ID;
- analysis/audit JSON;
- internal RCA PDF or DOCX;
- CAPA report;
- downloadable evidence package;
- persistent run record.

The only implemented download is a JSON copy of browser settings and rule drafts. Phase 1 cannot be accepted until the FFR workbook is safely copied, updated, reopened, validated and downloaded.

### 3.2 `Run analysis` does not start a governed analysis run

Rule evaluations are calculated immediately when files, rules or settings change. The `Run analysis` control only changes a Boolean used to reveal the already-calculated output.

Consequences:

- no run ID is created;
- no start/completion timestamps are recorded;
- no rule/model/configuration versions are pinned;
- no audit event is written;
- no background or processing state exists;
- changing a rule or template changes the apparent result of the same run.

A real run must create an immutable snapshot containing source hashes, parser version, feature version, rule-bundle version, model version, user, timestamps, outcome and exports.

### 3.3 Images are counted but not analyzed

The current image implementation checks MIME type or filename extension, increments an image counter and displays that the evidence was retained. It does not:

- validate the actual file signature;
- preserve the image;
- calculate a hash;
- show a thumbnail;
- classify the image view;
- assess image quality;
- call Vertex or OpenRouter;
- generate structured visual findings;
- link findings to hypotheses;
- allow analyst acceptance, rejection or correction.

The image disappears with the browser session. The interface must not state that it has been retained.

### 3.4 AI configuration is not connected to an AI service

Provider and model names are editable, but no provider adapter, server route or model call exists. There is no vision response, structured reasoning response, schema validation, prompt version, model attribution or AI failure fallback.

The current RCA and CAPA are static template interpolation. This is not vision-based RCA or hybrid AI/deterministic analysis.

### 3.5 No usable approved rule bundle is supplied

The repository currently contains:

- the complaint catalogue;
- two complaint-synonym mappings;
- one generic draft rule template;
- no active diagnostic rules by default;
- no positive, negative or boundary fixtures;
- no rule-coverage matrix.

The application nevertheless allows analysis to run with zero active rules and returns an inconclusive result. The correct state is `RULE_BUNDLE_UNAVAILABLE`, which must block the run.

The interface also reports three supported product families because three catalogues exist. Operational mapping currently supports only the observed `LTCT DT → METER` value. Catalogue presence must not be presented as implemented diagnostic coverage.

### 3.6 Rule outcomes are unsafe

The current logic makes the result `Probable — review required` whenever one or more rules match. It does not enforce:

- rule weight;
- `allowedOutcome`;
- required feature availability;
- evidence coverage;
- contradictory evidence;
- image requirements;
- supporting versus weakening rules;
- component-validation requirements;
- causal-depth limits.

Rule weight is displayed but not used for ranking. Required features and allowed outcome are displayed but not enforced. A single threshold comparison must never automatically become a probable RCA.

### 3.7 Competing hypotheses are not implemented

The required diagnostic workspace needs:

- candidate hypotheses;
- rank and hypothesis state;
- supporting evidence;
- contradictory evidence;
- missing evidence;
- weakened and ruled-out hypotheses;
- evidence coverage;
- deepest defensible outcome.

The current application concatenates matched rule labels into one sentence. There is no hypothesis state, scoring, ranking, evidence graph or contradiction model.

### 3.8 RCA and CAPA are not structured records

The RCA must separately store reported observation, reproduced symptom, failed function, subsystem, component/node, mechanism, initiating cause, contributors, origin, escape point, liability state, evidence, contradictions, outcome and missing validation.

The CAPA must store a CAPA ID, linked RCA version, containment, correction, corrective action, preventive action, recommended owner role, status, due date, implementation evidence and effectiveness rule.

The current interface renders two prose paragraphs. These paragraphs cannot support review, version comparison, safe reporting, assignment, write-back or audit.

### 3.9 Persistence and governance claims are not implemented

Rules and settings are saved in browser `localStorage`. The database schema is empty and there are no persistence routes or evidence-storage adapters.

The following interface statements are therefore inaccurate:

- evidence is immutable;
- published versions are pinned;
- historic runs retain their recorded bundle;
- retention is enforced;
- access policy is enforced;
- credentials remain server-side.

These statements must either be backed by working controls or labelled `Not implemented in this build`.

### 3.10 Authentication and RBAC are absent

An authentication helper exists but is not connected to the application. There is no authenticated user, role lookup, protected route, permission-based navigation or separation of duties.

Any visitor can currently change mappings, templates, access-policy text, rules and AI configuration. A person can also create and publish a rule simply by typing owner and reviewer names. This is not an approval process.

### 3.11 Analysis history is session state, not history

The history page contains only the current browser-session analysis. It has no persistent run ID, source hashes, user, timestamp, result version, export artifact or audit timeline. Refreshing the page removes the run.

Until persistence is implemented, this page should be called `Current session`, not `Analysis history`.

---

## 4. Supplied-workbook findings

### 4.1 The two supplied workbooks do not form a matching happy-path case

The BCS/DLMS workbook identifies meter `AS2373952`. The FFR register contains old meter numbers `SC10222714`, `SC10226881` and `SC10222115`, with different replacement meter numbers.

Therefore, the correct result for these two files is an identity exception. The application must not weaken or bypass exact matching to force an RCA.

A separate matched golden fixture for `AS2373952` is required to prove the happy path. The repository should contain both:

- the current mismatch package as a negative acceptance fixture;
- a matched package with reviewed images and known expected results as the positive golden fixture.

### 4.2 Header normalization is inconsistent

Workbook detection normalizes header casing and whitespace, but row values are stored under the original raw headers. Later logic retrieves values using exact hardcoded names.

A workbook can therefore pass validation and fail during matching or classification because a header contains different casing, spaces or line breaks.

Create a canonical header map once and use canonical field identifiers throughout parsing, analysis and write-back.

### 4.3 Duplicate workbook roles are silently accepted

If two FFR registers or two DLMS workbooks are uploaded, the last detected workbook silently replaces the earlier workbook. The run must stop with a specific duplicate-role exception.

Required states include:

- `MULTIPLE_FFR_REGISTERS`;
- `MULTIPLE_DLMS_PACKAGES`;
- `UNRECOGNIZED_FILE`;
- `MISSING_REQUIRED_WORKBOOK`.

### 4.4 Image validation trusts the filename extension

A renamed non-image file can be accepted because the parser trusts either MIME type or `.jpg`, `.png` or `.webp` extension. Validate image magic bytes and decode the image before accepting it.

### 4.5 Block-load record count is incorrect

The parser calculates block-load records using `sheet row count - 3`. In the supplied workbook, the data header is row 5 and records begin at row 6. With a used range ending at row 3365, the actual record count is 3,360, while the current calculation produces 3,362.

Record counts must be based on detected table headers and validated data rows, not a fixed subtraction.

### 4.6 DLMS feature extraction is insufficient

The current extractor reads only a small set of instantaneous values, battery flags and text occurrence counts. It does not calculate the Phase 1 feature library, including:

- expected versus actual profile intervals;
- profile gaps;
- zero-value runs;
- voltage/current distributions;
- import/export increments;
- register monotonicity and resets;
- event occurrence/restoration pairs;
- event durations;
- RTC offset and changes;
- phase-neutral current differences;
- duplicate and out-of-order timestamps;
- firmware/model applicability;
- unit/scaler anomalies;
- cross-sheet contradictions;
- missing and sparse sheet quality.

### 4.7 Evidence provenance is inadequate

A feature currently records only a sheet name such as `IP`. Every derived feature must instead record:

- source artifact ID and hash;
- sheet;
- cell or range;
- original value;
- parsed value;
- unit and scaler;
- calculation inputs;
- extractor and version;
- data-quality state.

Without this information, the RCA cannot be audited or defended.

---

## 5. Workflow and information-architecture feedback

### 5.1 The processing flow is incomplete

The interface currently shows six steps and stops at rules evaluation. The required Phase 1 flow is:

1. Files validated.
2. Identity matched.
3. Product family and complaint classified.
4. DLMS features calculated.
5. Images analyzed.
6. Approved rules evaluated.
7. Hypotheses ranked.
8. RCA drafted.
9. CAPA drafted.
10. Updated FFR workbook and reports generated.

The pipeline should show the actual state of each step, not mark a step complete because a Boolean was changed.

### 5.2 Identity exceptions should replace downstream content

When identities do not match, the interface continues to show DLMS features, the rule gate and a mapping-settings action. Product-family mapping cannot resolve an incorrect meter serial number.

The exception view should show only:

- detected DLMS meter ID;
- FFR old/new meter candidates;
- source filenames and hashes;
- the exact reason processing stopped;
- the correct recovery action: upload the matching register or report.

### 5.3 One page contains too many competing sections

The analysis page stacks upload, pipeline, identity, exception, feature table, rule gate, evaluation log, RCA and CAPA into one long page. The user loses case context and the current required action becomes unclear.

Use explicit application states or subviews:

- Upload and validation;
- Processing;
- Identity/data exception;
- Result and downloads.

Within results, use anchored sections or tabs while keeping case identity and outcome persistent.

### 5.4 Rule authoring should not dominate the pilot navigation

The current rule form exposes many technical fields in one continuous form without rule testing, impact analysis, approval, version comparison or fixture validation.

For Phase 1, rules should be version-controlled engineering assets developed with domain experts. If an authoring interface is retained later, separate it into:

1. Metadata and ownership.
2. Applicability.
3. Required evidence.
4. Condition groups.
5. Hypothesis effects.
6. Outcome and stop policy.
7. Explanations.
8. Positive/negative/boundary fixtures.
9. Review and publication history.

---

## 6. Visual and UI/UX feedback

### 6.1 High-level visual direction is acceptable

The basic shell is closer to the supplied Kimbal application than previous promotional designs. Retain the navy navigation, white operational surfaces, restrained shadows and Kimbal blue primary actions.

### 6.2 Branding is inaccurate

The approved Kimbal logo has been replaced with a generic blue square containing `K`. Use the approved Kimbal mark and proportions. Do not invent a substitute brand mark.

The global header should provide environment, notifications and user context. It should not repeat generic product descriptions.

### 6.3 The styling is not fully token-based

The stylesheet tokenizes some colors, one radius and one shadow, while typography, spacing, sizes and component geometry remain hardcoded with many unrelated pixel values.

Implement shared tokens for:

- typography roles;
- 4px spacing scale;
- control heights;
- radii;
- borders;
- shadows;
- sidebar and header geometry;
- content width;
- semantic states.

Components should use tokens only. New values require a documented design-system reason.

### 6.4 Operational text is too small

Several labels and metadata elements use 8px or 9px text. This is difficult to read and contradicts the design guide.

Recommended minimums:

- page title: 24px;
- section title: 16px;
- body copy: 14px;
- table content: 12px;
- secondary metadata: 11px;
- labels: 10–11px only when short and high-contrast.

### 6.5 The visual hierarchy is repetitive

Almost every section has an eyebrow, title, description, status, border and nested bordered content. This gives all information similar visual importance.

Prioritize:

1. current case and state;
2. blocker or next action;
3. result summary;
4. evidence and reasoning;
5. detailed configuration.

Move repeated explanatory text into contextual help, drawers or expandable information.

### 6.6 Evidence layers are not visually distinct

Source evidence, deterministic calculations, AI observations, analyst feedback, hypotheses and approved conclusions require distinct markers and labels.

Use the agreed semantic system:

- source evidence: blue;
- deterministic calculation: teal;
- AI-generated observation: indigo;
- analyst-confirmed finding: green;
- inference: amber;
- contradiction: red outline;
- missing/unavailable: grey dashed treatment.

Do not combine all layers into one RCA paragraph.

### 6.7 Diagnostic reasoning needs an evidence matrix

The result screen should use a wide-screen split:

- left: ranked hypotheses and comparison;
- right: selected hypothesis, missing evidence and next action.

Each hypothesis needs rank, score, evidence coverage, status, supporting count, contradictory count, missing count and expandable evidence details.

The score must be labelled `AI hypothesis score`, not a calibrated failure probability.

### 6.8 Responsive behavior is inadequate

At tablet width, the sidebar becomes a horizontal navigation strip rather than a drawer or collapsible sidebar. This consumes vertical space and creates unclear horizontal overflow.

The app must be reviewed at:

- 1440 × 900 desktop;
- 1024 × 768 tablet landscape;
- 768 × 1024 tablet portrait.

Preserve case identity, blocker and primary action first. Move secondary actions into overflow. Do not hide provenance or contradictions.

### 6.9 Accessibility is incomplete

Required improvements include:

- semantic tables rather than `div` grids;
- real table headers and accessible relationships;
- `aria-live` for validation, loading and completion;
- `aria-current` for navigation;
- skip-to-content link;
- focus movement after page/state changes;
- accessible full-value/copy treatment for truncated filenames and IDs;
- 44px tablet touch targets;
- automated WCAG checks.

### 6.10 Social preview artwork does not match the product

The current dark 3D social image presents a futuristic AI dashboard that is unrelated to the light Kimbal operational UI. Use a clean application screenshot or a restrained Kimbal-branded operational image.

---

## 7. Security and engineering-quality feedback

### 7.1 Dependency audit must be resolved

The current production dependency audit reports high-severity entries involving Next.js, PostCSS, Sharp and `xlsx`. The uploaded-workbook path directly uses `xlsx` 0.18.5, for which the audit reports prototype-pollution and denial-of-service advisories.

Do not publish the pilot until the dependency strategy is reviewed and safe supported versions or alternatives are selected.

### 7.2 Application responsibilities are overly concentrated

Most of the application lives in one client component. Separate the implementation into:

- shared UI components;
- file adapters;
- canonical workbook parser;
- DLMS feature engine;
- diagnostic rule engine;
- hypothesis engine;
- RCA/CAPA domain services;
- AI provider adapters;
- export service;
- persistence repository;
- audit service;
- RBAC policy layer.

This separation is required so Excel input can later be complemented by API input without rewriting the diagnostic domain.

### 7.3 Tests do not validate business behavior

Current tests mainly verify that selected strings and package names exist. Add tests for:

- actual workbook fixtures;
- identity match, mismatch and ambiguity;
- duplicate file roles;
- header variants;
- invalid image content;
- every feature calculation;
- event pairing and duration;
- positive, negative and boundary rule fixtures;
- required-feature handling;
- allowed-outcome enforcement;
- contradictory evidence;
- AI schema and provider failures;
- sparse-image fallback;
- Z:AE write-back;
- formula/style preservation;
- exported workbook reopening;
- immutable run-version pinning;
- RBAC denial;
- keyboard accessibility;
- responsive visual snapshots.

---

## 8. Required rebuild sequence

### Milestone 1 — File pipeline and workbook round-trip

- Canonical header mapping.
- Content-based file validation.
- Source hashes and artifact records.
- Duplicate-role validation.
- Exact identity match and focused exception state.
- Matched positive golden fixture.
- Safe workbook clone and Z:AE write-back.
- Reopen and validate exported workbook.

### Milestone 2 — BCS/DLMS intelligence

- Table-aware extraction.
- Stable feature codes.
- Units, scalers and cell/range provenance.
- Profiles, events and data-quality feature library.
- Calculation unit tests using real fixtures.

### Milestone 3 — Governed deterministic rules

- Reviewed active rule bundle.
- Deterministic applicability.
- Required-evidence validation.
- Support, weaken and rule-out effects.
- Allowed-outcome enforcement.
- Rule fixtures and coverage matrix.

### Milestone 4 — Vision and hybrid reasoning

- Server-side Vertex/OpenRouter adapters.
- Image view classification and quality assessment.
- Structured visual observations.
- Evidence coverage.
- Competing hypothesis generation and ranking.
- Strict schemas, attribution and failure handling.

### Milestone 5 — Structured RCA, CAPA and exports

- Structured RCA entity and causal chain.
- Structured CAPA entity, ID, owner role and status.
- Evidence-linked draft generation.
- Customer-safe versus internal wording.
- Updated FFR workbook, audit JSON, PDF and DOCX outputs.

### Milestone 6 — Pilot hardening

- Persistent run/evidence storage.
- Authentication and RBAC.
- Separation of duties.
- Version pinning and audit trail.
- Run history and recovery.
- Dependency/security remediation.
- Accessibility and responsive validation.

---

## 9. Definition of done

The Phase 1 pilot is complete only when a user can upload one matching FFR IG workbook, one matching BCS/DLMS workbook and meter images, press one primary action and receive:

- validated source artifacts with hashes and versions;
- exact matched FFR row and complaint context;
- traceable DLMS features and data-quality findings;
- structured image findings;
- complete rule-evaluation log;
- ranked competing hypotheses;
- evidence-linked structured draft RCA;
- structured draft CAPA with generated pilot ID and owner role;
- analysis/audit JSON;
- updated FFR IG copy with only approved Z:AE fields changed;
- working internal report downloads;
- persistent run history;
- explicit `Pilot-generated draft — review required` state.

The mismatch package must stop without generating RCA, CAPA or an updated workbook. Missing images or AI-provider failure must follow the approved degraded-mode policy without fabricating findings. Every output must retain the source, rule, model, template and application versions used to create it.

Until these conditions pass automated and manual acceptance testing, the application should be described as a development proof of concept rather than an end-to-end pilot.
