"use client";

import React, { useState } from "react";
import Link from "next/link";
import { BookOpen } from "lucide-react";

interface MechanismsClientViewProps {
  initialMechanisms: any[];
}

export default function MechanismsClientView({
  initialMechanisms,
}: MechanismsClientViewProps) {
  const [mechanisms] = useState<any[]>(initialMechanisms);
  const [selectedId, setSelectedId] = useState<string>("MECH-TERM-PROGRESSIVE");

  const selectedMech = mechanisms.find((m) => m.id === selectedId) || mechanisms[0];

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Knowledge Subnav Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <BookOpen size={20} className="text-blue-400" />
            Knowledge Base
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Physical failure modes and diagnostic rules owned by domain engineers.
          </p>
        </div>

        {/* Subnav links */}
        <div className="flex items-center gap-2 bg-slate-900 p-1 rounded-lg border border-slate-800 text-xs">
          <Link
            href="/knowledge/mechanisms"
            className="px-3 py-1.5 rounded-md font-semibold bg-blue-600 text-white"
          >
            Mechanisms ({mechanisms.length})
          </Link>
          <Link
            href="/knowledge/rules"
            className="px-3 py-1.5 rounded-md font-medium text-slate-400 hover:text-white"
          >
            Rules (60)
          </Link>
          <Link
            href="/knowledge/rules/forge"
            className="px-3 py-1.5 rounded-md font-medium text-slate-400 hover:text-white"
          >
            Rule Forge
          </Link>
        </div>
      </div>

      {/* 2-Column Layout: Mechanism List + Sticky YAML/Spec Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Mechanisms List (5 cols) */}
        <div className="lg:col-span-5 space-y-2">
          {mechanisms.map((m) => {
            const isSelected = m.id === selectedId;

            return (
              <div
                key={m.id}
                onClick={() => setSelectedId(m.id)}
                className={`p-4 rounded-xl border transition-all cursor-pointer space-y-2 ${
                  isSelected
                    ? "bg-blue-950 border-blue-500 shadow-lg shadow-blue-950"
                    : "bg-slate-900 border-slate-800 hover:border-slate-700"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] text-blue-400 font-bold">{m.id}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-slate-800 text-slate-300">
                    {m.family}
                  </span>
                </div>

                <div className="font-semibold text-sm text-slate-100">{m.name}</div>

                <div className="text-[11px] font-mono text-slate-400 border-t border-slate-800 pt-2 flex items-center justify-between">
                  <span>used in {m.metrics?.usedInRuns || 214} runs</span>
                  <span>leading in {m.metrics?.leadingInRuns || 61}</span>
                  <span className="text-emerald-400 font-semibold">{m.metrics?.accuracyPct || 85}% acc</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Column: Sticky Detail Spec View (7 cols) */}
        {selectedMech && (
          <div className="lg:col-span-7 sticky top-20 bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-2xl space-y-5">
            <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <div className="font-mono text-xs text-blue-400 font-bold mb-1">
                  {selectedMech.id} · [ {selectedMech.family.toUpperCase()} ]
                </div>
                <h2 className="text-lg font-bold text-white">{selectedMech.name}</h2>
              </div>
            </div>

            {/* Metrics Ribbon */}
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-xs text-slate-300 flex items-center justify-between">
              <span>used in <strong>214</strong> runs</span>
              <span>·</span>
              <span>leading in <strong>{selectedMech.metrics?.leadingInRuns || 61}</strong></span>
              <span>·</span>
              <span>adjudicated correct in <strong>{selectedMech.metrics?.adjudicatedCorrect || 52}</strong> (85%)</span>
            </div>

            {/* Narrative */}
            <div className="space-y-1">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Physical Failure Narrative
              </div>
              <p className="text-xs text-slate-300 leading-relaxed bg-slate-950 p-3.5 rounded-lg border border-slate-800">
                {selectedMech.narrative}
              </p>
            </div>

            {/* Signature: Requires, Supports, Contradicts, Disqualifiers */}
            <div className="space-y-2 text-xs">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Signature Pattern Matrix
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                  <div className="font-semibold text-emerald-400 text-[11px]">Requires (Absence weakens)</div>
                  {selectedMech.signature?.requires.map((r: string) => (
                    <div key={r} className="font-mono text-[10px] text-slate-300">+ {r}</div>
                  ))}
                </div>
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                  <div className="font-semibold text-blue-400 text-[11px]">Supports (Increases LR)</div>
                  {selectedMech.signature?.supports.map((s: string) => (
                    <div key={s} className="font-mono text-[10px] text-slate-300">+ {s}</div>
                  ))}
                </div>
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                  <div className="font-semibold text-amber-400 text-[11px]">Contradicts (Decreases LR)</div>
                  {selectedMech.signature?.contradicts.map((c: string) => (
                    <div key={c} className="font-mono text-[10px] text-slate-300">- {c}</div>
                  ))}
                </div>
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                  <div className="font-semibold text-red-400 text-[11px]">Disqualifiers (Zero odds)</div>
                  {selectedMech.signature?.disqualifiers.map((d: string) => (
                    <div key={d} className="font-mono text-[10px] text-slate-300">✕ {d}</div>
                  ))}
                </div>
              </div>
            </div>

            {/* Confirmations & Routes */}
            <div className="space-y-2 text-xs border-t border-slate-800 pt-3">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Laboratory Confirmations & Routes
              </div>
              <div className="space-y-1.5 font-mono text-[11px] text-slate-300">
                <div><strong>Visual:</strong> {selectedMech.confirmations?.visual}</div>
                <div><strong>Bench:</strong> {selectedMech.confirmations?.bench}</div>
                <div className="text-blue-400 pt-1">
                  <strong>Warranty:</strong> {selectedMech.routes?.warranty} · <strong>CAPA:</strong> {selectedMech.routes?.capaTrigger ? "Yes" : "None"} · <strong>Cohort:</strong> {selectedMech.routes?.cohortQuery}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
