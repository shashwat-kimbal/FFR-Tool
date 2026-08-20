"use client";

import React, { useState, useEffect } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { CaseHeader } from "@/app/components/CaseHeader";
import { StopState } from "@/app/components/StopState";
import { AnalysisPipelineModal } from "@/app/components/AnalysisPipelineModal";
import type { CaseRow } from "@/server/store/db.ts";

export default function CaseLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();

  // Robust ID resolution from params or pathname
  const idFromParams = params?.id ? String(params.id) : "";
  const idFromPath = typeof window !== "undefined" ? window.location.pathname.split("/")[2] : "";
  const id = idFromParams || idFromPath;
  if (!id) return <div>Case not found</div>;

  const [caseData, setCaseData] = useState<CaseRow | null>(null);
  const [evidenceCount, setEvidenceCount] = useState(2);
  const [runsCount, setRunsCount] = useState(4);
  const [isStopState, setIsStopState] = useState(false);
  const [stopDetails, setStopDetails] = useState<any>(null);
  const [pipelineModalOpen, setPipelineModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchCase = async () => {
    if (!id || id === "undefined") return;
    try {
      const res = await fetch(`/api/cases/${id}`);
      if (res.ok) {
        const data = await res.json();
        setCaseData(data.case);
        setEvidenceCount(data.evidence?.length || 2);
        setRunsCount(data.runs?.length || 4);
        setIsStopState(data.isStopState || false);
        setStopDetails(data.stopStateDetails);
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    fetchCase();
  }, [id, pathname]);

  const handleRunAnalysis = () => {
    setPipelineModalOpen(true);
  };

  const handlePipelineComplete = (verdict: any) => {
    setPipelineModalOpen(false);
    fetchCase();
    router.push(`/cases/${id}/verdict`);
  };

  const handleAdjudicate = async (verdictType: "confirm" | "different" | "inconclusive", note?: string) => {
    try {
      await fetch(`/api/cases/${id}/adjudicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mechanismId: caseData?.leading_cause || "MECH-TERM-PROGRESSIVE",
          verdictType,
          note,
        }),
      });
      fetchCase();
    } catch {}
  };

  if (loading || !caseData) {
    return (
      <div className="space-y-4 animate-pulse p-4">
        <div className="h-24 bg-slate-900 rounded-xl border border-slate-800" />
        <div className="h-96 bg-slate-900 rounded-xl border border-slate-800" />
      </div>
    );
  }

  // Stop state replacement for Tabs A and B (§5.7)
  const isVerdictOrTimeline = pathname.endsWith("/verdict") || pathname.endsWith("/timeline");
  if (isStopState && isVerdictOrTimeline) {
    return (
      <div>
        <CaseHeader
          caseData={caseData}
          evidenceCount={evidenceCount}
          runsCount={runsCount}
          onRunAnalysis={handleRunAnalysis}
          onAdjudicate={handleAdjudicate}
        />
        <StopState
          caseId={id}
          foundSerial={stopDetails?.workbookSerial || "AS2373110"}
          expectedOld={caseData.meter_old}
          expectedNew={caseData.meter_new || "SC10231275"}
          filename={stopDetails?.filename}
          sha256={stopDetails?.sha256}
        />
      </div>
    );
  }

  return (
    <div>
      <CaseHeader
        caseData={caseData}
        evidenceCount={evidenceCount}
        runsCount={runsCount}
        onRunAnalysis={handleRunAnalysis}
        onAdjudicate={handleAdjudicate}
      />

      <div className="mt-4">{children}</div>

      <AnalysisPipelineModal
        isOpen={pipelineModalOpen}
        onClose={() => setPipelineModalOpen(false)}
        onComplete={handlePipelineComplete}
        caseId={id}
      />
    </div>
  );
}
