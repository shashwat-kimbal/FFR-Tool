"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronRight,
  ChevronDown,
  ArrowRight,
  Zap,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { ConfidenceDials } from "@/app/components/ConfidenceDials";
import { Popover } from "@/app/components/Popover";
import { VerdictSkeleton } from "@/app/components/Skeleton";
import type { EvidenceLedgerItem, NextBestTest } from "@/server/inference/verdict-engine.ts";

interface VerdictClientViewProps {
  caseId: string;
  caseData?: any;
  initialRun?: any;
}

export default function VerdictClientView({
  caseId,
  caseData: propCaseData,
  initialRun: propInitialRun,
}: VerdictClientViewProps) {
  const router = useRouter();
  const [caseData, setCaseData] = useState<any>(propCaseData || null);
  const [latestRun, setLatestRun] = useState<any>(propInitialRun || null);
  const [loading, setLoading] = useState(!propInitialRun);

  // Filter tab on Evidence Ledger
  const [ledgerFilter, setLedgerFilter] = useState<"supports" | "against" | "gaps" | "passed">("supports");
  // Expanded alternatives
  const [expandedAlt, setExpandedAlt] = useState<string | null>(null);
  // Expanded ledger items
  const [expandedLedgerItems, setExpandedLedgerItems] = useState<string[]>(["P-PWR-ESC", "P-TRUNC-0V"]);

  useEffect(() => {
    if (!latestRun) {
      fetch(`/api/cases/${caseId}`)
        .then((res) => res.json())
        .then((data) => {
          setCaseData(data.case);
          setLatestRun(data.latestRun);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [caseId]);

  const toggleLedgerItem = (itemId: string) => {
    setExpandedLedgerItems((prev) =>
      prev.includes(itemId) ? prev.filter((i) => i !== itemId) : [...prev, itemId],
    );
  };

  if (loading) {
    return <VerdictSkeleton />;
  }

  // If no run exists yet
  if (!latestRun) {
    return (
      <div className="verdict-section text-center p-12 max-w-lg mx-auto my-8 space-y-4">
        <h3 className="t-title text-white">No analysis yet</h3>
        <p className="t-body text-slate-400">
          Run the deterministic diagnostic pipeline to compute the evidence ledger, failure mechanisms, and confidence dials.
        </p>
        <button
          type="button"
          onClick={() => {
            fetch(`/api/cases/${caseId}/runs`, { method: "POST" })
              .then(() => window.location.reload());
          }}
          className="btn btn-primary"
        >
          Run analysis
        </button>
      </div>
    );
  }

  const dials = latestRun.dials || { completeness: 3, discrimination: 2, provenance: 2, corroboration: 0 };
  const ledger = latestRun.ledger || { supporting: [], against: [], gaps: [], passed: [] };
  const timeline = latestRun.timeline || [];
  const nextTests: NextBestTest[] = latestRun.nextTests || [];
  const primaryNextTest = nextTests[0] || {
    rank: 1,
    title: "Feeder cohort — power-failure rate 31 May–5 Jun across 38 meters",
    expectedPosteriorShift: "LARGE",
    cost: "seconds",
    actionText: "Run this now →",
    queryParam: "/cohorts/feeder/Lakhipur_bec",
  };
  const alternatives = latestRun.alternatives || [];
  const posterior = latestRun.posterior_probability || 0.71;

  // Active ledger list based on filter
  const activeLedgerList: EvidenceLedgerItem[] =
    ledgerFilter === "supports"
      ? ledger.supporting || []
      : ledgerFilter === "against"
      ? ledger.against || []
      : ledgerFilter === "gaps"
      ? ledger.gaps || []
      : ledger.passed || [];

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* ① BAND 1: LEADING CAUSE (§5.2) */}
      <section className="verdict-section">
        <div className="band-header">
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            ① LEADING CAUSE
          </span>
          <span className="px-2.5 py-0.5 rounded text-xs font-mono font-bold bg-blue-950 text-blue-300 border border-blue-700">
            [ {caseData?.leading_family || "INSTALLATION"} ]
          </span>
        </div>

        {/* Cause Name & Single Large Posterior Bar */}
        <div>
          <h2 className="t-title text-white">
            {caseData?.leading_cause || "Progressive supply-terminal degradation"}
          </h2>

          <div className="posterior-bar-wrap">
            <div className="posterior-progress-track">
              <div
                className="posterior-progress-fill"
                style={{ width: `${posterior * 100}%` }}
              />
            </div>
            <div className="posterior-number">
              {posterior.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Narrative Description with [ ? ] popover */}
        <div className="flex items-start gap-2 bg-slate-950 p-3.5 rounded-lg border border-slate-800 text-xs text-slate-300 leading-relaxed">
          <p className="flex-1">
            Contact resistance at an incoming terminal rises, heats, intermittently opens under load, then fails fully.
          </p>
          <Popover
            title="Physical Failure Mode Signature"
            content={
              <div className="space-y-2 text-slate-300">
                <p>
                  Loose or oxidized terminal connections generate localized I²R Joule heating.
                  As thermal stress weakens mechanical contact, intermittent micro-arcing produces power-failure events and PF collapse.
                </p>
                <p className="text-[11px] text-slate-400">
                  Confirmed when DLMS log terminates at zero volts with preceding power-failure buffer saturation.
                </p>
              </div>
            }
          />
        </div>

        {/* 4 Confidence Dials (§5.2 & §7.3) */}
        <div className="pt-3 border-t border-slate-800">
          <ConfidenceDials
            completeness={dials.completeness}
            discrimination={dials.discrimination}
            provenance={dials.provenance}
            cohort={dials.cohort}
          />
        </div>

        {/* NEXT BEST TEST Callout Box (§5.2 & §7.4) */}
        <div className="next-best-box">
          <div className="space-y-1">
            <div className="text-[10px] font-bold tracking-wider text-blue-400 uppercase flex items-center gap-1.5">
              <Zap size={12} />
              NEXT BEST TEST
            </div>
            <div className="text-xs font-semibold text-slate-100">
              {primaryNextTest.title}
            </div>
            <div className="text-[11px] text-slate-400 flex items-center gap-2">
              <span>expected shift <strong className="text-blue-300">{primaryNextTest.expectedPosteriorShift}</strong></span>
              <span>·</span>
              <span>cost: <strong className="text-slate-300">{primaryNextTest.cost}</strong></span>
            </div>
          </div>

          <Link
            href={primaryNextTest.queryParam || "/cohorts/feeder/Lakhipur_bec"}
            className="btn btn-primary btn-sm"
          >
            Run this now →
          </Link>
        </div>
      </section>

      {/* ② BAND 2: ALTERNATIVES (§5.2) */}
      <section className="verdict-section">
        <div className="band-header">
          <span>② ALTERNATIVES</span>
        </div>

        <div className="space-y-2">
          {alternatives.map((alt: any) => {
            const isExpanded = expandedAlt === alt.mechanismId;
            return (
              <div
                key={alt.mechanismId}
                className="rounded-lg bg-slate-950 border border-slate-800 overflow-hidden"
              >
                <div
                  onClick={() => setExpandedAlt(isExpanded ? null : alt.mechanismId)}
                  className="p-3.5 flex items-center justify-between text-xs cursor-pointer hover:bg-slate-900 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-slate-500 font-mono">
                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </span>
                    <span className="font-semibold text-slate-200">{alt.name}</span>
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-slate-800 text-slate-400 uppercase">
                      {alt.family}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 font-mono">
                    <span className="text-slate-400 font-bold">{alt.posterior.toFixed(2)}</span>
                    <div className="w-20 h-2 rounded-full bg-slate-900 border border-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-slate-500 rounded-full"
                        style={{ width: `${alt.posterior * 100}%` }}
                      />
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="p-4 bg-slate-900/50 border-t border-slate-800 space-y-2 text-xs text-slate-300">
                    <p className="text-slate-400 italic mb-2">{alt.narrative}</p>
                    <div className="font-semibold text-slate-200 text-[11px] uppercase tracking-wider">
                      Hypothesis Evidence Ledger:
                    </div>
                    {alt.ledger && alt.ledger.length > 0 ? (
                      <div className="space-y-1.5 pt-1">
                        {alt.ledger.map((item: any, i: number) => (
                          <div
                            key={i}
                            className="flex items-center justify-between p-2 rounded bg-slate-950 border border-slate-800 text-xs"
                          >
                            <span className="text-slate-300">{item.title}</span>
                            <span className="font-mono text-slate-400">LR {item.likelihoodRatio}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-slate-500 text-xs">No specific findings logged for this alternative.</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ③ BAND 3: WHAT HAPPENED (§5.2 & §5.8) */}
      <section className="verdict-section">
        <div className="band-header">
          <span>③ WHAT HAPPENED</span>
        </div>

        <div className="space-y-2 font-mono text-xs">
          {timeline.map((event: any, idx: number) => {
            const isDeath = event.isDeath;
            const isLag = event.isLag;

            return (
              <div
                key={idx}
                onClick={() => router.push(`/cases/${caseId}/timeline`)}
                className={`p-2.5 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-900 transition-colors cursor-pointer ${
                  isDeath
                    ? "bg-red-950/25 border-red-800/60 text-red-200"
                    : isLag
                    ? "bg-amber-950/20 border-amber-800/50 text-amber-200"
                    : "bg-slate-950 border-slate-800 text-slate-300"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`font-bold w-16 text-right ${isDeath ? "text-red-400" : isLag ? "text-amber-400" : "text-blue-400"}`}>
                    {event.dateStr}
                  </span>
                  <span className="text-slate-600">│</span>
                  <span className="text-slate-200 font-sans text-xs">
                    {event.description}
                  </span>
                </div>

                {event.badge && (
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase self-start sm:self-auto ${
                      isDeath
                        ? "bg-red-900/60 text-red-300 border border-red-700/60"
                        : "bg-amber-900/60 text-amber-300 border border-amber-700/60"
                    }`}
                  >
                    {event.badge}
                  </span>
                )}
              </div>
            );
          })}
        </div>
        <p className="text-[11px] text-slate-500 italic pt-2">
          Each line links to the timeline instrument at that moment.
        </p>
      </section>

      {/* ④ BAND 4: EVIDENCE LEDGER (§5.2) */}
      <section className="verdict-section">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3 mb-4">
          <div className="band-header mb-0">
            <span>④ EVIDENCE LEDGER</span>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setLedgerFilter("supports")}
              className={`btn btn-sm ${ledgerFilter === "supports" ? "btn-primary" : "btn-secondary"}`}
            >
              Supports ({ledger.supporting?.length || 0})
            </button>
            <button
              type="button"
              onClick={() => setLedgerFilter("against")}
              className={`btn btn-sm ${ledgerFilter === "against" ? "btn-danger" : "btn-secondary"}`}
            >
              Against ({ledger.against?.length || 0})
            </button>
            <button
              type="button"
              onClick={() => setLedgerFilter("gaps")}
              className={`btn btn-sm ${ledgerFilter === "gaps" ? "bg-amber-600 text-white" : "btn-secondary"}`}
            >
              Gaps ({ledger.gaps?.length || 0})
            </button>
            <button
              type="button"
              onClick={() => setLedgerFilter("passed")}
              className={`btn btn-sm ${ledgerFilter === "passed" ? "btn-secondary bg-slate-700 text-white" : "btn-secondary"}`}
            >
              Passed ({ledger.passed?.length || 0})
            </button>
          </div>
        </div>

        {/* Semantic Color Legend (§5.2) */}
        <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-400 pb-3">
          <span className="font-semibold text-slate-500 uppercase text-[10px]">Evidence Provenance:</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-blue-500" /> Read from cell (Blue)</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-teal-500" /> Calculated (Teal)</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-amber-500" /> Assumed fallback (Amber)</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm border border-dashed border-slate-500" /> Missing gap (Grey)</span>
        </div>

        {/* Ledger Rows */}
        <div className="space-y-2">
          {activeLedgerList.map((item) => {
            const isExpanded = expandedLedgerItems.includes(item.id);

            // Strict 4-color semantic badge
            let badgeBg = "bg-blue-950 text-blue-300 border-blue-700"; // blue = source cell
            if (item.colorKind === "calculated") badgeBg = "bg-teal-950 text-teal-300 border-teal-700";
            else if (item.colorKind === "assumed") badgeBg = "bg-amber-950 text-amber-300 border-amber-700";
            else if (item.colorKind === "missing") badgeBg = "bg-slate-950 border-dashed border-slate-600 text-slate-400";

            return (
              <div
                key={item.id}
                className="rounded-lg bg-slate-950 border border-slate-800 overflow-hidden text-xs"
              >
                <div
                  onClick={() => toggleLedgerItem(item.id)}
                  className="p-3.5 flex items-center justify-between hover:bg-slate-900 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-slate-500 font-mono">
                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </span>
                    <span className="font-semibold text-slate-200">{item.title}</span>
                    {item.ruleCode && (
                      <span className="font-mono text-[10px] text-slate-500">
                        {item.ruleCode}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 font-mono">
                    <span className="text-slate-300 font-bold">LR {item.likelihoodRatio.toFixed(1)}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] border font-mono ${badgeBg}`}>
                      {item.sourceRef}
                    </span>
                  </div>
                </div>

                {isExpanded && (
                  <div className="p-4 bg-slate-900/40 border-t border-slate-800 space-y-2 text-xs">
                    <div className="flex items-start gap-2">
                      <span className="text-slate-500 font-mono w-20">measured:</span>
                      <span className="text-slate-200 font-medium">{item.measured}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-slate-500 font-mono w-20">source:</span>
                      <span className="font-mono text-blue-400 font-bold">{item.sourceRef}</span>
                    </div>
                    {item.note && (
                      <div className="flex items-start gap-2 text-amber-400 pt-1">
                        <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                        <span>{item.note}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
