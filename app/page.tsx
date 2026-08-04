"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type ReactNode } from "react";
import {
  AlertTriangle,
  BookOpenCheck,
  Bot,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  ClipboardList,
  Download,
  FileCheck2,
  FileSpreadsheet,
  ImageIcon,
  Info,
  Layers3,
  LoaderCircle,
  Plus,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Upload,
  X,
} from "lucide-react";
import { complaintOptions, defaultSettings, productFamilyOptions, ruleTemplate } from "./lib/pilot-config";
import { evaluateRules } from "./lib/rule-engine";
import { inspectFiles } from "./lib/workbook-parser";
import type { AnalysisPackage, AppSettings, DiagnosticRule, ProductFamily, RuleOperator } from "./lib/pilot-types";

type Page = "analysis" | "history" | "rules" | "settings";

const navigation: Array<{ id: Page; label: string; icon: typeof Upload; description: string }> = [
  { id: "analysis", label: "New analysis", icon: Upload, description: "File-first pilot" },
  { id: "history", label: "Analysis history", icon: ClipboardList, description: "Runs and exceptions" },
  { id: "rules", label: "Rule library", icon: BookOpenCheck, description: "Versioned diagnostic knowledge" },
  { id: "settings", label: "Settings", icon: Settings, description: "Configuration and templates" },
];

const formatSize = (bytes: number) => `${Math.max(1, Math.round(bytes / 1024 / 1024))} MB`;
const localConfigurationKey = "kimbal-ffr-pilot-configuration-v1";

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

function stateLabel(state: AnalysisPackage["identityState"]) {
  return state.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function interpolate(template: string, values: Record<string, string>) {
  return template.replace(/{{(.*?)}}/g, (_, token: string) => values[token.trim()] ?? "Not established from supplied evidence");
}

function defaultRuleDraft(): DiagnosticRule {
  return { ...ruleTemplate, conditions: ruleTemplate.conditions.map((condition) => ({ ...condition })) };
}

function loadStoredConfiguration(): { settings: AppSettings; rules: DiagnosticRule[] } | null {
  if (typeof window === "undefined") return null;
  try {
    const saved = window.localStorage.getItem(localConfigurationKey);
    if (!saved) return null;
    const parsed = JSON.parse(saved) as { settings?: AppSettings; rules?: DiagnosticRule[] };
    return parsed.settings && Array.isArray(parsed.rules) ? { settings: parsed.settings, rules: parsed.rules } : null;
  } catch {
    window.localStorage.removeItem(localConfigurationKey);
    return null;
  }
}

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [page, setPage] = useState<Page>("analysis");
  const [settings, setSettings] = useState<AppSettings>(() => loadStoredConfiguration()?.settings ?? defaultSettings);
  const [rules, setRules] = useState<DiagnosticRule[]>(() => loadStoredConfiguration()?.rules ?? [defaultRuleDraft()]);
  const [analysis, setAnalysis] = useState<AnalysisPackage | null>(null);
  const [analysisStarted, setAnalysisStarted] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [notice, setNotice] = useState("");
  const [mappingValue, setMappingValue] = useState("");
  const [mappingField, setMappingField] = useState<"Meter type" | "Old_Meter_Type">("Old_Meter_Type");
  const [mappingFamily, setMappingFamily] = useState<ProductFamily>("METER");
  const [draftRule, setDraftRule] = useState<DiagnosticRule>(defaultRuleDraft());

  useEffect(() => {
    window.localStorage.setItem(localConfigurationKey, JSON.stringify({ settings, rules }));
  }, [rules, settings]);

  const evaluations = useMemo(
    () => analysis ? evaluateRules(rules, analysis.productFamily, analysis.complaintKey, analysis.dlmsFeatures) : [],
    [analysis, rules],
  );
  const matchedRules = evaluations.filter((evaluation) => evaluation.applicable);
  const activeRules = rules.filter((rule) => rule.status === "active");

  const inspect = async (files: File[]) => {
    if (!files.length) return;
    setLoadingFiles(true);
    setAnalysisStarted(false);
    try {
      const packageResult = await inspectFiles(files, settings);
      setAnalysis(packageResult);
      setNotice("Files classified from workbook content. No source file has been changed.");
    } finally {
      setLoadingFiles(false);
    }
  };

  const onInput = (event: ChangeEvent<HTMLInputElement>) => void inspect(Array.from(event.target.files ?? []));
  const onDrop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    void inspect(Array.from(event.dataTransfer.files));
  };

  const addMapping = () => {
    if (!mappingValue.trim()) return setNotice("Enter the exact value used by the FFR workbook before adding a mapping.");
    setSettings((current) => ({
      ...current,
      productMappings: [
        ...current.productMappings,
        {
          id: `mapping-${Date.now()}`,
          sourceField: mappingField,
          sourceValue: mappingValue.trim(),
          productFamily: mappingFamily,
          basis: "Added in Settings — pending review",
        },
      ],
    }));
    setMappingValue("");
    setNotice("Product-family mapping added to the configuration draft.");
  };

  const addRule = () => {
    if (!draftRule.id.trim() || !draftRule.title.trim() || !draftRule.purpose.trim()) {
      setNotice("A rule needs an ID, title, and engineering purpose.");
      return;
    }
    if (rules.some((rule) => rule.id === draftRule.id)) {
      setNotice("Rule IDs are stable identifiers. Use a new ID or edit the existing rule through a future repository-backed change.");
      return;
    }
    setRules((current) => [...current, { ...draftRule, conditions: draftRule.conditions.map((condition) => ({ ...condition })) }]);
    setDraftRule(defaultRuleDraft());
    setNotice("Rule draft added. It remains inactive until it has an owner, reviewer, and a published status.");
  };

  const activateRule = (id: string) => {
    const target = rules.find((rule) => rule.id === id);
    if (!target || !target.owner.trim() || target.owner === "Unassigned" || !target.reviewer.trim() || target.reviewer === "Unassigned") {
      setNotice("An owner and reviewer must be recorded before a rule can be published as active.");
      return;
    }
    setRules((current) => current.map((rule) => rule.id === id ? { ...rule, status: "active" } : rule));
    setNotice("Rule published for future analysis runs. Existing runs retain their recorded bundle.");
  };

  const downloadSettings = () => {
    const blob = new Blob([JSON.stringify({ settings, rules }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "kimbal-ffr-pilot-configuration.json";
    link.click();
    URL.revokeObjectURL(url);
    setNotice("Configuration draft downloaded. Persisted server-side configuration is the next infrastructure slice.");
  };

  const renderAnalysis = () => {
    const canRun = analysis?.identityState === "READY_TO_ANALYZE" && Boolean(analysis.productFamily);
    const evidenceSummary = analysis
      ? `${analysis.dlmsFeatures.length} deterministic DLMS features were extracted from the preserved workbook; ${analysis.imageCount} image file(s) were supplied.`
      : "No evidence package is loaded.";
    const outcome = matchedRules.length ? "Probable — review required" : "Inconclusive — no active deterministic rule matched";
    const supportedConclusion = matchedRules.length
      ? matchedRules.map((evaluation) => evaluation.rule.hypothesisLabel).join(", ")
      : "No causal conclusion is established from the currently configured rules.";
    const rcaDraft = interpolate(settings.rcaTemplate, {
      evidence_summary: evidenceSummary,
      outcome,
      supported_conclusion: supportedConclusion,
      evidence_gaps: analysis?.messages.join(" ") || "No material data-quality warning reported by the intake stage.",
    });
    const capaDraft = interpolate(settings.capaTemplate, {
      containment: matchedRules.length ? "Hold potentially related cases for Quality review." : "Investigate the missing or unmatched evidence before assigning containment.",
      correction: "Preserve the returned meter and source package; do not alter the original files.",
      corrective_action: matchedRules.length ? "Assign an engineering owner after Quality reviews the supported hypothesis." : "No cause-specific corrective action is proposed.",
      preventive_action: "Not established from supplied evidence.",
      effectiveness_metric: "To be configured by the CAPA owner after RCA approval.",
    });

    return <div className="page-stack">
      <header className="page-header">
        <div className="page-symbol"><Upload size={22} /></div>
        <div><span className="eyebrow">Phase 1 file-first pilot</span><h1>New FFR analysis</h1><p>Upload the FFR register, matching BCS/DLMS workbook, and available meter images. The app extracts what is already present; it never asks an analyst to retype it.</p></div>
        <Status tone="warning">Pilot-generated drafts require review</Status>
      </header>

      <Card className="upload-card">
        <SectionHead eyebrow="1. Upload package" title="Detect file roles from their contents" description="FFR register and DLMS package signatures are validated from workbook sheets and headers, not file names." />
        <button className="drop-zone" onClick={() => inputRef.current?.click()} onDrop={onDrop} onDragOver={(event) => event.preventDefault()}>
          <span className="drop-icon"><Upload size={23} /></span>
          <strong>Upload FFR IG, BCS/DLMS, and meter images</strong>
          <span>Excel workbooks, JPEG, PNG, or WebP. Originals remain unchanged.</span>
          <em>Select files</em>
        </button>
        <input ref={inputRef} className="visually-hidden" type="file" multiple accept=".xlsx,.xls,.jpg,.jpeg,.png,.webp" onChange={onInput} />
        {loadingFiles && <div className="progress-message"><LoaderCircle className="spin" size={17} /> Reading workbook structure and evidence metadata…</div>}
        {analysis && <div className="artifact-grid">
          {analysis.artifacts.map((artifact) => <article key={`${artifact.id}-${artifact.kind}`} className="artifact-card">
            <span className={`artifact-icon artifact-${artifact.kind.toLowerCase()}`}>{artifact.kind === "IMAGE" ? <ImageIcon size={18} /> : <FileSpreadsheet size={18} />}</span>
            <div><strong>{artifact.name}</strong><small>{artifact.detail}</small></div>
            <Status tone={artifact.kind === "UNRECOGNIZED" ? "danger" : "good"}>{artifact.kind.replaceAll("_", " ")}</Status>
            <small>{formatSize(artifact.size)}</small>
          </article>)}
        </div>}
      </Card>

      {analysis && <>
        <section className="pipeline" aria-label="Analysis pipeline">
          {[
            ["Files validated", analysis.artifacts.some((artifact) => artifact.kind === "FFR_REGISTER") && analysis.artifacts.some((artifact) => artifact.kind === "DLMS_PACKAGE")],
            ["Meter identity matched", analysis.identityState === "READY_TO_ANALYZE"],
            ["Product family mapped", Boolean(analysis.productFamily)],
            ["Complaint classified", Boolean(analysis.complaintKey)],
            ["DLMS features extracted", analysis.dlmsFeatures.length > 0],
            ["Rules evaluated", analysisStarted],
          ].map(([label, complete], index) => <div className={complete ? "pipeline-step complete" : "pipeline-step"} key={String(label)}><span>{complete ? <CheckCircle2 size={15} /> : index + 1}</span><strong>{label}</strong></div>)}
        </section>

        <section className="analysis-grid">
          <Card>
            <SectionHead eyebrow="2. Identity gate" title="Exact match required" description="The FFR row is selected only by the configured old/new meter-number policy." action={<Status tone={analysis.identityState === "READY_TO_ANALYZE" ? "good" : "danger"}>{stateLabel(analysis.identityState)}</Status>} />
            <dl className="data-list">
              <div><dt>DLMS meter identity</dt><dd>{analysis.dlmsMeterId ?? "Not extracted"}</dd></div>
              <div><dt>FFR rows detected</dt><dd>{analysis.ffrRows.length || "None"}</dd></div>
              <div><dt>Matched FFR row</dt><dd>{analysis.matchedRow ? `Row ${analysis.matchedRow.rowNumber}` : "No unique row"}</dd></div>
              <div><dt>Product family</dt><dd>{analysis.productFamily ?? "Unresolved"}</dd></div>
              <div><dt>Complaint classification</dt><dd>{analysis.complaintKey ? `${analysis.complaintKey} — ${analysis.complaintLabel}` : "Awaiting a valid match"}</dd></div>
            </dl>
            {analysis.matchedRow && <div className="matched-row"><span>Matched complaint evidence</span><strong>{analysis.matchedRow.values["Defect Trigger"] || "—"}</strong><p>{analysis.matchedRow.values["Symptoms of the problem New"] || analysis.matchedRow.values["Field Observation"] || "No descriptive complaint was supplied."}</p></div>}
          </Card>
          <Card>
            <SectionHead eyebrow="Exception handling" title={analysis.identityState === "READY_TO_ANALYZE" ? "Package is ready for deterministic analysis" : "Safe stop protects the case record"} />
            <div className={analysis.identityState === "READY_TO_ANALYZE" ? "callout good" : "callout danger"}>
              {analysis.identityState === "READY_TO_ANALYZE" ? <CheckCircle2 size={19} /> : <AlertTriangle size={19} />}
              <div><strong>{analysis.identityState === "READY_TO_ANALYZE" ? "The workbook pair has one exact meter identity." : "No workbook fields will be written or inferred."}</strong><p>{analysis.messages[0] ?? "The detected evidence is ready for the next configured stage."}</p></div>
            </div>
            {analysis.identityState !== "READY_TO_ANALYZE" && analysis.ffrRows.length > 0 && <div className="candidate-list"><span>FFR meter candidates</span>{analysis.ffrRows.map((row) => <div key={row.rowNumber}><strong>Row {row.rowNumber}</strong><span>Old {row.values.Old_Meter_Number || "—"} · New {row.values.New_Meter_Number || "—"}</span></div>)}</div>}
            <button className="button secondary" onClick={() => setPage("settings")}><SlidersHorizontal size={15} /> Review mappings in Settings</button>
          </Card>
        </section>

        <Card>
          <SectionHead eyebrow="3. Deterministic evidence" title="Extracted DLMS features" description="Every feature remains traceable to its source sheet. Feature calculations are separate from rule definitions." />
          <div className="feature-table"><div className="feature-head"><span>Feature</span><span>Value</span><span>Source</span></div>{analysis.dlmsFeatures.map((feature) => <div key={feature.code}><span><strong>{feature.label}</strong><small>{feature.code}</small></span><strong>{String(feature.value)}</strong><span>{feature.source}</span></div>)}</div>
        </Card>

        <Card>
          <SectionHead eyebrow="4. Rule gate" title="Run only published deterministic rules" description="The app never lets AI choose rules in Phase 1." action={<Status tone={activeRules.length ? "good" : "warning"}>{activeRules.length} active rule{activeRules.length === 1 ? "" : "s"}</Status>} />
          {!canRun && <div className="callout danger"><CircleAlert size={19} /><div><strong>Analysis cannot start yet.</strong><p>Resolve the identity and product-family gate before evaluating rules. The current evidence remains visible and preserved.</p></div></div>}
          {canRun && !analysisStarted && <div className="callout neutral"><Info size={19} /><div><strong>Ready to apply the versioned rule bundle.</strong><p>{activeRules.length ? "Only conditions configured in active rules will affect the result." : "No active rule bundle is present. You can add/review rules in the Rule library before running."}</p></div></div>}
          <div className="button-row"><button className="button primary" disabled={!canRun || loadingFiles} onClick={() => { setAnalysisStarted(true); setNotice(activeRules.length ? "Deterministic rule evaluation completed. Review the explanation and evidence links below." : "No active rules were available; the run remains honestly inconclusive."); }}><FileCheck2 size={16} /> Run analysis</button><button className="button secondary" onClick={() => setPage("rules")}><BookOpenCheck size={16} /> Open rule library</button></div>
        </Card>

        {analysisStarted && <>
          <Card>
            <SectionHead eyebrow="Rule evaluation log" title="What ran, what it checked, and why" description="Rule explanations stay visible to analysts; status alone is never the result." />
            <div className="evaluation-list">{evaluations.map((evaluation) => <article key={evaluation.rule.id}>
              <div className="evaluation-title"><div><Status tone={evaluation.applicable ? "good" : evaluation.rule.status === "active" ? "warning" : "neutral"}>{evaluation.applicable ? "Matched" : evaluation.rule.status}</Status><h3>{evaluation.rule.title}</h3><p>{evaluation.rule.purpose}</p></div><span>{evaluation.rule.id} · v{evaluation.rule.version}</span></div>
              <div className="evaluation-grid"><div><small>Why it ran</small><strong>{evaluation.summary}</strong></div><div><small>Required evidence</small><strong>{evaluation.rule.requiredFeatures.join(", ") || "None"}</strong></div><div><small>What it cannot prove</small><strong>{evaluation.rule.limitation}</strong></div></div>
              <div className="condition-list">{evaluation.conditionResults.map((condition, index) => <div key={`${condition.feature}-${index}`}><Status tone={condition.passed ? "good" : "warning"}>{condition.passed ? "Matched" : "Not met"}</Status><span>{condition.feature} {condition.operator} {condition.value ?? ""}</span><strong>Actual: {condition.actual}</strong></div>)}</div>
            </article>)}</div>
          </Card>
          <section className="analysis-grid">
            <Card><SectionHead eyebrow="Draft RCA" title="Evidence-linked, not invented" /><p className="draft-copy">{rcaDraft}</p><div className="draft-meta"><Status tone="warning">{outcome}</Status><span>Template is editable in Settings. This draft is not approved.</span></div></Card>
            <Card><SectionHead eyebrow="Draft CAPA" title="Action remains provisional" /><p className="draft-copy">{capaDraft}</p><div className="draft-meta"><Status tone="warning">Draft — review required</Status><span>Cause-specific CAPA is withheld when no rule supports a hypothesis.</span></div></Card>
          </section>
        </>}
      </>}
    </div>;
  };

  const renderHistory = () => <div className="page-stack">
    <header className="page-header"><div className="page-symbol"><ClipboardList size={22} /></div><div><span className="eyebrow">Pilot runs</span><h1>Analysis history</h1><p>Completed runs, exceptions, source versions, and future reports will live here. Source evidence is never overwritten.</p></div></header>
    <Card>{analysis ? <><SectionHead title="Current browser-session run" description="Server-side PilotRun persistence and immutable object storage are the next infrastructure slice." action={<Status tone={analysis.identityState === "READY_TO_ANALYZE" ? "good" : "danger"}>{stateLabel(analysis.identityState)}</Status>} /><div className="history-row"><div><FileSpreadsheet size={20} /><span><strong>{analysis.dlmsMeterId ?? "No DLMS identity"}</strong><small>{analysis.artifacts.length} artifact(s) · {analysis.dlmsFeatures.length} feature(s)</small></span></div><span>{analysisStarted ? "Rule evaluation recorded in this session" : "Awaiting analysis"}</span><button className="button secondary" onClick={() => setPage("analysis")}>Open run <ChevronRight size={15} /></button></div></> : <div className="empty-state"><ClipboardList size={28} /><strong>No analysis runs yet</strong><span>Upload a file package to create the first pilot run.</span><button className="button primary" onClick={() => setPage("analysis")}>Start analysis</button></div>}</Card>
  </div>;

  const renderRules = () => <div className="page-stack">
    <header className="page-header"><div className="page-symbol"><BookOpenCheck size={22} /></div><div><span className="eyebrow">Engineering-managed knowledge</span><h1>Rule library</h1><p>Rules are explainable, versioned engineering assets. A draft is visible for review but can never affect a result.</p></div><Status tone="ai">AI does not select rules in Phase 1</Status></header>
    <Card><SectionHead title="Rule coverage" description="The first bundle starts intentionally empty. Add and review rules with engineering before publishing them." /><div className="rule-summary"><div><strong>{rules.length}</strong><span>Total rule records</span></div><div><strong>{activeRules.length}</strong><span>Published active rules</span></div><div><strong>{rules.filter((rule) => rule.status === "draft").length}</strong><span>Drafts requiring review</span></div><div><strong>{productFamilyOptions().length}</strong><span>Supported product families</span></div></div></Card>
    <div className="rule-library">{rules.map((rule) => <Card key={rule.id} className="rule-card"><div className="rule-card-head"><div><Status tone={rule.status === "active" ? "good" : rule.status === "draft" ? "warning" : "neutral"}>{rule.status}</Status><h2>{rule.title}</h2><p>{rule.purpose}</p></div><span>{rule.id} · v{rule.version}</span></div><div className="rule-detail-grid"><div><small>Applies to</small><strong>{rule.productFamilies.join(", ")}</strong></div><div><small>Complaint scope</small><strong>{rule.complaintKeys.join(", ")}</strong></div><div><small>Hypothesis effect</small><strong>{rule.hypothesisLabel} +{rule.weight}</strong></div><div><small>Allowed outcome</small><strong>{rule.allowedOutcome}</strong></div><div><small>Next evidence</small><strong>{rule.requiredFollowUp}</strong></div><div><small>Governance</small><strong>{rule.owner} · reviewer: {rule.reviewer}</strong></div></div><div className="rule-explanation"><div><span>What it checks</span><p>{rule.conditions.map((condition) => `${condition.feature} ${condition.operator} ${condition.value ?? ""}`).join(" and ") || "No conditions configured"}</p></div><div><span>Why it matters</span><p>{rule.analystExplanation}</p></div><div><span>What it cannot prove</span><p>{rule.limitation}</p></div></div>{rule.status !== "active" && <button className="button secondary" onClick={() => activateRule(rule.id)}><ShieldCheck size={15} /> Publish after review</button>}</Card>)}</div>
    <Card><SectionHead eyebrow="Add rule draft" title="Create a reviewable diagnostic rule" description="This form produces configuration data. Production authoring will persist the same schema with validation, fixtures, review, and audit history." />
      <div className="form-grid rule-form">
        <label>Rule ID<input value={draftRule.id} onChange={(event) => setDraftRule({ ...draftRule, id: event.target.value })} /></label>
        <label>Version<input value={draftRule.version} onChange={(event) => setDraftRule({ ...draftRule, version: event.target.value })} /></label>
        <label className="wide">Rule title<input value={draftRule.title} onChange={(event) => setDraftRule({ ...draftRule, title: event.target.value })} /></label>
        <label className="wide">Engineering purpose<textarea value={draftRule.purpose} onChange={(event) => setDraftRule({ ...draftRule, purpose: event.target.value })} /></label>
        <label>Product family<select value={draftRule.productFamilies[0]} onChange={(event) => setDraftRule({ ...draftRule, productFamilies: [event.target.value as ProductFamily] })}>{productFamilyOptions().map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <label>Complaint scope<select value={draftRule.complaintKeys[0]} onChange={(event) => setDraftRule({ ...draftRule, complaintKeys: [event.target.value] })}>{complaintOptions(draftRule.productFamilies[0]).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <label>Required feature<input value={draftRule.requiredFeatures[0] ?? ""} onChange={(event) => setDraftRule({ ...draftRule, requiredFeatures: [event.target.value], conditions: [{ ...draftRule.conditions[0], feature: event.target.value }] })} /></label>
        <label>Operator<select value={draftRule.conditions[0]?.operator} onChange={(event) => setDraftRule({ ...draftRule, conditions: [{ ...draftRule.conditions[0], operator: event.target.value as RuleOperator }] })}>{(["exists", "equals", "gte", "lte"] as RuleOperator[]).map((operator) => <option key={operator}>{operator}</option>)}</select></label>
        <label>Expected value<input value={draftRule.conditions[0]?.value ?? ""} onChange={(event) => setDraftRule({ ...draftRule, conditions: [{ ...draftRule.conditions[0], value: event.target.value }] })} /></label>
        <label>Hypothesis code<input value={draftRule.hypothesisCode} onChange={(event) => setDraftRule({ ...draftRule, hypothesisCode: event.target.value })} /></label>
        <label>Hypothesis label<input value={draftRule.hypothesisLabel} onChange={(event) => setDraftRule({ ...draftRule, hypothesisLabel: event.target.value })} /></label>
        <label>Weight<input type="number" value={draftRule.weight} onChange={(event) => setDraftRule({ ...draftRule, weight: Number(event.target.value) })} /></label>
        <label>Owner<input value={draftRule.owner} onChange={(event) => setDraftRule({ ...draftRule, owner: event.target.value })} /></label>
        <label>Reviewer<input value={draftRule.reviewer} onChange={(event) => setDraftRule({ ...draftRule, reviewer: event.target.value })} /></label>
        <label>Required next evidence<input value={draftRule.requiredFollowUp} onChange={(event) => setDraftRule({ ...draftRule, requiredFollowUp: event.target.value })} /></label>
        <label>Allowed outcome<input value={draftRule.allowedOutcome} onChange={(event) => setDraftRule({ ...draftRule, allowedOutcome: event.target.value })} /></label>
        <label className="wide">Analyst explanation<textarea value={draftRule.analystExplanation} onChange={(event) => setDraftRule({ ...draftRule, analystExplanation: event.target.value })} /></label>
        <label className="wide">Report-safe explanation<textarea value={draftRule.reportSafeExplanation} onChange={(event) => setDraftRule({ ...draftRule, reportSafeExplanation: event.target.value })} /></label>
        <label className="wide">Limitation / stop policy<textarea value={draftRule.limitation} onChange={(event) => setDraftRule({ ...draftRule, limitation: event.target.value })} /></label>
      </div>
      <button className="button primary" onClick={addRule}><Plus size={16} /> Add draft rule</button>
    </Card>
  </div>;

  const renderSettings = () => <div className="page-stack">
    <header className="page-header"><div className="page-symbol"><Settings size={22} /></div><div><span className="eyebrow">Administrator configuration</span><h1>Settings</h1><p>Configuration is data, not UI code. Publishable configuration will be stored and audited server-side in the persistence slice.</p></div><button className="button secondary" onClick={downloadSettings}><Download size={15} /> Download draft</button></header>
    <Card><SectionHead eyebrow="Product-family mapping" title="Map incoming FFR values to Meter, NIC, or Gateway" description="Mappings are exact and deterministic. The app will stop safely when no unique mapping applies." />
      <div className="mapping-list">{settings.productMappings.map((mapping) => <div key={mapping.id}><span><strong>{mapping.sourceField}</strong><small>{mapping.basis}</small></span><strong>{mapping.sourceValue}</strong><Status tone="good">{mapping.productFamily}</Status><button aria-label={`Remove ${mapping.sourceValue} mapping`} onClick={() => setSettings((current) => ({ ...current, productMappings: current.productMappings.filter((item) => item.id !== mapping.id) }))}><X size={15} /></button></div>)}</div>
      <div className="inline-form"><select value={mappingField} onChange={(event) => setMappingField(event.target.value as "Meter type" | "Old_Meter_Type")}><option>Old_Meter_Type</option><option>Meter type</option></select><input value={mappingValue} onChange={(event) => setMappingValue(event.target.value)} placeholder="Exact FFR value, e.g. NIC type" /><select value={mappingFamily} onChange={(event) => setMappingFamily(event.target.value as ProductFamily)}>{productFamilyOptions().map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><button className="button secondary" onClick={addMapping}><Plus size={15} /> Add mapping</button></div>
    </Card>
    <section className="settings-grid">
      <Card><SectionHead eyebrow="AI configuration" title="Provider-ready settings" description="Credentials remain server-side; the browser receives no secret." />
        <div className="form-grid"><label>AI provider<input value={settings.ai.provider} onChange={(event) => setSettings({ ...settings, ai: { ...settings.ai, provider: event.target.value } })} /></label><label>Vision model<input value={settings.ai.visionModel} onChange={(event) => setSettings({ ...settings, ai: { ...settings.ai, visionModel: event.target.value } })} /></label><label>Reasoning model<input value={settings.ai.reasoningModel} onChange={(event) => setSettings({ ...settings, ai: { ...settings.ai, reasoningModel: event.target.value } })} /></label><label className="wide">Server credential reference<input value={settings.ai.credentialReference} onChange={(event) => setSettings({ ...settings, ai: { ...settings.ai, credentialReference: event.target.value } })} /><small>Use a vault secret name or connection ID; never enter the secret in the browser.</small></label><label className="toggle"><input type="checkbox" checked={settings.ai.visionEnabled} onChange={(event) => setSettings({ ...settings, ai: { ...settings.ai, visionEnabled: event.target.checked } })} /><span>Enable vision analysis when a configured provider is available</span></label></div>
      </Card>
      <Card><SectionHead eyebrow="Pilot operations" title="Retention, upload, and access policy" /><div className="form-grid"><label>Evidence retention (days)<input type="number" min="1" value={settings.retentionDays} onChange={(event) => setSettings({ ...settings, retentionDays: Number(event.target.value) })} /></label><label>Maximum upload size (MB)<input type="number" min="1" value={settings.uploadMaxMb} onChange={(event) => setSettings({ ...settings, uploadMaxMb: Number(event.target.value) })} /></label><label>Pilot access mode<input value={settings.pilotAccess.mode} onChange={(event) => setSettings({ ...settings, pilotAccess: { ...settings.pilotAccess, mode: event.target.value } })} /></label><label className="wide">Approved pilot roles (comma separated)<input value={settings.pilotAccess.approvedRoles.join(", ")} onChange={(event) => setSettings({ ...settings, pilotAccess: { ...settings.pilotAccess, approvedRoles: event.target.value.split(",").map((role) => role.trim()).filter(Boolean) } })} /></label></div><p className="helper-text">There is no file-cost setting. The configured upload limit is applied before reading a file; retention and access rules are enforced by the hosted persistence layer.</p></Card>
    </section>
    <Card><SectionHead eyebrow="Draft wording" title="Editable RCA and CAPA templates" description="No approved wording is currently provided. These neutral templates are clearly labelled as pilot drafts and are versioned with the run when publishing is added." /><div className="template-grid"><label>RCA template<textarea value={settings.rcaTemplate} onChange={(event) => setSettings({ ...settings, rcaTemplate: event.target.value })} /><small>{"Tokens: {{evidence_summary}}, {{outcome}}, {{supported_conclusion}}, {{evidence_gaps}}"}</small></label><label>CAPA template<textarea value={settings.capaTemplate} onChange={(event) => setSettings({ ...settings, capaTemplate: event.target.value })} /><small>{"Tokens: {{containment}}, {{correction}}, {{corrective_action}}, {{preventive_action}}, {{effectiveness_metric}}"}</small></label></div></Card>
    <Card><SectionHead eyebrow="Configuration governance" title="What remains guarded" /><div className="guard-grid"><div><ShieldCheck size={19} /><strong>Evidence is immutable</strong><span>Settings never rewrite uploaded source files or historic results.</span></div><div><Layers3 size={19} /><strong>Published versions are pinned</strong><span>Rule, mapping, and template versions are recorded on each future run.</span></div><div><Bot size={19} /><strong>AI is constrained</strong><span>Models can summarize and rank; they cannot select rules or approve conclusions.</span></div></div></Card>
  </div>;

  const content: Record<Page, ReactNode> = { analysis: renderAnalysis(), history: renderHistory(), rules: renderRules(), settings: renderSettings() };

  return <div className="app-shell">
    <aside className="sidebar"><div className="brand"><div className="brand-mark">K</div><div><strong>Kimbal</strong><span>FFR Intelligence</span></div></div><div className="pilot-chip"><Layers3 size={14} /> File-first pilot</div><nav aria-label="Primary navigation">{navigation.map((item) => { const Icon = item.icon; return <button className={page === item.id ? "active" : ""} key={item.id} onClick={() => setPage(item.id)}><Icon size={18} /><span><strong>{item.label}</strong><small>{item.description}</small></span></button>; })}</nav><div className="sidebar-note"><ShieldCheck size={16} /><span><strong>Evidence before inference</strong><small>Exact identity matching and configuration gates protect every case.</small></span></div></aside>
    <main className="main"><header className="topbar"><div><span>Private pilot workspace</span><strong>Configurable, evidence-linked diagnosis</strong></div><div className="topbar-status"><Status tone="good">Local prototype</Status><span>v1.0</span></div></header><div className="content">{notice && <div className="notice"><Info size={16} /><span>{notice}</span><button aria-label="Dismiss notification" onClick={() => setNotice("")}><X size={15} /></button></div>}{content[page]}</div></main>
  </div>;
}
