"use client";

import React from "react";

export type StatusValue = "open" | "evidence_ready" | "analysed" | "blocked" | "in_review" | "closed";

interface StatusPillProps {
  status: StatusValue | string;
  className?: string;
  detailed?: boolean;
}

export function StatusPill({ status, className = "", detailed = false }: StatusPillProps) {
  switch (status) {
    case "open":
      return (
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium text-slate-300 bg-slate-800 border border-slate-700 ${className}`}>
          <span className="w-1.5 h-1.5 rounded-full border border-slate-400 bg-transparent" />
          {detailed ? "○ Open · no evidence" : "○ Open"}
        </span>
      );
    case "evidence_ready":
      return (
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium text-sky-300 bg-sky-950/60 border border-sky-800/60 ${className}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
          {detailed ? "◐ Evidence ready · unanalysed" : "◐ Evidence ready"}
        </span>
      );
    case "analysed":
      return (
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium text-blue-300 bg-blue-950/70 border border-blue-700/60 ${className}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
          {detailed ? "● ANALYSED · draft verdict" : "● Analysed"}
        </span>
      );
    case "blocked":
      return (
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium text-red-300 bg-red-950/70 border border-red-800/60 ${className}`}>
          <span className="text-[10px]">⛔</span>
          {detailed ? "⛔ BLOCKED · mismatch/missing" : "⛔ Blocked"}
        </span>
      );
    case "in_review":
      return (
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium text-amber-300 bg-amber-950/60 border border-amber-700/60 ${className}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          {detailed ? "◑ In review · awaiting quality" : "◑ In review"}
        </span>
      );
    case "closed":
      return (
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium text-emerald-300 bg-emerald-950/60 border border-emerald-800/60 ${className}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          {detailed ? "✓ Closed · exported" : "✓ Closed"}
        </span>
      );
    default:
      return (
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium text-slate-400 bg-slate-800 border border-slate-700 ${className}`}>
          {status}
        </span>
      );
  }
}
