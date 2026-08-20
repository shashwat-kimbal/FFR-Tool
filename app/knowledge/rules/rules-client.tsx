"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Search, Plus, BookOpen } from "lucide-react";

interface RulesClientViewProps {
  initialRules: any[];
}

export default function RulesClientView({
  initialRules,
}: RulesClientViewProps) {
  const [rules, setRules] = useState<any[]>(initialRules);
  const [selectedId, setSelectedId] = useState<string>("DLMS-PRF-009");
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const filteredRules = rules.filter((r) => {
    const matchesQ = !search || r.id.toLowerCase().includes(search.toLowerCase()) || r.name.toLowerCase().includes(search.toLowerCase());
    const matchesGroup = groupFilter === "all" || r.group === groupFilter;
    const matchesStatus = statusFilter === "all" || (statusFilter === "enabled" ? r.enabled : !r.enabled);
    return matchesQ && matchesGroup && matchesStatus;
  });

  const handleToggleRule = async (ruleId: string, currentEnabled: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`/api/knowledge/rules/${ruleId}/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !currentEnabled }),
      });
      setRules((prev) =>
        prev.map((r) => (r.id === ruleId ? { ...r, enabled: !currentEnabled } : r)),
      );
    } catch {}
  };

  const selectedRule = rules.find((r) => r.id === selectedId) || rules[0];

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Knowledge Subnav Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <BookOpen size={20} className="text-blue-400" />
            Diagnostic Rules Catalogue
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            60 deterministic diagnostic checks grounded in DLMS standards.
          </p>
        </div>

        {/* Subnav & Teach Action */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-900 p-1 rounded-lg border border-slate-800 text-xs">
            <a
              href="/knowledge/mechanisms"
              className="px-3 py-1.5 rounded-md font-medium text-slate-400 hover:text-white"
            >
              Mechanisms
            </a>
            <a
              href="/knowledge/rules"
              className="px-3 py-1.5 rounded-md font-semibold bg-blue-600 text-white"
            >
              Rules (60)
            </a>
            <a
              href="/knowledge/rules/forge"
              className="px-3 py-1.5 rounded-md font-medium text-slate-400 hover:text-white"
            >
              Rule Forge
            </a>
          </div>

          <a href="/knowledge/rules/forge" className="btn btn-primary">
            <Plus size={14} /> Teach a new rule
          </a>
        </div>
      </div>

      {/* Filter Row */}
      <div className="filter-row">
        <div className="search-box">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="⌕ search 60 rules…"
          />
        </div>

        <div className="filter-group">
          <select
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
            className="filter-select"
          >
            <option value="all">Group▾ All Groups</option>
            <option value="Foundation">Foundation</option>
            <option value="Profile & data quality">Profile & data quality</option>
            <option value="Events">Events</option>
            <option value="Complaint context">Complaint context</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="filter-select"
          >
            <option value="all">Status▾ All</option>
            <option value="enabled">Enabled</option>
            <option value="disabled">Disabled</option>
          </select>
        </div>
      </div>

      {/* 2-Column Layout: Rule List + Sticky Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Rule List (5 cols) */}
        <div className="lg:col-span-5 space-y-1.5 max-h-[720px] overflow-y-auto pr-1">
          {filteredRules.map((r) => {
            const isSelected = r.id === selectedId;

            return (
              <div
                key={r.id}
                onClick={() => setSelectedId(r.id)}
                className={`p-3 rounded-lg border flex items-center justify-between text-xs transition-colors cursor-pointer ${
                  isSelected
                    ? "bg-blue-950 border-blue-500 shadow-sm"
                    : "bg-slate-900 border-slate-800 hover:border-slate-700"
                }`}
              >
                <div className="space-y-0.5 min-w-0 pr-2">
                  <div className="font-mono font-bold text-slate-200 truncate">{r.id}</div>
                  <div className="text-[11px] text-slate-400 truncate">{r.name}</div>
                </div>

                {/* Neutral Toggle (§7.2: neutral toggle, never an amber badge) */}
                <button
                  type="button"
                  onClick={(e) => handleToggleRule(r.id, r.enabled, e)}
                  className={`w-9 h-5 rounded-full transition-colors flex items-center p-0.5 cursor-pointer ${
                    r.enabled ? "bg-slate-700 justify-end" : "bg-slate-950 justify-start"
                  }`}
                  title={r.enabled ? "Rule is enabled (neutral toggle)" : "Rule is disabled"}
                >
                  <span
                    className={`w-4 h-4 rounded-full transition-all ${
                      r.enabled ? "bg-slate-200" : "bg-slate-600"
                    }`}
                  />
                </button>
              </div>
            );
          })}
        </div>

        {/* Right: Sticky Detail Panel (7 cols) */}
        {selectedRule && (
          <div className="lg:col-span-7 sticky top-20 bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-2xl space-y-5">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div>
                <div className="font-mono text-xs text-blue-400 font-bold mb-1">
                  {selectedRule.id} · {selectedRule.group}
                </div>
                <h2 className="text-lg font-bold text-white">{selectedRule.name}</h2>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700 uppercase">
                {selectedRule.severity || "HIGH"}
              </span>
            </div>

            {/* Backtest Ribbon */}
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-xs text-slate-300 flex items-center justify-between">
              <span>fires on <strong>{selectedRule.firesOnCount}</strong>/214</span>
              <span>·</span>
              <span>precision <strong className="text-emerald-400">{selectedRule.precision}</strong></span>
              <span>·</span>
              <span>fixtures: <strong>{selectedRule.fixturesCount}</strong></span>
            </div>

            {/* Detects */}
            <div className="space-y-1 text-xs">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                What this check detects
              </div>
              <p className="text-slate-300 leading-relaxed bg-slate-950 p-3 rounded-lg border border-slate-800">
                {selectedRule.description}
              </p>
            </div>

            {/* Why Matched / Limitation / Follow-up */}
            <div className="space-y-2.5 text-xs">
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-slate-400 font-semibold text-[11px]">Reasoning & Threshold:</span>
                <p className="text-slate-300">{selectedRule.why || "Matched because profile values crossed configured threshold."}</p>
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-amber-400 font-semibold text-[11px]">Limitations:</span>
                <p className="text-slate-300">{selectedRule.limitation || "Single-series check cannot prove physical component failure without cohort corroboration."}</p>
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-blue-400 font-semibold text-[11px]">Recommended Next Action:</span>
                <p className="text-slate-300">{selectedRule.followUp || "Cross-reference feeder cohort distribution."}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
