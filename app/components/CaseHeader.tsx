"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronDown, Check, AlertCircle, FileText, Download } from "lucide-react";
import { StatusPill } from "./StatusPill";
import type { CaseRow } from "@/server/store/db.ts";

interface CaseHeaderProps {
  caseData: CaseRow;
  evidenceCount?: number;
  runsCount?: number;
  onRunAnalysis?: () => void;
  onAdjudicate?: (verdictType: "confirm" | "different" | "inconclusive", note?: string) => void;
  onExportPdf?: () => void;
  onExportFfrIg?: () => void;
  isAnalyzing?: boolean;
}

export function CaseHeader({
  caseData,
  evidenceCount = 2,
  runsCount = 4,
  onRunAnalysis,
  onAdjudicate,
  onExportPdf,
  onExportFfrIg,
  isAnalyzing = false,
}: CaseHeaderProps) {
  const pathname = usePathname();
  const [adjudicateMenuOpen, setAdjudicateMenuOpen] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [showAdjModal, setShowAdjModal] = useState<"confirm" | "different" | "inconclusive" | null>(null);
  const [adjNote, setAdjNote] = useState("");

  const id = caseData.id;

  const tabs = [
    { label: "Verdict", href: `/cases/${id}/verdict` },
    { label: "Timeline", href: `/cases/${id}/timeline` },
    { label: `Evidence ${evidenceCount}`, href: `/cases/${id}/evidence` },
    { label: `Runs ${runsCount}`, href: `/cases/${id}/runs` },
    { label: "Report", href: `/cases/${id}/report` },
  ];

  const handleConfirmAdjudication = () => {
    if (showAdjModal && onAdjudicate) {
      onAdjudicate(showAdjModal, adjNote);
    }
    setShowAdjModal(null);
    setAdjNote("");
    setAdjudicateMenuOpen(false);
  };

  return (
    <div className="sticky top-0 z-30 bg-[#0b1120]/95 backdrop-blur-md border-b border-slate-800 shadow-xl -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 pt-3 pb-0 mb-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3">
        {/* Left: Identity & Sublines */}
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <Link
              href="/queue"
              className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors"
            >
              <ChevronLeft size={14} /> Queue
            </Link>
            <span className="font-mono text-lg font-bold text-white tracking-tight">
              {caseData.case_ref}
            </span>
            <StatusPill status={caseData.status} detailed />
          </div>

          <div className="text-xs text-slate-300 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="font-mono font-medium text-slate-100">{caseData.meter_old}</span>
            <span className="text-slate-500">→</span>
            <span className="font-mono text-slate-400">{caseData.meter_new || "SC10231275"}</span>
            <span className="text-slate-600">·</span>
            <span>{caseData.complaint_label || "METER:B Meter burnt"}</span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-400 font-medium">{caseData.sub_division}</span>
          </div>

          <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-x-2">
            <span>died 5 Jun 18:30</span>
            <span className="text-slate-600">·</span>
            <span>reported {caseData.defect_date || "16 Jun"}</span>
            <span className="text-slate-600">·</span>
            <span className="text-amber-400 font-medium">11-day lag</span>
            <span className="text-slate-600">·</span>
            <span>{caseData.age_days || 76} days old</span>
          </div>
        </div>

        {/* Right: Primary Action depending on status */}
        <div className="flex items-center gap-3 relative">
          {caseData.status === "open" && (
            <Link
              href={`/cases/${id}/evidence`}
              className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-600/30 transition-colors"
            >
              Attach evidence
            </Link>
          )}

          {caseData.status === "evidence_ready" && (
            <button
              type="button"
              onClick={onRunAnalysis}
              disabled={isAnalyzing}
              className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-600/30 transition-colors cursor-pointer disabled:opacity-50"
            >
              {isAnalyzing ? "Running pipeline…" : "Run analysis"}
            </button>
          )}

          {caseData.status === "blocked" && (
            <Link
              href={`/cases/${id}/evidence`}
              className="px-4 py-2 rounded-md bg-red-700 hover:bg-red-600 text-white text-xs font-semibold shadow-md shadow-red-700/30 transition-colors"
            >
              Resolve stop state
            </Link>
          )}

          {caseData.status === "analysed" && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setAdjudicateMenuOpen(!adjudicateMenuOpen)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-600/30 transition-colors cursor-pointer"
              >
                Adjudicate <ChevronDown size={14} />
              </button>

              {adjudicateMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 rounded-lg bg-slate-900 border border-slate-700 shadow-2xl p-1.5 z-50 text-xs text-slate-200 animate-in fade-in zoom-in-95">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAdjModal("confirm");
                      setAdjudicateMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded hover:bg-slate-800 flex items-center justify-between text-emerald-400 font-medium"
                  >
                    Confirm leading cause <Check size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAdjModal("different");
                      setAdjudicateMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded hover:bg-slate-800 text-slate-200"
                  >
                    Choose different mechanism…
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAdjModal("inconclusive");
                      setAdjudicateMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded hover:bg-slate-800 text-slate-400"
                  >
                    Mark inconclusive
                  </button>
                </div>
              )}
            </div>
          )}

          {(caseData.status === "in_review" || caseData.status === "closed") && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setExportMenuOpen(!exportMenuOpen)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors cursor-pointer"
              >
                <Download size={14} /> Export <ChevronDown size={14} />
              </button>

              {exportMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-48 rounded-lg bg-slate-900 border border-slate-700 shadow-2xl p-1.5 z-50 text-xs text-slate-200 animate-in fade-in zoom-in-95">
                  <button
                    type="button"
                    onClick={() => {
                      if (onExportFfrIg) onExportFfrIg();
                      setExportMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded hover:bg-slate-800 text-slate-200"
                  >
                    Export FFR IG
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (onExportPdf) onExportPdf();
                      setExportMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded hover:bg-slate-800 text-slate-200"
                  >
                    Export PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      alert("Sent RCA Report to Quality Engineering Team.");
                      setExportMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded hover:bg-slate-800 text-blue-400 font-medium border-t border-slate-800 mt-1 pt-2"
                  >
                    Send to quality →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Tabs Row */}
      <div className="flex items-center gap-1 border-t border-slate-800/80 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8">
        {tabs.map((t) => {
          const isActive = pathname.startsWith(t.href);
          return (
            <Link
              key={t.label}
              href={t.href}
              className={`py-2.5 px-4 text-xs font-medium border-b-2 transition-colors ${
                isActive
                  ? "border-blue-500 text-blue-400 font-semibold bg-blue-950/20"
                  : "border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      {/* Adjudication Modal Dialog */}
      {showAdjModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-xl p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white">
              {showAdjModal === "confirm"
                ? "Confirm Leading Cause"
                : showAdjModal === "different"
                ? "Select Physical Mechanism"
                : "Mark Inconclusive"}
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              {showAdjModal === "confirm"
                ? `Confirming "${caseData.leading_cause || "Progressive supply-terminal degradation"}" as the adjudicated ground truth. This adjudication joins the backtest corpus.`
                : "Record expert adjudication notes."}
            </p>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Adjudication note (optional)
              </label>
              <textarea
                value={adjNote}
                onChange={(e) => setAdjNote(e.target.value)}
                placeholder="Add visual or bench test confirmation findings…"
                className="w-full h-20 p-2.5 rounded bg-slate-950 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowAdjModal(null)}
                className="px-3.5 py-1.5 rounded text-xs font-medium text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAdjudication}
                className="px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold"
              >
                Confirm Adjudication
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
