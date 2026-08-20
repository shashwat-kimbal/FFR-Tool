"use client";

import { useState } from "react";
import { CheckCircle2, AlertCircle, ArrowRight, ShieldCheck, Zap, Activity } from "lucide-react";
import type { VerdictObject } from "@/server/inference/verdict-engine";
import { Card, SectionHead, Status } from "./ui";

interface VerdictPanelProps {
  verdict: VerdictObject;
  onAdjudicate?: (mechanismId: string) => void;
}

export function VerdictPanel({ verdict, onAdjudicate }: VerdictPanelProps) {
  const [adjudicated, setAdjudicated] = useState(false);
  const leading = verdict.leadingMechanism;

  const familyBadgeTones: Record<string, "good" | "warning" | "danger" | "neutral"> = {
    installation: "warning",
    product: "danger",
    grid: "good",
    customer: "neutral",
    "no-fault": "good",
  };

  const dialColor = (val: number) => {
    if (val >= 80) return "text-emerald-600 bg-emerald-50 border-emerald-200";
    if (val >= 50) return "text-amber-600 bg-amber-50 border-amber-200";
    return "text-rose-600 bg-rose-50 border-rose-200";
  };

  return (
    <Card className="verdict-panel border-l-4 border-l-indigo-600 shadow-md">
      <SectionHead
        eyebrow="Part IV — Abductive Verdict (L5)"
        title={leading.name}
        description={`Root cause attribution: ${leading.family.toUpperCase()} failure mode. Output is an attribution, a decomposed confidence, and routed actions.`}
        action={
          <div className="button-row">
            <Status tone={familyBadgeTones[leading.family] ?? "neutral"}>
              {leading.family.toUpperCase()} FAMILY
            </Status>
            <Status tone="good">
              {(verdict.posteriorProbability * 100).toFixed(0)}% POSTERIOR (CAPPED)
            </Status>
          </div>
        }
      />

      <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-6">
        <p className="text-sm text-slate-800 leading-relaxed font-medium">
          {leading.narrative}
        </p>
      </div>

      {/* Part VII: 4 Confidence Dials (A5) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className={`p-3 rounded-lg border text-center ${dialColor(verdict.dials.completeness)}`}>
          <span className="text-xs uppercase tracking-wider font-semibold block text-slate-500 mb-1">
            Completeness
          </span>
          <strong className="text-2xl font-bold">{verdict.dials.completeness}%</strong>
          <span className="text-xs block text-slate-500 mt-1">Signature observed</span>
        </div>

        <div className={`p-3 rounded-lg border text-center ${dialColor(verdict.dials.discrimination)}`}>
          <span className="text-xs uppercase tracking-wider font-semibold block text-slate-500 mb-1">
            Discrimination
          </span>
          <strong className="text-2xl font-bold">{verdict.dials.discrimination}%</strong>
          <span className="text-xs block text-slate-500 mt-1">Gap vs #2 mechanism</span>
        </div>

        <div className={`p-3 rounded-lg border text-center ${dialColor(verdict.dials.provenance)}`}>
          <span className="text-xs uppercase tracking-wider font-semibold block text-slate-500 mb-1">
            Provenance
          </span>
          <strong className="text-2xl font-bold">{verdict.dials.provenance}%</strong>
          <span className="text-xs block text-slate-500 mt-1">Config from workbook</span>
        </div>

        <div className={`p-3 rounded-lg border text-center ${dialColor(verdict.dials.corroboration)}`}>
          <span className="text-xs uppercase tracking-wider font-semibold block text-slate-500 mb-1">
            Corroboration
          </span>
          <strong className="text-2xl font-bold">{verdict.dials.corroboration}%</strong>
          <span className="text-xs block text-slate-500 mt-1">Same-feeder returns</span>
        </div>
      </div>

      {/* Next Best Test Panel (§7.4) */}
      {verdict.nextBestTest && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-900 flex items-center gap-1.5">
              <Zap size={14} /> Next Best Test (Value of Information)
            </span>
            <span className="text-xs bg-indigo-200 text-indigo-900 font-semibold px-2 py-0.5 rounded">
              Cost: {verdict.nextBestTest.cost}
            </span>
          </div>
          <h4 className="font-semibold text-indigo-950 text-sm mb-1">
            1. {verdict.nextBestTest.title}
          </h4>
          <p className="text-xs text-indigo-800 mb-3">
            {verdict.nextBestTest.description}
          </p>
        </div>
      )}

      {/* Adjudication Action Button (Part XII) */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-200">
        <div className="text-xs text-slate-500">
          <span>Warranty route: </span>
          <strong className="text-slate-700 uppercase font-semibold">{verdict.routes.warranty}</strong>
          {verdict.routes.capaTrigger && (
            <span className="ml-2 font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded">CAPA TRIGGERED</span>
          )}
        </div>
        <button
          className={`button ${adjudicated ? "secondary" : "primary"}`}
          onClick={() => {
            setAdjudicated(true);
            onAdjudicate?.(leading.id);
          }}
        >
          {adjudicated ? (
            <>
              <CheckCircle2 size={15} /> Adjudicated by analyst
            </>
          ) : (
            <>
              <ShieldCheck size={15} /> Adjudicate & Confirm Verdict
            </>
          )}
        </button>
      </div>
    </Card>
  );
}
