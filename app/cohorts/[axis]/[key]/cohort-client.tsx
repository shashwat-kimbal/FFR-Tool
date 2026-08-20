"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  GitFork,
  ChevronDown,
  ShieldAlert,
} from "lucide-react";
import { StatusPill } from "@/app/components/StatusPill";
import { VoltageSparkline } from "@/app/components/VoltageSparkline";
import { ConfidenceDials } from "@/app/components/ConfidenceDials";
import type { CohortAnalysisResult } from "@/server/cohorts/cohort-service.ts";

interface CohortClientViewProps {
  axis: string;
  cohortKey: string;
  initialAnalysis: CohortAnalysisResult;
}

export default function CohortClientView({
  axis,
  cohortKey,
  initialAnalysis,
}: CohortClientViewProps) {
  const router = useRouter();
  const [data] = useState<CohortAnalysisResult>(initialAnalysis);
  const [axisMenuOpen, setAxisMenuOpen] = useState(false);

  const distribution = data.distribution || [];
  const cases = data.cases || [];
  const availableAxes = data.availableAxes || [];

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Header (64px) with Axis Switcher (§6) */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <GitFork size={20} className="text-blue-400" />
            Cohort · {axis.charAt(0).toUpperCase() + axis.slice(1)} {cohortKey}
            <span className="text-xs font-mono font-normal text-slate-400">
              ({data.totalReturns} returns)
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            A single case proposes; only the cohort confirms. Separates grid stress from manufacturing defects.
          </p>
        </div>

        {/* Change Axis Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setAxisMenuOpen(!axisMenuOpen)}
            className="btn btn-secondary"
          >
            Change axis ▾
          </button>

          {axisMenuOpen && (
            <div className="absolute right-0 top-full mt-2 w-64 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl p-3 z-50 text-xs text-slate-200 space-y-2">
              <div className="text-[10px] font-bold text-slate-400 uppercase px-1">
                Select Cohort Dimension
              </div>
              {availableAxes.map((ax) => (
                <div key={ax.id} className="space-y-1">
                  <div className="text-[11px] font-semibold text-blue-300 px-1">{ax.label}</div>
                  <div className="grid grid-cols-2 gap-1">
                    {ax.keys.map((k) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => {
                          setAxisMenuOpen(false);
                          router.push(`/cohorts/${ax.id}/${encodeURIComponent(k)}`);
                        }}
                        className={`text-left px-2 py-1 rounded text-[11px] truncate ${
                          axis === ax.id && cohortKey === k
                            ? "bg-blue-600 text-white font-bold"
                            : "hover:bg-slate-800 text-slate-300"
                        }`}
                      >
                        {k}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Mechanism Distribution vs Baseline (§6) */}
      <div className="verdict-section space-y-4">
        <div className="flex items-center justify-between text-[11px] font-bold tracking-wider text-slate-400 uppercase">
          <span>MECHANISM DISTRIBUTION</span>
          <span>vs BASELINE</span>
        </div>

        <div className="space-y-3">
          {distribution.map((item) => {
            const isElevated = item.multiplier >= 2.0;

            return (
              <div key={item.name} className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-200">{item.name}</span>
                    <span className="font-mono text-slate-400">({item.count})</span>
                  </div>

                  <div className="flex items-center gap-4 font-mono">
                    <span className="font-bold text-slate-100">{item.percentage}%</span>
                    <span className="text-slate-500">baseline {item.baselinePercentage}%</span>
                    <span className={`w-14 text-right font-bold ${isElevated ? "text-amber-400" : "text-slate-400"}`}>
                      {isElevated ? `▲ ${item.multiplier}×` : "▼"}
                    </span>
                  </div>
                </div>

                <div className="w-full h-3 rounded-full bg-slate-950 border border-slate-800 overflow-hidden flex items-center">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isElevated ? "bg-amber-500" : "bg-blue-600"
                    }`}
                    style={{ width: `${Math.min(100, item.percentage)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Insight Callout Banner & CAPA Action (§6) */}
      {data.capaTriggered && (
        <div className="p-4 rounded-xl bg-gradient-to-r from-amber-950/40 to-slate-900 border border-amber-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-900/50 text-amber-300">
              <ShieldAlert size={22} />
            </div>
            <div>
              <div className="text-xs font-bold text-amber-200 flex items-center gap-1.5">
                <span>⚑ {data.capaNotice}</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Population spike confirmed on feeder {cohortKey}. Potentially related — not confirmed until human review.
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => alert(`CAPA Notice raised for Feeder ${cohortKey}`)}
            className="btn btn-sm bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold whitespace-nowrap"
          >
            Raise CAPA
          </button>
        </div>
      )}

      {/* Cohort Cases Table (Same 11 columns as Queue table) */}
      <div className="table-container">
        <div className="p-3.5 bg-slate-950 border-b border-slate-800 text-xs font-semibold text-slate-200">
          Cases in this cohort ({cases.length})
        </div>

        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th className="w-20">CASE</th>
                <th className="w-28">METER</th>
                <th className="w-40">COMPLAINT</th>
                <th className="w-28">VOLTAGE</th>
                <th>LEADING CAUSE</th>
                <th className="w-20">CONF</th>
                <th className="w-28">STATUS</th>
                <th className="w-16 text-right">AGE</th>
              </tr>
            </thead>
            <tbody>
              {cases.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => router.push(`/cases/${c.id}/verdict`)}
                  className="cursor-pointer"
                >
                  <td className="font-mono font-bold text-slate-100">
                    {c.case_ref}
                  </td>
                  <td className="font-mono text-slate-300">
                    {c.meter_old}
                  </td>
                  <td className="text-slate-300 truncate max-w-[160px]">
                    {c.complaint_label}
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <VoltageSparkline
                      pointsJson={c.sparkline_points_json}
                      summaryJson={c.sparkline_summary_json}
                    />
                  </td>
                  <td>
                    <span className="font-medium text-slate-200">{c.leading_cause || "—"}</span>
                  </td>
                  <td>
                    <ConfidenceDials
                      completeness={c.confidence_completeness}
                      discrimination={c.confidence_discrimination}
                      provenance={c.confidence_provenance}
                      cohort={c.confidence_cohort}
                      compact
                    />
                  </td>
                  <td>
                    <StatusPill status={c.status} />
                  </td>
                  <td className="text-right font-mono text-slate-400">
                    {c.age_days}d
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
