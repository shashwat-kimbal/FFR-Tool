"use client";

import React from "react";
import Link from "next/link";
import { AlertOctagon, RefreshCw, Edit3 } from "lucide-react";

interface StopStateProps {
  caseId: string;
  foundSerial: string;
  expectedOld: string;
  expectedNew?: string;
  filename?: string;
  sha256?: string;
}

export function StopState({
  caseId,
  foundSerial = "AS2373110",
  expectedOld = "AS2373952",
  expectedNew = "SC10231275",
  filename = "AS2373110_Reports_2026-06-30.xlsx",
  sha256 = "9b3ac41f0d4d5df289a74c2e6b8109d32fe4",
}: StopStateProps) {
  return (
    <div className="max-w-2xl mx-auto my-12 p-8 rounded-xl bg-red-950/20 border-2 border-red-800/80 shadow-2xl text-center space-y-6">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-red-900/40 text-red-400 border border-red-700/60 mb-2">
        <AlertOctagon size={32} />
      </div>

      <div className="space-y-2">
        <h2 className="text-xl font-bold text-red-300">
          ⛔ This report is for a different meter
        </h2>
        <p className="text-xs text-slate-400">
          DLMS identity serial mismatch detected. Technical analysis is halted to prevent incorrect root-cause attribution.
        </p>
      </div>

      <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-4 text-xs font-mono text-left space-y-2">
        <div className="flex justify-between border-b border-slate-800 pb-2">
          <span className="text-slate-500">Workbook contains:</span>
          <span className="text-red-400 font-bold">{foundSerial}</span>
        </div>
        <div className="flex justify-between border-b border-slate-800 pb-2">
          <span className="text-slate-500">Case {caseId} expects (old):</span>
          <span className="text-slate-200 font-bold">{expectedOld}</span>
        </div>
        {expectedNew && (
          <div className="flex justify-between border-b border-slate-800 pb-2">
            <span className="text-slate-500">Case {caseId} expects (new):</span>
            <span className="text-slate-300">{expectedNew}</span>
          </div>
        )}
        <div className="flex justify-between pt-1 text-[11px] text-slate-400">
          <span className="text-slate-500">File:</span>
          <span>{filename} · 1.2 MB · sha256 {sha256.substring(0, 10)}…</span>
        </div>
      </div>

      {/* Exactly Two Actions (§5.7) */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
        <a
          href={`/cases/${caseId}/evidence`}
          className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold shadow-lg shadow-red-600/30 transition-colors flex items-center justify-center gap-2"
        >
          <RefreshCw size={14} /> Attach the correct report
        </a>
        <button
          type="button"
          onClick={() => alert(`Prompt to correct meter serial on Case ${caseId}`)}
          className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors flex items-center justify-center gap-2"
        >
          <Edit3 size={14} /> Correct the serial on this case
        </button>
      </div>
    </div>
  );
}
