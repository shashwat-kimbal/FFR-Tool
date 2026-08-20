"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  Bot,
  CheckCircle2,
  XCircle,
  Send,
  Loader2,
} from "lucide-react";
import type { ForgeProposal } from "@/server/forge/agent.ts";

interface ForgeClientViewProps {
  caseId: string;
  series: string;
  fromTs: string;
  toTs: string;
  initialProposal: ForgeProposal;
}

export default function ForgeClientView({
  caseId,
  series,
  fromTs,
  toTs,
  initialProposal,
}: ForgeClientViewProps) {
  const router = useRouter();
  const [intent, setIntent] = useState("power failures accelerating right before the log stops");
  const [proposal, setProposal] = useState<ForgeProposal>(initialProposal);
  const [loading, setLoading] = useState(false);
  const [shipping, setShipping] = useState(false);
  const [shippedToast, setShippedToast] = useState<string | null>(null);

  const runForgeAgent = async () => {
    setLoading(true);
    setShippedToast(null);
    try {
      const res = await fetch("/api/knowledge/forge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId,
          series,
          fromTs,
          toTs,
          intentText: intent,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setProposal(data);
      }
    } catch {}
    setLoading(false);
  };

  const handleApproveAndShip = async () => {
    setShipping(true);
    try {
      const res = await fetch("/api/knowledge/forge/ship", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ruleId: proposal?.candidate.ruleId || "P-PWR-ESC" }),
      });
      const data = await res.json();
      setShippedToast(data.message || "P-PWR-ESC shipped. 6 cases re-queued for review.");
    } catch {}
    setShipping(false);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Knowledge Subnav Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <Sparkles size={20} className="text-blue-400" />
            Rule Forge — Agentic Authoring <span className="text-red-500 font-bold ml-4 border border-red-500 px-2 py-1 rounded text-xs bg-red-900/20">SIMULATED</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            The analyst points; the multi-agent system grounds, calibrates against corpus data, and backtests.
          </p>
        </div>

        {/* Subnav links */}
        <div className="flex items-center gap-2 bg-slate-900 p-1 rounded-lg border border-slate-800 text-xs">
          <a
            href="/knowledge/mechanisms"
            className="px-3 py-1.5 rounded-md font-medium text-slate-400 hover:text-white"
          >
            Mechanisms
          </a>
          <a
            href="/knowledge/rules"
            className="px-3 py-1.5 rounded-md font-medium text-slate-400 hover:text-white"
          >
            Rules (60)
          </a>
          <a
            href="/knowledge/rules/forge"
            className="px-3 py-1.5 rounded-md font-semibold bg-blue-600 text-white"
          >
            Rule Forge
          </a>
        </div>
      </div>

      {/* Shipped Toast Banner */}
      {shippedToast && (
        <div className="p-4 rounded-xl bg-emerald-950 border border-emerald-600 flex items-center justify-between text-xs text-emerald-200 shadow-xl">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-400" />
            <span className="font-semibold">{shippedToast}</span>
          </div>
          <a href="/queue" className="underline hover:text-white font-mono">
            View queue →
          </a>
        </div>
      )}

      {/* 2-Column Workbench Layout (§7.3) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* LEFT PANEL: WHAT YOU'RE LOOKING FOR */}
        <div className="verdict-section space-y-5">
          <div className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
            WHAT YOU&apos;RE LOOKING FOR
          </div>

          {/* Context Card & Brushed Thumbnail */}
          <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-2 text-xs font-mono">
            <div className="text-slate-300 font-semibold">
              From case <span className="text-blue-400">{caseId}</span> · {series}
            </div>
            <div className="text-slate-400">
              {fromTs} → {toTs}
            </div>
            {/* Visual Thumbnail Bar */}
            <div className="h-10 rounded bg-slate-900 border border-slate-800 flex items-center px-3 relative overflow-hidden">
              <div className="absolute left-8 right-16 top-2 bottom-2 bg-blue-500/20 border-l border-r border-blue-500 rounded-sm" />
              <div className="w-full flex justify-between items-center text-[10px] text-slate-500 z-10">
                <span>28 Mar</span>
                <span className="text-blue-400 font-bold">1 Jun – 6 Jun (Brushed)</span>
                <span>30 Jun</span>
              </div>
            </div>
          </div>

          {/* Natural Language Intent Box */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-200">
              Describe what matters here:
            </label>
            <textarea
              value={intent}
              onChange={(e) => setIntent(e.target.value)}
              placeholder="e.g. power failures accelerating right before the log stops"
              className="w-full h-24 p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 leading-relaxed"
            />
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={runForgeAgent}
                disabled={loading}
                className="btn btn-primary btn-sm"
              >
                {loading ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                Synthesize &amp; Backtest
              </button>
            </div>
          </div>

          {/* Multi-Agent Reasoning Log (§7.3 & First Principles §9.5) */}
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Bot size={14} className="text-blue-400" />
              AGENT
            </div>

            <div className="space-y-2 text-xs font-mono">
              {proposal?.logs.map((log, i) => (
                <div
                  key={i}
                  className="p-2.5 rounded bg-slate-950 border border-slate-800 text-slate-300 space-y-0.5"
                >
                  <div className="text-[10px] font-bold text-blue-400 uppercase">
                    › [{log.agent} Agent]
                  </div>
                  <div className="text-[11px] text-slate-300 leading-relaxed font-sans">
                    {log.message}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: CANDIDATE & BACKTEST */}
        <div className="verdict-section space-y-5">
          <div className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
            CANDIDATE &amp; BACKTEST
          </div>

          {proposal && (
            <>
              {/* Candidate Spec Box */}
              <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-2 font-mono text-xs">
                <div className="flex justify-between border-b border-slate-800 pb-1.5">
                  <span className="text-slate-400">pattern</span>
                  <span className="text-white font-bold">{proposal.candidate.pattern}</span>
                </div>
                <div className="flex justify-between border-b border-slate-800 pb-1.5">
                  <span className="text-slate-400">window</span>
                  <span className="text-slate-200">{proposal.candidate.window}</span>
                </div>
                <div className="flex justify-between items-center border-b border-slate-800 pb-1.5">
                  <span className="text-slate-400">threshold</span>
                  <div className="text-right">
                    <span className="text-emerald-400 font-bold">{proposal.candidate.threshold}</span>
                    <span className="text-slate-500 text-[10px] ml-1.5">
                      ← {proposal.candidate.thresholdNote}
                    </span>
                  </div>
                </div>
                <div className="pt-1 text-[11px] text-blue-300">
                  <span>supports: </span>
                  <span className="font-semibold">{proposal.candidate.supportsMechanism}</span>
                </div>
              </div>

              {/* Backtest Metrics Box */}
              <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-2.5 font-mono text-xs">
                <div className="text-[11px] font-bold text-slate-400 uppercase font-sans">
                  BACKTEST
                </div>

                <div className="grid grid-cols-3 gap-2 text-center pt-1">
                  <div className="p-2 rounded bg-slate-900 border border-slate-800">
                    <div className="text-slate-400 text-[10px]">fires on</div>
                    <div className="font-bold text-white text-sm mt-0.5">
                      {proposal.backtest.firesOnCount} of {proposal.backtest.totalCases}
                    </div>
                  </div>
                  <div className="p-2 rounded bg-slate-900 border border-slate-800">
                    <div className="text-slate-400 text-[10px]">precision</div>
                    <div className="font-bold text-emerald-400 text-sm mt-0.5">
                      {proposal.backtest.precision}
                    </div>
                  </div>
                  <div className="p-2 rounded bg-slate-900 border border-slate-800">
                    <div className="text-slate-400 text-[10px]">recall</div>
                    <div className="font-bold text-blue-400 text-sm mt-0.5">
                      {proposal.backtest.recall}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-2 rounded bg-amber-950/20 border border-amber-800 text-amber-300 text-xs mt-2">
                  <span>verdicts changed: <strong>{proposal.backtest.verdictsChangedCount}</strong></span>
                  <button
                    type="button"
                    onClick={() => alert(`Reviewing changed cases: ${proposal.backtest.changedCaseRefs.join(", ")}`)}
                    className="underline text-[11px] hover:text-white"
                  >
                    [ review ]
                  </button>
                </div>
              </div>

              {/* Adversarial Fixtures (§7.3) */}
              <div className="space-y-2 text-xs font-mono">
                <div className="text-[11px] font-bold text-slate-400 uppercase font-sans">
                  FIXTURES
                </div>

                <div className="space-y-1.5">
                  {proposal.fixtures.map((fix) => {
                    const isPass = fix.status === "pass";

                    return (
                      <div
                        key={fix.caseRef}
                        className="p-2.5 rounded bg-slate-950 border border-slate-800 flex items-start gap-2.5"
                      >
                        <span className="mt-0.5">
                          {isPass ? (
                            <CheckCircle2 size={14} className="text-emerald-400" />
                          ) : (
                            <XCircle size={14} className="text-amber-400" />
                          )}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-200">
                              {isPass ? "✓" : "✗"} {fix.type}: {fix.caseRef}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 font-sans mt-0.5">
                            {fix.details}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action Buttons (§7.3: [ Reject ] [ Approve & ship ]) */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => router.push("/knowledge/rules")}
                  className="btn btn-secondary"
                >
                  Reject
                </button>
                <button
                  type="button"
                  onClick={handleApproveAndShip}
                  disabled={shipping}
                  className="btn btn-primary"
                >
                  {shipping ? <Loader2 size={14} className="animate-spin" /> : null}
                  Approve &amp; ship
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
