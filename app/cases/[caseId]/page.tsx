"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { useParams } from "next/navigation";
import {
  AlertTriangle,
  BookOpenCheck,
  CheckCircle2,
  ClipboardList,
  Info,
  X,
} from "lucide-react";
import { ArtifactSummary, Card, SectionHead, Status, UploadStage } from "../../components/ui";
import { CaseDetailsList } from "../../components/case-details";
import { DlmsFindingsPanel, type FindingFilter } from "../../components/dlms-findings";
import { inspectDlmsWorkbook, inspectImageEvidence } from "../../lib/workbook-parser";
import { useSharedGovernance } from "../../lib/use-shared-governance";
import type { DlmsAnalysis } from "../../lib/dlms-analysis";
import type { ImageInspection } from "../../lib/pilot-types";

type MeterRole = "old" | "new";

type CaseRecord = {
  id: string;
  caseRef: string;
  registerRow: { rowNumber: number; values: Record<string, string>; labels: Record<string, string> };
  productFamily: string | null;
  complaintKey: string | null;
  complaintLabel: string | null;
};

type DlmsReportView = {
  id: string;
  meterId: string | null;
  expectedMeterId: string;
  identityState: string;
  artifact: Record<string, unknown>;
  features: unknown[];
  messages: string[];
  analysis: DlmsAnalysis | null;
};

type CaseMeterView = {
  role: MeterRole;
  meterSerial: string | null;
  latestReport: DlmsReportView | null;
};

type CaseResponse = { case: CaseRecord; meters: CaseMeterView[] };

const meterRoleMeta: Record<MeterRole, { title: string; description: string }> = {
  old: {
    title: "Defective / old meter",
    description: "Use when the returned failed meter is the evidence subject.",
  },
  new: {
    title: "Replacement / new meter",
    description: "Use when evidence relates to the installed replacement meter.",
  },
};

export default function CaseDetailPage() {
  const params = useParams<{ caseId: string }>();
  const caseId = params?.caseId ?? "";
  const shared = useSharedGovernance();
  const { settings, profile, bundle, sharedAdapters, governance } = shared;

  const [caseData, setCaseData] = useState<CaseResponse | null>(null);
  const [loadError, setLoadError] = useState("");
  const [selectedRole, setSelectedRole] = useState<MeterRole>("old");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [intakeError, setIntakeError] = useState("");
  const [findingFilter, setFindingFilter] = useState<FindingFilter>("all");
  const [lastUploadedFile, setLastUploadedFile] = useState<File | null>(null);
  const [images, setImages] = useState<ImageInspection | null>(null);
  const [imagesBusy, setImagesBusy] = useState(false);

  const loadCase = async () => {
    try {
      const response = await fetch(`/api/cases/${caseId}`, { cache: "no-store" });
      if (!response.ok) {
        setLoadError(
          response.status === 404
            ? "This case was not found. It may have been created in a different environment."
            : "The case could not be loaded.",
        );
        return;
      }
      const payload = (await response.json()) as CaseResponse;
      setCaseData(payload);
      setLoadError("");
    } catch {
      setLoadError("The case could not be loaded.");
    }
  };

  useEffect(() => {
    const bootstrap = async () => {
      if (caseId) await loadCase();
    };
    void bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

  if (loadError) {
    return (
      <>
        <header className="topbar">
          <div>
            <span>Private pilot workspace</span>
            <strong>Staged evidence and governed rules</strong>
          </div>
        </header>
        <div className="content">
          <div className="callout danger" role="alert">
            <AlertTriangle size={19} />
            <div>
              <strong>Case unavailable.</strong>
              <p>{loadError}</p>
            </div>
          </div>
          <a className="button secondary" href="/">
            Back to cases
          </a>
        </div>
      </>
    );
  }

  if (!caseData) {
    return (
      <>
        <header className="topbar">
          <div>
            <span>Private pilot workspace</span>
            <strong>Staged evidence and governed rules</strong>
          </div>
        </header>
        <div className="content">
          <p>Loading case…</p>
        </div>
      </>
    );
  }

  const { case: caseRecord, meters } = caseData;
  const selectedMeter = meters.find((meter) => meter.role === selectedRole) ?? null;
  const selectedMeterId = selectedMeter?.meterSerial ?? "";
  const latestReport = selectedMeter?.latestReport ?? null;
  const identityValid = latestReport?.identityState === "READY_TO_ANALYZE";
  const row = { ...caseRecord.registerRow };

  const chooseMeterRole = (role: MeterRole) => {
    setSelectedRole(role);
    setIntakeError("");
    setLastUploadedFile(null);
  };

  const uploadDlms = async (file: File) => {
    if (!selectedMeterId) return;
    setBusy(true);
    setIntakeError("");
    try {
      const adapterMapping = caseRecord.productFamily
        ? (settings.adapterMappings.find(
            (mapping) => mapping.productFamily === caseRecord.productFamily,
          ) ?? null)
        : null;
      const adapter = sharedAdapters[adapterMapping?.adapterId ?? bundle.adapterId];
      const inspection = await inspectDlmsWorkbook(
        file,
        selectedMeterId,
        settings,
        profile,
        bundle,
        {
          productFamily: caseRecord.productFamily as "METER" | "NIC" | "GATEWAY" | null,
          complaintKey: caseRecord.complaintKey,
          adapter,
          dedicatedAdapterConfigured: Boolean(
            adapter && adapterMapping?.evidenceMode === "direct",
          ),
        },
      );
      setLastUploadedFile(file);
      setNotice(inspection.messages[0]);
      const response = await fetch(`/api/cases/${caseId}/dlms`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          meterRole: selectedRole,
          meterId: inspection.meterId,
          expectedMeterId: selectedMeterId,
          identityState: inspection.identityState,
          artifact: inspection.artifact,
          features: inspection.features,
          messages: inspection.messages,
          analysis: inspection.analysis ?? null,
          bundleId: governance.activeBundle?.bundleId ?? null,
          bundleVersion: governance.activeBundle?.version ?? null,
          profileKey:
            governance.activeProfile?.profileKey ?? inspection.analysis?.profile.id ?? null,
          profileVersion: governance.activeProfile?.version ?? null,
          adapterKey: inspection.analysis?.adapter.id ?? null,
          adapterVersion: 1,
        }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(payload.message ?? "The DLMS report could not be saved.");
      }
      await loadCase();
    } catch (error) {
      setIntakeError(
        error instanceof Error
          ? error.message
          : "UNRECOGNIZED_FILE: the DLMS workbook could not be validated.",
      );
    } finally {
      setBusy(false);
    }
  };

  const handleDlmsUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length !== 1) {
      setIntakeError(
        files.length > 1
          ? "MULTIPLE_DLMS_PACKAGES: upload one DLMS workbook for the selected meter."
          : "MISSING_REQUIRED_WORKBOOK: choose the matching DLMS workbook.",
      );
      return;
    }
    await uploadDlms(files[0]);
  };

  const rerunAnalysis = async () => {
    if (!lastUploadedFile) return;
    await uploadDlms(lastUploadedFile);
  };

  const handleImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    setImagesBusy(true);
    try {
      const inspection = await inspectImageEvidence(files, settings);
      setImages(inspection);
      setNotice(
        inspection.messages[0] ??
          `${inspection.artifacts.filter((artifact) => artifact.kind === "IMAGE").length} image file(s) were bound to this case.`,
      );
      if (settings.retentionDays > 0) {
        await Promise.all(
          files.map((file) =>
            fetch("/api/governance/evidence", {
              method: "POST",
              headers: {
                "content-type": file.type || "application/octet-stream",
                "x-case-ref": caseRecord.caseRef,
              },
              body: file,
            }).catch(() => null),
          ),
        );
      }
    } finally {
      setImagesBusy(false);
    }
  };

  return (
    <>
      <header className="topbar">
        <div>
          <span>Private pilot workspace</span>
          <strong>Staged evidence and governed rules</strong>
        </div>
        <div className="topbar-status">
          <Status tone={governance.mode === "ready" ? "good" : "warning"}>
            {governance.mode === "ready" ? "Shared configuration" : "Governance setup"}
          </Status>
        </div>
      </header>
      <div className="content">
        {notice && (
          <div className="notice" aria-live="polite">
            <Info size={16} />
            <span>{notice}</span>
            <button aria-label="Dismiss notification" onClick={() => setNotice("")}>
              <X size={15} />
            </button>
          </div>
        )}
        <div className="page-stack">
          <header className="page-header">
            <div className="page-symbol">
              <ClipboardList size={22} />
            </div>
            <div>
              <span className="eyebrow">Persisted FFR case</span>
              <h1>Case {caseRecord.caseRef}</h1>
              <p>
                Register context, meter identity, and the latest DLMS technical
                report for this case — reloaded from shared storage, not
                browser memory.
              </p>
            </div>
            <a className="button secondary" href="/">
              Back to cases
            </a>
          </header>
          {intakeError && (
            <div className="callout danger" role="alert">
              <AlertTriangle size={19} />
              <div>
                <strong>Upload stopped.</strong>
                <p>{intakeError}</p>
              </div>
            </div>
          )}
          <Card className="case-card">
            <SectionHead
              eyebrow="Register context"
              title={`Case ${caseRecord.caseRef}`}
              description="FFR values are source context. Existing RCA/CAPA cells are never treated as approved conclusions."
            />
            <div className="case-summary">
              <div>
                <span>Product mapping</span>
                <strong>{caseRecord.productFamily ?? "Unresolved — add a shared mapping"}</strong>
              </div>
              <div>
                <span>Complaint mapping</span>
                <strong>{caseRecord.complaintLabel ?? "Unclassified"}</strong>
              </div>
            </div>
            <CaseDetailsList row={row} />
          </Card>
          <Card className="stage-card">
            <SectionHead
              eyebrow="Evidence target"
              title="Which meter are you uploading evidence for?"
              description="This choice controls the exact DLMS identity gate."
            />
            <div className="meter-role-grid">
              {meters.map((meter) => (
                <button
                  key={meter.role}
                  className={selectedRole === meter.role ? "meter-role selected" : "meter-role"}
                  onClick={() => chooseMeterRole(meter.role)}
                  disabled={!meter.meterSerial}
                >
                  <span>
                    <strong>{meterRoleMeta[meter.role].title}</strong>
                    <small>{meterRoleMeta[meter.role].description}</small>
                  </span>
                  <b>{meter.meterSerial || "No meter number supplied"}</b>
                  {selectedRole === meter.role && <CheckCircle2 size={18} />}
                </button>
              ))}
            </div>
          </Card>
          <UploadStage
            title="Upload the matching BCS / DLMS workbook"
            description="The technical 60-check report runs immediately and is saved to this case. Exact identity still decides whether any finding can be linked to it."
            buttonText={busy ? "Reading DLMS report…" : "Upload one BCS / DLMS workbook"}
            accept=".xlsx,.xls"
            disabled={!selectedMeterId || busy}
            onChange={handleDlmsUpload}
          />
          {latestReport && (
            <div className={identityValid ? "callout good" : "callout danger"}>
              {identityValid ? <CheckCircle2 size={19} /> : <AlertTriangle size={19} />}
              <div>
                <strong>
                  {identityValid
                    ? "Exact meter identity confirmed"
                    : "IDENTITY_NO_MATCH — case-level analysis is blocked"}
                </strong>
                <p>{latestReport.messages[0]}</p>
              </div>
            </div>
          )}
          {latestReport?.analysis && (
            <DlmsFindingsPanel
              analysis={latestReport.analysis}
              findingFilter={findingFilter}
              setFindingFilter={setFindingFilter}
              onRerun={lastUploadedFile ? rerunAnalysis : undefined}
              rerunDisabled={busy}
            />
          )}
          {latestReport?.artifact && (
            <div className="artifact-grid">
              <ArtifactSummary
                artifact={
                  latestReport.artifact as unknown as import("../../lib/pilot-types").UploadedArtifact
                }
              />
            </div>
          )}
          {latestReport && (
            <UploadStage
              title={
                identityValid
                  ? "Upload meter images"
                  : "Upload image evidence as unassigned context"
              }
              description={
                identityValid
                  ? "Images remain separately attached evidence. This build validates the files but does not fabricate visual findings."
                  : "You may preserve image evidence after an identity mismatch, but it remains unassigned and cannot support a customer-case conclusion until the exact meter identity is corrected."
              }
              buttonText={
                imagesBusy ? "Checking image evidence…" : "Attach meter images"
              }
              accept=".png,.jpg,.jpeg,.webp"
              multiple
              onChange={handleImageUpload}
            >
              {images && (
                <div className="artifact-grid">
                  {images.artifacts.map((artifact) => (
                    <ArtifactSummary key={artifact.id} artifact={artifact} />
                  ))}
                </div>
              )}
            </UploadStage>
          )}
          {latestReport && (
            <Card>
              <SectionHead
                eyebrow="Case rule gate"
                title={
                  identityValid && caseRecord.productFamily
                    ? "Case context is eligible for provisional interpretation"
                    : "Case-specific interpretation remains blocked"
                }
                description={
                  identityValid && caseRecord.productFamily
                    ? `The current selected case is mapped to ${caseRecord.productFamily}. The same shared bundle is filtered by its family/complaint scopes when a governed run is released.`
                    : "The technical report above remains useful, but it cannot be assigned to a customer case, RCA, CAPA, or workbook output yet."
                }
                action={
                  <a className="button secondary" href="/rules">
                    <BookOpenCheck size={15} /> Review 60 checks
                  </a>
                }
              />
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
