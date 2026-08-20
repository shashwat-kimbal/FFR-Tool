"use client";

import { Activity, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import type { FirstPrinciplesPatterns } from "@/server/inference/patterns";
import { Card, SectionHead, Status } from "./ui";

export function TimelineInstrument({ patterns }: { patterns: FirstPrinciplesPatterns }) {
  const { truncation, dose, censoredStreams, coincidence } = patterns;

  return (
    <Card className="timeline-instrument">
      <SectionHead
        eyebrow="Part V — The Instrument"
        title="Reconstructed Failure Timeline"
        description="A physical object with a history. The log stops at the time of death; absence is systematically analyzed."
      />

      {/* Story narrative text (§5.8) */}
      <div className="bg-slate-900 text-slate-100 p-4 rounded-lg font-mono text-xs leading-relaxed mb-6 border border-slate-800">
        <div className="text-emerald-400 font-bold mb-2 flex items-center gap-1.5">
          <Activity size={14} /> RECONSTRUCTED NARRATIVE:
        </div>
        <p className="text-slate-300">{patterns.reconstructedStory}</p>
      </div>

      {/* Visual Timeline Event Cards */}
      <div className="space-y-3 relative pl-6 border-l-2 border-indigo-200">
        {dose.totalSamples > 0 && (
          <div className="relative">
            <div className="absolute -left-[31px] top-1 bg-amber-500 text-white rounded-full p-1">
              <Activity size={12} />
            </div>
            <div className="bg-slate-50 p-3 rounded border border-slate-200">
              <span className="text-xs text-slate-500 font-semibold block">CHRONIC VOLTAGE STRESS</span>
              <strong className="text-sm text-slate-800 block">
                {dose.percentAboveUpper}% of profile samples &gt; 253V (Peak {dose.peakVoltage ?? 260}V)
              </strong>
              <small className="text-xs text-slate-600 block mt-0.5">
                Volt-hours above upper band: {dose.voltHoursAboveUpper} V-hrs · Trend: {dose.trend}
              </small>
            </div>
          </div>
        )}

        {censoredStreams.powerEvent?.saturated && (
          <div className="relative">
            <div className="absolute -left-[31px] top-1 bg-indigo-500 text-white rounded-full p-1">
              <Clock size={12} />
            </div>
            <div className="bg-slate-50 p-3 rounded border border-slate-200">
              <span className="text-xs text-slate-500 font-semibold block">POWER FAILURE STORM</span>
              <strong className="text-sm text-slate-800 block">
                PowerRelatedEvent 50-entry circular buffer saturated in {censoredStreams.powerEvent.spanDays} days
              </strong>
              <small className="text-xs text-slate-600 block mt-0.5">
                Estimated interruption rate: ~{censoredStreams.powerEvent.ratePerDay} power failures/day
              </small>
            </div>
          </div>
        )}

        {coincidence.eventsInWindowCount >= 3 && (
          <div className="relative">
            <div className="absolute -left-[31px] top-1 bg-purple-500 text-white rounded-full p-1">
              <AlertTriangle size={12} />
            </div>
            <div className="bg-slate-50 p-3 rounded border border-slate-200">
              <span className="text-xs text-slate-500 font-semibold block">MULTI-STREAM CONVERGENCE</span>
              <strong className="text-sm text-slate-800 block">
                {coincidence.eventsInWindowCount} events converged across {coincidence.streamsInvolved.join(", ")}
              </strong>
              <small className="text-xs text-slate-600 block mt-0.5">
                Co-occurred inside a {coincidence.windowHours}h window before profile truncation
              </small>
            </div>
          </div>
        )}

        {truncation.lastLiveTs && (
          <div className="relative">
            <div className="absolute -left-[31px] top-1 bg-rose-600 text-white rounded-full p-1">
              <AlertTriangle size={12} />
            </div>
            <div className="bg-rose-50 p-3 rounded border border-rose-200">
              <div className="flex items-center justify-between">
                <span className="text-xs text-rose-700 font-bold">TIME OF DEATH (TRUNCATION)</span>
                <Status tone="danger">0 V TERMINAL</Status>
              </div>
              <strong className="text-sm text-rose-950 block mt-1">
                {truncation.lastLiveTs} at terminal voltages [{truncation.terminalVoltages.join(", ")}V]
              </strong>
              {truncation.silenceDays && (
                <small className="text-xs text-rose-800 block mt-0.5">
                  Followed by {truncation.silenceDays} days of silence before depot readout
                </small>
              )}
            </div>
          </div>
        )}

        {truncation.defectDate && (
          <div className="relative">
            <div className="absolute -left-[31px] top-1 bg-slate-700 text-white rounded-full p-1">
              <CheckCircle2 size={12} />
            </div>
            <div className="bg-slate-100 p-3 rounded border border-slate-300">
              <span className="text-xs text-slate-600 font-semibold block">FIELD DEFECT TICKET REPORTED</span>
              <strong className="text-sm text-slate-800 block">
                Reported on {truncation.defectDate}
              </strong>
              {truncation.detectionLagDays !== null && (
                <small className="text-xs text-slate-600 block mt-0.5">
                  Detection lag: {truncation.detectionLagDays} days after DLMS truncation
                </small>
              )}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
