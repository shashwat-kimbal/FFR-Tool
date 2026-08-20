"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import {
  GitCompare,
  RotateCcw,
  Check,
  CheckCircle2,
  Clock,
  Layers,
  ArrowRight,
  AlertCircle,
  Loader2,
} from "lucide-react";

export default function RunsPage() {
  const params = useParams();
  const id = String(params.id);

  const [runs, setRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRuns, setSelectedRuns] = useState<string[]>([]);
  const [comparing, setComparing] = useState(false);
  const [reRunning, setReRunning] = useState(false);

  const fetchRuns = async () => {
    try {
      const res = await fetch(`/api/cases/${id}/runs`);
      if (res.ok) {
        const data = await res.json();
        setRuns(data.runs || []);
        if (data.runs && data.runs.length >= 2) {
          setSelectedRuns([data.runs[0].id, data.runs[1].id]);
        }
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    fetchRuns();
  }, [id]);

  const handleToggleSelect = (runId: string) => {
    if (selectedRuns.includes(runId)) {
      setSelectedRuns(selectedRuns.filter((r) => r !== runId));
    } else {
      if (selectedRuns.length >= 2) {
        setSelectedRuns([selectedRuns[1], runId]);
      } else {
        setSelectedRuns([...selectedRuns, runId]);
      }
    }
  };

  const handleReRun = async () => {
    setReRunning(true);
    try {
      await fetch(`/api/cases/${id}/runs`, { method: "POST" });
      await fetchRuns();
    } catch {}
    setReRunning(false);
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-12 text-center text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500 mb-2" />
        <div>Loading run history…</div>
      </div>
    );
  }

  const runA = runs.find((r) => r.id === selectedRuns[0]);
  const runB = runs.find((r) => r.id === selectedRuns[1]);

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div>
          <h2 className="text-lg font-bold text-white">Analysis Runs & Version History</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Every analysis run is deterministic, versioned, and replayable.
          </p>
        </div>

        <button
          type="button"
          onClick={handleReRun}
          disabled={reRunning}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-600/30 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          <RotateCcw size={14} className={reRunning ? "animate-spin" : ""} />
          {reRunning ? "Evaluating…" : "Re-run analysis"}
        </button>
      </div>

      {/* Runs Table List */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-950/80 text-slate-400 font-semibold uppercase text-[11px]">
              <th className="py-3 px-4 w-12 text-center">Compare</th>
              <th className="py-3 px-4 w-20">Run</th>
              <th className="py-3 px-4 w-36">Timestamp</th>
              <th className="py-3 px-4">Artifact Versions</th>
              <th className="py-3 px-4">Leading Attribution</th>
              <th className="py-3 px-4 w-20 text-right">Posterior</th>
              <th className="py-3 px-4 w-24 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {runs.map((r, idx) => {
              const isSelected = selectedRuns.includes(r.id);
              const isCurrent = idx === 0;

              return (
                <tr
                  key={r.id}
                  onClick={() => handleToggleSelect(r.id)}
                  className={`hover:bg-slate-800/40 transition-colors cursor-pointer ${
                    isSelected ? "bg-blue-950/20" : ""
                  }`}
                >
                  <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleSelect(r.id)}
                      className="rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-0 cursor-pointer"
                    />
                  </td>
                  <td className="py-3 px-4 font-bold text-white">
                    RUN {r.run_number}
                  </td>
                  <td className="py-3 px-4 text-slate-400">
                    {r.started_at.substring(0, 16)}
                  </td>
                  <td className="py-3 px-4 text-slate-300">
                    <span className="text-blue-400">{r.ruleset_v}</span> · <span className="text-slate-400">{r.mechanisms_v}</span>
                  </td>
                  <td className="py-3 px-4 text-slate-200 font-sans font-medium">
                    {r.leading_cause || "Inconclusive"}
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-slate-100">
                    {r.posterior_probability ? r.posterior_probability.toFixed(2) : "—"}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {isCurrent ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-blue-950 text-blue-300 border border-blue-700/60 font-semibold">
                        ● current
                      </span>
                    ) : (
                      <span className="text-slate-500 text-[11px]">historical</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Compare Action Bar */}
      <div className="flex items-center justify-between bg-slate-900/60 p-3 rounded-lg border border-slate-800 text-xs">
        <div className="text-slate-300 flex items-center gap-2">
          <span>Selected for comparison:</span>
          {selectedRuns.map((rId) => {
            const r = runs.find((x) => x.id === rId);
            return (
              <span key={rId} className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 font-mono font-bold">
                Run {r?.run_number}
              </span>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setComparing(!comparing)}
          disabled={selectedRuns.length < 2}
          className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-md shadow-blue-600/30 flex items-center gap-1.5 disabled:opacity-40 cursor-pointer"
        >
          <GitCompare size={14} /> {comparing ? "Hide comparison" : "Compare runs →"}
        </button>
      </div>

      {/* Side-by-Side Comparison Diff View (§5.5) */}
      {comparing && runA && runB && (
        <div className="p-6 rounded-xl bg-slate-900/80 border border-blue-800/60 shadow-2xl space-y-5 animate-in fade-in">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <GitCompare size={16} className="text-blue-400" />
              Side-by-Side Run Comparison: Run {runA.run_number} vs Run {runB.run_number}
            </h3>
            <span className="text-xs font-mono text-blue-300 bg-blue-950/60 px-2.5 py-1 rounded border border-blue-800">
              Reason: ruleset v2→v3 (P-PWR-ESC added)
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Run A Column */}
            <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                <span className="font-bold text-white font-mono">RUN {runA.run_number} ({runA.ruleset_v})</span>
                <span className="font-mono text-blue-400 font-bold">{runA.posterior_probability?.toFixed(2) || "—"}</span>
              </div>
              <div className="text-xs font-semibold text-slate-200">{runA.leading_cause}</div>
              <div className="space-y-1 text-[11px] font-mono text-slate-300">
                <div className="p-2 rounded bg-slate-900 border border-blue-800/40 text-blue-300">
                  + P-PWR-ESC (Escalating power failures): LR 6.0
                </div>
                <div className="p-2 rounded bg-slate-900 border border-slate-800">
                  + P-TRUNC-0V (Truncation at zero volts): LR 8.0
                </div>
                <div className="p-2 rounded bg-slate-900 border border-slate-800">
                  + P-PF-COLLAPSE (Low PF saturated): LR 4.5
                </div>
              </div>
            </div>

            {/* Run B Column */}
            <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                <span className="font-bold text-slate-300 font-mono">RUN {runB.run_number} ({runB.ruleset_v})</span>
                <span className="font-mono text-slate-400 font-bold">{runB.posterior_probability?.toFixed(2) || "—"}</span>
              </div>
              <div className="text-xs font-semibold text-slate-400">{runB.leading_cause}</div>
              <div className="space-y-1 text-[11px] font-mono text-slate-400">
                <div className="p-2 rounded bg-slate-900/40 border border-dashed border-slate-800 text-slate-600">
                  — P-PWR-ESC not in ruleset v2
                </div>
                <div className="p-2 rounded bg-slate-900 border border-slate-800">
                  + P-TRUNC-0V (Truncation at zero volts): LR 8.0
                </div>
                <div className="p-2 rounded bg-slate-900 border border-slate-800">
                  + P-PF-COLLAPSE (Low PF saturated): LR 4.5
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
