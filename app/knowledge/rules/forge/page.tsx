"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import ForgeClientView from "./forge-client";
import type { ForgeProposal } from "@/server/forge/agent.ts";

export default function RuleForgePage() {
  const searchParams = useSearchParams();
  const caseId = searchParams.get("caseId") || "13644";
  const series = searchParams.get("series") || "voltage";
  const fromTs = searchParams.get("from") || "1 Jun 00:00";
  const toTs = searchParams.get("to") || "6 Jun 00:00";

  const [proposal, setProposal] = useState<ForgeProposal | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/knowledge/forge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        caseId,
        series,
        fromTs,
        toTs,
        intentText: "power failures accelerating right before the log stops",
      }),
    })
      .then((res) => res.json())
      .then((d) => {
        setProposal(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [caseId, series, fromTs, toTs]);

  if (loading || !proposal) {
    return (
      <div className="space-y-4 animate-pulse p-4">
        <div className="h-16 bg-slate-900 rounded-xl border border-slate-800" />
        <div className="h-96 bg-slate-900 rounded-xl border border-slate-800" />
      </div>
    );
  }

  return (
    <ForgeClientView
      caseId={caseId}
      series={series}
      fromTs={fromTs}
      toTs={toTs}
      initialProposal={proposal}
    />
  );
}
