"use client";

import { Users, AlertTriangle, ShieldCheck } from "lucide-react";
import { Card, SectionHead, Status } from "./ui";

interface CohortPanelProps {
  productFamily?: string | null;
  subDivision?: string | null;
  agreedCount?: number;
  totalCount?: number;
}

export function CohortPanel({
  productFamily = "METER",
  subDivision = "SUB-DIV-1",
  agreedCount = 27,
  totalCount = 40,
}: CohortPanelProps) {
  const percent = Math.round((agreedCount / Math.max(1, totalCount)) * 100);

  return (
    <Card className="cohort-panel">
      <SectionHead
        eyebrow="Part VIII — Population Layer"
        title="Cohort Exposure & Confirmation"
        description="A single case proposes a cause; only the population confirms it. Separates grid stress from product flaws."
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-indigo-700 block mb-1">
            Same Feeder Cohort
          </span>
          <strong className="text-2xl font-bold text-indigo-950 block mb-1">
            {agreedCount} / {totalCount} ({percent}%)
          </strong>
          <span className="text-xs text-indigo-800 block">
            Returns on feeder share this supply termination failure mode.
          </span>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-600 block mb-1">
            Feeder vs Grid
          </span>
          <strong className="text-lg font-bold text-slate-900 block mb-1">
            Isolated to Feeder
          </strong>
          <span className="text-xs text-slate-600 block">
            Grid voltage normal across adjacent feeders; issue clustered on this feeder branch.
          </span>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-amber-800 block mb-1">
            Surveillance Alert
          </span>
          <strong className="text-lg font-bold text-amber-950 block mb-1">
            Early Warning Triggered
          </strong>
          <span className="text-xs text-amber-800 block">
            Failure rate in this contractor installation window &gt; 3.5× baseline threshold.
          </span>
        </div>
      </div>
    </Card>
  );
}
