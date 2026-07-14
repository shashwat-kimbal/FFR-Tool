"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  Archive,
  ArrowRight,
  BarChart3,
  Bell,
  Bot,
  Box,
  BrainCircuit,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  ClipboardCheck,
  Clock3,
  Database,
  Download,
  Eye,
  Factory,
  FileCheck2,
  FileText,
  Filter,
  FlaskConical,
  Gauge,
  GitBranch,
  HardDrive,
  HelpCircle,
  History,
  ImageIcon,
  Layers3,
  LayoutDashboard,
  ListChecks,
  LockKeyhole,
  Menu,
  Microscope,
  Network,
  PackageCheck,
  Play,
  Plus,
  Power,
  Radio,
  RefreshCw,
  RotateCcw,
  ScanLine,
  Search,
  Server,
  Settings,
  Snowflake,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TestTube2,
  TrendingDown,
  TrendingUp,
  Truck,
  UserRoundCheck,
  Users,
  Workflow,
  Wrench,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";

type View =
  | "dashboard"
  | "cases"
  | "case"
  | "lab"
  | "batches"
  | "intelligence"
  | "capa"
  | "system";
type Persona = "Executive" | "FFR Engineer" | "Quality Reviewer" | "Store Operator";
type CaseTab = "overview" | "evidence" | "genealogy" | "lab" | "reasoning" | "rca" | "closure" | "audit";
type SystemTab = "integrations" | "knowledge" | "agents" | "governance";
type IntelligenceTab = "operations" | "quality" | "agent" | "customer";
type Tone = "teal" | "amber" | "red" | "indigo" | "navy" | "gray" | "green";

interface CaseRow {
  id: string;
  meter: string;
  complaint: string;
  model: string;
  utility: string;
  batch: string;
  stage: string;
  owner: string;
  sla: string;
  tone: Tone;
}

interface TourStep {
  eyebrow: string;
  title: string;
  description: string;
  view: View;
  tab?: CaseTab;
}

const navItems: { id: View; label: string; icon: LucideIcon; badge?: string }[] = [
  { id: "dashboard", label: "Command centre", icon: LayoutDashboard },
  { id: "cases", label: "Cases & intake", icon: ClipboardCheck, badge: "842" },
  { id: "lab", label: "Laboratory line", icon: FlaskConical },
  { id: "batches", label: "Batch intelligence", icon: Layers3, badge: "3" },
  { id: "intelligence", label: "Population insights", icon: BarChart3 },
  { id: "capa", label: "CAPA management", icon: FileCheck2, badge: "12" },
  { id: "system", label: "System & governance", icon: Settings },
];

const cases: CaseRow[] = [
  { id: "FFR-2026-04782", meter: "SP-24-084731", complaint: "Display blank", model: "KSP-100", utility: "Aravalli Power", batch: "PCB-24-06-117", stage: "Hypothesis review", owner: "A. Sharma", sla: "6h 24m", tone: "indigo" },
  { id: "FFR-2026-04781", meter: "SP-24-084706", complaint: "Communication unavailable", model: "KSP-100", utility: "Dharini DISCOM", batch: "PCB-24-06-117", stage: "Identity exception", owner: "S. Iyer", sla: "2h 05m", tone: "red" },
  { id: "FFR-2026-04779", meter: "TP-24-019332", complaint: "Relay does not disconnect", model: "KTP-300", utility: "Narmada Grid", batch: "PCB-24-05-088", stage: "Targeted testing", owner: "P. Das", sla: "11h 30m", tone: "amber" },
  { id: "FFR-2026-04773", meter: "SP-24-083991", complaint: "Date / time incorrect", model: "KSP-100", utility: "Aravalli Power", batch: "PCB-24-05-101", stage: "RCA drafted", owner: "R. Mehta", sla: "1d 02h", tone: "teal" },
  { id: "FFR-2026-04768", meter: "CT-24-003184", complaint: "Terminal heated", model: "KCT-500", utility: "Vindhya Energy", batch: "PCB-24-04-063", stage: "Do not energize", owner: "N. Singh", sla: "3h 42m", tone: "red" },
  { id: "FFR-2026-04761", meter: "SP-24-081227", complaint: "Data missing", model: "KSP-100", utility: "Dharini DISCOM", batch: "PCB-24-03-041", stage: "HES evidence partial", owner: "M. Rao", sla: "1d 08h", tone: "amber" },
  { id: "FFR-2026-04758", meter: "SP-24-080994", complaint: "Repeated restart", model: "KSP-100", utility: "Aravalli Power", batch: "PCB-24-03-041", stage: "Component diagnosis", owner: "A. Sharma", sla: "18h 10m", tone: "indigo" },
  { id: "FFR-2026-04744", meter: "LT-24-000882", complaint: "Suspected accuracy", model: "KLT-700", utility: "Narmada Grid", batch: "PCB-24-02-019", stage: "No fault reproduced", owner: "P. Das", sla: "2d 03h", tone: "gray" },
  { id: "FFR-2026-04731", meter: "SP-24-078311", complaint: "Moisture seen", model: "KSP-100", utility: "Coastal Power", batch: "PCB-24-01-007", stage: "Inconclusive", owner: "R. Mehta", sla: "2d 14h", tone: "amber" },
];

const tourSteps: TourStep[] = [
  { eyebrow: "01 · Command centre", title: "See the operating system at a glance", description: "Start with volume, turnaround time, queues, systemic signals and the full closed-loop workflow.", view: "dashboard" },
  { eyebrow: "02 · Intake", title: "Create a traceable digital work order", description: "Capture factual complaints, chain of custody and identity without asking external parties to diagnose the cause.", view: "cases" },
  { eyebrow: "03 · Preserve evidence", title: "Identity and evidence before intervention", description: "Reconcile every identity source and prevent power, teardown or destruction until preservation gates are complete.", view: "case", tab: "evidence" },
  { eyebrow: "04 · Diagnose", title: "Let evidence steer the next test", description: "Maintain competing hypotheses, expose contradictions and choose the highest-information approved test.", view: "case", tab: "reasoning" },
  { eyebrow: "05 · Synthesize", title: "Turn observations into defensible causality", description: "Build a structured RCA with separate facts, inferences, confidence, origin, escape point and liability review.", view: "case", tab: "rca" },
  { eyebrow: "06 · Close the loop", title: "Separate technical, commercial and CAPA closure", description: "Approve reports, track replacement and verify the corrective action over a defined population and period.", view: "case", tab: "closure" },
  { eyebrow: "07 · Detect patterns", title: "Move from one meter to the affected population", description: "Cluster related returns, select representative units and connect a shared RCA and CAPA.", view: "batches" },
  { eyebrow: "08 · Learn", title: "Measure whether the system is getting better", description: "Monitor recurrence, automation quality, customer outcomes and agent performance—not the number of AI features.", view: "intelligence" },
];

const workflowSteps = [
  ["Observe", "Field complaint", Radio],
  ["Identify", "SAP · MES · WMS", ScanLine],
  ["Preserve", "Images · HES · DLMS", Archive],
  ["Triage", "Safe core tests", ShieldCheck],
  ["Diagnose", "Hypotheses · next test", BrainCircuit],
  ["Conclude", "Structured RCA", FileCheck2],
  ["Correct", "CAPA · replacement", Wrench],
  ["Learn", "Population signal", TrendingUp],
] as const;

const stations = [
  { n: "01", name: "Receipt & identity", wip: 38, queue: "18m", cycle: "4.2m", state: "Healthy", tone: "teal" as Tone },
  { n: "02", name: "External vision", wip: 31, queue: "22m", cycle: "5.1m", state: "Healthy", tone: "teal" as Tone },
  { n: "03", name: "Unpowered screen", wip: 24, queue: "14m", cycle: "3.8m", state: "Healthy", tone: "teal" as Tone },
  { n: "04", name: "Battery domain", wip: 19, queue: "11m", cycle: "4.6m", state: "Healthy", tone: "teal" as Tone },
  { n: "05", name: "Mains & optical", wip: 47, queue: "43m", cycle: "10.4m", state: "Queue risk", tone: "amber" as Tone },
  { n: "06", name: "Core functional", wip: 42, queue: "39m", cycle: "9.8m", state: "Queue risk", tone: "amber" as Tone },
  { n: "07", name: "Comms & relay", wip: 16, queue: "16m", cycle: "8.2m", state: "Healthy", tone: "teal" as Tone },
  { n: "08", name: "Teardown & vision", wip: 13, queue: "26m", cycle: "14.5m", state: "Healthy", tone: "teal" as Tone },
  { n: "09", name: "Component diagnosis", wip: 21, queue: "1h 18m", cycle: "31m", state: "Bottleneck", tone: "red" as Tone },
  { n: "10", name: "Deep-analysis lab", wip: 5, queue: "2h 06m", cycle: "74m", state: "Specialist", tone: "indigo" as Tone },
  { n: "11", name: "Review & validation", wip: 27, queue: "35m", cycle: "12m", state: "Healthy", tone: "teal" as Tone },
  { n: "12", name: "Retention & destruction", wip: 9, queue: "20m", cycle: "6.4m", state: "Healthy", tone: "teal" as Tone },
];

const integrations = [
  { name: "SAP", icon: Database, status: "Connected", detail: "Returns, GRN, RO & replacement", synced: "42 sec ago", coverage: "100%", tone: "teal" as Tone },
  { name: "MES", icon: Factory, status: "Connected", detail: "Genealogy & original tests", synced: "1 min ago", coverage: "99.8%", tone: "teal" as Tone },
  { name: "WMS", icon: HardDrive, status: "Connected", detail: "Receipt, batch & disposition", synced: "2 min ago", coverage: "100%", tone: "teal" as Tone },
  { name: "HES", icon: Network, status: "Partial", detail: "2 external evidence requests pending", synced: "8 min ago", coverage: "83.4%", tone: "amber" as Tone },
  { name: "Optical / DLMS", icon: Radio, status: "8 / 8 online", detail: "Read-only extraction stations", synced: "Live", coverage: "92.1%", tone: "teal" as Tone },
];

const agents = [
  ["Intake agent", "Validates complaint, GRN and initial route", "Create case · read SAP/WMS"],
  ["Identity & genealogy", "Reconciles identities and freezes MES snapshot", "Read SAP/MES/WMS"],
  ["HES evidence", "Aligns timestamps and missing intervals", "Read/request HES"],
  ["Visual inspection", "Codes observations and regions of interest", "Request image"],
  ["Test orchestration", "Chooses approved tests and reserves stations", "Run approved recipe"],
  ["Diagnostic reasoning", "Ranks hypotheses and selects next-best test", "Query evidence/history"],
  ["Component diagnosis", "Guides probes against expected values", "Request measurement"],
  ["RCA synthesis", "Builds causal record and two report views", "Create draft"],
  ["CAPA agent", "Proposes actions, owners and effectiveness", "Create draft task"],
  ["Batch intelligence", "Clusters returns and estimates population", "Query historical cases"],
  ["Validation & governance", "Prevents unsupported release", "Create approval task"],
];

function StatusPill({ tone = "gray", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`status-pill tone-${tone}`}><span className="status-dot" />{children}</span>;
}

function MetricCard({ label, value, meta, trend, icon: Icon, tone = "navy" }: { label: string; value: string; meta: string; trend?: "up" | "down"; icon: LucideIcon; tone?: Tone }) {
  return (
    <article className="metric-card">
      <div className={`metric-icon tone-${tone}`}><Icon size={17} /></div>
      <div className="metric-copy"><span>{label}</span><strong>{value}</strong><small className={trend ? `trend-${trend}` : ""}>{trend === "up" ? <TrendingUp size={13} /> : trend === "down" ? <TrendingDown size={13} /> : null}{meta}</small></div>
    </article>
  );
}

function SectionTitle({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="section-title">
      <div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h2>{title}</h2>{description && <p>{description}</p>}</div>
      {action && <div className="section-actions">{action}</div>}
    </div>
  );
}

function ProgressBar({ value, tone = "teal" }: { value: number; tone?: Tone }) {
  return <div className="progress-track" aria-label={`${value}%`}><div className={`progress-fill tone-${tone}`} style={{ width: `${value}%` }} /></div>;
}

function Initials({ name }: { name: string }) {
  return <span className="avatar">{name.split(" ").map((part) => part[0]).join("").slice(0, 2)}</span>;
}

export default function Home() {
  const [activeView, setActiveView] = useState<View>("dashboard");
  const [caseTab, setCaseTab] = useState<CaseTab>("overview");
  const [systemTab, setSystemTab] = useState<SystemTab>("integrations");
  const [intelTab, setIntelTab] = useState<IntelligenceTab>("operations");
  const [persona, setPersona] = useState<Persona>("FFR Engineer");
  const [search, setSearch] = useState("");
  const [caseFilter, setCaseFilter] = useState("All cases");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [featureMapOpen, setFeatureMapOpen] = useState(false);
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [intakeStep, setIntakeStep] = useState(0);
  const [tourOpen, setTourOpen] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [testRunning, setTestRunning] = useState(false);
  const [testRun, setTestRun] = useState(false);
  const [teardownAuthorized, setTeardownAuthorized] = useState(false);
  const [rcaApproved, setRcaApproved] = useState(false);
  const [reportReleased, setReportReleased] = useState(false);
  const [capaAccepted, setCapaAccepted] = useState(false);
  const [toast, setToast] = useState("");

  const canRunTest = persona === "FFR Engineer";
  const canApprove = persona === "Quality Reviewer";
  const canIntake = persona === "Store Operator" || persona === "FFR Engineer";

  useEffect(() => {
    const savedPersona = window.localStorage.getItem("ffr-persona") as Persona | null;
    const savedTour = Number(window.localStorage.getItem("ffr-tour-step") || "0");
    const savedState = window.localStorage.getItem("ffr-demo-state");
    if (savedPersona) setPersona(savedPersona);
    if (!Number.isNaN(savedTour)) setTourStep(Math.min(savedTour, tourSteps.length - 1));
    if (savedState) {
      try {
        const state = JSON.parse(savedState) as { testRun?: boolean; teardownAuthorized?: boolean; rcaApproved?: boolean; reportReleased?: boolean; capaAccepted?: boolean };
        setTestRun(Boolean(state.testRun));
        setTeardownAuthorized(Boolean(state.teardownAuthorized));
        setRcaApproved(Boolean(state.rcaApproved));
        setReportReleased(Boolean(state.reportReleased));
        setCapaAccepted(Boolean(state.capaAccepted));
      } catch { /* canonical state remains */ }
    }
    const hash = window.location.hash.replace("#", "") as View;
    if (navItems.some((item) => item.id === hash) || hash === "case") setActiveView(hash);
  }, []);

  useEffect(() => { window.localStorage.setItem("ffr-persona", persona); }, [persona]);
  useEffect(() => { window.localStorage.setItem("ffr-tour-step", String(tourStep)); }, [tourStep]);
  useEffect(() => {
    window.localStorage.setItem("ffr-demo-state", JSON.stringify({ testRun, teardownAuthorized, rcaApproved, reportReleased, capaAccepted }));
  }, [testRun, teardownAuthorized, rcaApproved, reportReleased, capaAccepted]);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3200);
  };

  const navigate = (view: View, tab?: CaseTab) => {
    setActiveView(view);
    if (tab) setCaseTab(tab);
    setMobileNavOpen(false);
    window.location.hash = view;
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const startTour = () => {
    setTourStep(0);
    setTourOpen(true);
    navigate(tourSteps[0].view, tourSteps[0].tab);
  };

  const changeTour = (next: number) => {
    const bounded = Math.max(0, Math.min(next, tourSteps.length - 1));
    setTourStep(bounded);
    navigate(tourSteps[bounded].view, tourSteps[bounded].tab);
  };

  const resetDemo = () => {
    setTestRun(false);
    setTeardownAuthorized(false);
    setRcaApproved(false);
    setReportReleased(false);
    setCapaAccepted(false);
    setTourStep(0);
    setCaseTab("overview");
    window.localStorage.removeItem("ffr-demo-state");
    showToast("Demo reset to the canonical starting state");
    navigate("dashboard");
  };

  const runRecommendedTest = () => {
    if (!canRunTest) return showToast("Switch to FFR Engineer to execute an approved test");
    setTestRunning(true);
    window.setTimeout(() => {
      setTestRunning(false);
      setTestRun(true);
      showToast("Measurement captured · hypothesis scores updated");
    }, 900);
  };

  const approveRca = () => {
    if (!canApprove) return showToast("Switch to Quality Reviewer to approve the technical RCA");
    if (!testRun) return showToast("The recommended measurement must be completed first");
    setRcaApproved(true);
    showToast("Technical RCA approved · customer report unlocked");
  };

  const releaseCustomerReport = () => {
    if (!canApprove) return showToast("Customer release requires the Quality Reviewer persona");
    if (!rcaApproved) return showToast("Technical approval is required before customer release");
    setReportReleased(true);
    showToast("Customer-safe report released and audit event recorded");
  };

  const authorizeTeardown = () => {
    if (!canRunTest) return showToast("Switch to FFR Engineer to authorize laboratory teardown");
    setTeardownAuthorized(true);
    showToast("Teardown authorized · all preservation prerequisites were satisfied");
  };

  const acceptCapa = () => {
    if (!canApprove) return showToast("Switch to Quality Reviewer to accept the CAPA plan");
    if (!rcaApproved) return showToast("Approve the technical RCA before accepting CAPA");
    setCapaAccepted(true);
    showToast("CAPA accepted · effectiveness monitoring scheduled");
  };

  const reportRows: [string, string][] = [
    ["Customer observation", "Meter display blank after field removal"],
    ["Laboratory reproduction", "Display blank on battery and controlled mains"],
    ["Failed function", "Low-voltage control electronics"],
    ["Failed subsystem", "Power supply"],
    ["Failed component / node", testRun ? "3.3 V regulator stage" : "Pending next-best test"],
    ["Physical mechanism", testRun ? "Internal regulator failure" : "Under investigation"],
    ["Initiating cause", "Not conclusively established"],
    ["Contributing factor", "PCB-batch concentration under investigation"],
    ["Origin", "Probable component / latent manufacturing cause"],
    ["Escape point", "Latent failure not exposed by end-of-line functional test"],
    ["Confidence", testRun ? "Highly probable" : "Probable"],
    ["Liability recommendation", "Manufacturer responsibility pending batch investigation"],
  ];

  const exportPdf = async (customer = false) => {
    if (customer && !rcaApproved) return showToast("Approve the RCA before exporting the customer report");
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    doc.setFillColor(11, 22, 35);
    doc.rect(0, 0, 595, 86, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.text(customer ? "Customer Technical Findings" : "Internal Field Failure RCA", 42, 42);
    doc.setFontSize(10);
    doc.text("Kimbal FFR Intelligence · FFR-2026-04782 · DEMO DATA", 42, 62);
    doc.setTextColor(28, 42, 55);
    let y = 118;
    const rows = customer ? reportRows.filter(([key]) => !["Failed component / node", "Initiating cause", "Liability recommendation"].includes(key)) : reportRows;
    for (const [label, value] of rows) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text(label.toUpperCase(), 42, y);
      y += 14;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      const lines = doc.splitTextToSize(value, 500) as string[];
      doc.text(lines, 42, y);
      y += lines.length * 14 + 16;
    }
    doc.setFontSize(8);
    doc.setTextColor(90, 105, 118);
    doc.text("Synthetic prototype record. Not a production RCA or billing determination.", 42, 806);
    doc.save(`${customer ? "customer-findings" : "internal-rca"}-FFR-2026-04782.pdf`);
    showToast("PDF generated from the approved structured record");
  };

  const exportDocx = async (customer = false) => {
    if (customer && !rcaApproved) return showToast("Approve the RCA before exporting the customer report");
    const { Document, Packer, Paragraph, HeadingLevel, TextRun } = await import("docx");
    const rows = customer ? reportRows.filter(([key]) => !["Failed component / node", "Initiating cause", "Liability recommendation"].includes(key)) : reportRows;
    const doc = new Document({ sections: [{ children: [
      new Paragraph({ text: customer ? "Customer Technical Findings" : "Internal Field Failure RCA", heading: HeadingLevel.TITLE }),
      new Paragraph({ children: [new TextRun({ text: "Kimbal FFR Intelligence · FFR-2026-04782 · DEMO DATA", bold: true, color: "167C80" })] }),
      ...rows.flatMap(([label, value]) => [new Paragraph({ text: label, heading: HeadingLevel.HEADING_2 }), new Paragraph({ text: value })]),
      new Paragraph({ children: [new TextRun({ text: "Synthetic prototype record. Not a production RCA or billing determination.", italics: true, color: "667785" })] }),
    ] }] });
    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${customer ? "customer-findings" : "internal-rca"}-FFR-2026-04782.docx`;
    anchor.click();
    URL.revokeObjectURL(url);
    showToast("DOCX generated from the structured record");
  };

  const filteredCases = useMemo(() => cases.filter((item) => {
    const matchesSearch = `${item.id} ${item.meter} ${item.complaint} ${item.utility} ${item.batch}`.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = caseFilter === "All cases" || (caseFilter === "Exceptions" ? item.tone === "red" || item.stage.includes("partial") : caseFilter === "SLA risk" ? item.tone === "red" || item.tone === "amber" : item.stage.includes("RCA") || item.stage.includes("review"));
    return matchesSearch && matchesFilter;
  }), [search, caseFilter]);

  const renderDashboard = () => (
    <div className="view-stack">
      <section className="command-hero">
        <div className="hero-copy">
          <span className="hero-kicker"><Sparkles size={15} /> Agentic field-quality operating system</span>
          <h1>Field failures into<br /><em>defensible root cause.</em></h1>
          <p>Preserve evidence, route the fastest safe diagnosis and turn every returned smart meter into population-level learning.</p>
          <div className="hero-actions">
            <button className="button primary" onClick={startTour}><Play size={16} /> Start guided case</button>
            <button className="button secondary" onClick={() => navigate("cases")}><ClipboardCheck size={16} /> Explore cases</button>
          </div>
        </div>
        <div className="signal-panel">
          <div className="signal-head"><span><AlertTriangle size={16} /> Systemic signal</span><StatusPill tone="red">High priority</StatusPill></div>
          <div className="signal-main"><small>PCB BATCH</small><strong>PCB-24-06-117</strong><p>4 related low-voltage rail failures detected across 3 projects.</p></div>
          <div className="signal-stats"><div><span>1,248</span><small>potentially affected</small></div><div><span>3.6×</span><small>above baseline</small></div><div><span>91%</span><small>cluster confidence</small></div></div>
          <button className="text-button" onClick={() => navigate("batches")}>Review affected population <ArrowRight size={14} /></button>
        </div>
      </section>

      <section className="metric-grid">
        <MetricCard label="Received today" value="327" meta="27 above plan" trend="up" icon={PackageCheck} tone="navy" />
        <MetricCard label="Completed today" value="301" meta="92% of inflow" icon={CheckCircle2} tone="teal" />
        <MetricCard label="Work in progress" value="842" meta="−6.4% this week" trend="down" icon={Activity} tone="indigo" />
        <MetricCard label="Median RCA TAT" value="2.8d" meta="0.6d faster" trend="down" icon={Clock3} tone="teal" />
        <MetricCard label="95th percentile" value="6.4d" meta="Target ≤ 7d" icon={Gauge} tone="navy" />
        <MetricCard label="SLA at risk" value="37" meta="12 need action" icon={ShieldAlert} tone="amber" />
        <MetricCard label="Analyst throughput" value="24.6" meta="meters / day" trend="up" icon={Users} tone="teal" />
        <MetricCard label="Evidence automated" value="71%" meta="+8 pts this month" trend="up" icon={Bot} tone="indigo" />
      </section>

      <section className="card workflow-card">
        <SectionTitle eyebrow="Closed-loop workflow" title="One evidence-preserving diagnostic graph" description="Mandatory core stages for every meter; agent-selected branches only where they add diagnostic value." action={<button className="button ghost small" onClick={() => setFeatureMapOpen(true)}>View feature map</button>} />
        <div className="workflow-map">
          {workflowSteps.map(([title, subtitle, Icon], index) => <div className="workflow-node" key={title}><div className={`workflow-icon ${index === 4 ? "active" : ""}`}><Icon size={18} /></div><div><strong>{title}</strong><span>{subtitle}</span></div>{index < workflowSteps.length - 1 && <ChevronRight className="workflow-arrow" size={16} />}</div>)}
        </div>
        <div className="principle-strip"><ShieldCheck size={17} /><strong>Evidence before intervention</strong><span>Preserve → identify → observe → read → energize → test → open → probe → remove components</span></div>
      </section>

      <section className="two-column dashboard-lower">
        <article className="card">
          <SectionTitle eyebrow="Flow health" title="WIP by critical station" action={<button className="text-button" onClick={() => navigate("lab")}>Open lab line <ArrowRight size={14} /></button>} />
          <div className="station-list compact">
            {stations.slice(4, 10).map((station) => <button key={station.n} className="station-row" onClick={() => navigate("lab")}><span className="station-number">{station.n}</span><span className="station-row-name"><strong>{station.name}</strong><small>{station.queue} queue · {station.cycle} cycle</small></span><span className="station-wip">{station.wip}</span><StatusPill tone={station.tone}>{station.state}</StatusPill></button>)}
          </div>
        </article>
        <article className="card">
          <SectionTitle eyebrow="Integration orchestration" title="Evidence readiness" action={<button className="text-button" onClick={() => { navigate("system"); setSystemTab("integrations"); }}>View all systems <ArrowRight size={14} /></button>} />
          <div className="integration-list">
            {integrations.map(({ name, icon: Icon, status, coverage, tone }) => <div className="integration-row" key={name}><span className="integration-icon"><Icon size={17} /></span><div><strong>{name}</strong><small>{status}</small></div><div className="coverage"><span>{coverage}</span><ProgressBar value={Number.parseFloat(coverage)} tone={tone} /></div></div>)}
          </div>
          <div className="micro-callout amber"><AlertTriangle size={16} /><div><strong>12 cases waiting on third-party HES evidence</strong><span>Median external response time is 9h 18m.</span></div></div>
        </article>
      </section>

      <section className="card">
        <SectionTitle eyebrow="Priority queue" title="Cases needing attention" action={<button className="button ghost small" onClick={() => navigate("cases")}>View all 842 cases</button>} />
        {renderCaseTable(cases.slice(0, 5))}
      </section>
    </div>
  );

  const renderCaseTable = (rows: CaseRow[]) => (
    <div className="table-wrap"><table className="data-table"><thead><tr><th>Case / meter</th><th>Observation</th><th>Utility / batch</th><th>Current stage</th><th>Owner</th><th>SLA age</th><th /></tr></thead><tbody>{rows.map((item) => <tr key={item.id} onClick={() => navigate("case")} tabIndex={0} onKeyDown={(event) => event.key === "Enter" && navigate("case")}><td><strong className="case-link">{item.id}</strong><span>{item.meter} · {item.model}</span></td><td><strong>{item.complaint}</strong><span>Post-install</span></td><td><strong>{item.utility}</strong><span>{item.batch}</span></td><td><StatusPill tone={item.tone}>{item.stage}</StatusPill></td><td><span className="owner"><Initials name={item.owner} />{item.owner}</span></td><td><strong>{item.sla}</strong><span>{item.tone === "red" ? "Action now" : "Within SLA"}</span></td><td><ChevronRight size={16} /></td></tr>)}</tbody></table></div>
  );

  const renderCases = () => (
    <div className="view-stack">
      <SectionTitle eyebrow="Case management" title="Returned-meter work queue" description="Every unit remains individually traceable—even when it shares a batch-level root cause." action={<><button className="button secondary" onClick={() => showToast("Queue export prepared with current filters")}><Download size={16} /> Export</button><button className="button primary" onClick={() => canIntake ? setIntakeOpen(true) : showToast("Switch to Store Operator or FFR Engineer to create a case")}><Plus size={16} /> New return intake</button></>} />
      <section className="mini-metric-row">
        <div><span>Ready for physical RCA</span><strong>526</strong><StatusPill tone="teal">62.5%</StatusPill></div>
        <div><span>Evidence exception</span><strong>141</strong><StatusPill tone="amber">16.7%</StatusPill></div>
        <div><span>Identity exception</span><strong>23</strong><StatusPill tone="red">2.7%</StatusPill></div>
        <div><span>Commercial exception</span><strong>19</strong><StatusPill tone="amber">2.3%</StatusPill></div>
        <div><span>In diagnosis / review</span><strong>133</strong><StatusPill tone="indigo">15.8%</StatusPill></div>
      </section>
      <section className="card queue-card">
        <div className="queue-toolbar">
          <div className="segmented">{["All cases", "SLA risk", "Exceptions", "In review"].map((filter) => <button className={caseFilter === filter ? "active" : ""} onClick={() => setCaseFilter(filter)} key={filter}>{filter}</button>)}</div>
          <div className="toolbar-actions"><button className="button ghost small"><Filter size={15} /> 4 filters</button><button className="button ghost small"><ChevronDown size={15} /> Sort: SLA age</button></div>
        </div>
        {filteredCases.length ? renderCaseTable(filteredCases) : <div className="empty-state"><Search size={26} /><strong>No cases match those filters</strong><span>Clear the search or choose another queue view.</span><button className="text-button" onClick={() => { setSearch(""); setCaseFilter("All cases"); }}>Clear filters</button></div>}
        <div className="table-footer"><span>Showing {filteredCases.length} of 842 cases</span><div><button aria-label="Previous page"><ChevronLeft size={15} /></button><span>1 / 94</span><button aria-label="Next page"><ChevronRight size={15} /></button></div></div>
      </section>
      <section className="card exception-explainer">
        <div className="exception-icon"><ShieldAlert size={22} /></div><div><strong>Incomplete field evidence does not reject a returned meter.</strong><p>The platform records what is missing, initiates a request and adjusts diagnostic confidence while the physical case continues through the safe core workflow.</p></div><button className="text-button" onClick={() => { setFeatureMapOpen(true); }}>See exception handling <ArrowRight size={14} /></button>
      </section>
    </div>
  );

  const caseTabs: { id: CaseTab; label: string }[] = [
    { id: "overview", label: "Overview" }, { id: "evidence", label: "Evidence" }, { id: "genealogy", label: "Genealogy" }, { id: "lab", label: "Lab workflow" }, { id: "reasoning", label: "Agent reasoning" }, { id: "rca", label: "RCA & reports" }, { id: "closure", label: "CAPA & closure" }, { id: "audit", label: "Audit trail" },
  ];

  const renderCase = () => (
    <div className="view-stack">
      <section className="case-header">
        <button className="back-link" onClick={() => navigate("cases")}><ChevronLeft size={16} /> All cases</button>
        <div className="case-title-row"><div><div className="case-id-line"><span className="eyebrow">Golden demo case</span><StatusPill tone={testRun ? "teal" : "indigo"}>{testRun ? "RCA ready for review" : "Hypothesis review"}</StatusPill></div><h1>FFR-2026-04782</h1><p>SP-24-084731 · KSP-100 single-phase · Display blank</p></div><div className="case-actions"><button className="button secondary" onClick={() => showToast("Case link copied to clipboard")}><GitBranch size={16} /> Share case</button><button className="button primary" onClick={() => { setTourOpen(true); setTourStep(2); }}>Walk through case <Play size={15} /></button></div></div>
        <div className="case-meta-strip"><div><span>Utility</span><strong>Aravalli Power</strong></div><div><span>PCB batch</span><strong>PCB-24-06-117</strong></div><div><span>GRN</span><strong>GRN-260708-318</strong></div><div><span>SAP return</span><strong>RTN-74002918</strong></div><div><span>Current owner</span><strong>A. Sharma</strong></div><div><span>SLA age</span><strong>6h 24m</strong></div></div>
      </section>
      <nav className="case-tabs" aria-label="Case sections">{caseTabs.map((tab) => <button key={tab.id} className={caseTab === tab.id ? "active" : ""} onClick={() => setCaseTab(tab.id)}>{tab.label}{tab.id === "reasoning" && <span className="tab-spark"><Sparkles size={11} /></span>}</button>)}</nav>
      {caseTab === "overview" && renderCaseOverview()}
      {caseTab === "evidence" && renderEvidence()}
      {caseTab === "genealogy" && renderGenealogy()}
      {caseTab === "lab" && renderCaseLab()}
      {caseTab === "reasoning" && renderReasoning()}
      {caseTab === "rca" && renderRca()}
      {caseTab === "closure" && renderClosure()}
      {caseTab === "audit" && renderAudit()}
    </div>
  );

  const renderCaseOverview = () => (
    <div className="view-stack">
      <section className="closure-grid">
        <article className="closure-card"><div className="closure-icon teal"><Microscope size={18} /></div><div><span>Technical RCA</span><strong>{rcaApproved ? "Closed" : testRun ? "Review pending" : "In diagnosis"}</strong><small>{rcaApproved ? "Approved by Quality" : "Next: regulator measurement"}</small></div><StatusPill tone={rcaApproved ? "green" : "indigo"}>{rcaApproved ? "Complete" : "Active"}</StatusPill></article>
        <article className="closure-card"><div className="closure-icon amber"><Truck size={18} /></div><div><span>Commercial replacement</span><strong>{reportReleased ? "Receipt pending" : "RO in progress"}</strong><small>RO 4500098712</small></div><StatusPill tone="amber">Open</StatusPill></article>
        <article className="closure-card"><div className="closure-icon indigo"><FileCheck2 size={18} /></div><div><span>CAPA effectiveness</span><strong>{capaAccepted ? "Monitoring" : "Drafted"}</strong><small>{capaAccepted ? "90-day window" : "Owner approval required"}</small></div><StatusPill tone={capaAccepted ? "indigo" : "gray"}>{capaAccepted ? "Active" : "Draft"}</StatusPill></article>
      </section>
      <section className="two-column wide-left">
        <article className="card">
          <SectionTitle eyebrow="Digital work order" title="Case context" />
          <div className="detail-grid"><div><span>Original observation</span><strong>“Meter display remained blank after supply restoration.”</strong></div><div><span>Install state</span><strong>Post-install · 18 months in field</strong></div><div><span>Reported</span><strong>08 Jul 2026 · 10:42 IST</strong></div><div><span>Removed</span><strong>09 Jul 2026 · 16:18 IST</strong></div><div><span>Site</span><strong>Jaipur North · Feeder JN-18</strong></div><div><span>Chain of custody</span><strong>4 verified handovers</strong></div></div>
          <div className="observation-callout"><Eye size={18} /><div><span>Observation—not cause</span><strong>Display blank on battery and mains</strong><p>No external damage, burn, moisture or seal anomaly observed.</p></div></div>
          <SectionTitle eyebrow="Case timeline" title="From return to current decision" />
          <div className="timeline horizontal"><div className="done"><span><Check size={13} /></span><strong>Case created</strong><small>10:16</small></div><div className="done"><span><Check size={13} /></span><strong>Identity verified</strong><small>10:24</small></div><div className="done"><span><Check size={13} /></span><strong>Evidence preserved</strong><small>10:49</small></div><div className="done"><span><Check size={13} /></span><strong>Core tests</strong><small>11:32</small></div><div className="active"><span><BrainCircuit size={13} /></span><strong>{testRun ? "RCA drafted" : "Hypothesis review"}</strong><small>{testRun ? "Now" : "11:41"}</small></div><div><span>6</span><strong>Approval</strong><small>Pending</small></div></div>
        </article>
        <aside className="view-stack">
          <article className="card readiness-card"><SectionTitle eyebrow="Evidence readiness" title="12 of 12 complete" /><div className="readiness-ring"><div><strong>100%</strong><span>ready</span></div></div><div className="check-list"><span><CheckCircle2 size={15} />Identity sources reconciled</span><span><CheckCircle2 size={15} />External images complete</span><span><CheckCircle2 size={15} />Read-only DLMS dump stored</span><span><CheckCircle2 size={15} />HES window aligned</span><span><CheckCircle2 size={15} />Core suite complete</span></div><button className="text-button" onClick={() => setCaseTab("evidence")}>Inspect evidence gates <ArrowRight size={14} /></button></article>
          <article className="card next-action-card"><div className="agent-badge"><BrainCircuit size={17} /> Diagnostic reasoning agent</div><span>Recommended next action</span><h3>{testRun ? "Review structured RCA draft" : "Measure regulator input / output"}</h3><p>{testRun ? "Evidence supports the regulator stage with highly probable confidence." : "Highest expected information gain; 4 minutes; no additional evidence risk."}</p><button className="button primary full" onClick={() => setCaseTab(testRun ? "rca" : "reasoning")}>{testRun ? "Open RCA draft" : "Review recommendation"}<ArrowRight size={15} /></button></article>
        </aside>
      </section>
    </div>
  );

  const renderEvidence = () => (
    <div className="view-stack">
      <section className="two-column wide-left">
        <article className="card"><SectionTitle eyebrow="Synthetic evidence" title="Evidence-preserving image set" description="Illustrative demo imagery—never presented as a real returned meter." action={<StatusPill tone="indigo">4 / 4 views complete</StatusPill>} />
          <div className="evidence-grid">
            {[["/evidence/meter-exterior.png", "Front & enclosure", "No visible impact, moisture or discoloration"], ["/evidence/terminal-closeup.png", "Terminal block & seals", "Seals intact · no heat or arc marks"], ["/evidence/meter-opened.png", "Internal assembly", "Captured before touch after authorization"], ["/evidence/pcb-power-supply.png", "Power-supply region", "Region of interest · synthetic baseline"]].map(([src, title, note]) => <figure className="evidence-tile" key={src}><div className="image-wrap"><img src={src} alt={`Synthetic evidence: ${title}`} loading="lazy" /><span className="synthetic-label"><ImageIcon size={12} /> Synthetic evidence</span></div><figcaption><strong>{title}</strong><span>{note}</span></figcaption></figure>)}
          </div>
        </article>
        <aside className="card"><SectionTitle eyebrow="Preservation gate" title="Before intervention" /><div className="gate-list">{[["Case and identity verified", true], ["External photographs complete", true], ["Unpowered safety screen", true], ["Battery-domain test complete", true], ["Read-only DLMS dump stored", true], ["Core functional suite complete", true], ["Teardown authorized", teardownAuthorized]].map(([label, done]) => <div className={done ? "gate-done" : "gate-pending"} key={String(label)}>{done ? <CheckCircle2 size={17} /> : <LockKeyhole size={17} />}<span>{label}</span><small>{done ? "Complete" : "Awaiting operator action"}</small></div>)}</div><button className="button primary full" disabled={teardownAuthorized} onClick={authorizeTeardown}>{teardownAuthorized ? <CheckCircle2 size={16} /> : <ShieldCheck size={16} />}{teardownAuthorized ? "Teardown authorized" : "Authorize controlled teardown"}</button><p className="permission-note">Action recorded against the active FFR Engineer persona.</p></aside>
      </section>
      <section className="card"><SectionTitle eyebrow="Identity reconciliation" title="Every available source agrees" action={<StatusPill tone="green">Verified</StatusPill>} /><div className="identity-grid">{[["Reported meter", "SP-24-084731", "Complaint portal"], ["Printed / OCR", "SP-24-084731", "Nameplate image"], ["Optical identity", "SP-24-084731", "DLMS object 0.0.96.1.0.255"], ["SAP identity", "SP-24-084731", "RTN-74002918"], ["MES identity", "SP-24-084731", "Production record"], ["WMS identity", "SP-24-084731", "Bin FFR-A-17"]].map(([label, value, source]) => <div key={label}><span>{label}</span><strong><CheckCircle2 size={15} />{value}</strong><small>{source}</small></div>)}</div></section>
      <section className="card"><SectionTitle eyebrow="Immutable snapshots" title="Enterprise and meter evidence" /><div className="integration-snapshot-grid">{integrations.map(({ name, icon: Icon, status, synced, tone }) => <div key={name}><span className="integration-icon"><Icon size={17} /></span><div><strong>{name}</strong><small>Retrieved {synced}</small></div><StatusPill tone={tone}>{status}</StatusPill></div>)}</div></section>
    </div>
  );

  const renderGenealogy = () => (
    <div className="view-stack">
      <section className="card genealogy-hero"><div><span className="eyebrow">MES immutable snapshot · 10 Jul 2026 10:21 IST</span><h2>KSP-100 / Single-phase smart meter</h2><p>Historical manufacturing evidence remains frozen even if master data changes later.</p></div><div className="genealogy-badge"><Factory size={21} /><span>Original release</span><strong>PASS</strong></div></section>
      <section className="fact-grid">{[["Material code", "KM-SP-100-4G"], ["BOM revision", "BOM-7.3"], ["PCB revision", "PCB-R06"], ["PCB batch", "PCB-24-06-117"], ["Firmware", "FW-4.12.8"], ["Configuration", "AP-JPR-R11"], ["Production date", "17 Dec 2024"], ["Shift / line", "B · SMT-03"], ["Assembly", "ASM-02 · OP-184"], ["Calibration", "CAL-08 · PASS"], ["Functional test", "EOL-14 · PASS"], ["Rework history", "None"]].map(([label, value]) => <article className="card" key={label}><span>{label}</span><strong>{value}</strong></article>)}</section>
      <section className="two-column">
        <article className="card"><SectionTitle eyebrow="Original manufacturing evidence" title="Calibration & end-of-line tests" /><div className="simple-table"><div className="simple-head"><span>Test</span><span>Original result</span><span>Current relevance</span></div>{[["Basic accuracy · Ib", "+0.18% · PASS", "No metrology complaint"], ["Input consumption", "1.42 W · PASS", "Compare with current 0.11 W"], ["Display segments", "PASS", "Now blank"], ["Optical session", "PASS", "Now unavailable on mains"], ["Relay operation", "PASS", "Not implicated"], ["Powered soak · 15m", "PASS", "Latent escape possible"]].map(([test, result, relevance]) => <div key={test}><strong>{test}</strong><span>{result}</span><span>{relevance}</span></div>)}</div></article>
        <article className="card"><SectionTitle eyebrow="Similar population" title="Related returns from the same PCB batch" action={<button className="text-button" onClick={() => navigate("batches")}>Open batch <ArrowRight size={14} /></button>} /><div className="related-list">{[["SP-24-084706", "Communication unavailable", "Under test"], ["SP-24-084992", "Display blank", "Regulator stage"], ["SP-24-085106", "Repeated restart", "PSU instability"], ["SP-24-085417", "Display blank", "New return"]].map(([meter, complaint, state]) => <div key={meter}><span className="meter-cube"><Box size={15} /></span><div><strong>{meter}</strong><small>{complaint}</small></div><StatusPill tone={state === "Regulator stage" ? "red" : "amber"}>{state}</StatusPill></div>)}</div><div className="micro-callout red"><AlertTriangle size={16} /><div><strong>Batch concentration exceeds alert threshold</strong><span>4 related returns · 3.6× model baseline.</span></div></div></article>
      </section>
    </div>
  );

  const renderCaseLab = () => (
    <div className="view-stack">
      <section className="card"><SectionTitle eyebrow="Variant-specific route" title="Evidence-preserving laboratory sequence" description="KSP-100 recipe v3.8 · Fixture SP-FX-04 · Equipment calibration valid" action={<StatusPill tone="green">Safe sequence</StatusPill>} /><div className="lab-stage-track">{[["External vision", "Complete", "teal"], ["Unpowered screen", "Safe", "teal"], ["Battery test", "Display blank", "amber"], ["Controlled mains", "0.11 W input", "amber"], ["Optical extraction", "Failed", "red"], ["Core suite", "6 / 10 passed", "amber"], ["Hypothesis gate", testRun ? "Updated" : "Active", "indigo"], ["Component probe", testRun ? "Complete" : "Next", testRun ? "teal" : "gray"]].map(([label, status, tone], i) => <div className={`lab-stage ${i === 6 && !testRun ? "current" : ""}`} key={label}><span className={`tone-${tone}`}>{i < 6 || testRun ? <Check size={13} /> : i === 6 ? <BrainCircuit size={13} /> : <LockKeyhole size={13} />}</span><strong>{label}</strong><small>{status}</small></div>)}</div></section>
      <section className="two-column wide-left">
        <article className="card"><SectionTitle eyebrow="Captured measurements" title="Core and targeted test record" /><div className="simple-table five"><div className="simple-head"><span>Test / recipe</span><span>Expected</span><span>Measured</span><span>Result</span><span>Evidence</span></div>{[["Unpowered input screen · v2.4", "> 180 kΩ", "231 kΩ", "PASS", "Raw trace"], ["Battery rail · v3.1", "2.8–3.6 V", "3.12 V", "PASS", "DMM-07"], ["Display on battery · v3.8", "Full segment", "Blank", "FAIL", "Video 02"], ["Controlled mains ramp · v4.2", "Boot ≤ 140 V", "No boot", "FAIL", "AC trace"], ["Rectified HV rail · v2.9", "300–340 VDC", "324.8 VDC", "PASS", "Scope 04"], ["3.3 V regulator · v5.0", "3.20–3.40 V", testRun ? "0.08 V" : "Pending", testRun ? "FAIL" : "NEXT", testRun ? "DMM-07" : "—"]].map(([test, expected, measured, result, evidence]) => <div key={test}><strong>{test}</strong><span>{expected}</span><span>{measured}</span><StatusPill tone={result === "PASS" ? "teal" : result === "FAIL" ? "red" : "indigo"}>{result}</StatusPill><span>{evidence}</span></div>)}</div></article>
        <aside className="view-stack"><article className="card safety-card"><SectionTitle eyebrow="Safety interlocks" title="Execution allowed" /><div className="check-list"><span><CheckCircle2 size={15} />Correct SP-FX-04 fixture</span><span><CheckCircle2 size={15} />AC source calibration valid</span><span><CheckCircle2 size={15} />Operator qualified to level L2</span><span><CheckCircle2 size={15} />Current limit set to 35 mA</span><span><CheckCircle2 size={15} />Automatic cut-off armed</span></div><div className="safety-limit"><Power size={17} /><div><span>Hard stop</span><strong>42 mA or 68°C</strong></div></div></article><article className="card"><SectionTitle eyebrow="Raw evidence" title="Instrument traceability" /><div className="stacked-facts"><div><span>Station</span><strong>MAIN-OPT-05</strong></div><div><span>Operator</span><strong>A. Sharma · L2</strong></div><div><span>Recipe</span><strong>KSP-CORE-3.8</strong></div><div><span>Fixture</span><strong>SP-FX-04</strong></div><div><span>Start / end</span><strong>11:18 / 11:32 IST</strong></div></div></article></aside>
      </section>
    </div>
  );

  const renderReasoning = () => {
    const hypotheses = testRun ? [["H1", "PSU regulator failure", 91, "teal", "HV rail present · 3.3 V absent · normal downstream resistance"], ["H2", "Downstream short", 4, "gray", "Rail resistance normal contradicts short"], ["H3", "MCU failure", 3, "gray", "Does not explain missing low-voltage rail"], ["H4", "Battery-only issue", 2, "gray", "Meter also blank on controlled mains"]] : [["H1", "PSU regulator failure", 62, "indigo", "3.3 V absent · HV rail present"], ["H2", "Downstream short", 21, "amber", "3.3 V absent; rail resistance not yet measured"], ["H3", "MCU failure", 10, "gray", "Meter dead; low-voltage evidence incomplete"], ["H4", "Battery-only issue", 7, "gray", "Blank on battery; contradicted by mains result"]];
    return <div className="view-stack">
      <section className="agent-hero"><div className="agent-orb"><BrainCircuit size={25} /></div><div><span className="eyebrow">Diagnostic reasoning agent · decision record DR-04782-08</span><h2>Competing hypotheses, not premature conclusions</h2><p>Every score is linked to evidence, contradictions, model/rule version and reviewer changes.</p></div><div className="agent-meta"><span>Reasoner v2.4</span><span>Rules KSP v5.0</span><span>Calibration 0.93</span></div></section>
      <section className="reasoning-layout"><article className="card"><SectionTitle eyebrow="Current hypothesis set" title={testRun ? "Evidence converged on the regulator stage" : "Power-supply path is most likely"} action={<StatusPill tone={testRun ? "teal" : "indigo"}>{testRun ? "Highly probable" : "Decision in progress"}</StatusPill>} /><div className="hypothesis-list">{hypotheses.map(([id, label, score, tone, evidence]) => <div className={`hypothesis ${id === "H1" ? "leading" : ""}`} key={String(id)}><div className="hypothesis-head"><span className="hypothesis-id">{id}</span><strong>{label}</strong><span>{score}%</span></div><ProgressBar value={Number(score)} tone={tone as Tone} /><p>{evidence}</p></div>)}</div><div className="evidence-legend"><span><CircleDot size={13} className="teal-text" /> Direct evidence</span><span><CircleDot size={13} className="amber-text" /> Inference</span><span><CircleDot size={13} className="red-text" /> Contradiction</span><span><CircleDot size={13} /> Unavailable</span></div></article>
        <aside className="view-stack"><article className="card next-test-card"><div className="next-test-top"><span className="agent-badge"><Sparkles size={15} /> Next-best test</span><StatusPill tone="green">Approved recipe</StatusPill></div><h3>{testRun ? "Stop condition reached" : "Measure regulator input, output and downstream resistance"}</h3><p>{testRun ? "Additional destructive testing is unlikely to materially change the current component-level conclusion." : "This single test separates the regulator-failure and downstream-short hypotheses with no additional evidence risk."}</p>{!testRun && <div className="test-value-grid"><div><span>Information gain</span><strong>High · 0.78</strong></div><div><span>Duration</span><strong>4 minutes</strong></div><div><span>Queue impact</span><strong>6 minutes</strong></div><div><span>Evidence risk</span><strong>None</strong></div><div><span>Target station</span><strong>Component 09</strong></div><div><span>Recipe</span><strong>PSU-PROBE-5.0</strong></div></div>}{testRun ? <button className="button primary full" onClick={() => setCaseTab("rca")}><FileText size={16} /> Review generated RCA</button> : <button className="button primary full" onClick={runRecommendedTest} disabled={testRunning}>{testRunning ? <><RefreshCw className="spin" size={16} /> Capturing measurement…</> : <><Play size={16} /> Run next recommended test</>}</button>}<p className="permission-note">{canRunTest ? "You are authorized to execute this approved recipe." : "Read-only for this persona. Switch to FFR Engineer to execute."}</p></article>{testRun && <article className="card result-card"><SectionTitle eyebrow="New test evidence" title="Regulator output absent" action={<StatusPill tone="red">FAIL</StatusPill>} /><div className="measurement"><div><span>Regulator input</span><strong>12.1 V</strong><small>Expected 11.5–12.5 V</small></div><div><span>Regulator output</span><strong>0.08 V</strong><small>Expected 3.20–3.40 V</small></div><div><span>Downstream rail</span><strong>8.4 kΩ</strong><small>No short detected</small></div></div></article>}</aside>
      </section>
      <section className="card"><SectionTitle eyebrow="Decision transparency" title="Why this test was selected" /><div className="candidate-table"><div><span>Candidate</span><span>Information gain</span><span>Duration</span><span>Risk</span><span>Decision</span></div>{[["Regulator I/O + resistance", "High · 0.78", "4m", "None", "Selected"], ["Replace battery", "Low · 0.12", "3m", "Low", "Rejected"], ["Remove MCU", "Medium · 0.41", "38m", "Destructive", "Rejected"], ["Full teardown", "Medium · 0.46", "24m", "Medium", "Deferred"]].map((row) => <div key={row[0]}>{row.map((cell, index) => index === 4 ? <StatusPill key={cell} tone={cell === "Selected" ? "teal" : "gray"}>{cell}</StatusPill> : <span key={cell}>{cell}</span>)}</div>)}</div></section>
    </div>;
  };

  const renderRca = () => (
    <div className="view-stack">
      <section className="rca-banner"><div><span className="eyebrow">Structured RCA · version {rcaApproved ? "1.0 approved" : "0.8 draft"}</span><h2>{testRun ? "Low-voltage regulator stage failed" : "Component conclusion awaits next-best test"}</h2><p>Generated from the evidence graph—not from a single free-text root-cause field.</p></div><div className="confidence-badge"><span>Confidence</span><strong>{testRun ? "Highly probable" : "Probable"}</strong><small>{testRun ? "0.91 calibrated" : "0.62 calibrated"}</small></div></section>
      <section className="two-column wide-left">
        <article className="card"><SectionTitle eyebrow="Causal hierarchy" title="From reported symptom to controlled action" action={<StatusPill tone={rcaApproved ? "green" : "amber"}>{rcaApproved ? "Approved" : "Review required"}</StatusPill>} /><div className="causal-grid">{reportRows.map(([label, value], index) => <div className={index < 2 ? "fact" : index < 6 ? "finding" : "inference"} key={label}><span>{label}</span><strong>{value}</strong><small>{index < 2 ? "Direct observation" : index < 6 && testRun ? "Direct evidence" : "Evidence-supported inference"}</small></div>)}</div><div className="contradiction-box"><AlertTriangle size={17} /><div><strong>Missing or contradictory evidence remains explicit</strong><p>Supplier lot-to-PCB-batch mapping is unavailable. The failed component is highly probable; supplier or manufacturing origin remains probable.</p></div></div></article>
        <aside className="view-stack"><article className="card approval-card"><SectionTitle eyebrow="Technical validation" title={rcaApproved ? "Approved by Quality" : "Approval pending"} /><div className="reviewer"><Initials name="K. Verma" /><div><strong>K. Verma</strong><span>Quality reviewer · Level Q3</span></div>{rcaApproved && <CheckCircle2 size={21} className="teal-text" />}</div><div className="check-list"><span><CheckCircle2 size={15} />Causal hierarchy complete</span><span><CheckCircle2 size={15} />Evidence links complete</span><span><CheckCircle2 size={15} />Contradictions declared</span><span><CheckCircle2 size={15} />Billing conclusion excluded</span><span className={testRun ? "" : "pending-text"}>{testRun ? <CheckCircle2 size={15} /> : <Clock3 size={15} />}Component measurement {testRun ? "complete" : "pending"}</span></div><button className="button primary full" disabled={rcaApproved} onClick={approveRca}>{rcaApproved ? <CheckCircle2 size={16} /> : <UserRoundCheck size={16} />}{rcaApproved ? "Technical RCA approved" : "Approve technical RCA"}</button><p className="permission-note">{canApprove ? "Quality approval authority active." : "Switch to Quality Reviewer to approve."}</p></article><article className="card"><SectionTitle eyebrow="Evidence map" title="18 evidence links" /><div className="evidence-counts"><div><strong>12</strong><span>Direct</span></div><div><strong>4</strong><span>Inferred</span></div><div><strong>2</strong><span>Missing</span></div><div><strong>1</strong><span>Contradiction</span></div></div><button className="text-button" onClick={() => setCaseTab("audit")}>Open decision history <ArrowRight size={14} /></button></article></aside>
      </section>
      <section className="report-grid">
        <article className="report-preview internal"><div className="report-head"><div><span>INTERNAL</span><strong>Field Failure RCA</strong></div><StatusPill tone={rcaApproved ? "green" : "amber"}>{rcaApproved ? "Approved v1.0" : "Draft v0.8"}</StatusPill></div><div className="report-body"><small>FFR-2026-04782 · SP-24-084731</small><h3>3.3 V regulator stage failure</h3><p><strong>Evidence:</strong> HV rail present, regulator input present, output absent, downstream short excluded.</p><p><strong>Origin:</strong> Probable component / latent manufacturing cause. PCB-batch concentration under investigation.</p><p><strong>Liability:</strong> Manufacturer responsibility recommended, pending batch investigation.</p><div className="report-actions"><button className="button secondary small" onClick={() => exportPdf(false)}><Download size={14} /> PDF</button><button className="button secondary small" onClick={() => exportDocx(false)}><FileText size={14} /> DOCX</button></div></div></article>
        <article className="report-preview customer"><div className="report-head"><div><span>CUSTOMER-SAFE</span><strong>Technical Findings</strong></div><StatusPill tone={reportReleased ? "green" : rcaApproved ? "teal" : "gray"}>{reportReleased ? "Released" : rcaApproved ? "Ready" : "Locked"}</StatusPill></div><div className="report-body"><small>Reference FFR-2026-04782</small><h3>Meter did not power its control electronics</h3><p>Laboratory testing reproduced the blank display condition. Evidence indicates a failure in the meter’s low-voltage power-supply function.</p><p>Corrective action and a related production-batch review have been initiated. This report does not determine billing liability.</p><div className="report-actions"><button className="button secondary small" disabled={!rcaApproved} onClick={() => exportPdf(true)}><Download size={14} /> PDF</button><button className="button secondary small" disabled={!rcaApproved} onClick={() => exportDocx(true)}><FileText size={14} /> DOCX</button><button className="button primary small" disabled={reportReleased} onClick={releaseCustomerReport}>{reportReleased ? <Check size={14} /> : <ArrowRight size={14} />}{reportReleased ? "Released" : "Release"}</button></div></div></article>
      </section>
    </div>
  );

  const renderClosure = () => (
    <div className="view-stack">
      <section className="closure-grid">
        <article className="closure-card"><div className="closure-icon teal"><Microscope size={18} /></div><div><span>Technical RCA</span><strong>{rcaApproved ? "Closed" : "Review pending"}</strong><small>{rcaApproved ? "11 Jul 2026 · K. Verma" : "Quality approval required"}</small></div><StatusPill tone={rcaApproved ? "green" : "amber"}>{rcaApproved ? "Complete" : "Open"}</StatusPill></article>
        <article className="closure-card"><div className="closure-icon amber"><Truck size={18} /></div><div><span>Commercial replacement</span><strong>Customer receipt pending</strong><small>Replacement dispatched 11 Jul</small></div><StatusPill tone="amber">Open</StatusPill></article>
        <article className="closure-card"><div className="closure-icon indigo"><FileCheck2 size={18} /></div><div><span>CAPA effectiveness</span><strong>{capaAccepted ? "90-day monitoring" : "Plan approval pending"}</strong><small>Target: zero repeat regulator failures</small></div><StatusPill tone={capaAccepted ? "indigo" : "gray"}>{capaAccepted ? "Monitoring" : "Draft"}</StatusPill></article>
      </section>
      <section className="two-column wide-left">
        <article className="card"><SectionTitle eyebrow="CAPA-2026-0148" title="Regulator-stage batch investigation" action={<StatusPill tone={capaAccepted ? "indigo" : "amber"}>{capaAccepted ? "Monitoring" : "Awaiting approval"}</StatusPill>} /><div className="capa-steps"><div><span>01</span><div><small>Containment</small><strong>Screen 1,248 retained and WIP meters from PCB-24-06-117</strong><p>Owner: Factory Quality · Due 12 Jul</p></div><StatusPill tone="red">In progress</StatusPill></div><div><span>02</span><div><small>Correction</small><strong>Replace returned meter and preserve regulator for supplier analysis</strong><p>Owner: FFR Operations · Completed</p></div><StatusPill tone="green">Done</StatusPill></div><div><span>03</span><div><small>Corrective action</small><strong>Supplier / PCB-batch analysis and enhanced PSU signature test</strong><p>Owner: Supplier Quality · Due 18 Jul</p></div><StatusPill tone="amber">Planned</StatusPill></div><div><span>04</span><div><small>Preventive action</small><strong>Add powered soak rule if component weakness is confirmed</strong><p>Owner: Process Engineering · Due 26 Jul</p></div><StatusPill tone="gray">Draft</StatusPill></div><div><span>05</span><div><small>Effectiveness</small><strong>Zero recurrence in 25,000 post-change meters over 90 days</strong><p>Baseline 0.32% · Target ≤ 0.04%</p></div><StatusPill tone="indigo">Defined</StatusPill></div></div><button className="button primary" disabled={capaAccepted} onClick={acceptCapa}>{capaAccepted ? <CheckCircle2 size={16} /> : <FileCheck2 size={16} />}{capaAccepted ? "CAPA accepted" : "Accept CAPA plan"}</button></article>
        <aside className="view-stack"><article className="card"><SectionTitle eyebrow="SAP repair order" title="RO 4500098712" /><div className="vertical-timeline"><div className="done"><span><Check /></span><div><strong>Repair order created</strong><small>09 Jul · 17:04</small></div></div><div className="done"><span><Check /></span><div><strong>Replacement authorized</strong><small>10 Jul · 09:18</small></div></div><div className="done"><span><Check /></span><div><strong>New meter dispatched</strong><small>11 Jul · 08:42</small></div></div><div className="active"><span><Truck /></span><div><strong>Customer receipt</strong><small>Expected 13 Jul</small></div></div><div><span>5</span><div><strong>Commercial closure</strong><small>Waiting on receipt</small></div></div></div></article><article className="card"><SectionTitle eyebrow="Disposition" title="Evidence retention & destruction" /><div className="stacked-facts"><div><span>Representative sample</span><strong>Retain until supplier analysis</strong></div><div><span>Failed component</span><strong>Regulator · evidence hold</strong></div><div><span>Destruction authorization</span><strong>Blocked until hold released</strong></div><div><span>WMS state</span><strong>QUARANTINE-FFR-17</strong></div></div><div className="micro-callout red"><LockKeyhole size={16} /><div><strong>Destruction blocked</strong><span>Supplier-analysis evidence hold is active.</span></div></div></article></aside>
      </section>
    </div>
  );

  const renderAudit = () => (
    <section className="card"><SectionTitle eyebrow="Immutable audit trail" title="Every observation, decision, override and approval" description="Times shown in IST · source values retained alongside transformed values." action={<button className="button secondary small" onClick={() => showToast("Audit package prepared for download")}><Download size={15} /> Export audit</button>} /><div className="audit-list">{[["11:48", testRun ? "Measurement captured" : "Next-best test recommended", testRun ? "DMM-07 recorded 12.1 V in / 0.08 V out; hypothesis H1 updated to 0.91." : "Reasoner v2.4 selected PSU-PROBE-5.0 with information gain 0.78.", "Diagnostic agent", "indigo"], ["11:41", "Hypothesis set created", "Four competing hypotheses created; missing and contradictory evidence declared.", "Reasoner v2.4", "indigo"], ["11:32", "Core functional suite completed", "6 of 10 functions passed; no unauthorized write command executed.", "A. Sharma", "teal"], ["11:18", "Controlled mains test started", "SP-FX-04 verified; current limit 35 mA; calibration valid.", "MAIN-OPT-05", "teal"], ["10:57", "Read-only DLMS extraction failed", "Session attempted twice; raw protocol traces preserved; no reset issued.", "DLMS-05", "red"], ["10:49", "External evidence complete", "12 required views stored; vision observations confirmed by operator.", "Vision agent", "teal"], ["10:24", "Identity reconciled", "Printed, optical-unavailable, SAP, MES and WMS identities agree.", "Identity agent", "teal"], ["10:16", "Digital case created", "SAP return, GRN, WMS batch and complaint linked; SLA timer started.", "Intake agent", "navy"]].map(([time, title, detail, actor, tone]) => <div className="audit-event" key={`${time}-${title}`}><span className={`audit-marker tone-${tone}`} /><time>{time}</time><div><strong>{title}</strong><p>{detail}</p></div><span className="audit-actor">{actor}</span></div>)}</div></section>
  );

  const renderLab = () => (
    <div className="view-stack">
      <SectionTitle eyebrow="Central RCA facility" title="Laboratory line control" description="Logical separation remains explicit even where stations share a physical bench during the pilot." action={<><button className="button secondary"><Clock3 size={16} /> Shift B · 6h 12m left</button><button className="button primary" onClick={() => navigate("case", "lab")}><Play size={15} /> Open active route</button></>} />
      <section className="mini-metric-row lab-metrics"><div><span>Current WIP</span><strong>292</strong><StatusPill tone="teal">−18 today</StatusPill></div><div><span>Units / hour</span><strong>41.7</strong><StatusPill tone="teal">Target 40</StatusPill></div><div><span>Equipment online</span><strong>47 / 49</strong><StatusPill tone="amber">2 service</StatusPill></div><div><span>Average queue</span><strong>28m</strong><StatusPill tone="teal">−7m</StatusPill></div><div><span>Safety stops</span><strong>3</strong><StatusPill tone="red">Reviewed</StatusPill></div></section>
      <section className="lab-board">{stations.map((station, index) => <article className={`station-card ${index === 8 ? "selected" : ""}`} key={station.n}><div className="station-top"><span className="station-number">{station.n}</span><StatusPill tone={station.tone}>{station.state}</StatusPill></div><h3>{station.name}</h3><div className="station-data"><div><span>WIP</span><strong>{station.wip}</strong></div><div><span>Queue</span><strong>{station.queue}</strong></div><div><span>Cycle</span><strong>{station.cycle}</strong></div></div><ProgressBar value={Math.min(96, station.wip * 2)} tone={station.tone} /><div className="station-footer"><span>{index === 8 ? "FFR-2026-04782 next" : `${Math.max(2, 8 - (index % 5))} stations online`}</span><ChevronRight size={15} /></div></article>)}</section>
      <section className="two-column wide-left"><article className="card"><SectionTitle eyebrow="Selected route" title="FFR-2026-04782 · dead / no display" action={<StatusPill tone="indigo">Component station next</StatusPill>} /><div className="route-line">{["Received", "Vision", "Safe screen", "Battery", "Mains", "DLMS", "Core", "Hypothesis", "Component", "Review"].map((step, index) => <div className={index < 8 ? "done" : index === 8 ? "active" : ""} key={step}><span>{index < 8 ? <Check size={12} /> : index + 1}</span><small>{step}</small></div>)}</div><div className="route-detail"><div><BrainCircuit size={20} /><div><span>Routing reason</span><strong>HV rail present + low-voltage electronics inactive</strong><p>Route to Station 09 for regulator input/output and downstream resistance measurement.</p></div></div><button className="button primary" onClick={() => navigate("case", "reasoning")}>Open decision record <ArrowRight size={15} /></button></div></article><aside className="card"><SectionTitle eyebrow="Safety controls" title="3 active interlocks" /><div className="alert-list"><div><ShieldAlert size={17} /><div><strong>FFR-2026-04768 · Do not energize</strong><span>Carbonized terminal path detected.</span></div></div><div><Clock3 size={17} /><div><strong>METRO-03 calibration expires in 2h</strong><span>No new recipes after expiry.</span></div></div><div><LockKeyhole size={17} /><div><strong>2 unsupported HTCT variants</strong><span>Routed to expert review.</span></div></div></div></aside></section>
    </div>
  );

  const renderBatches = () => (
    <div className="view-stack">
      <SectionTitle eyebrow="Batch intelligence" title="Shared causality without losing individual traceability" description="Every meter keeps its own identity, safety screen and evidence; only defensibly homogeneous clusters share a master RCA." action={<button className="button primary" onClick={() => showToast("Representative-sample plan generated")}><Sparkles size={16} /> Generate sample plan</button>} />
      <section className="batch-alert-hero"><div className="batch-alert-icon"><AlertTriangle size={26} /></div><div><span className="eyebrow">Systemic alert · ALT-2026-071</span><h2>PCB-24-06-117 · low-voltage rail failures</h2><p>Four related returns across three projects; common regulator-stage signature; concentration exceeds the model baseline by 3.6×.</p><div className="batch-tags"><span>KSP-100</span><span>PCB-R06</span><span>FW-4.12.8</span><span>SMT-03</span></div></div><div className="batch-score"><strong>91%</strong><span>homogeneity</span><small>High-confidence cluster</small></div></section>
      <section className="fact-grid batch-facts">{[["Member meters", "38"], ["Deep-analysis sample", "5"], ["Confirmed signature", "4"], ["Outliers", "2"], ["Affected population", "1,248"], ["Shared CAPA", "CAPA-2026-0148"]].map(([label, value]) => <article className="card" key={label}><span>{label}</span><strong>{value}</strong></article>)}</section>
      <section className="batch-layout"><aside className="card cluster-list"><SectionTitle eyebrow="Active clusters" title="3 need review" />{[["PCB-24-06-117", "Power supply", "38", "red"], ["FW-4.11.2", "RTC drift", "17", "amber"], ["Coastal · Jun 26", "Moisture", "11", "amber"], ["SMT-02 · Shift C", "Solder", "8", "indigo"]].map(([id, label, count, tone], index) => <button className={index === 0 ? "active" : ""} key={id}><span className={`cluster-dot tone-${tone}`} /><div><strong>{id}</strong><small>{label}</small></div><span>{count}</span><ChevronRight size={15} /></button>)}</aside><article className="card"><SectionTitle eyebrow="Cluster composition" title="Evidence signature & representative sampling" action={<StatusPill tone="teal">Technically homogeneous</StatusPill>} /><div className="signature-grid">{[["Model / revision", "100%", 100], ["Firmware / config", "94%", 94], ["Core-test signature", "91%", 91], ["HES chronology", "86%", 86], ["Visual signature", "82%", 82], ["Production line", "76%", 76]].map(([label, value, score]) => <div key={String(label)}><span><strong>{label}</strong><small>{value}</small></span><ProgressBar value={Number(score)} tone={Number(score) > 90 ? "teal" : "indigo"} /></div>)}</div><div className="sample-table"><div><span>Representative meter</span><span>Selection reason</span><span>Depth</span><span>Result</span></div>{[["SP-24-084731", "Median signature", "Full component", testRun ? "Regulator stage" : "In progress"], ["SP-24-084992", "Earliest production", "Full component", "Regulator stage"], ["SP-24-085106", "Reset variant", "Thermal + rails", "PSU unstable"], ["SP-24-085417", "Newest return", "Core + optical", "Scheduled"], ["SP-24-085802", "Outlier signature", "Deep analysis", "Expand sample"]].map((row) => <div key={row[0]}>{row.map((cell, index) => index === 3 ? <StatusPill key={cell} tone={cell === "Regulator stage" ? "red" : cell === "Scheduled" ? "gray" : "amber"}>{cell}</StatusPill> : <span key={cell}>{cell}</span>)}</div>)}</div></article></section>
      <section className="card master-rca"><SectionTitle eyebrow="Master RCA & containment" title="One shared conclusion, 38 linked individual records" /><div className="master-columns"><div><span>Common signature</span><strong>Rectified HV rail present; 3.3 V rail absent; no downstream short</strong></div><div><span>Master conclusion</span><strong>Highly probable regulator-stage internal failure</strong></div><div><span>Containment</span><strong>Screen retained inventory; preserve regulator samples; supplier review</strong></div><div><span>Expansion rule</span><strong>Expand sampling if any member contradicts the PSU signature</strong></div></div></section>
    </div>
  );

  const renderIntelligence = () => (
    <div className="view-stack">
      <SectionTitle eyebrow="Population intelligence" title="Learn across every meter, batch and corrective action" description="All values are deterministic prototype data designed to demonstrate the target operating model." action={<button className="button secondary"><Clock3 size={15} /> Last 30 days <ChevronDown size={14} /></button>} />
      <nav className="sub-tabs">{(["operations", "quality", "agent", "customer"] as IntelligenceTab[]).map((tab) => <button className={intelTab === tab ? "active" : ""} onClick={() => setIntelTab(tab)} key={tab}>{tab === "agent" ? "Agent performance" : tab === "customer" ? "Customer / project" : `${tab[0].toUpperCase()}${tab.slice(1)}`}</button>)}</nav>
      {intelTab === "operations" && <><section className="metric-grid four"><MetricCard label="Median RCA TAT" value="2.8d" meta="−18% vs baseline" trend="down" icon={Clock3} tone="teal" /><MetricCard label="Within SLA" value="93.6%" meta="+4.2 pts" trend="up" icon={ShieldCheck} tone="teal" /><MetricCard label="Tests per case" value="8.4" meta="−2.1 with routing" trend="down" icon={TestTube2} tone="indigo" /><MetricCard label="Analyst minutes" value="31m" meta="−14m per meter" trend="down" icon={Users} tone="navy" /></section><section className="two-column"><article className="card"><SectionTitle eyebrow="Throughput" title="Inflow and completions by day" /><div className="bar-chart grouped">{[["M", 292, 281], ["T", 314, 306], ["W", 305, 312], ["T", 339, 320], ["F", 327, 301], ["S", 166, 173]].map(([day, input, output]) => <div key={day}><div><span style={{ height: `${Number(input) / 4}px` }} /><span style={{ height: `${Number(output) / 4}px` }} /></div><small>{day}</small></div>)}</div><div className="chart-legend"><span><i className="navy" />Received</span><span><i className="teal" />Completed</span></div></article><article className="card"><SectionTitle eyebrow="Queue time" title="Median wait by station" /><div className="horizontal-bars">{stations.slice(4, 10).map((station) => <div key={station.n}><span>{station.name}</span><div><i style={{ width: `${Math.min(100, station.wip * 2)}%` }} className={station.tone} /></div><strong>{station.queue}</strong></div>)}</div></article></section></>}
      {intelTab === "quality" && <><section className="metric-grid four"><MetricCard label="Confirmed cause" value="64.8%" meta="+7.6 pts" trend="up" icon={FileCheck2} tone="teal" /><MetricCard label="Inconclusive" value="8.2%" meta="−2.4 pts" trend="down" icon={HelpCircle} tone="amber" /><MetricCard label="Later overturned" value="1.6%" meta="Target < 2%" icon={RefreshCw} tone="navy" /><MetricCard label="CAPA recurrence" value="3.1%" meta="−1.2 pts" trend="down" icon={TrendingDown} tone="teal" /></section><section className="two-column"><article className="card"><SectionTitle eyebrow="Failure distribution" title="Subsystem by confirmed RCA" /><div className="donut-layout"><div className="css-donut"><div><strong>1,846</strong><span>confirmed</span></div></div><div className="donut-legend">{[["Power supply", "31%", "navy"], ["Communication", "22%", "teal"], ["Relay", "14%", "indigo"], ["RTC / battery", "12%", "amber"], ["Terminal path", "9%", "red"], ["Other", "12%", "gray"]].map(([label, value, tone]) => <div key={label}><i className={tone} /><span>{label}</span><strong>{value}</strong></div>)}</div></div></article><article className="card"><SectionTitle eyebrow="Systemic alerts" title="Signals requiring containment" /><div className="alert-table">{[["PCB-24-06-117", "PSU regulator", "3.6×", "High"], ["FW-4.11.2", "RTC drift", "2.1×", "Medium"], ["Coastal Jun-26", "Moisture", "1.8×", "Medium"], ["SMT-02 Shift C", "Solder joint", "1.6×", "Watch"]].map(([scope, signal, ratio, severity]) => <div key={scope}><div><strong>{scope}</strong><span>{signal}</span></div><strong>{ratio}</strong><StatusPill tone={severity === "High" ? "red" : severity === "Watch" ? "gray" : "amber"}>{severity}</StatusPill></div>)}</div></article></section></>}
      {intelTab === "agent" && <><section className="metric-grid four"><MetricCard label="Recommendation accepted" value="88.4%" meta="+3.7 pts" trend="up" icon={BrainCircuit} tone="indigo" /><MetricCard label="Tests saved / case" value="2.1" meta="18% reduction" trend="down" icon={TestTube2} tone="teal" /><MetricCard label="Material RCA edits" value="12.6%" meta="−5.1 pts" trend="down" icon={FileText} tone="navy" /><MetricCard label="High-conf overturn" value="0.9%" meta="Within policy" icon={ShieldCheck} tone="teal" /></section><section className="two-column"><article className="card"><SectionTitle eyebrow="Confidence calibration" title="Predicted vs observed correctness" /><div className="calibration-chart"><div className="calibration-line" /><div className="calibration-point p1">0.61</div><div className="calibration-point p2">0.74</div><div className="calibration-point p3">0.86</div><div className="calibration-point p4">0.94</div><span className="axis-y">Observed correctness</span><span className="axis-x">Predicted confidence</span></div></article><article className="card"><SectionTitle eyebrow="Class-level quality" title="Precision by failure family" /><div className="horizontal-bars quality">{[["Dead / no display", 94], ["Communication", 89], ["Relay", 91], ["RTC / time", 87], ["Terminal heating", 82], ["Moisture", 78]].map(([label, score]) => <div key={String(label)}><span>{label}</span><div><i style={{ width: `${score}%` }} className={Number(score) >= 90 ? "teal" : Number(score) >= 82 ? "indigo" : "amber"} /></div><strong>{score}%</strong></div>)}</div></article></section></>}
      {intelTab === "customer" && <><section className="metric-grid four"><MetricCard label="Returns / 1k installed" value="1.84" meta="−0.21" trend="down" icon={Gauge} tone="teal" /><MetricCard label="Customer TAT" value="3.6d" meta="−0.8d" trend="down" icon={Clock3} tone="teal" /><MetricCard label="Replacement complete" value="96.2%" meta="Within 5 days" icon={Truck} tone="navy" /><MetricCard label="Open customer CAPAs" value="7" meta="2 due this week" icon={FileCheck2} tone="amber" /></section><section className="two-column"><article className="card"><SectionTitle eyebrow="Utility comparison" title="Return volume and turnaround" /><div className="utility-list">{[["Aravalli Power", "1,284", "2.4d", 93], ["Dharini DISCOM", "992", "3.1d", 86], ["Narmada Grid", "741", "2.9d", 89], ["Vindhya Energy", "506", "4.2d", 76], ["Coastal Power", "398", "3.8d", 81]].map(([name, volume, tat, score]) => <div key={String(name)}><Initials name={String(name)} /><div><strong>{name}</strong><small>{volume} returns · {tat} median TAT</small></div><div className="score-bar"><ProgressBar value={Number(score)} tone={Number(score) > 85 ? "teal" : "amber"} /><span>{score}% SLA</span></div></div>)}</div></article><article className="card"><SectionTitle eyebrow="Complaint mix" title="Top customer observations" /><div className="horizontal-bars quality">{[["Communication unavailable", 31], ["Display blank", 24], ["Relay operation", 16], ["Date / time", 11], ["Data missing", 9], ["Terminal heated", 6]].map(([label, score]) => <div key={String(label)}><span>{label}</span><div><i style={{ width: `${Number(score) * 3}%` }} className="navy" /></div><strong>{score}%</strong></div>)}</div><div className="micro-callout teal"><ShieldCheck size={16} /><div><strong>Observations only</strong><span>Customers are never asked to identify a component, cause or liability.</span></div></div></article></section></>}
    </div>
  );

  const renderCapa = () => (
    <div className="view-stack">
      <SectionTitle eyebrow="Corrective & preventive action" title="From containment to proven effectiveness" description="A case is not fully closed until the corrective action demonstrates that the failure does not recur." action={<button className="button primary" onClick={() => showToast("CAPA creation is simulated in this prototype")}><Plus size={16} /> Create CAPA</button>} />
      <section className="mini-metric-row"><div><span>Open CAPAs</span><strong>42</strong><StatusPill tone="navy">All owners</StatusPill></div><div><span>Overdue</span><strong>7</strong><StatusPill tone="red">Action required</StatusPill></div><div><span>In monitoring</span><strong>18</strong><StatusPill tone="indigo">Effectiveness</StatusPill></div><div><span>Effective</span><strong>86</strong><StatusPill tone="green">Last 12m</StatusPill></div><div><span>Failed effectiveness</span><strong>3</strong><StatusPill tone="red">Reopen</StatusPill></div></section>
      <section className="kanban">{[["Open", "amber", [["CAPA-2026-0148", "PSU regulator batch investigation", "Factory Quality", "12 Jul", "1,248 meters"], ["CAPA-2026-0142", "RTC battery supplier review", "Supplier Quality", "16 Jul", "FW-4.11.2"], ["CAPA-2026-0139", "Terminal torque work instruction", "Process Eng.", "18 Jul", "3 projects"]]], ["Overdue", "red", [["CAPA-2026-0126", "Moisture ingress seal study", "Design Quality", "08 Jul", "11 days late"], ["CAPA-2026-0118", "SMT AOI rule update", "SMT Quality", "05 Jul", "14 days late"]]], ["Monitoring", "indigo", [["CAPA-2026-0102", "Relay contact material change", "Supplier Quality", "90-day window", "18,400 meters"], ["CAPA-2026-0097", "Communication module soak", "Product Quality", "60-day window", "12,800 meters"]]], ["Effective", "green", [["CAPA-2026-0071", "Optical port fixture alignment", "Test Eng.", "Verified", "0 recurrences"], ["CAPA-2026-0062", "RTC sync configuration", "Firmware", "Verified", "−93% recurrence"]]]].map(([column, tone, cards]) => <div className="kanban-column" key={String(column)}><div className="kanban-head"><span><i className={`tone-${tone}`} />{column}</span><strong>{(cards as string[][]).length}</strong></div>{(cards as string[][]).map(([id, title, owner, due, scope], index) => <article className={id === "CAPA-2026-0148" ? "selected" : ""} key={id} onClick={() => id === "CAPA-2026-0148" && navigate("case", "closure")}><small>{id}</small><h3>{title}</h3><div><span><Initials name={owner} />{owner}</span><span>{due}</span></div><p>{scope}</p>{id === "CAPA-2026-0148" && <StatusPill tone="red">Golden case</StatusPill>}</article>)}</div>)}</section>
      <section className="two-column"><article className="card"><SectionTitle eyebrow="Effectiveness trend" title="Recurrence after verified CAPA" /><div className="line-bars">{[31, 27, 25, 20, 18, 14, 11, 9, 7, 5, 4, 3].map((height, index) => <div key={index}><span style={{ height: `${height * 3}px` }} /><small>{["A", "S", "O", "N", "D", "J", "F", "M", "A", "M", "J", "J"][index]}</small></div>)}</div><div className="trend-summary"><TrendingDown size={22} /><div><strong>90.3% recurrence reduction</strong><span>Across CAPAs verified in the last 12 months</span></div></div></article><article className="card"><SectionTitle eyebrow="Due soon" title="Owner action queue" /><div className="owner-queue">{[["Factory Quality", "4 actions", "Today"], ["Supplier Quality", "7 actions", "2 overdue"], ["Process Engineering", "3 actions", "18 Jul"], ["Firmware", "2 actions", "21 Jul"]].map(([owner, count, due]) => <div key={owner}><Initials name={owner} /><div><strong>{owner}</strong><small>{count}</small></div><StatusPill tone={due.includes("overdue") ? "red" : due === "Today" ? "amber" : "gray"}>{due}</StatusPill></div>)}</div></article></section>
    </div>
  );

  const renderSystem = () => (
    <div className="view-stack">
      <SectionTitle eyebrow="System, knowledge & governance" title="Controlled tools, versioned knowledge and human authority" description="Specialist agents operate over approved interfaces; high-consequence actions remain explicitly governed." />
      <nav className="sub-tabs">{(["integrations", "knowledge", "agents", "governance"] as SystemTab[]).map((tab) => <button className={systemTab === tab ? "active" : ""} onClick={() => setSystemTab(tab)} key={tab}>{tab[0].toUpperCase() + tab.slice(1)}</button>)}</nav>
      {systemTab === "integrations" && <><section className="integration-cards">{integrations.map(({ name, icon: Icon, status, detail, synced, coverage, tone }) => <article className="card" key={name}><div className="integration-card-head"><span className="integration-icon large"><Icon size={20} /></span><StatusPill tone={tone}>{status}</StatusPill></div><h3>{name}</h3><p>{detail}</p><div className="integration-card-foot"><span>Evidence coverage</span><strong>{coverage}</strong></div><ProgressBar value={Number.parseFloat(coverage)} tone={tone} /><small>Last activity: {synced}</small><button className="text-button" onClick={() => showToast(`${name} reconciliation request queued`)}><RefreshCw size={13} /> Reconcile</button></article>)}</section><section className="card"><SectionTitle eyebrow="Orchestration queue" title="Explicit integration states" /><div className="orchestration-grid">{[["SAP", "Complete", "842 / 842", "teal"], ["MES", "Complete", "840 / 842", "teal"], ["WMS", "Complete", "842 / 842", "teal"], ["HES", "Partial", "702 / 842", "amber"], ["Optical", "Failed", "66 / 842", "red"], ["Physical meter", "Pending", "58 / 842", "gray"], ["Core tests", "Active", "393 / 842", "indigo"], ["RO / replacement", "Pending", "184 / 842", "amber"]].map(([system, state, count, tone]) => <div key={system}><span>{system}</span><StatusPill tone={tone as Tone}>{state}</StatusPill><strong>{count}</strong></div>)}</div></section></>}
      {systemTab === "knowledge" && <><section className="card"><SectionTitle eyebrow="Versioned test catalogue" title="Approved digital diagnostic objects" action={<button className="button primary"><Plus size={15} /> New draft recipe</button>} /><div className="simple-table knowledge"><div className="simple-head"><span>Test / version</span><span>Applies to</span><span>Duration</span><span>Safety prerequisite</span><span>Signal / discriminates</span><span>State</span></div>{[["KSP-CORE · v3.8", "KSP-100", "9.8m", "Safe to energize", "Core signature", "Approved"], ["PSU-PROBE · v5.0", "SP / TP", "4.0m", "Teardown + L2", "Regulator vs short", "Approved"], ["COMMS-LOCAL · v2.7", "4G modules", "8.2m", "Optical preserved", "Network vs module", "Approved"], ["RELAY-PATH · v4.1", "All relay", "12m", "Current limited", "Driver / coil / contact", "Approved"], ["RTC-DRIFT · v2.2", "All smart", "28m", "Clock preserved", "Battery / oscillator", "Approved"], ["PSU-SOAK · v0.6", "PCB-R06", "45m", "Pilot approval", "Latent PSU failure", "Draft"]].map((row) => <div key={row[0]}>{row.map((cell, index) => index === 5 ? <StatusPill key={cell} tone={cell === "Approved" ? "teal" : "amber"}>{cell}</StatusPill> : <span key={cell}>{cell}</span>)}</div>)}</div></section><section className="two-column"><article className="card"><SectionTitle eyebrow="Golden references" title="Variant baseline library" /><div className="reference-list">{[["KSP-100 · PCB-R06", "BOM-7.3", "Complete"], ["KTP-300 · PCB-R04", "BOM-5.1", "Complete"], ["KCT-500 · PCB-R03", "BOM-4.8", "Complete"], ["KLT-700 · PCB-R02", "BOM-3.6", "Needs thermal"]].map(([model, bom, state]) => <div key={model}><span className="meter-cube"><Box size={15} /></span><div><strong>{model}</strong><small>{bom}</small></div><StatusPill tone={state === "Complete" ? "teal" : "amber"}>{state}</StatusPill></div>)}</div></article><article className="card"><SectionTitle eyebrow="Diagnostic graph" title="Complaint branch coverage" /><div className="coverage-list">{[["Dead / no display", 100], ["Communication", 92], ["Relay", 88], ["RTC / date-time", 94], ["Terminal heating", 81], ["Accuracy / metrology", 76], ["Moisture", 68]].map(([label, score]) => <div key={String(label)}><span>{label}</span><ProgressBar value={Number(score)} tone={Number(score) > 90 ? "teal" : Number(score) > 75 ? "indigo" : "amber"} /><strong>{score}%</strong></div>)}</div></article></section></>}
      {systemTab === "agents" && <><section className="agent-grid">{agents.map(([name, responsibility, tools], index) => <article className="card" key={name}><div className="agent-card-icon">{index < 10 ? String.fromCharCode(65 + index) : "K"}</div><div><h3>{name}</h3><p>{responsibility}</p></div><span className="tool-chip"><Wrench size={12} />{tools}</span><div className="agent-card-foot"><StatusPill tone="teal">Operational</StatusPill><span>v{index % 3 + 1}.{index + 2}</span></div></article>)}</section><section className="card prohibited"><SectionTitle eyebrow="Hard restrictions" title="What agents cannot do" /><div className="prohibited-grid">{["Write to production without authorization", "Reset a meter before evidence capture", "Change firmware or configuration", "Issue destructive commands", "Assign external liability without approval", "Release customer reports outside policy", "Destroy or delete evidence", "Bypass safety and calibration gates"].map((item) => <div key={item}><X size={15} /><span>{item}</span></div>)}</div></section></>}
      {systemTab === "governance" && <><section className="two-column wide-left"><article className="card"><SectionTitle eyebrow="Role and permission matrix" title="Authority follows consequence" /><div className="permission-table"><div><span>Action</span>{["Store", "FFR", "Quality", "Executive"].map((role) => <span key={role}>{role}</span>)}</div>{[["Create / receive case", true, true, false, false], ["Execute approved test", false, true, false, false], ["Authorize teardown", false, true, true, false], ["Approve technical RCA", false, false, true, false], ["Approve liability wording", false, false, true, false], ["Release customer report", false, false, true, false], ["Close CAPA", false, false, true, false], ["View portfolio analytics", true, true, true, true]].map((row) => <div key={String(row[0])}><strong>{row[0]}</strong>{row.slice(1).map((allowed, index) => <span key={index}>{allowed ? <CheckCircle2 size={16} /> : <X size={15} />}</span>)}</div>)}</div></article><aside className="card"><SectionTitle eyebrow="Active persona" title={persona} /><div className="persona-card"><Initials name={persona} /><div><strong>{persona}</strong><span>{persona === "Executive" ? "Portfolio visibility · read only" : persona === "FFR Engineer" ? "Test execution · teardown authorization" : persona === "Quality Reviewer" ? "Technical, liability and release approval" : "Receipt, batch and chain of custody"}</span></div></div><select value={persona} onChange={(event) => setPersona(event.target.value as Persona)}>{["Executive", "FFR Engineer", "Quality Reviewer", "Store Operator"].map((item) => <option key={item}>{item}</option>)}</select><p className="permission-note">Persona switching is a prototype device; production access would use identity-aware authorization.</p></aside></section><section className="metric-grid four"><MetricCard label="Models monitored" value="6" meta="All within drift limit" icon={BrainCircuit} tone="indigo" /><MetricCard label="Rules in production" value="48" meta="7 drafts in validation" icon={ListChecks} tone="navy" /><MetricCard label="Overrides / 1k" value="4.8" meta="100% reason-coded" icon={History} tone="amber" /><MetricCard label="Audit completeness" value="100%" meta="No missing events" icon={ShieldCheck} tone="teal" /></section><section className="card"><SectionTitle eyebrow="Model governance" title="Version, intended use, calibration and rollback" /><div className="simple-table knowledge"><div className="simple-head"><span>Model / rule</span><span>Intended use</span><span>Performance</span><span>Drift</span><span>Owner</span><span>Rollback</span></div>{[["Reasoner v2.4", "Hypothesis ranking", "0.91 macro F1", "Stable", "FFR Data Science", "v2.3 ready"], ["Vision-ext v1.8", "External observations", "0.94 precision", "Stable", "Quality AI", "v1.7 ready"], ["Vision-PCB v0.9", "Region of interest", "0.82 precision", "Watch", "Quality AI", "Rules only"], ["Batch-signal v1.6", "Cluster alerting", "0.89 precision", "Stable", "Product Quality", "v1.5 ready"]].map((row) => <div key={row[0]}>{row.map((cell, index) => index === 3 ? <StatusPill key={cell} tone={cell === "Stable" ? "teal" : "amber"}>{cell}</StatusPill> : <span key={cell}>{cell}</span>)}</div>)}</div></section></>}
    </div>
  );

  const viewContent: Record<View, ReactNode> = {
    dashboard: renderDashboard(), cases: renderCases(), case: renderCase(), lab: renderLab(), batches: renderBatches(), intelligence: renderIntelligence(), capa: renderCapa(), system: renderSystem(),
  };

  return (
    <div className={`app-shell ${mobileNavOpen ? "nav-open" : ""}`}>
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark"><Snowflake size={22} /></div><div><strong>Kimbal</strong><span>FFR Intelligence</span></div></div>
        <div className="demo-chip"><Sparkles size={13} /><span>Interactive prototype</span></div>
        <nav className="main-nav" aria-label="Primary navigation">{navItems.map(({ id, label, icon: Icon, badge }) => <button key={id} className={activeView === id || (id === "cases" && activeView === "case") ? "active" : ""} onClick={() => navigate(id)}><Icon size={18} /><span>{label}</span>{badge && <small>{badge}</small>}</button>)}</nav>
        <div className="sidebar-spacer" />
        <button className="sidebar-action" onClick={() => setFeatureMapOpen(true)}><HelpCircle size={17} /><span>Feature map</span></button>
        <button className="sidebar-action" onClick={resetDemo}><RotateCcw size={17} /><span>Reset demo</span></button>
        <div className="sidebar-footer"><div className="system-live"><span /><div><strong>Demo systems online</strong><small>Simulated · no live data</small></div></div><span className="version">Prototype v0.9</span></div>
      </aside>
      {mobileNavOpen && <button className="nav-backdrop" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} />}
      <div className="app-main">
        <header className="topbar">
          <button className="icon-button menu-button" aria-label="Open navigation" onClick={() => setMobileNavOpen(true)}><Menu size={19} /></button>
          <div className="global-search"><Search size={17} /><input aria-label="Search cases, meters or batches" value={search} onChange={(event) => setSearch(event.target.value)} onFocus={() => activeView !== "cases" && navigate("cases")} placeholder="Search case, meter, batch, GRN…" /><kbd>⌘ K</kbd></div>
          <div className="topbar-actions"><span className="persistent-demo"><CircleDot size={13} /> DEMO DATA</span><div className="persona-select"><Initials name={persona} /><select aria-label="Active persona" value={persona} onChange={(event) => { setPersona(event.target.value as Persona); showToast(`Persona changed to ${event.target.value}`); }}>{["Executive", "FFR Engineer", "Quality Reviewer", "Store Operator"].map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={14} /></div><button className="icon-button" aria-label="Open feature map" onClick={() => setFeatureMapOpen(true)}><HelpCircle size={19} /></button><div className="popover-wrap"><button className="icon-button notification-button" aria-label="Open notifications" onClick={() => setNotificationsOpen(!notificationsOpen)}><Bell size={19} /><span>3</span></button>{notificationsOpen && <div className="notification-popover"><div className="popover-head"><strong>Notifications</strong><button onClick={() => setNotificationsOpen(false)}><X size={15} /></button></div><button onClick={() => { navigate("batches"); setNotificationsOpen(false); }}><AlertTriangle size={16} /><div><strong>Systemic signal detected</strong><span>PCB-24-06-117 · 4 related returns</span></div></button><button onClick={() => { navigate("lab"); setNotificationsOpen(false); }}><Clock3 size={16} /><div><strong>Station 09 queue risk</strong><span>1h 18m median wait</span></div></button><button onClick={() => { navigate("capa"); setNotificationsOpen(false); }}><FileCheck2 size={16} /><div><strong>2 CAPA actions overdue</strong><span>Supplier Quality ownership</span></div></button></div>}</div></div>
        </header>
        <main className="content">{viewContent[activeView]}</main>
      </div>

      {tourOpen && <aside className="tour-panel" aria-live="polite"><div className="tour-top"><span>{tourSteps[tourStep].eyebrow}</span><button aria-label="Close guided tour" onClick={() => setTourOpen(false)}><X size={16} /></button></div><ProgressBar value={((tourStep + 1) / tourSteps.length) * 100} tone="indigo" /><div className="tour-copy"><span className="tour-icon"><Sparkles size={18} /></span><h3>{tourSteps[tourStep].title}</h3><p>{tourSteps[tourStep].description}</p></div><div className="tour-actions"><button className="button ghost small" disabled={tourStep === 0} onClick={() => changeTour(tourStep - 1)}><ChevronLeft size={15} /> Back</button><span>{tourStep + 1} / {tourSteps.length}</span>{tourStep === tourSteps.length - 1 ? <button className="button primary small" onClick={() => { setTourOpen(false); showToast("Guided tour complete · every module remains explorable"); }}>Finish <Check size={15} /></button> : <button className="button primary small" onClick={() => changeTour(tourStep + 1)}>Next <ChevronRight size={15} /></button>}</div></aside>}

      {featureMapOpen && <div className="modal-layer" role="dialog" aria-modal="true" aria-label="Feature map"><div className="modal feature-modal"><div className="modal-head"><div><span className="eyebrow">Prototype coverage</span><h2>The complete FFR operating system</h2><p>Choose any module to explore it directly.</p></div><button className="icon-button" onClick={() => setFeatureMapOpen(false)}><X size={19} /></button></div><div className="feature-map-grid">{navItems.map(({ id, label, icon: Icon }, index) => <button key={id} onClick={() => { setFeatureMapOpen(false); navigate(id); }}><span className="feature-number">0{index + 1}</span><Icon size={20} /><strong>{label}</strong><small>{["Throughput, SLA, queues and workflow", "Intake, identity, evidence and case 360", "Stations, safety, recipes and routing", "Clusters, sampling and master RCA", "Operations, quality, agent and customer KPIs", "Actions, owners, recurrence and effectiveness", "Integrations, knowledge, agents and permissions"][index]}</small><ArrowRight size={15} /></button>)}</div><div className="feature-footer"><div><ShieldCheck size={19} /><span><strong>Governed autonomy</strong> · Agents recommend and automate within approved tools; people retain high-consequence authority.</span></div><button className="button primary" onClick={() => { setFeatureMapOpen(false); startTour(); }}><Play size={15} /> Start guided story</button></div></div></div>}

      {intakeOpen && <div className="modal-layer" role="dialog" aria-modal="true" aria-label="New return intake"><div className="modal intake-modal"><div className="modal-head"><div><span className="eyebrow">New digital work order</span><h2>Return intake</h2><p>Capture observations and chain of custody—not diagnosis.</p></div><button className="icon-button" onClick={() => setIntakeOpen(false)}><X size={19} /></button></div><div className="wizard-steps">{["Observation", "Return & custody", "Evidence", "Readiness"].map((step, index) => <div className={intakeStep === index ? "active" : index < intakeStep ? "done" : ""} key={step}><span>{index < intakeStep ? <Check size={13} /> : index + 1}</span><strong>{step}</strong></div>)}</div><div className="wizard-content">{intakeStep === 0 && <div className="form-grid"><label>Meter number<input defaultValue="SP-24-086214" /></label><label>Utility / AMISP<select defaultValue="Aravalli Power"><option>Aravalli Power</option><option>Dharini DISCOM</option></select></label><label>Install state<select defaultValue="Post-install"><option>Post-install</option><option>Pre-install</option></select></label><label>Observation code<select defaultValue="Display blank"><option>Display blank</option><option>Communication unavailable</option><option>Relay does not disconnect</option></select></label><label className="full">Original statement<textarea defaultValue="Display remained blank after supply was restored at site." /></label><div className="form-note full"><Eye size={16} /><span>The reporter is not asked to select a component, manufacturing cause, root cause or liability.</span></div></div>}{intakeStep === 1 && <div className="form-grid"><label>SAP return<input defaultValue="RTN-74003144" /></label><label>GRN<input defaultValue="GRN-260714-082" /></label><label>WMS batch<input defaultValue="FFR-B-260714-09" /></label><label>Physical location<input defaultValue="RECEIVING-03" /></label><label>Complaint date<input type="date" defaultValue="2026-07-11" /></label><label>Return date<input type="date" defaultValue="2026-07-14" /></label><div className="form-note full teal"><ShieldCheck size={16} /><span>Chain of custody will begin when the physical meter is scanned.</span></div></div>}{intakeStep === 2 && <div className="upload-stage"><Camera size={28} /><h3>External evidence package</h3><p>12 standard views required before cleaning or power application.</p><div className="upload-cards"><div><CheckCircle2 size={17} /><span>Complaint portal photo</span><strong>1 file</strong></div><div><ImageIcon size={17} /><span>Physical intake views</span><strong>0 / 12</strong></div><div><Network size={17} /><span>HES request</span><strong>Ready</strong></div></div><button className="button secondary" onClick={() => showToast("Synthetic upload area selected")}>Select demo files</button></div>}{intakeStep === 3 && <div className="readiness-summary"><div className="summary-icon"><ClipboardCheck size={28} /></div><h3>Ready with evidence exception</h3><p>The digital case can be created now. Physical intake images will be requested at receipt; diagnostic confidence will track missing evidence.</p><div className="summary-list"><span><CheckCircle2 size={16} />Mandatory complaint fields complete</span><span><CheckCircle2 size={16} />SAP return and GRN linked</span><span><CheckCircle2 size={16} />Initial identity sources agree</span><span className="pending-text"><Clock3 size={16} />Physical image set pending receipt</span></div></div>}</div><div className="wizard-footer"><button className="button ghost" disabled={intakeStep === 0} onClick={() => setIntakeStep(intakeStep - 1)}><ChevronLeft size={15} /> Back</button><span>Step {intakeStep + 1} of 4</span>{intakeStep < 3 ? <button className="button primary" onClick={() => setIntakeStep(intakeStep + 1)}>Continue <ChevronRight size={15} /></button> : <button className="button primary" onClick={() => { setIntakeOpen(false); setIntakeStep(0); showToast("Demo case FFR-2026-04811 created in the intake queue"); }}><Check size={15} /> Create demo case</button>}</div></div></div>}

      {toast && <div className="toast"><CheckCircle2 size={17} /><span>{toast}</span></div>}
    </div>
  );
}
