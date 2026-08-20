"use client";

import React, { useState } from "react";

interface ConfidenceDialsProps {
  completeness: number;    // 0 - 4
  discrimination: number;  // 0 - 4
  provenance: number;      // 0 - 4
  cohort: number;          // 0 - 4
  compact?: boolean;
  improvements?: {
    completeness?: string;
    discrimination?: string;
    provenance?: string;
    cohort?: string;
  };
}

export function ConfidenceDials({
  completeness = 0,
  discrimination = 0,
  provenance = 0,
  cohort = 0,
  compact = false,
  improvements,
}: ConfidenceDialsProps) {
  const [hoveredDial, setHoveredDial] = useState<string | null>(null);

  const dials = [
    {
      id: "completeness",
      name: "Completeness",
      score: Math.max(0, Math.min(4, completeness)),
      tooltip: improvements?.completeness || "Measures % of expected failure mode signature observable in evidence. Attach photos/bench readings to increase.",
    },
    {
      id: "discrimination",
      name: "Discrimination",
      score: Math.max(0, Math.min(4, discrimination)),
      tooltip: improvements?.discrimination || "Probability gap between #1 leading hypothesis and #2 runner-up. Run discriminating tests to separate causes.",
    },
    {
      id: "provenance",
      name: "Provenance",
      score: Math.max(0, Math.min(4, provenance)),
      tooltip: improvements?.provenance || "Proportion of thresholds derived from device configuration vs fallback defaults. Load utility contracts to lift.",
    },
    {
      id: "cohort",
      name: "Cohort",
      score: Math.max(0, Math.min(4, cohort)),
      tooltip: improvements?.cohort || "Corroboration from population returns sharing same feeder, batch, or firmware. Widen cohort query to corroborate.",
    },
  ];

  if (compact) {
    // 4 micro-bars for the Queue table row
    return (
      <div className="relative group inline-flex items-center gap-1.5" title="Confidence: Completeness · Discrimination · Provenance · Cohort">
        <div className="flex items-center gap-1">
          {dials.map((d) => (
            <div key={d.id} className="flex gap-[1.5px] items-center" title={`${d.name}: ${d.score}/4`}>
              {[1, 2, 3, 4].map((bar) => (
                <span
                  key={bar}
                  className={`w-[3px] h-3 rounded-[0.5px] ${
                    bar <= d.score ? "bg-blue-400" : "bg-slate-700/70"
                  }`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Full 4-dial display for Tab A (Verdict)
  return (
    <div className="flex flex-wrap items-center gap-4 py-2 text-xs">
      {dials.map((d) => (
        <div
          key={d.id}
          className="relative flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-slate-900/80 border border-slate-800 hover:border-slate-700 cursor-help transition-colors"
          onMouseEnter={() => setHoveredDial(d.id)}
          onMouseLeave={() => setHoveredDial(null)}
        >
          <span className="text-slate-400 font-medium">{d.name}</span>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4].map((bar) => (
              <span
                key={bar}
                className={`w-1.5 h-3.5 rounded-[1px] transition-colors ${
                  bar <= d.score ? "bg-blue-500" : "bg-slate-800"
                }`}
              />
            ))}
          </div>

          {hoveredDial === d.id && (
            <div className="absolute bottom-full left-0 mb-2 w-64 p-2.5 rounded bg-slate-950 border border-slate-700 shadow-xl text-slate-200 text-xs z-50 pointer-events-none">
              <div className="font-semibold text-white mb-1">{d.name} ({d.score}/4)</div>
              <p className="text-slate-300 leading-relaxed">{d.tooltip}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
