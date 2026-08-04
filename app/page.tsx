"use client";
/* Browser-uploaded data URLs cannot be routed through the framework image optimizer. */
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import {
  AlertTriangle,
  BookOpenCheck,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Download,
  FileImage,
  FileSpreadsheet,
  Info,
  Layers3,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Upload,
  X,
} from "lucide-react";
import { caseDisplayGroups, defaultSettings, pilotContract, productFamilyOptions, ruleTemplate } from "./lib/pilot-config";
import {
  classifyFfrCase,
  canonicalField,
  ffrValue,
  inspectDlmsWorkbook,
  inspectFfrRegister,
  inspectImageEvidence,
} from "./lib/workbook-parser";
import type { AppSettings, DiagnosticRule, DlmsInspection, FfrRegisterInspection, FfrRow, ImageInspection, ProductFamily, UploadedArtifact } from "./lib/pilot-types";

type Page = "analysis" | "session" | "rules" | "settings";
type MeterRole = "old" | "new";

const localConfigurationKey = "kimbal-ffr-pilot-configuration-v2";
const meterRoles: Array<{ id: MeterRole; field: string; title: string; description: string }> = [
  { id: "old", field: pilotContract.ffrRegister.identityMatch.fieldsInOrder[0], title: "Defective / old meter", description: "Use when the returned failed meter is the evidence subject." },
  { id: "new", field: pilotContract.ffrRegister.identityMatch.fieldsInOrder[1], title: "Replacement / new meter", description: "Use when evidence relates to the installed replacement meter." },
];

const navigation: Array<{ id: Page; label: string; icon: typeof Upload; description: string }> = [
  { id: "analysis", label: "Case intake", icon: Upload, description: "Register-first workflow" },
  { id: "session", label: "Current session", icon: ClipboardList, description: "Not persistent history" },
  { id: "rules", label: "Rule bundle", icon: BookOpenCheck, description: "Read-only pilot state" },
  { id: "settings", label: "Settings", icon: Settings, description: "Local configuration" },
];

function Status({ tone = "neutral", children }: { tone?: "neutral" | "good" | "warning" | "danger" | "ai"; children: ReactNode }) {
  return <span className={`status status-${tone}`}><span />{children}</span>;
}

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`card ${className}`}>{children}</section>;
}

function SectionHead({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="section-head">
    <div>
      {eyebrow && <span className="eyebrow">{eyebrow}</span>}
      <h2>{title}</h2>
      {description && <p>{description}</p>}
    </div>
    {action && <div className="section-action">{action}</div>}
  </div>;
}

function formatSize(bytes: number) {
  return `${Math.max(1, Math.round(bytes / 1024 / 1024))} MB`;
}

function truncateHash(hash: string | null) {
  return hash ? `${hash.slice(0, 12)}…${hash.slice(-8)}` : "Hash unavailable in this browser";
}

function defaultRuleDraft(): DiagnosticRule {
  return { ...ruleTemplate, conditions: ruleTemplate.conditions.map((condition) => ({ ...condition })) };
}

function hydrateSettings(candidate: Partial<AppSettings> | undefined): AppSettings {
  return {
    ...defaultSettings,
    ...candidate,
    productMappings: candidate?.productMappings ?? defaultSettings.productMappings,
    ai: { ...defaultSettings.ai, ...candidate?.ai },
    pilotAccess: { ...defaultSettings.pilotAccess, ...candidate?.pilotAccess, approvedRoles: candidate?.pilotAccess?.approvedRoles ?? defaultSettings.pilotAccess.approvedRoles },
    branding: { ...defaultSettings.branding, ...candidate?.branding },
  };
}

function loadStoredConfiguration(): { settings: AppSettings; rules: DiagnosticRule[] } | null {
  if (typeof window === "undefined") return null;
  try {
    const saved = window.localStorage.getItem(localConfigurationKey) ?? window.localStorage.getItem("kimbal-ffr-pilot-configuration-v1");
    if (!saved) return null;
    const parsed = JSON.parse(saved) as { settings?: Partial<AppSettings>; rules?: DiagnosticRule[] };
    return parsed.settings ? { settings: hydrateSettings(parsed.settings), rules: Array.isArray(parsed.rules) ? parsed.rules : [defaultRuleDraft()] } : null;
  } catch {
    window.localStorage.removeItem(localConfigurationKey);
    return null;
  }
}

function ArtifactSummary({ artifact }: { artifact: UploadedArtifact }) {
  const icon = artifact.kind === "IMAGE" ? <FileImage size={18} /> : <FileSpreadsheet size={18} />;
  return <article className="artifact-card">
    <span className={`artifact-icon artifact-${artifact.kind.toLowerCase()}`}>{icon}</span>
    <div><strong title={artifact.name}>{artifact.name}</strong><small>{artifact.detail}</small></div>
    <Status tone={artifact.kind === "UNRECOGNIZED" ? "danger" : "good"}>{artifact.kind.replaceAll("_", " ")}</Status>
    <small>{formatSize(artifact.size)} · SHA-256 {truncateHash(artifact.sha256)}</small>
  </article>;
}

function UploadStage({ title, description, buttonText, accept, multiple = false, disabled = false, onChange, children }: { title: string; description: string; buttonText: string; accept: string; multiple?: boolean; disabled?: boolean; onChange: (event: ChangeEvent<HTMLInputElement>) => void; children?: ReactNode }) {
  const inputRef = useRef<HTMLInputElement>(null);
  return <Card className="stage-card">
    <SectionHead title={title} description={description} />
    <button className="drop-zone stage-upload" disabled={disabled} onClick={() => inputRef.current?.click()}>
      <span className="drop-icon"><Upload size={23} /></span>
      <strong>{buttonText}</strong>
      <span>{multiple ? "You may select several image files." : "Select one workbook only for this stage."}</span>
      <em>{disabled ? "Complete the previous stage first" : "Select file"}</em>
    </button>
    <input ref={inputRef} className="visually-hidden" type="file" accept={accept} multiple={multiple} disabled={disabled} onChange={onChange} />
    {children}
  </Card>;
}

export default function Home() {
  const [page, setPage] = useState<Page>("analysis");
  const [settings, setSettings] = useState<AppSettings>(() => loadStoredConfiguration()?.settings ?? hydrateSettings(defaultSettings));
  const [rules] = useState<DiagnosticRule[]>(() => loadStoredConfiguration()?.rules ?? [defaultRuleDraft()]);
  const [register, setRegister] = useState<FfrRegisterInspection | null>(null);
  const [selectedRowNumber, setSelectedRowNumber] = useState<number | null>(null);
  const [meterRole, setMeterRole] = useState<MeterRole>("old");
  const [dlms, setDlms] = useState<DlmsInspection | null>(null);
  const [images, setImages] = useState<ImageInspection | null>(null);
  const [busyStage, setBusyStage] = useState<"ffr" | "dlms" | "images" | null>(null);
  const [notice, setNotice] = useState("");
  const [intakeError, setIntakeError] = useState("");
  const [mappingValue, setMappingValue] = useState("");
  const [mappingField, setMappingField] = useState<"Meter type" | "Old_Meter_Type">("Old_Meter_Type");
  const [mappingFamily, setMappingFamily] = useState<ProductFamily>("METER");

  useEffect(() => {
    window.localStorage.setItem(localConfigurationKey, JSON.stringify({ settings, rules }));
  }, [rules, settings]);

  const selectedRow = useMemo(() => register?.rows.find((row) => row.rowNumber === selectedRowNumber) ?? null, [register, selectedRowNumber]);
  const selectedRole = meterRoles.find((role) => role.id === meterRole) ?? meterRoles[0];
  const selectedMeterId = selectedRow ? ffrValue(selectedRow, selectedRole.field) : "";
  const selectedCase = selectedRow ? classifyFfrCase(selectedRow, settings) : null;
  const validDlms = dlms?.identityState === "READY_TO_ANALYZE";

  const resetEvidence = () => {
    setDlms(null);
    setImages(null);
  };

  const handleFfrUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length !== 1) {
      setIntakeError(files.length > 1 ? "MULTIPLE_FFR_REGISTERS: upload one FFR register at a time." : "MISSING_REQUIRED_WORKBOOK: choose the FFR register first.");
      return;
    }
    setBusyStage("ffr");
    setIntakeError("");
    try {
      const inspection = await inspectFfrRegister(files[0], settings);
      setRegister(inspection);
      setSelectedRowNumber(null);
      setMeterRole("old");
      resetEvidence();
      setNotice("FFR register validated. Choose the case and the meter whose evidence you want to assess.");
    } catch (error) {
      setRegister(null);
      setSelectedRowNumber(null);
      resetEvidence();
      setIntakeError(error instanceof Error ? error.message : "UNRECOGNIZED_FILE: the FFR register could not be validated.");
    } finally {
      setBusyStage(null);
    }
  };

  const chooseCase = (rowNumber: number) => {
    setSelectedRowNumber(rowNumber);
    setMeterRole("old");
    resetEvidence();
    setIntakeError("");
    setNotice(`Case on FFR row ${rowNumber} selected. Choose whether evidence belongs to the defective or replacement meter.`);
  };

  const chooseMeterRole = (role: MeterRole) => {
    setMeterRole(role);
    resetEvidence();
    setIntakeError("");
  };

  const handleDlmsUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length !== 1) {
      setIntakeError(files.length > 1 ? "MULTIPLE_DLMS_PACKAGES: upload one DLMS workbook for the selected meter." : "MISSING_REQUIRED_WORKBOOK: choose the matching DLMS workbook.");
      return;
    }
    if (!selectedMeterId) return;
    setBusyStage("dlms");
    setIntakeError("");
    try {
      const inspection = await inspectDlmsWorkbook(files[0], selectedMeterId, settings);
      setDlms(inspection);
      setImages(null);
      setNotice(inspection.messages[0]);
    } catch (error) {
      setDlms(null);
      setImages(null);
      setIntakeError(error instanceof Error ? error.message : "UNRECOGNIZED_FILE: the DLMS workbook could not be validated.");
    } finally {
      setBusyStage(null);
    }
  };

  const handleImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    setBusyStage("images");
    setIntakeError("");
    try {
      const inspection = await inspectImageEvidence(files, settings);
      setImages(inspection);
      setNotice(inspection.messages[0] ?? `${inspection.artifacts.filter((artifact) => artifact.kind === "IMAGE").length} image file(s) were bound to the selected meter.`);
    } finally {
      setBusyStage(null);
    }
  };

  const addMapping = () => {
    if (!mappingValue.trim()) {
      setNotice("Enter the exact FFR value before adding a mapping.");
      return;
    }
    setSettings((current) => ({
      ...current,
      productMappings: [...current.productMappings, { id: `mapping-${Date.now()}`, sourceField: mappingField, sourceValue: mappingValue.trim(), productFamily: mappingFamily, basis: "Local browser draft — not approved" }],
    }));
    setMappingValue("");
  };

  const handleLogoUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/") || !/\.(svg|png|jpe?g|webp)$/i.test(file.name)) {
      setNotice("Use an SVG, PNG, JPEG, or WebP logo file.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setNotice("Use a logo smaller than 2 MB for this browser-local preview.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setSettings((current) => ({ ...current, branding: { logoDataUrl: typeof reader.result === "string" ? reader.result : null, logoFileName: file.name } }));
      setNotice("Logo applied to this browser session. Server branding storage is not implemented in this build.");
    };
    reader.readAsDataURL(file);
  };

  const downloadSettings = () => {
    const blob = new Blob([JSON.stringify({ settings, rules }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "kimbal-ffr-local-configuration.json";
    link.click();
    URL.revokeObjectURL(url);
    setNotice("Local configuration draft downloaded.");
  };

  const renderCaseDetails = (row: FfrRow) => <div className="case-context-list">
    {caseDisplayGroups.map((group) => <details key={group.id} open={group.id === "case_context" || group.id === "asset_context" || group.id === "complaint_context"}>
      <summary>{group.title}</summary>
      <dl>{group.fields.map((field) => <div key={field}><dt>{row.labels[canonicalField(field)] ?? field}</dt><dd>{ffrValue(row, field) || "Not supplied"}</dd></div>)}</dl>
    </details>)}
  </div>;

  const renderException = () => <div className="page-stack">
    <header className="page-header"><div className="page-symbol"><AlertTriangle size={22} /></div><div><span className="eyebrow">Identity exception</span><h1>Evidence does not belong to the selected meter</h1><p>Processing stopped before image intake, rules, RCA, CAPA, or workbook output. Product mapping cannot resolve a meter identity mismatch.</p></div><Status tone="danger">IDENTITY_NO_MATCH</Status></header>
    <Card className="exception-panel"><SectionHead title="Upload the matching DLMS workbook or choose another register meter" /><dl className="data-list"><div><dt>Selected FFR case</dt><dd>Row {selectedRow?.rowNumber} · {ffrValue(selectedRow!, "S.No") || "No case reference"}</dd></div><div><dt>Selected evidence target</dt><dd>{selectedRole.title}: {selectedMeterId}</dd></div><div><dt>DLMS serial detected</dt><dd>{dlms?.meterId ?? "Not extracted"}</dd></div><div><dt>Reason</dt><dd>{dlms?.messages[0]}</dd></div></dl><div className="button-row"><button className="button secondary" onClick={() => { setDlms(null); setImages(null); setIntakeError(""); }}><Upload size={15} /> Upload another DLMS workbook</button><button className="button secondary" onClick={() => { setSelectedRowNumber(null); resetEvidence(); }}><ChevronRight size={15} /> Choose another case</button></div></Card>
  </div>;

  const renderAnalysis = () => {
    if (dlms?.identityState === "IDENTITY_NO_MATCH") return renderException();
    return <div className="page-stack">
      <header className="page-header"><div className="page-symbol"><ClipboardList size={22} /></div><div><span className="eyebrow">Development proof of concept</span><h1>Register-first case intake</h1><p>Start with one FFR register, select the case and evidence target, then provide that meter’s DLMS workbook and images in separate stages.</p><p className="helper-text">The uploaded register is read locally. Deepu return-module enrichment is not connected in this build, so no external meter data is fetched.</p></div><Status tone="warning">No governed analysis run yet</Status></header>
      <section className="workflow-overview" aria-label="Case intake stages">{[["1", "FFR register", Boolean(register)], ["2", "Case and meter", Boolean(selectedRow && selectedMeterId)], ["3", "Matching DLMS", Boolean(validDlms)], ["4", "Image evidence", Boolean(images)], ["5", "Analysis readiness", false]].map(([number, label, complete]) => <div className={complete ? "pipeline-step complete" : "pipeline-step"} key={String(number)}><span>{complete ? <CheckCircle2 size={15} /> : number}</span><strong>{label}</strong></div>)}</section>
      {intakeError && <div className="callout danger" role="alert"><AlertTriangle size={19} /><div><strong>Intake stopped.</strong><p>{intakeError}</p></div></div>}
      {!register && <UploadStage title="1. Upload the FFR IG register" description="This is the source register of selectable FFR cases. Upload only this workbook first; the app will read its case, meter, complaint, field, logistics, and existing CAPA data." buttonText={busyStage === "ffr" ? "Reading FFR register…" : "Upload one FFR IG workbook"} accept=".xlsx,.xls" onChange={handleFfrUpload} />}
      {register && !selectedRow && <Card className="stage-card"><SectionHead eyebrow="1. FFR register validated" title="Choose the FFR case before uploading evidence" description="This register contains multiple meters. The next upload belongs to exactly one selected case and meter, not to the register as a whole." action={<Status tone="good">{register.rows.length} cases</Status>} /><div className="artifact-grid"><ArtifactSummary artifact={register.artifact} /></div><div className="case-table-wrap"><table className="case-table"><thead><tr><th>Case</th><th>Sub-division</th><th>Defective meter</th><th>Replacement meter</th><th>Complaint</th><th>Field observation</th><th><span className="visually-hidden">Select</span></th></tr></thead><tbody>{register.rows.map((row) => <tr key={row.rowNumber}><td><strong>{ffrValue(row, "S.No") || `Row ${row.rowNumber}`}</strong><small>Excel row {row.rowNumber}</small></td><td>{ffrValue(row, "Sub-Division") || "Not supplied"}</td><td>{ffrValue(row, "Old_Meter_Number") || "Not supplied"}</td><td>{ffrValue(row, "New_Meter_Number") || "Not supplied"}</td><td><strong>{ffrValue(row, "Defect Trigger") || "Not supplied"}</strong><small>{ffrValue(row, "Symptoms of the problem New")}</small></td><td>{ffrValue(row, "Field Observation") || "Not supplied"}</td><td><button className="button primary" onClick={() => chooseCase(row.rowNumber)}>Choose case</button></td></tr>)}</tbody></table></div></Card>}
      {selectedRow && <>
        <Card className="case-card"><SectionHead eyebrow="2. Selected FFR case" title={`Case ${ffrValue(selectedRow, "S.No") || `row ${selectedRow.rowNumber}`}`} description="All values below come from the FFR register. Existing RCA/CAPA cells are source context only and are not treated as approved conclusions." action={<button className="button secondary" onClick={() => { setSelectedRowNumber(null); resetEvidence(); }}>Change case</button>} /><div className="case-summary"><div><span>Defect date</span><strong>{ffrValue(selectedRow, "Date Of Defect") || "Not supplied"}</strong></div><div><span>Sub-division</span><strong>{ffrValue(selectedRow, "Sub-Division") || "Not supplied"}</strong></div><div><span>Product mapping</span><strong>{selectedCase?.productFamily ?? "Unresolved — configure mapping"}</strong></div><div><span>Complaint mapping</span><strong>{selectedCase?.complaintLabel ?? "Unclassified"}</strong></div></div>{renderCaseDetails(selectedRow)}</Card>
        <Card className="stage-card"><SectionHead eyebrow="2. Evidence target" title="Which meter are you uploading evidence for?" description="This choice controls the exact DLMS identity check. It is deliberately separate from case selection." /><div className="meter-role-grid">{meterRoles.map((role) => { const meterId = ffrValue(selectedRow, role.field); return <button key={role.id} className={meterRole === role.id ? "meter-role selected" : "meter-role"} onClick={() => chooseMeterRole(role.id)} disabled={!meterId}><span><strong>{role.title}</strong><small>{role.description}</small></span><b>{meterId || "No meter number supplied"}</b>{meterRole === role.id && <CheckCircle2 size={18} />}</button>; })}</div>{!selectedMeterId && <div className="callout danger"><AlertTriangle size={19} /><div><strong>This case has no selected meter ID.</strong><p>Select a populated meter identity or correct the source register before uploading DLMS evidence.</p></div></div>}</Card>
        <UploadStage title="3. Upload the matching BCS/DLMS workbook" description={`Upload the single DLMS workbook for ${selectedRole.title.toLowerCase()} ${selectedMeterId}. Its serial number must exactly match this selected ID.`} buttonText={busyStage === "dlms" ? "Reading DLMS workbook…" : "Upload one matching DLMS workbook"} accept=".xlsx,.xls" disabled={!selectedMeterId} onChange={handleDlmsUpload}>{dlms && <div className="artifact-grid"><ArtifactSummary artifact={dlms.artifact} /></div>}</UploadStage>
      </>}
      {validDlms && <>
        <Card className="callout good"><CheckCircle2 size={19} /><div><strong>Exact identity confirmed for {selectedMeterId}.</strong><p>{dlms?.messages[0]}</p></div></Card>
        <UploadStage title="4. Upload images for this selected meter" description="Images are attached only to this case and meter. File signatures are validated. Vision/image analysis is not implemented in this build, so no visual finding is inferred." buttonText={busyStage === "images" ? "Validating image files…" : "Add meter images"} accept=".png,.jpg,.jpeg,.webp" multiple onChange={handleImageUpload}>{images && <div className="artifact-grid">{images.artifacts.map((artifact) => <ArtifactSummary key={artifact.id} artifact={artifact} />)}</div>}</UploadStage>
        <Card><SectionHead eyebrow="5. Analysis readiness" title="Evidence has been staged, not analyzed" description="This build validates and binds evidence to the selected case. It does not have an approved rule bundle, image-analysis adapter, governed run record, workbook write-back, or exports; no RCA/CAPA is generated." action={<Status tone="warning">RULE_BUNDLE_UNAVAILABLE</Status>} /><div className="feature-table"><div className="feature-head"><span>Preliminary deterministic feature</span><span>Value</span><span>Source and locator</span></div>{dlms?.features.map((feature) => <div key={feature.code}><span><strong>{feature.label}</strong><small>{feature.code}</small></span><strong>{String(feature.value)}</strong><span>{feature.provenance ? `${feature.provenance.sheet} · ${feature.provenance.locator}` : feature.source}</span></div>)}</div></Card>
      </>}
    </div>;
  };

  const renderSession = () => <div className="page-stack"><header className="page-header"><div className="page-symbol"><ClipboardList size={22} /></div><div><span className="eyebrow">Browser-only state</span><h1>Current session</h1><p>This page is not persistent run history. Refreshing or clearing browser data may remove the current evidence selection.</p></div></header><Card>{selectedRow ? <><SectionHead title={`Selected case ${ffrValue(selectedRow, "S.No") || selectedRow.rowNumber}`} description="Current session state only." action={<Status tone={validDlms ? "good" : "warning"}>{validDlms ? "DLMS matched" : "Evidence incomplete"}</Status>} /><div className="history-row"><div><FileSpreadsheet size={20} /><span><strong>{selectedMeterId || "No selected meter"}</strong><small>{register?.artifact.name ?? "No FFR register"} · {dlms?.artifact.name ?? "No DLMS workbook"}</small></span></div><button className="button secondary" onClick={() => setPage("analysis")}>Return to intake <ChevronRight size={15} /></button></div></> : <div className="empty-state"><ClipboardList size={28} /><strong>No case selected in this session</strong><span>Start by uploading the FFR register and selecting a case.</span><button className="button primary" onClick={() => setPage("analysis")}>Start case intake</button></div>}</Card></div>;

  const renderRules = () => <div className="page-stack"><header className="page-header"><div className="page-symbol"><BookOpenCheck size={22} /></div><div><span className="eyebrow">Governed deterministic rules</span><h1>Rule bundle</h1><p>The repository contains one unapproved rule template, not an operational rule bundle. Browser edits and browser publication are intentionally unavailable.</p></div><Status tone="danger">RULE_BUNDLE_UNAVAILABLE</Status></header><Card><SectionHead title="What a rule must declare" description="The template is visible so engineering teams can review the decision boundary, but it cannot influence a case." /><div className="rule-detail-grid"><div><small>Question it helps answer</small><strong>{ruleTemplate.purpose}</strong></div><div><small>Applies to</small><strong>{ruleTemplate.productFamilies.join(", ")} · {ruleTemplate.complaintKeys.join(", ")}</strong></div><div><small>Evidence condition</small><strong>{ruleTemplate.conditions.map((condition) => `${condition.feature} ${condition.operator} ${condition.value ?? ""}`).join(" and ")}</strong></div><div><small>Possible effect</small><strong>{ruleTemplate.hypothesisLabel} +{ruleTemplate.weight}</strong></div><div><small>Required follow-up</small><strong>{ruleTemplate.requiredFollowUp}</strong></div><div><small>Stop policy</small><strong>{ruleTemplate.limitation}</strong></div></div><div className="callout warning"><Info size={19} /><div><strong>Why the case cannot run yet.</strong><p>There are no reviewed active rules, fixtures, or coverage matrix. A deterministic analysis run must remain blocked rather than return a misleading inconclusive RCA.</p></div></div></Card></div>;

  const renderSettings = () => <div className="page-stack"><header className="page-header"><div className="page-symbol"><Settings size={22} /></div><div><span className="eyebrow">Browser-local preferences</span><h1>Settings</h1><p>These values are stored in this browser and can be downloaded. They are not server-persisted, audited, access-controlled, or applied to historic runs.</p></div><button className="button secondary" onClick={downloadSettings}><Download size={15} /> Download local draft</button></header>
    <section className="settings-grid"><Card><SectionHead eyebrow="Branding" title="Upload the Kimbal logo" description="Use the approved logo asset. It is used as a browser-local preview only until branding storage is implemented." /><div className="logo-setting"><div className="logo-preview">{settings.branding.logoDataUrl ? <img src={settings.branding.logoDataUrl} alt="Uploaded organisation logo" /> : <span>No logo uploaded</span>}</div><div><label className="button secondary"> <Upload size={15} /> Upload logo<input className="visually-hidden" type="file" accept=".svg,.png,.jpg,.jpeg,.webp" onChange={handleLogoUpload} /></label>{settings.branding.logoFileName && <small>{settings.branding.logoFileName}</small>}{settings.branding.logoDataUrl && <button className="text-button" onClick={() => setSettings((current) => ({ ...current, branding: { logoDataUrl: null, logoFileName: null } }))}>Remove local logo</button>}</div></div></Card><Card><SectionHead eyebrow="Pilot settings" title="Upload and retention preference" /><div className="form-grid"><label>Maximum upload size (MB)<input type="number" min="1" value={settings.uploadMaxMb} onChange={(event) => setSettings({ ...settings, uploadMaxMb: Number(event.target.value) })} /></label><label>Retention preference (days)<input type="number" min="1" value={settings.retentionDays} onChange={(event) => setSettings({ ...settings, retentionDays: Number(event.target.value) })} /></label><label>Pilot access mode<input value={settings.pilotAccess.mode} onChange={(event) => setSettings({ ...settings, pilotAccess: { ...settings.pilotAccess, mode: event.target.value } })} /></label><label className="wide">Approved pilot roles (local reference)<input value={settings.pilotAccess.approvedRoles.join(", ")} onChange={(event) => setSettings({ ...settings, pilotAccess: { ...settings.pilotAccess, approvedRoles: event.target.value.split(",").map((role) => role.trim()).filter(Boolean) } })} /></label></div><p className="helper-text">Upload size is applied by this browser build. Retention and access are not enforced until server storage and RBAC exist.</p></Card></section>
    <Card><SectionHead eyebrow="Product-family mapping" title="Map actual FFR values to Meter, NIC, or Gateway" description="Catalogue presence is not diagnostic coverage. Only exact mappings configured here can classify a selected FFR case." /><div className="mapping-list">{settings.productMappings.map((mapping) => <div key={mapping.id}><span><strong>{mapping.sourceField}</strong><small>{mapping.basis}</small></span><strong>{mapping.sourceValue}</strong><Status tone="good">{mapping.productFamily}</Status><button aria-label={`Remove ${mapping.sourceValue} mapping`} onClick={() => setSettings((current) => ({ ...current, productMappings: current.productMappings.filter((item) => item.id !== mapping.id) }))}><X size={15} /></button></div>)}</div><div className="inline-form"><select value={mappingField} onChange={(event) => setMappingField(event.target.value as "Meter type" | "Old_Meter_Type")}><option>Old_Meter_Type</option><option>Meter type</option></select><input value={mappingValue} onChange={(event) => setMappingValue(event.target.value)} placeholder="Exact FFR value" /><select value={mappingFamily} onChange={(event) => setMappingFamily(event.target.value as ProductFamily)}>{productFamilyOptions().map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><button className="button secondary" onClick={addMapping}><SlidersHorizontal size={15} /> Add local mapping</button></div></Card>
    <section className="settings-grid"><Card><SectionHead eyebrow="AI reference only" title="No AI provider is connected" description="Do not enter credentials here. These are local reference fields only; no model call, image analysis, or structured reasoning service is implemented." /><div className="form-grid"><label>Provider reference<input value={settings.ai.provider} onChange={(event) => setSettings({ ...settings, ai: { ...settings.ai, provider: event.target.value } })} /></label><label>Vision-model reference<input value={settings.ai.visionModel} onChange={(event) => setSettings({ ...settings, ai: { ...settings.ai, visionModel: event.target.value } })} /></label><label>Reasoning-model reference<input value={settings.ai.reasoningModel} onChange={(event) => setSettings({ ...settings, ai: { ...settings.ai, reasoningModel: event.target.value } })} /></label><label className="wide">Future server secret reference<input value={settings.ai.credentialReference} onChange={(event) => setSettings({ ...settings, ai: { ...settings.ai, credentialReference: event.target.value } })} /></label></div></Card><Card><SectionHead eyebrow="Draft wording" title="RCA and CAPA templates" description="No approved RCA/CAPA wording is supplied. These local templates cannot create a report in this build." /><div className="template-grid"><label>RCA template<textarea value={settings.rcaTemplate} onChange={(event) => setSettings({ ...settings, rcaTemplate: event.target.value })} /></label><label>CAPA template<textarea value={settings.capaTemplate} onChange={(event) => setSettings({ ...settings, capaTemplate: event.target.value })} /></label></div></Card></section>
  </div>;

  const content: Record<Page, ReactNode> = { analysis: renderAnalysis(), session: renderSession(), rules: renderRules(), settings: renderSettings() };

  return <div className="app-shell"><a className="skip-link" href="#main-content">Skip to case intake</a><aside className="sidebar"><div className="brand">{settings.branding.logoDataUrl ? <img className="brand-logo-image" src={settings.branding.logoDataUrl} alt="Organisation logo" /> : <div className="brand-wordmark">Kimbal</div>}<div><strong>Kimbal</strong><span>FFR Intelligence</span></div></div><div className="pilot-chip"><Layers3 size={14} /> Development proof of concept</div><nav aria-label="Primary navigation">{navigation.map((item) => { const Icon = item.icon; return <button aria-current={page === item.id ? "page" : undefined} className={page === item.id ? "active" : ""} key={item.id} onClick={() => setPage(item.id)}><Icon size={18} /><span><strong>{item.label}</strong><small>{item.description}</small></span></button>; })}</nav><div className="sidebar-note"><ShieldCheck size={16} /><span><strong>Exact identity before inference</strong><small>FFR case selection and meter identity are separate, required stages.</small></span></div></aside><main className="main" id="main-content"><header className="topbar"><div><span>Private pilot workspace</span><strong>Case-first evidence staging</strong></div><div className="topbar-status"><Status tone="warning">Local browser state</Status><span>v1.1</span></div></header><div className="content">{notice && <div className="notice" aria-live="polite"><Info size={16} /><span>{notice}</span><button aria-label="Dismiss notification" onClick={() => setNotice("")}><X size={15} /></button></div>}{content[page]}</div></main></div>;
}
