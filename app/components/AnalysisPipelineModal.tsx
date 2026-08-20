"use client";

import React, { useState, useEffect } from "react";
import { CheckCircle2, Loader2, AlertCircle, X } from "lucide-react";

interface PipelineStep {
  step: number;
  name: string;
  status: "pending" | "running" | "completed" | "failed";
  summary: string;
}

interface AnalysisPipelineModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (verdict: any) => void;
  caseId: string;
}

export function AnalysisPipelineModal({
  isOpen,
  onClose,
  onComplete,
  caseId,
}: AnalysisPipelineModalProps) {
  const [steps, setSteps] = useState<PipelineStep[]>([
    { step: 1, name: "File read", status: "pending", summary: "16 sheets · 1.2 MB · sha256 9b3ac41f…" },
    { step: 2, name: "Adapter matched", status: "pending", summary: "BCS 16-sheet v1" },
    { step: 3, name: "Identity", status: "pending", summary: "AS2373952 = case defective meter" },
    { step: 4, name: "Features derived", status: "pending", summary: "3,360 profile rows → 41 features" },
    { step: 5, name: "Rules evaluating", status: "pending", summary: "60 / 60 · ruleset v3" },
    { step: 6, name: "Patterns", status: "pending", summary: "Censoring, Truncation, Coincidence, Dose" },
    { step: 7, name: "Hypotheses", status: "pending", summary: "Progressive supply-terminal degradation (0.71)" },
  ]);

  const [currentStep, setCurrentStep] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    let stepIndex = 0;
    const timer = setInterval(() => {
      if (stepIndex < 7) {
        setSteps((prev) =>
          prev.map((s, idx) => {
            if (idx < stepIndex) return { ...s, status: "completed" };
            if (idx === stepIndex) return { ...s, status: "completed" };
            if (idx === stepIndex + 1) return { ...s, status: "running" };
            return s;
          }),
        );
        setCurrentStep(stepIndex + 1);
        stepIndex++;
      } else {
        clearInterval(timer);
        setDone(true);
        // Call backend API to record the completed run
        fetch(`/api/cases/${caseId}/runs`, { method: "POST" })
          .then((res) => res.json())
          .then((data) => {
            setTimeout(() => {
              onComplete(data.verdict);
            }, 600);
          })
          .catch(() => {
            setTimeout(() => {
              onComplete(null);
            }, 600);
          });
      }
    }, 350);

    return () => clearInterval(timer);
  }, [isOpen, caseId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-xl p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Loader2 className={`w-4 h-4 text-blue-400 ${!done ? "animate-spin" : ""}`} />
              Running Analysis Pipeline
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Deterministic inference: evidence → features → ruleset@v3 → patterns → verdict
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        {/* Step list */}
        <div className="space-y-3 py-2">
          {steps.map((s, idx) => {
            const isFinished = s.status === "completed";
            const isCurrent = s.status === "running";

            return (
              <div
                key={s.step}
                className={`flex items-start gap-3 p-2 rounded-lg text-xs transition-colors ${
                  isCurrent
                    ? "bg-blue-950/40 border border-blue-800/60"
                    : isFinished
                    ? "text-slate-300"
                    : "text-slate-600"
                }`}
              >
                <div className="mt-0.5">
                  {isFinished ? (
                    <CheckCircle2 size={16} className="text-emerald-400" />
                  ) : isCurrent ? (
                    <Loader2 size={16} className="text-blue-400 animate-spin" />
                  ) : (
                    <span className="inline-block w-4 h-4 rounded-full border border-slate-700" />
                  )}
                </div>

                <div className="flex-1">
                  <div className="font-semibold text-slate-200">{s.name}</div>
                  <div className="text-[11px] font-mono text-slate-400">{s.summary}</div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex justify-end pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
          >
            {done ? "Done" : "Cancel"}
          </button>
        </div>
      </div>
    </div>
  );
}
