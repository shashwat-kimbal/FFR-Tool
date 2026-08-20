"use client";

import { CheckCircle2, XCircle, HelpCircle, Layers } from "lucide-react";
import type { EvidenceLedgerItem } from "../lib/verdict-engine";
import { Card, SectionHead } from "./ui";

interface EvidenceLedgerPanelProps {
  ledger: {
    supporting: EvidenceLedgerItem[];
    contradicting: EvidenceLedgerItem[];
    missingGaps: EvidenceLedgerItem[];
  };
}

export function EvidenceLedgerPanel({ ledger }: EvidenceLedgerPanelProps) {
  return (
    <Card className="evidence-ledger-panel">
      <SectionHead
        eyebrow="Part VII — Evidence Ledger"
        title="Abductive Evidence & Likelihood Ratios"
        description="Every fact contributes a Likelihood Ratio (LR) to candidate hypotheses. Contradiction reduces likelihood; missing evidence is neutral by construction."
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Supporting Evidence */}
        <div className="bg-emerald-50/60 border border-emerald-200 rounded-lg p-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-900 mb-3 flex items-center gap-1.5">
            <CheckCircle2 size={14} className="text-emerald-600" />
            Supporting Evidence ({ledger.supporting.length})
          </h4>
          <div className="space-y-2">
            {ledger.supporting.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No direct supporting evidence.</p>
            ) : (
              ledger.supporting.map((item) => (
                <div key={item.id} className="bg-white p-2.5 rounded border border-emerald-100 shadow-sm text-xs">
                  <div className="flex items-center justify-between font-semibold text-emerald-950 mb-1">
                    <span>{item.id}</span>
                    <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-mono">
                      +{item.likelihoodRatio.toFixed(1)}× LR
                    </span>
                  </div>
                  <p className="text-slate-600 leading-snug">{item.description}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Contradicting Evidence */}
        <div className="bg-rose-50/60 border border-rose-200 rounded-lg p-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-rose-900 mb-3 flex items-center gap-1.5">
            <XCircle size={14} className="text-rose-600" />
            Contradicting Evidence ({ledger.contradicting.length})
          </h4>
          <div className="space-y-2">
            {ledger.contradicting.length === 0 ? (
              <p className="text-xs text-slate-500 italic">Zero contradicting observations.</p>
            ) : (
              ledger.contradicting.map((item) => (
                <div key={item.id} className="bg-white p-2.5 rounded border border-rose-100 shadow-sm text-xs">
                  <div className="flex items-center justify-between font-semibold text-rose-950 mb-1">
                    <span>{item.id}</span>
                    <span className="bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded font-mono">
                      {item.likelihoodRatio.toFixed(2)}× LR
                    </span>
                  </div>
                  <p className="text-slate-600 leading-snug">{item.description}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Gaps / Missing Evidence */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-3 flex items-center gap-1.5">
            <HelpCircle size={14} className="text-slate-500" />
            Gaps / Unobserved Signatures ({ledger.missingGaps.length})
          </h4>
          <div className="space-y-2">
            {ledger.missingGaps.length === 0 ? (
              <p className="text-xs text-slate-500 italic">Signature completely observed.</p>
            ) : (
              ledger.missingGaps.map((item) => (
                <div key={item.id} className="bg-white p-2.5 rounded border border-slate-200 shadow-sm text-xs">
                  <div className="flex items-center justify-between font-semibold text-slate-800 mb-1">
                    <span>{item.id}</span>
                    <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">
                      1.0× LR (Neutral)
                    </span>
                  </div>
                  <p className="text-slate-500 leading-snug">{item.description}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
