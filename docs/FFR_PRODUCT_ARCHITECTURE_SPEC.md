# Kimbal FFR Intelligence

## Product Requirements and Technical Architecture Specification

| Document field | Value |
| --- | --- |
| Product | Kimbal FFR Intelligence |
| Purpose | Target product specification; implemented incrementally from the file-first pilot |
| Primary readers | Product owner, intern, software engineer, designer, QA engineer, data/AI engineer and integration owner |
| Status | Working specification; Phase 1 delivery is governed by the file-first pilot plan |
| Last updated | 4 August 2026 |
| Related visual guide | `docs/FFR_UI_UX_DESIGN_SYSTEM.md` |
| Current delivery plan | `docs/FFR_PILOT_PHASED_IMPLEMENTATION_PLAN.md` |
| Reference blueprint | `C:\Users\Shashwat\Downloads\FFR_Agentic_RCA_System_Blueprint.md` |

---

## 1. How to use this document

This document describes the target product: what to build, why each part exists, what data enters from each source, how that data is processed, where AI is allowed, how a Root Cause Analysis (RCA) becomes a Corrective and Preventive Action (CAPA), and how the application proves who did what.

**Delivery precedence:** Phase 1 is the file-first pilot in `FFR_PILOT_PHASED_IMPLEMENTATION_PLAN.md`. It accepts only an FFR IG workbook, the matching BCS/DLMS workbook and meter images, then produces an RCA/CAPA draft and an updated FFR IG copy. The API, SAP, MES, HES, batch, laboratory and broader workflow sections in this document are target-state requirements and must not be implemented ahead of the Phase 1 slices unless the product owner changes the priority.

An implementer should not begin by designing screens. Build in this order:

1. Understand the system boundaries and vocabulary.
2. Implement the canonical data model and state machines.
3. Implement immutable source ingestion and validation.
4. Implement deterministic DLMS analytics and the versioned rule engine.
5. Add AI adapters over validated, structured evidence.
6. Add review, RCA, CAPA and reporting workflows.
7. Build the user interface over these domain services.

The application must never treat generated text as the source of truth. The source of truth is the structured case record, its immutable evidence, approved rules and recorded human decisions.

---

## 2. Product in one paragraph

Kimbal FFR Intelligence is the technical-analysis and quality-closure system for electricity meters returned from the field or from pre-installation stock. It receives return information, SAP references, MES manufacturing history, BCS/DLMS data and photographs; validates and preserves those sources; calculates repeatable diagnostic signals; uses versioned engineering rules and configured AI models to rank possible failures; captures structured analyst feedback; produces an evidence-linked RCA for Quality approval; creates CAPA responsibilities; and back-traces the conclusion to related PCB batches, suppliers, production lines and meter populations. It does not replace the return/logistics module, SAP or MES. It coordinates their relevant records around one traceable FFR case.

---

## 3. Phased scope

### 3.1 Phase 1 file-first pilot

- One internal Kimbal workspace.
- Invite-only pilot accounts with application RBAC; corporate SSO is a later adapter.
- Upload of the current FFR IG register workbook.
- Upload of one matching BCS/DLMS workbook in the existing 16-sheet format.
- Upload of external/internal meter images.
- Automatic file-role detection, meter identity extraction and exact FFR-row matching.
- Deterministic product-family and complaint mapping.
- Deterministic BCS/DLMS calculations.
- Engineering-managed, version-controlled diagnostic rules.
- Deterministic Phase 1 rule selection and execution.
- AI image observations, hypothesis ranking and structured draft generation.
- Evidence-linked draft RCA and draft CAPA without additional data entry.
- Updated copy of the FFR IG workbook, limited to approved Kimbal/RCA/CAPA columns.
- Audit/run package and optional PDF/DOCX output.
- Honest confirmed/probable/NFR/inconclusive/manual-validation outcomes.

### 3.2 Phase 2 and later

- AI recommends which approved rules to apply; the deterministic engine validates the recommendation.
- Users run offline equipment tests and enter/upload structured readings.
- Analyst and Quality approval workflow.
- Deepu return-module synchronization.
- SAP GRN, return/repair order and scrap processing.
- MES genealogy and population back-tracing.
- Full CAPA assignment/effectiveness workflow.
- Return-lot/master RCA, dashboards, queues and enterprise reporting.
- Corporate SSO.
- HES and direct equipment automation in later dedicated phases.

### 3.3 Explicitly excluded from Phase 1

- HES ingestion or HES-dependent logic. A disabled adapter contract will be reserved for later.
- Laboratory-equipment integration.
- Equipment-reading AI analysis.
- Manual/offline test-reading entry.
- Test-station scheduling or automated instrument control.
- Deepu, SAP, MES, WMS or other live enterprise integration.
- AI selection of which rules execute.
- Automatic meter reset, configuration change, firmware update or destructive command.
- Automatic Quality approval, customer release, liability assignment, recall or CAPA closure.
- WMS integration.
- Billing adjudication.
- X-ray analysis.
- External supplier, utility or AMISP login.
- A rule-authoring user interface. Rules are maintained by engineering in version control.

### 3.4 Consequence of excluding laboratory readings

DLMS data and images can support a strong diagnostic hypothesis, but they cannot always prove a component-level electrical mechanism. The application must support these valid stop outcomes:

- confirmed;
- highly probable;
- probable;
- no fault reproduced;
- inconclusive;
- manual validation required.

The product must never force a root cause merely to complete a workflow.

---

## 4. Vocabulary

| Term | Meaning in this product |
| --- | --- |
| Return lot | A physical or commercial grouping received together. It may contain one or many meters. |
| FFR case | The complete technical record for one physical meter. Every meter has an independent FFR case. |
| Master RCA | A reviewer-approved causal conclusion shared by a homogeneous group of individual cases. |
| Source snapshot | An immutable copy of a source payload/file and its provenance at a point in time. |
| Evidence | A source value, image, calculated signal or confirmed finding that can be linked to a hypothesis or conclusion. |
| Observation | What was reported, measured or visibly detected. It is not automatically a cause. |
| Visual finding | A structured description of something visible in an image, with location and evidence reference. |
| DLMS feature | A deterministic calculation derived from the imported BCS/DLMS package. |
| Diagnostic rule | A versioned, deterministic engineering statement that evaluates evidence and affects hypotheses or required actions. |
| Hypothesis | A plausible explanation under evaluation. Several hypotheses may coexist. |
| AI score | A model-generated relative ranking across the current hypotheses. It is not a calibrated probability of truth. |
| Evidence coverage | How much of the evidence required to assess a hypothesis is present. |
| RCA | The approved structured causal chain supported by the case evidence. |
| CAPA | Containment, correction, corrective action, preventive action and effectiveness verification linked to an approved RCA. |
| Back-trace | Use of MES and case data to identify related batches, suppliers, lines, processes or meter populations. |
| Technical closure | The RCA is approved and required technical actions are complete. |
| CAPA closure | Effectiveness criteria have been evaluated and accepted. |

---

## 5. System boundaries and ownership

### 5.1 Deepu's return-management module

This module remains the source of truth for return intake, field details, logistics and physical movement.

It provides, where applicable:

- external return ID;
- return-lot ID;
- meter number;
- utility;
- AMISP;
- Sales owner/reference;
- project/site;
- pre-install or post-install classification;
- complaint code;
- original complaint text;
- complaint date;
- removal/return date;
- field photographs;
- Store receipt status;
- current physical location;
- logistics status.

Kimbal FFR Intelligence returns only analysis milestones and actions:

- FFR case ID;
- analysis state;
- missing-data request;
- Quality review state;
- approved report link;
- technical disposition;
- CAPA state summary;
- technical closure date.

Detailed hypotheses, source evidence and internal reviewer comments remain in the FFR platform.

### 5.2 SAP

SAP is not the diagnostic source. Its role is limited to:

- GRN reference and status;
- return order;
- repair order;
- approved scrap-processing request/status.

SAP writes must be initiated only from an approved application action and executed through a dedicated service account. The application must record the requesting user, approval, payload, SAP response and correlation ID.

### 5.3 MES

MES provides the manufacturing and process context used in RCA and back-tracing:

- model/material code;
- BOM revision;
- PCB/PCBA batch;
- supplier and supplier lot where available;
- production date and shift;
- production/assembly line;
- process tests and original results;
- calibration result;
- rework history.

MES is read-only in the MVP. The FFR platform may generate a containment or investigation recommendation, but it must not automatically place a manufacturing hold.

### 5.4 BCS/DLMS

BCS/DLMS is the meter-resident technical data source. It may enter through:

- a structured API package; or
- the fixed-format workbook used by the current team.

Both inputs must produce the same normalized entities and features. Differences in ingestion route must not change diagnostic logic.

### 5.5 Images

Images are technical evidence, not decoration. Each image must be assigned to a case, evidence stage and view type. Originals are immutable. Derived thumbnails, crops, annotations and AI results must reference the original image.

Required supported view types:

- exterior/front;
- nameplate;
- terminal area;
- seal/cover;
- opened assembly before touch;
- PCB front;
- PCB back;
- power-supply region;
- communication region;
- relay/terminal-current path;
- other controlled close-up.

### 5.6 HES

HES is a later-phase evidence source. The MVP must not display missing HES as an error and must not reduce readiness merely because HES is unavailable. The future adapter will add field communication, commands, outages and pre-failure chronology to the same evidence model.

---

## 6. Users, responsibilities and RBAC

| Role | Purpose | Main permissions | Explicit restrictions |
| --- | --- | --- | --- |
| Store Operator | Confirm technical handoff, identity and initial image evidence | View assigned returns, confirm receipt, scan identity, upload permitted external images, raise mismatch | Cannot run diagnosis, change rules, approve RCA or close CAPA |
| FFR Analyst | Perform technical analysis and prepare the RCA | Validate imports, review AI findings, add structured feedback, manage hypotheses, draft/submit RCA | Cannot Quality-approve own RCA, release final report or manage credentials |
| Quality Reviewer | Independently review causal evidence | Approve, reject or request changes; approve batch grouping; release approved report | Cannot alter immutable source evidence or silently edit an analyst submission |
| CAPA Owner | Execute assigned actions | Accept action, update progress, upload implementation evidence, submit effectiveness result | Cannot change the approved RCA or self-approve failed effectiveness |
| Sales Viewer | View safe status for relevant projects/customers | View case milestone, approved customer-safe report and replacement/scrap status where permitted | Cannot see internal scores, internal comments, confidential MES details or draft RCA |
| Administrator | Configure the workspace | Invite/deactivate users, map roles, configure integrations/models/retention, publish approved rule bundle | Cannot bypass audit, alter approved evidence or approve RCA solely because of admin access |
| Auditor | Independent read-only review | View evidence versions, approvals, AI runs, audit history and released reports | No mutation permissions |
| Integration Service | Machine identity for system exchange | Call the allowed API scopes | No interactive login and no permission outside the assigned connector |

Pilot authentication is invite-only. Store salted password hashes through the selected identity service; do not implement custom cryptography. Design the user identity model with stable external subject fields so OIDC/SAML can replace pilot login later without changing domain ownership or audit records.

### 6.1 Separation-of-duty rules

- An analyst may not Quality-approve the RCA version they submitted.
- The Quality reviewer may request changes but may not rewrite the analyst's submitted version. Changes create a new version.
- A CAPA owner may submit effectiveness evidence but a Quality reviewer closes a failed or high-severity CAPA.
- Only an administrator may change the active AI provider/model or retention policy.
- No user may hard-delete approved evidence, RCA versions, approvals or audit records.

---

## 7. End-to-end logical workflow

### 7.1 Individual-meter happy path

1. Deepu's module sends a new or changed return record.
2. The integration validates the payload and creates or updates the linked return lot.
3. One child FFR case is created for each physical meter.
4. Store receipt and printed meter identity are recorded or synchronized.
5. The application obtains relevant SAP references.
6. The application queries MES and freezes a manufacturing snapshot.
7. The analyst uploads a DLMS workbook or an API package arrives.
8. The adapter preserves the original, validates its schema and normalizes the values.
9. Deterministic DLMS calculations create technical signals.
10. Required external/internal images are uploaded and classified by view type.
11. Vision AI produces structured visual findings from the configured failure-point ontology.
12. The rule engine evaluates complaint, identity, MES, DLMS and visual evidence.
13. The reasoning model ranks competing hypotheses and lists supporting, contradictory and missing evidence.
14. The analyst accepts, rejects or corrects individual findings using structured feedback.
15. The application reruns affected rules and hypothesis ranking.
16. The analyst chooses the deepest supported conclusion and drafts the RCA.
17. The analyst submits a versioned RCA to Quality.
18. Quality approves it or returns it with structured comments.
19. The approved record generates internal and customer-safe report views.
20. CAPA is created when required; actions receive owners, dates and effectiveness rules.
21. MES keys are used to identify potentially related meters, lots and process history.
22. Technical closure, return/disposition closure and CAPA closure proceed independently.

### 7.2 Return-lot and batch flow

- A return lot is only a container; it never replaces the individual case.
- Each meter retains its own identity, source package, image set, AI run, finding, RCA status and disposition.
- The platform may propose a cluster when cases share model, PCB batch, supplier, line, DLMS signature and visual code.
- A Quality reviewer confirms membership and explicitly identifies outliers.
- A master RCA references the approved individual evidence used to support it.
- One shared CAPA may link to all confirmed members.
- New contradictory evidence removes a case from automatic inheritance and sends it for review.

### 7.3 Main case states

```text
RETURN_SYNCED
  -> STORE_RECEIVED
  -> IDENTITY_VALIDATION
  -> DATA_PENDING
  -> READY_FOR_ANALYSIS
  -> DLMS_ANALYSIS
  -> VISION_ANALYSIS
  -> HYPOTHESIS_REVIEW
  -> RCA_DRAFTED
  -> QUALITY_REVIEW
  -> RCA_APPROVED
  -> TECHNICALLY_CLOSED
```

Independent state fields must also exist:

- `return_disposition_status`;
- `capa_status`;
- `report_release_status`;
- `integration_status` for each source.

Exception states do not destroy progress:

- `IDENTITY_EXCEPTION`;
- `INVALID_SOURCE_PACKAGE`;
- `EVIDENCE_INCOMPLETE`;
- `AI_ANALYSIS_FAILED`;
- `CONTRADICTORY_EVIDENCE`;
- `MANUAL_VALIDATION_REQUIRED`;
- `NO_FAULT_REPRODUCED`;
- `INCONCLUSIVE`.

---

## 8. Functional modules

### 8.1 Operations and work queue

Purpose: show what needs attention without turning the dashboard into an analytical report.

Required capabilities:

- counts by current case state;
- unassigned cases;
- oldest cases and SLA age;
- invalid imports and identity exceptions;
- DLMS/image analysis failures;
- RCA awaiting analyst or Quality action;
- overdue CAPA actions;
- integration health;
- filters for meter, case, lot, customer, AMISP, project, complaint, model, PCB batch, owner and state;
- saved filter in local or user preferences;
- deep links into the exact blocked action.

### 8.2 Return lot and case management

Required capabilities:

- create from API or Excel;
- view source ownership and last synchronization;
- link one or many meter cases;
- prevent silent duplication;
- preserve manual corrections as overrides with reason and actor;
- show return/logistics milestones from Deepu's module without recreating its workflow;
- display SAP references and status;
- display technical, report, disposition and CAPA closure independently.

### 8.3 Identity reconciliation

Identity sources can include:

- reported meter number;
- printed/manual scan;
- OCR/nameplate;
- DLMS meter identity;
- SAP identity;
- MES identity.

Rules:

- Never overwrite one identity with another.
- Normalize whitespace, case and approved punctuation before comparison.
- Preserve the exact source value.
- Exact normalized agreement may auto-pass.
- Partial, unreadable or conflicting values create an exception.
- Resolution requires an authorized user, reason code and explanatory comment.
- Analysis may continue only if policy allows the unresolved source; final RCA approval requires a resolved primary identity.

### 8.4 Source and evidence centre

For every source, show:

- source system/type;
- source record ID or file name;
- received time;
- retrieval/import method;
- schema/adapter version;
- file hash;
- validation status;
- active version;
- previous versions;
- errors and retry history;
- downstream calculations or AI runs that used the source.

### 8.5 BCS/DLMS workspace

The current workbook adapter must recognize these sheets:

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

The parser must use a named, versioned mapping rather than sheet indexes. It must retain raw cell values, normalized values, units, parse warnings and source coordinates. Empty event sheets are valid; missing mandatory sheets or incompatible headers are not.

Deterministic calculations must include, where data exists:

- data window and interval frequency;
- missing, duplicate or out-of-order intervals;
- zero-voltage/zero-current periods;
- voltage minimum, median, maximum and configured excursion counts;
- current maximum and phase-neutral difference distribution;
- import/export energy increments and register monotonicity;
- apparent/active energy consistency;
- derived PF indicators with low-value safeguards;
- power-failure occurrence/restoration pairing and duration;
- overvoltage/undervoltage occurrence/restoration pairing and duration;
- current-reversal occurrence/restoration pairing and duration;
- low-PF occurrence/restoration pairing and duration;
- connect/disconnect history;
- load-limit changes;
- RTC/date-time changes and meter-versus-retrieval-time offset;
- self-diagnostic flags;
- programming/configuration transaction count;
- suspicious scaler, unit, mapping or repeated impossible values.

Every calculated signal needs:

- feature code;
- value and unit;
- calculation version;
- applicable thresholds;
- severity;
- source range/records;
- explanatory text;
- data-quality caveat.

### 8.6 Image evidence workspace

Upload requirements:

- supported formats: JPEG, PNG and WebP;
- configurable maximum file size;
- preserve EXIF separately where present;
- strip executable or unsupported content;
- calculate content hash;
- require evidence stage and view type;
- allow rotation/crop only as non-destructive derived assets;
- support annotation overlays without changing the original.

Vision results must capture:

- failure-point/observation code;
- human-readable observation;
- image ID;
- normalized region or bounding box when supported;
- affected meter area;
- model confidence;
- image-quality assessment;
- alternate view required;
- analyst disposition: pending, accepted, rejected or corrected;
- analyst reason code/comment.

The vision output must not directly populate `initiating_cause`, `origin`, `liability` or `escape_point`.

### 8.7 Diagnostic workspace

The workspace must present:

- normalized complaint and original complaint text;
- MES context relevant to diagnosis;
- significant DLMS signals;
- accepted and pending visual findings;
- candidate hypotheses;
- AI score for each hypothesis;
- deterministic rule matches;
- supporting evidence;
- contradictory evidence;
- missing evidence;
- evidence coverage;
- current allowed stop outcome;
- recommended manual validation, when required.

Analyst feedback actions:

- accept;
- reject as false positive;
- correct classification;
- correct location;
- mark evidence unreadable;
- request another image/data package;
- add a structured expert finding;
- add an explanatory comment.

Any changed finding invalidates downstream draft calculations and creates a new reasoning run. Prior runs remain visible in audit history.

### 8.8 RCA and reports

See Section 14 for the exact causal model and approval behavior.

### 8.9 CAPA and action management

See Section 15 for action structure, responsibility and effectiveness behavior.

### 8.10 Batch intelligence and back-tracing

See Section 16 for clustering, representative evidence and MES population behavior.

### 8.11 Administration

Admin pages:

- users and roles;
- integration configuration and health;
- AI provider/model configuration;
- prompt and rule bundle versions;
- retention policy;
- failure ontology/version;
- audit search;
- system job failures and retries.

There is no editable diagnostic-rule builder in the MVP. Admin may view the active bundle and its metadata.

---

## 9. Canonical data model

### 9.1 Core relationships

```text
ReturnLot 1 --- * FFRCase
FFRCase 1 --- * SourceSnapshot
FFRCase 1 --- * MeterIdentity
FFRCase 1 --- * DLMSPackage 1 --- * DLMSFeature
FFRCase 1 --- * ImageEvidence 1 --- * VisualFinding
FFRCase 1 --- * RuleEvaluation
FFRCase 1 --- * Hypothesis
Evidence * --- * Hypothesis (through EvidenceLink)
FFRCase 1 --- * RCAVersion 1 --- * Approval
RCAVersion 1 --- 0..1 CAPA 1 --- * CAPAAction
MasterRCA * --- * FFRCase
Every mutable aggregate 1 --- * AuditEvent
Every AI operation 1 --- 1 AIRun
```

### 9.2 Required entity fields

#### `ReturnLot`

- internal ID;
- external return-lot ID;
- source owner;
- utility, AMISP, Sales/project references;
- received/return dates;
- synchronization version;
- current logistics milestone;
- child case IDs;
- created/updated/audit metadata.

#### `FFRCase`

- case ID;
- return-lot ID;
- external return ID;
- primary meter ID;
- complaint record;
- project/customer context;
- current technical state;
- disposition state;
- report state;
- CAPA state;
- priority and owner;
- selected active source versions;
- timestamps and audit metadata.

#### `SourceSnapshot`

- source type and provider;
- external record ID;
- method: API or Excel/file;
- raw object location;
- content hash;
- MIME type and file size;
- schema/adapter version;
- received and source timestamps;
- validation result;
- validation errors;
- superseded-by link;
- importing integration/user.

#### `DLMSPackage`

- case ID;
- source snapshot ID;
- meter identity from package;
- meter clock and extraction/retrieval time;
- workbook/object-map version;
- package completeness;
- parsed tables and warnings;
- selected-for-analysis flag.

#### `DLMSFeature`

- feature code;
- value, unit and data type;
- severity;
- time window;
- threshold/reference;
- source pointers;
- calculation version;
- data-quality status;
- human-readable explanation.

#### `ImageEvidence`

- original object ID;
- derived asset IDs;
- case ID;
- stage and view type;
- capture/upload metadata;
- content hash;
- quality status;
- analyst annotations.

#### `VisualFinding`

- ontology code/version;
- image/region reference;
- observation and location;
- model score;
- AI run ID;
- analyst disposition;
- corrected code/text where applicable;
- feedback reason and actor.

#### `Hypothesis`

- hypothesis code and description;
- current AI score;
- previous score;
- rule-support summary;
- evidence coverage;
- supporting, contradictory and missing evidence links;
- status: active, weakened, rejected, leading or resolved;
- reasoning run ID.

#### `RCAVersion`

- version number;
- structured causal fields;
- evidence links;
- confidence category;
- AI score snapshot;
- missing/contradictory evidence statement;
- author and submission timestamp;
- review status;
- superseded version.

#### `CAPA` and `CAPAAction`

- linked approved RCA version;
- affected population;
- action category;
- accountable internal owner;
- external/internal contributor;
- due date;
- acceptance state;
- implementation evidence;
- effectiveness metric, baseline, target and window;
- effectiveness result;
- approval and closure history.

#### `AIRun`

- capability: vision, hypothesis ranking or RCA drafting;
- provider and model;
- credential alias, never the key;
- prompt/template version;
- structured input references;
- raw response object reference;
- validated output;
- validation errors and retries;
- latency, token/cost metadata where returned;
- initiating user/job and timestamp.

#### `AuditEvent`

- actor type and ID;
- action;
- target entity/type/version;
- before/after reference or structured delta;
- reason/comment where required;
- timestamp, request ID, IP/session metadata as policy permits;
- linked integration or AI run.

---

## 10. Source ingestion and reconciliation rules

### 10.1 Common ingestion contract

Every adapter must implement:

```ts
interface SourceAdapter<TInput, TNormalized> {
  identify(input: TInput): Promise<SourceIdentity>;
  validate(input: TInput): Promise<ValidationResult>;
  preserve(input: TInput, metadata: SourceMetadata): Promise<SourceSnapshot>;
  normalize(snapshot: SourceSnapshot): Promise<TNormalized>;
  reconcile(normalized: TNormalized, caseContext: CaseContext): Promise<ReconciliationResult>;
}
```

Order is mandatory: identify → validate → preserve → normalize → reconcile. A source that fails validation is still preserved and shown as invalid; it must not silently disappear.

### 10.2 Idempotency and duplicates

- API writes require an idempotency key and source record version.
- Repeating the same key and payload returns the original result.
- Repeating the same key with a different payload returns a conflict.
- File uploads use content hash plus source type to identify exact duplicates.
- A changed file creates a new immutable version.
- Potential duplicate return records are suggested, never auto-merged.

### 10.3 Source precedence

- Deepu's API is authoritative for operational return fields once linked.
- Return Excel may create a case before API availability, but later linkage requires a reviewable reconciliation event.
- SAP is authoritative for its document/status fields.
- MES is authoritative for manufacturing history.
- DLMS is authoritative only for the contents of its preserved meter/data package.
- Analyst corrections do not modify source values; they create explicit overrides or feedback records.

### 10.4 Invalid data behavior

- Show the exact sheet, field, row/cell or JSON path that failed.
- Separate fatal errors from warnings.
- Permit correction through re-import; never edit the original file inside the application.
- Keep completed downstream work but mark it stale when a selected evidence version changes.
- Require rerun/review before approval if changed evidence affects reasoning.

---

## 11. Integration interfaces

### 11.1 Incoming return API

Minimum versioned payload:

```json
{
  "eventId": "evt-unique-id",
  "eventVersion": 3,
  "eventType": "return.updated",
  "occurredAt": "2026-08-04T09:30:00+05:30",
  "returnLot": {
    "externalLotId": "LOT-2026-00128",
    "utility": "Example Utility",
    "amisp": "Example AMISP",
    "salesReference": "SO-000123",
    "project": "Project name"
  },
  "meters": [
    {
      "externalReturnId": "RET-2026-01092",
      "reportedMeterNumber": "AS2373952",
      "installState": "POST_INSTALL",
      "complaintCode": "DISPLAY_BLANK",
      "complaintText": "Display is blank at site",
      "complaintDate": "2026-06-21",
      "removalDate": "2026-06-24",
      "storeReceiptAt": "2026-06-30T11:10:00+05:30"
    }
  ]
}
```

The final field list and authentication method require Deepu's signed API contract before integration coding.

### 11.2 Outgoing milestone events

Supported event types:

- `ffr.case.created`;
- `ffr.action.required`;
- `ffr.analysis.started`;
- `ffr.quality_review.pending`;
- `ffr.rca.approved`;
- `ffr.report.released`;
- `ffr.technical.closed`;
- `ffr.capa.status_changed`.

Each event includes external return ID, FFR case ID, milestone, occurred time, safe summary, optional action deadline and an application deep link. Do not include internal hypothesis scores or confidential MES evidence.

### 11.3 DLMS ingestion API

Support two modes through one case endpoint:

- multipart upload of the approved workbook;
- JSON package following the normalized DLMS import schema.

The JSON package must include source identity, meter identity, extraction time, meter clock, object-map/schema version, records/events, units/scalers and parse/access errors.

### 11.4 SAP adapter

Required operations:

- fetch/validate GRN;
- fetch return/repair order;
- request or record approved return/repair order creation where supported;
- request or record approved scrap processing;
- poll or receive status updates.

### 11.5 MES adapter

Required read operations:

- retrieve meter genealogy by reconciled identity;
- retrieve approved BOM/revision;
- retrieve PCB batch/supplier lot;
- retrieve production line/date/shift;
- retrieve process-test and calibration results;
- retrieve rework events;
- query other units by selected back-trace dimensions.

### 11.6 HES adapter placeholder

Define the connector interface and show `Planned` in administration. Do not create HES screens, readiness requirements, fake HES values or workflow blocks in the MVP.

---

## 12. Deterministic diagnostic-rule engine

Rules are engineering assets, not prompts and not editable free text in the application.

### 12.1 Rule requirements

Each rule contains:

- stable rule ID;
- semantic version;
- lifecycle: draft, approved, active, retired;
- applicable meter models/variants;
- complaint codes;
- required and optional evidence;
- deterministic `all`, `any` and `not` conditions;
- rule-output severity;
- hypotheses strengthened/weakened/ruled out;
- score contribution or constraint;
- requested evidence/manual validation;
- stop condition if any;
- owner, reviewer and effective date;
- test fixtures.

### 12.2 Example rule

```yaml
id: DLMS-POWER-OVERVOLTAGE-001
version: 1.0.0
status: active
appliesTo:
  complaintCodes: [DISPLAY_BLANK, REPEATED_RESET]
  meterModels: ['*']
requires:
  features:
    - voltage.over_limit.count
when:
  all:
    - feature: voltage.over_limit.count
      operator: gte
      value: 3
    - feature: voltage.maximum
      operator: gt
      reference: configured_voltage_upper_limit
effects:
  strengthen:
    - hypothesis: POWER_SUPPLY_STRESS
      weight: 20
  requestEvidence:
    - imageView: POWER_SUPPLY_REGION
  notes:
    - Repeated high voltage supports electrical stress but does not identify the failed component.
approval:
  owner: engineering-quality
  reviewer: technical-authority
```

### 12.3 Rule deployment

- Store rule source in version control.
- Validate against a JSON Schema in CI.
- Run positive, negative and boundary fixtures.
- Publish an immutable bundle artifact.
- Load the active bundle into the runtime store.
- Record the bundle version on every rule evaluation and RCA version.
- Retiring a rule affects future runs only; historical cases retain their original evaluation.

---

## 13. AI architecture and guardrails

### 13.1 Provider configuration

Workspace administrators can configure either:

- Vertex AI: project, location, credentials/service account reference and model ID;
- OpenRouter: API key and model slug.

Allow separate active models for:

- image analysis;
- hypothesis ranking;
- RCA/report drafting.

Keys must be encrypted and stored only in the server secret layer. The browser receives only provider name, model name, masked key suffix and verification status.

### 13.2 AI capabilities

#### Vision analysis

Receives selected images, view metadata, meter model/revision and the approved failure ontology. Returns strict structured observations.

#### Hypothesis ranking

Receives the normalized complaint, relevant MES snapshot, deterministic DLMS features, accepted/pending visual findings, matched rules and known contradictions. It must not receive arbitrary database access.

#### RCA drafting

Receives only selected evidence, the analyst's accepted findings, current hypothesis record and RCA schema. It proposes structured wording; it does not approve or publish.

### 13.3 Required validation

- Every capability uses a versioned JSON schema.
- Reject additional causal fields not allowed for that capability.
- Validate referenced evidence IDs exist and belong to the case.
- Hypothesis scores must be numeric, between 0 and 100 and total 100 within rounding tolerance.
- Missing or malformed output triggers one controlled repair attempt, then a visible failure.
- Provider/model errors must never clear a previous valid result.
- A model switch creates a new run; it does not overwrite historical output.

### 13.4 Presentation of AI scores

For each hypothesis display:

- AI hypothesis score;
- evidence coverage percentage;
- number of supporting rules/evidence;
- number of contradictions;
- missing critical evidence;
- final reviewer-approved confidence category, if available.

Always label the percentage `AI hypothesis score`, never `probability that this is the root cause`.

### 13.5 Human control

AI may:

- extract visual observations;
- summarize deterministic signals;
- rank hypotheses;
- suggest missing evidence;
- draft RCA wording;
- propose CAPA text.

AI may not:

- alter raw source evidence;
- resolve identity conflicts;
- mark a visual finding accepted on behalf of an analyst;
- approve RCA;
- assign liability;
- release a customer report;
- submit an SAP action;
- close CAPA;
- group a case into a master RCA without reviewer approval.

---

## 14. RCA model and approval

### 14.1 Required structured fields

1. Reported observation
2. Reproduced or data-supported symptom
3. Failed function
4. Subsystem
5. Failure point/component/node
6. Physical or logical mechanism
7. Initiating cause
8. Contributing factors
9. Origin classification
10. Escape point
11. Liability recommendation, if applicable and permitted
12. Confidence category
13. Supporting evidence
14. Contradictory evidence
15. Missing validation
16. Related meter population

Each causal field supports:

- value/code;
- explanatory text;
- evidence links;
- evidence type: direct, inferred, contradictory or unavailable;
- author/system source;
- last changed version.

### 14.2 Valid depth behavior

The deepest supported level may differ by case:

- A visible broken terminal may support a confirmed failure point and mechanism.
- DLMS voltage events plus a visible burnt power-supply region may support a probable subsystem-level conclusion.
- A blank display with normal self-diagnostics and no visible anomaly may remain inconclusive.

Empty deeper fields must be represented as `Not established from available evidence`, not fabricated.

### 14.3 Analyst submission

Before submission, validate:

- primary identity resolved;
- selected DLMS package valid or explicitly unavailable;
- required image views complete or waived with reason;
- all material AI findings reviewed;
- conclusion evidence-linked;
- contradictions disclosed;
- confidence selected;
- no unsupported liability or billing statement.

Submission freezes the RCA version and creates a Quality task.

### 14.4 Quality review

Quality can:

- approve;
- request changes with reason codes and comments;
- reject as unsupported;
- mark manual validation required;
- approve or reject proposed master-RCA membership.

Approval stores reviewer, timestamp and exact version. Any later edit creates a new version and invalidates the prior report release until re-approved.

### 14.5 Report generation

Internal report includes the full structured record, hypothesis history, rule versions, AI run metadata, contradictions, MES back-trace and CAPA.

Customer-safe report is generated from the same approved RCA but excludes:

- internal hypothesis scores;
- model/prompt detail;
- confidential MES/process information;
- unapproved liability language;
- blame/speculation;
- internal comments;
- billing conclusions;
- unrelated component-level detail.

Every PDF/DOCX records case ID, RCA version, approval timestamp and report-template version.

---

## 15. CAPA workflow

### 15.1 CAPA structure

- Containment: immediate control of potentially affected inventory/population.
- Correction: action on the specific returned meter/case.
- Corrective action: removal of the confirmed or approved probable cause.
- Preventive action: reduction of occurrence in related products or processes.
- Effectiveness verification: proof that the action worked over a defined population and period.

### 15.2 CAPA action fields

- action ID and category;
- linked RCA version;
- description;
- accountable internal owner;
- department;
- optional external contributor;
- due date and priority;
- acceptance timestamp;
- progress and comments;
- implementation evidence;
- affected population;
- effectiveness metric;
- baseline and target;
- observation window;
- pass/fail rule;
- submitted result;
- reviewer and closure decision.

### 15.3 CAPA states

```text
DRAFT
  -> AWAITING_OWNER_ACCEPTANCE
  -> IN_PROGRESS
  -> IMPLEMENTED
  -> EFFECTIVENESS_MONITORING
  -> EFFECTIVE -> CLOSED
                       \
                        -> FAILED -> REOPENED / REVISED_ACTION
```

### 15.4 Ownership behavior

- Every action has exactly one accountable internal owner.
- External contributors do not receive MVP accounts; their work is recorded by the internal owner.
- Reassignment requires reason and is audited.
- Overdue actions appear in the owner and Quality queues.
- A CAPA cannot close merely because actions are marked complete; effectiveness must be evaluated.

---

## 16. Batch intelligence and MES back-tracing

### 16.1 Candidate grouping dimensions

- meter model/variant;
- PCB batch/PCBA batch;
- supplier/supplier lot;
- BOM revision;
- production line/date/shift;
- process-test or calibration signature;
- rework code;
- complaint code;
- DLMS event/profile signature;
- visual failure-point code;
- approved mechanism/origin.

### 16.2 Grouping policy

- The system proposes, never automatically approves, a cluster.
- Show why every member was proposed.
- Show contradictory dimensions and outliers.
- Quality selects representative evidence and confirms membership.
- A master RCA records its homogeneity rationale and member version set.
- An individual case may inherit a master conclusion only through an explicit, auditable link.
- New evidence can trigger membership review.

### 16.3 Back-trace output

Display:

- selection criteria;
- matching MES population count;
- matching returned-case count;
- time range;
- supplier, batch, line and process distribution;
- cases supporting the signature;
- known outliers;
- proposed containment population;
- linked CAPA.

Do not label the queried population `affected` until reviewer confirmation; use `potentially related`.

---

## 17. Notifications and work assignment

MVP notifications are in-app and link directly to the required action.

Required events:

- new case assigned;
- identity mismatch;
- invalid import;
- missing required image/data;
- AI run failed;
- analyst feedback requested;
- RCA submitted;
- Quality changes requested;
- RCA approved;
- CAPA assigned/reassigned;
- CAPA due soon/overdue;
- effectiveness window completed;
- integration unhealthy.

Email is an optional notification adapter, not required for domain correctness.

---

## 18. Application screens and navigation

Primary navigation:

1. Dashboard
2. Return Lots
3. FFR Cases
4. Batch RCA
5. CAPA
6. Reports
7. Administration, permission-controlled

Case detail tabs:

1. Overview
2. Sources and identity
3. MES genealogy
4. BCS/DLMS analysis
5. Images and findings
6. Diagnostic reasoning
7. RCA and reports
8. CAPA and back-trace
9. Audit history

Each screen's layout and component rules are specified in `FFR_UI_UX_DESIGN_SYSTEM.md`.

---

## 19. Reference software architecture

### 19.1 Logical components

```text
Web client
  -> API/application service
      -> relational database
      -> object storage
      -> background job queue
      -> integration adapters (Deepu, SAP, MES, DLMS)
      -> AI provider adapters (Vertex, OpenRouter)
      -> document generation service
      -> notification adapter
      -> audit service
```

### 19.2 Current-repository implementation direction

The existing project is a React/TypeScript application using Next-compatible Vinext. Continue with TypeScript for UI, server routes and shared schemas. The present prototype uses in-memory demonstration state and has no configured production database or object bucket. Production work must add:

- Drizzle-backed relational persistence;
- object-storage abstraction;
- background-job abstraction;
- migration workflow;
- server-side authentication/RBAC enforcement;
- secret-provider abstraction;
- integration and AI adapters.

Do not bind domain services directly to a specific cloud SDK. Define ports/interfaces and supply environment-specific adapters.

### 19.3 Suggested source organization

```text
app/
  dashboard/
  lots/
  cases/
  batches/
  capa/
  reports/
  admin/
  api/v1/
components/
  shell/
  data-display/
  forms/
  evidence/
  diagnosis/
domain/
  cases/
  evidence/
  dlms/
  diagnosis/
  rca/
  capa/
  batch/
integrations/
  returns/
  sap/
  mes/
  dlms/
  ai/
infrastructure/
  database/
  objects/
  jobs/
  auth/
  secrets/
rules/
  schema/
  active/
  fixtures/
db/
  schema.ts
  migrations/
tests/
  unit/
  integration/
  e2e/
```

### 19.4 API and domain conventions

- Version public integration endpoints under `/api/v1`.
- Use generated IDs internally and preserve external IDs separately.
- Store timestamps in UTC and display in the user's configured timezone.
- Use ISO 8601 in APIs.
- Use decimal-safe representations for meter values; do not rely on binary floating point for billing/energy registers.
- Define request/response schemas in shared TypeScript and runtime validation.
- Return machine-readable error codes plus safe user messages.
- Use optimistic concurrency/version fields for reviewable records.
- All write services receive actor/context and produce audit events in the same transaction.

---

## 20. Security, audit and retention

### 20.1 Security baseline

- Private deployment only.
- Server-side authorization on every read and write; hidden UI is not authorization.
- Least-privilege integration service accounts.
- Encrypted transport and encrypted managed storage.
- AI/integration credentials only in the secret layer.
- Malware/type validation for uploaded files.
- Signed, short-lived download URLs for evidence and reports.
- Rate limits and size limits on imports and AI actions.
- No secrets or raw customer evidence in application logs.

### 20.2 Audit baseline

Audit these actions:

- login/account/role changes;
- import and source-version selection;
- identity resolution;
- AI execution/retry/model change;
- analyst feedback;
- rule evaluation/version;
- RCA edits, submission and approval;
- report generation/release;
- CAPA assignment/status/evidence/closure;
- SAP action request;
- retention-policy change;
- attempted unauthorized action.

### 20.3 Retention

Evidence is immutable for an administrator-configured retention period. Expiry creates an archive/deletion job subject to policy and legal hold. Ordinary users cannot delete source evidence, approved RCA, reports, AI-run records or audit history.

---

## 21. Error, loading and recovery behavior

### 21.1 Integration failure

- Keep the case available.
- Mark only the failed source as unavailable/partial.
- Show last successful snapshot.
- Allow authorized retry.
- Do not manufacture placeholder source data.

### 21.2 AI failure

- Preserve inputs and failed run metadata.
- Retry according to configured transient-error policy.
- Allow the analyst to continue with deterministic results.
- Never remove a previously accepted finding because a later model call failed.

### 21.3 Contradictory evidence

- Display both claims and their sources.
- Mark dependent hypotheses/conclusions as needing review.
- Prevent final approval if contradiction is material and unresolved.
- Resolution requires a reason and does not delete either source.

### 21.4 Empty data

- Distinguish `not supplied`, `not available`, `not applicable`, `empty valid result` and `failed to retrieve`.
- Do not display zero where the value is unknown.
- Explain how missing evidence affects coverage and confidence.

---

## 22. Testing and acceptance criteria

### 22.1 Unit tests

- Runtime schemas and validation errors.
- Identity normalization/reconciliation.
- Workbook sheet/header mapping.
- Date/time, decimal, unit and scaler parsing.
- Every deterministic DLMS feature.
- Event occurrence/restoration pairing.
- Rule conditions and score effects.
- State transition guards.
- RBAC permission checks.
- Customer-safe report field filtering.
- CAPA effectiveness rules.

### 22.2 Golden workbook fixture

Use `AS2373952_Reports_2026-06-30_16-07-28.xlsx` as an initial regression fixture. Expected assertions should include:

- all 16 sheets recognized;
- correct meter identity and configuration extraction;
- self-diagnostic status extraction;
- block-load record count and time window;
- detection of the long profile gap;
- voltage excursion statistics;
- power, current-reversal, low-PF and voltage event pairing;
- RTC transaction detection;
- register monotonicity checks;
- suspicious repeated export value flagged as a data-quality/mapping signal rather than accepted as a physical half-hour reading.

Exact expected values must be stored in a reviewed fixture manifest, not scattered through UI tests.

### 22.3 Integration tests

- API and Excel return imports normalize identically.
- DLMS API and workbook packages normalize into compatible features.
- Duplicate event retries are idempotent.
- Source update makes dependent reasoning stale.
- Invalid files remain visible and can be superseded.
- AI output is schema-validated.
- Provider timeout/failure does not lose case state.
- SAP action requires correct approval and audit context.
- MES back-trace records query dimensions and snapshot.

### 22.4 End-to-end scenarios

1. Single-meter happy path from return sync through approved RCA and CAPA monitoring.
2. Return lot containing several individually traceable meters.
3. Meter-identity mismatch blocking final analysis.
4. Invalid DLMS workbook followed by a corrected upload.
5. Visual finding rejected by the analyst and hypotheses recalculated.
6. Strong but unconfirmed evidence producing `probable` with manual-validation request.
7. No fault reproduced.
8. Inconclusive diagnosis with honest missing-evidence statement.
9. Quality change request creating a new RCA version.
10. Reviewer-approved master RCA with an excluded outlier.
11. CAPA becoming overdue, entering monitoring, passing and closing.
12. CAPA failing effectiveness and reopening.
13. Unauthorized user attempting approval or model configuration.
14. Vertex/OpenRouter failure with deterministic workflow continuing.
15. HES remaining absent without blocking the MVP case.

### 22.5 Accessibility and UI tests

- Keyboard access to navigation, tables, dialogs, uploads and review actions.
- Visible focus indicator.
- WCAG AA contrast for text and interactive controls.
- Status never communicated by color alone.
- Logical heading order and form labels.
- Desktop and tablet responsive layouts.
- Loading, empty, partial, failed and unauthorized states.

### 22.6 Definition of done for the MVP

- No production screen relies on hard-coded demo records.
- Every displayed technical conclusion can navigate to its source evidence.
- Every user mutation is permission-checked server-side and audited.
- Both return and DLMS sources work through API and Excel/file modes.
- Approved internal and customer-safe reports are real downloadable PDF/DOCX files.
- A case can stop as probable/inconclusive without a dead end.
- CAPA ownership and effectiveness can be completed end to end.
- A return lot can support reviewer-approved batch RCA while preserving per-meter traceability.
- Production build, automated tests and security checks pass before private release.

---

## 23. Recommended implementation sequence

The detailed current plan is `FFR_PILOT_PHASED_IMPLEMENTATION_PLAN.md`. Its delivery order is authoritative:

### Phase 1A — File pipeline and workbook round-trip

- FFR IG and DLMS workbook detection/parsing.
- Exact identity matching.
- Image preservation.
- Safe Z:AE update in an exported FFR copy.
- Identity and schema exception screens.

### Phase 1B — Deterministic DLMS intelligence

- Versioned 16-sheet adapter.
- Feature/data-quality library.
- Event/profile/register calculations.
- Golden workbook regression manifest.

### Phase 1C — Complaint catalogue and deterministic rules

- Meter/NIC/Gateway product and complaint mapping.
- Rule schema/loader/evaluator and fixture harness.
- Foundation and Meter rule packs built with domain experts.
- Coverage matrix.

### Phase 1D/1E — Vision, RCA/CAPA and pilot hardening

- Vertex/OpenRouter image and structured-reasoning adapters.
- Evidence-linked hypotheses and draft RCA/CAPA.
- Updated Excel, audit JSON and report downloads.
- RBAC, retries, security, accessibility and repeated golden runs.

### Phase 2 — Adaptive diagnosis and offline test evidence

- AI recommendation of approved rules, validated by the deterministic engine.
- Versioned offline test catalogue.
- Manual/uploaded equipment readings and provenance.
- Reranking after new test evidence.
- Analyst/Quality workflow and selected enterprise integrations.

### Later phases

- Deepu/SAP/MES production integration and population learning.
- HES evidence after core workflow stability.
- Direct laboratory automation only after offline test capture is proven.

---

## 24. What is settled and what is not yet figured out

### 24.1 Settled product decisions

- Phase 1 is file-first: one FFR IG workbook, one matching DLMS workbook and images.
- The normal Phase 1 flow requires no additional technical form entry.
- File roles, meter identity, FFR row, product family and complaint are detected deterministically.
- Meter identity must match exactly one old/new meter number; mismatch is a hard stop.
- Phase 1 updates only an exported copy of approved FFR IG columns Z:AE.
- Phase 1 rule selection is deterministic; AI selection of rules begins in Phase 2.
- AI may analyze images, rank rule-generated hypotheses and draft RCA/CAPA.
- All automatic RCA/CAPA outputs remain pilot drafts requiring review.
- Meter, NIC and Gateway complaint codes are scoped by product family in a versioned catalogue.
- BCS diagnostic rules are engineering-managed and built jointly with domain experts.
- Phase 2 adds AI rule orchestration and manual/uploaded offline-equipment results.
- Deepu, SAP, MES and enterprise workflow are Phase 2+; HES remains later.
- One meter always retains an individual FFR case, even inside a lot or master RCA.
- Diagnostic logic is hybrid: deterministic calculations/rules plus AI extraction/ranking.
- AI scores are shown with evidence coverage, rules and contradictions.
- Probable, NFR and inconclusive are valid outcomes.
- AI credentials are admin-managed and server-side.
- Pilot accounts come first; SSO later.
- Evidence retention is immutable and configurable.
- Infrastructure remains cloud-agnostic through adapters.

### 24.2 P0 inputs required before their integrations/features can be completed

These are not reasons to stop all development. They are dependencies for the named feature.

1. **Matched golden package:** the FFR IG row, DLMS workbook and images must all belong to the same meter. The two currently supplied workbooks do not match.
2. **Workbook mapping approval:** exact FFR header aliases, expected DLMS headers/data rows, mandatory sheets and supported format versions.
3. **Failure-point catalogue:** the promised annotated image, code names, permitted observations, meter variants and golden-reference images.
4. **Product-family mapping:** actual FFR values that identify Meter, NIC and Gateway.
5. **Complaint synonyms:** approved mapping from real `Defect Trigger`, symptom and field-observation text to the versioned complaint catalogue.
6. **BCS rule catalogue:** conditions, thresholds, model exceptions, hypothesis effects and stop limits created with domain experts.
7. **Historical ground truth:** reviewed positive, negative and boundary cases for every activated rule pack.
8. **FFR write-back approval:** confirm columns Z:AE, maximum cell text and `Draft - review required` status.
9. **RCA/CAPA wording:** approved draft templates, correction-versus-corrective-action policy and CAPA numbering owner.
10. **AI operating configuration:** initial Vertex/OpenRouter models, credentials, file limits and cost limits.
11. **Pilot access/retention:** user roster, retention period and private hosting choice.

Deepu, SAP, MES and DLMS API contracts are required for later integration phases, not for Phase 1.

### 24.3 Honest readiness answer

The Phase 1 software flow, file roles, identity gate, feature pipeline, rule-engine boundary, draft RCA/CAPA behavior and Excel write-back contract are sufficiently defined to begin Phase 1A. The pilot is **not ready for a successful golden run** until a matched file/image package and the first reviewed rule pack are supplied. The wider production application is not fully figured out until its later integration contracts and operating policies are approved. An intern must not invent missing external contracts, thresholds, failure ontology or customer-safe wording.

---

## Appendix A — Required structured AI outputs

### A.1 Visual-analysis output

```json
{
  "schemaVersion": "1.0",
  "imageId": "img_123",
  "imageQuality": {
    "status": "SUFFICIENT",
    "issues": []
  },
  "findings": [
    {
      "ontologyCode": "POWER_REGION_DISCOLORATION",
      "observation": "Localized dark discoloration is visible near the power-supply region.",
      "location": "PCB_POWER_SUPPLY",
      "boundingBox": { "x": 0.42, "y": 0.31, "width": 0.18, "height": 0.16 },
      "score": 78,
      "alternateViewRequired": false
    }
  ]
}
```

### A.2 Hypothesis-ranking output

```json
{
  "schemaVersion": "1.0",
  "caseId": "FFR-2026-04782",
  "hypotheses": [
    {
      "code": "POWER_SUPPLY_STAGE_FAILURE",
      "score": 62,
      "supportingEvidenceIds": ["feature_12", "finding_8"],
      "contradictoryEvidenceIds": ["feature_19"],
      "missingEvidenceCodes": ["MANUAL_COMPONENT_VALIDATION"],
      "explanation": "Repeated voltage stress and accepted visual evidence support the power-supply region, while available data does not identify the exact component."
    },
    {
      "code": "DISPLAY_PATH_FAILURE",
      "score": 23,
      "supportingEvidenceIds": ["complaint_1"],
      "contradictoryEvidenceIds": [],
      "missingEvidenceCodes": ["DISPLAY_CONNECTOR_VIEW"],
      "explanation": "The complaint is consistent, but direct display-path evidence is missing."
    },
    {
      "code": "MCU_OR_FIRMWARE_FAILURE",
      "score": 15,
      "supportingEvidenceIds": [],
      "contradictoryEvidenceIds": ["selfdiag_ok"],
      "missingEvidenceCodes": ["MANUAL_COMPONENT_VALIDATION"],
      "explanation": "Not ruled out, but current evidence provides limited support."
    }
  ],
  "recommendedStopState": "PROBABLE_CAUSE_REQUIRES_VALIDATION"
}
```

---

## Appendix B — Coding rules for the implementer

- Keep domain logic out of React components.
- Do not call AI providers directly from the browser.
- Do not parse workbooks inside UI components.
- Do not use generated prose as a database schema.
- Do not store files as base64 inside relational rows.
- Do not overwrite immutable sources or approved versions.
- Do not infer authorization from a role label in the client.
- Do not use `any` for integration or AI payloads; validate unknown input at the boundary.
- Do not introduce an HES dependency into MVP readiness.
- Do not add equipment/test-station workflows to the MVP without a scope change.
- Keep every user-facing status derived from the domain state, not separately hard-coded.
- Add tests with every new rule, parser version and state transition.
