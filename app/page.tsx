"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { Info, LockKeyhole, Upload, X } from "lucide-react";
import { ArtifactSummary, Card, SectionHead, Status, UploadStage } from "./components/ui";
import { classifyFfrCase, ffrValue, inspectFfrRegister } from "./lib/workbook-parser";
import { useSharedGovernance } from "./lib/use-shared-governance";
import type { FfrRegisterInspection } from "./lib/pilot-types";

type CaseListItem = {
  id: string;
  caseRef: string;
  productFamily: string | null;
  complaintLabel: string | null;
  createdAt: string;
  registerRow: { values: Record<string, string> };
};

export default function CasesDashboard() {
  const router = useRouter();
  const shared = useSharedGovernance();
  const { settings, governance } = shared;

  const [cases, setCases] = useState<CaseListItem[] | null>(null);
  const [register, setRegister] = useState<FfrRegisterInspection | null>(null);
  const [busy, setBusy] = useState<"ffr" | "creating" | null>(null);
  const [notice, setNotice] = useState("");
  const [intakeError, setIntakeError] = useState("");

  const sharedAnalysisReady =
    governance.mode === "ready" &&
    Boolean(governance.activeBundle && governance.activeProfile);
  const sharedAnalysisMessage = sharedAnalysisReady
    ? "Shared released configuration is ready for intake."
    : governance.mode === "loading"
      ? "Waiting for the shared released rule bundle and profile."
      : "A named administrator must configure and release the shared rule bundle before intake can start.";

  const loadCases = async () => {
    try {
      const response = await fetch("/api/cases", { cache: "no-store" });
      if (!response.ok) return;
      const payload = (await response.json()) as { cases?: CaseListItem[] };
      setCases(Array.isArray(payload.cases) ? payload.cases : []);
    } catch {
      setCases((current) => current ?? []);
    }
  };

  useEffect(() => {
    const bootstrap = async () => {
      await loadCases();
    };
    void bootstrap();
  }, []);

  const handleFfrUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!sharedAnalysisReady) {
      setIntakeError(`SHARED_CONFIGURATION_REQUIRED: ${sharedAnalysisMessage}`);
      return;
    }
    if (files.length !== 1) {
      setIntakeError(
        files.length > 1
          ? "MULTIPLE_FFR_REGISTERS: upload one FFR register at a time."
          : "MISSING_REQUIRED_WORKBOOK: choose the FFR register first.",
      );
      return;
    }
    setBusy("ffr");
    setIntakeError("");
    try {
      const inspection = await inspectFfrRegister(files[0], settings);
      setRegister(inspection);
      setNotice(
        "FFR register validated. Choose one case to open its persisted record.",
      );
    } catch (error) {
      setRegister(null);
      setIntakeError(
        error instanceof Error
          ? error.message
          : "UNRECOGNIZED_FILE: the FFR register could not be validated.",
      );
    } finally {
      setBusy(null);
    }
  };

  const chooseCase = async (rowNumber: number) => {
    if (!register) return;
    const row = register.rows.find((candidate) => candidate.rowNumber === rowNumber);
    if (!row) return;
    setBusy("creating");
    setIntakeError("");
    try {
      const caseInfo = classifyFfrCase(row, settings);
      const response = await fetch("/api/cases", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          caseRef: ffrValue(row, "S.No") || `row-${row.rowNumber}`,
          registerArtifactName: register.artifact.name,
          registerRowNumber: row.rowNumber,
          registerRow: row,
          oldMeterSerial: ffrValue(row, "Old_Meter_Number") || null,
          newMeterSerial: ffrValue(row, "New_Meter_Number") || null,
          productFamily: caseInfo.productFamily,
          complaintKey: caseInfo.complaintKey,
          complaintLabel: caseInfo.complaintLabel,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        case?: { id: string };
        message?: string;
      };
      if (!response.ok || !payload.case) {
        throw new Error(payload.message ?? "The case could not be created.");
      }
      router.push(`/cases/${payload.case.id}`);
    } catch (error) {
      setIntakeError(
        error instanceof Error ? error.message : "The case could not be created.",
      );
      setBusy(null);
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
              <Upload size={22} />
            </div>
            <div>
              <span className="eyebrow">Development proof of concept</span>
              <h1>FFR case register</h1>
              <p>
                Upload the FFR register, then choose one case to open its
                persisted record. Cases and their DLMS technical reports are
                saved to shared storage and can be reopened from this list.
              </p>
              <p className="helper-text">
                Deepu return-module enrichment is not connected in this build.
                The DLMS workbook itself is read directly, and its 60
                technical checks run even when the selected FFR meter does
                not match.
              </p>
            </div>
            <Status tone="warning">Provisional analysis</Status>
          </header>
          {!sharedAnalysisReady && (
            <div className="callout warning">
              <LockKeyhole size={19} />
              <div>
                <strong>Shared configuration required</strong>
                <p>{sharedAnalysisMessage}</p>
              </div>
            </div>
          )}
          {intakeError && (
            <div className="callout danger" role="alert">
              <Info size={19} />
              <div>
                <strong>Stopped.</strong>
                <p>{intakeError}</p>
              </div>
            </div>
          )}
          <Card>
            <SectionHead
              eyebrow="Cases"
              title={
                cases === null
                  ? "Loading cases…"
                  : `${cases.length} case${cases.length === 1 ? "" : "s"}`
              }
              description="Every meter has an independent, persisted FFR case. Reopen any case to see its register context and latest DLMS report."
            />
            {cases && cases.length === 0 && (
              <div className="empty-state">
                <Upload size={28} />
                <strong>No cases yet</strong>
                <span>Upload an FFR register below to create the first one.</span>
              </div>
            )}
            {cases && cases.length > 0 && (
              <div className="case-table-wrap">
                <table className="case-table">
                  <thead>
                    <tr>
                      <th>Case</th>
                      <th>Sub-division</th>
                      <th>Product mapping</th>
                      <th>Complaint</th>
                      <th>Created</th>
                      <th>
                        <span className="visually-hidden">Open</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {cases.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <strong>{item.caseRef}</strong>
                        </td>
                        <td>
                          {item.registerRow?.values?.SUB_DIVISION || "Not supplied"}
                        </td>
                        <td>{item.productFamily ?? "Unresolved"}</td>
                        <td>{item.complaintLabel ?? "Unclassified"}</td>
                        <td>{item.createdAt}</td>
                        <td>
                          <a className="button primary" href={`/cases/${item.id}`}>
                            Open case
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
          {!register && (
            <UploadStage
              title="Upload the FFR IG register"
              description="This multi-case register establishes the case, meter IDs, complaint, field observation, and source data to be mapped later."
              buttonText={
                busy === "ffr" ? "Reading FFR register…" : "Upload one FFR IG workbook"
              }
              accept=".xlsx,.xls"
              onChange={handleFfrUpload}
            />
          )}
          {register && (
            <Card className="stage-card">
              <SectionHead
                eyebrow="FFR register validated"
                title="Choose the FFR case to open"
                description="A register can contain several meters. Picking a row creates (or reopens) that case's persisted record."
                action={
                  <button
                    className="button secondary"
                    onClick={() => {
                      setRegister(null);
                      setIntakeError("");
                    }}
                  >
                    Upload a different register
                  </button>
                }
              />
              <div className="artifact-grid">
                <ArtifactSummary artifact={register.artifact} />
              </div>
              <div className="case-table-wrap">
                <table className="case-table">
                  <thead>
                    <tr>
                      <th>Case</th>
                      <th>Sub-division</th>
                      <th>Defective meter</th>
                      <th>Replacement meter</th>
                      <th>Complaint</th>
                      <th>Field observation</th>
                      <th>
                        <span className="visually-hidden">Select</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {register.rows.map((row) => (
                      <tr key={row.rowNumber}>
                        <td>
                          <strong>{ffrValue(row, "S.No") || `Row ${row.rowNumber}`}</strong>
                          <small>Excel row {row.rowNumber}</small>
                        </td>
                        <td>{ffrValue(row, "Sub-Division") || "Not supplied"}</td>
                        <td>{ffrValue(row, "Old_Meter_Number") || "Not supplied"}</td>
                        <td>{ffrValue(row, "New_Meter_Number") || "Not supplied"}</td>
                        <td>
                          <strong>{ffrValue(row, "Defect Trigger") || "Not supplied"}</strong>
                          <small>{ffrValue(row, "Symptoms of the problem New")}</small>
                        </td>
                        <td>{ffrValue(row, "Field Observation") || "Not supplied"}</td>
                        <td>
                          <button
                            className="button primary"
                            disabled={busy === "creating"}
                            onClick={() => void chooseCase(row.rowNumber)}
                          >
                            {busy === "creating" ? "Opening…" : "Choose case"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
