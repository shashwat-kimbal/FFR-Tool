"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import CohortClientView from "./cohort-client";
import type { CohortAnalysisResult } from "@/server/cohorts/cohort-service.ts";

export default function CohortDetailPage() {
  const params = useParams();
  const pathParts = typeof window !== "undefined" ? window.location.pathname.split("/") : [];
  const axis = (params?.axis ? String(params.axis) : "") || pathParts[2] || "feeder";
  const key = (params?.key ? String(params.key) : "") || pathParts[3] || "Lakhipur_bec";

  const [analysis, setAnalysis] = useState<CohortAnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/cohorts/${axis}/${encodeURIComponent(key)}`)
      .then((res) => res.json())
      .then((data) => {
        setAnalysis(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [axis, key]);

  if (loading || !analysis) {
    return (
      <div className="space-y-4 animate-pulse p-4">
        <div className="h-20 bg-slate-900 rounded-xl border border-slate-800" />
        <div className="h-72 bg-slate-900 rounded-xl border border-slate-800" />
      </div>
    );
  }

  return (
    <CohortClientView
      axis={axis}
      cohortKey={key}
      initialAnalysis={analysis}
    />
  );
}
