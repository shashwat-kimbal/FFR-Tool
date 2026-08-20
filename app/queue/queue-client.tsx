"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Upload,
  UserCheck,
  Download,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";
import { StatusPill } from "@/app/components/StatusPill";
import { VoltageSparkline } from "@/app/components/VoltageSparkline";
import { ConfidenceDials } from "@/app/components/ConfidenceDials";
import { QueueTableSkeleton } from "@/app/components/Skeleton";
import type { CaseRow } from "@/server/store/db.ts";

export default function QueueClientView() {
  const router = useRouter();
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit] = useState(25);
  const [stats, setStats] = useState({ needsMe: 12, blocked: 8, awaitingReview: 23, closed: 41 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [mechFilter, setMechFilter] = useState("all");
  const [ageFilter, setAgeFilter] = useState("all");
  const [savedView, setSavedView] = useState("all");

  // Selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Fetch filtered cases
  const fetchCases = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        view: savedView,
        ...(search && { q: search }),
        ...(statusFilter !== "all" && { status: statusFilter }),
        ...(ownerFilter !== "all" && { owner: ownerFilter }),
        ...(mechFilter !== "all" && { mechanism: mechFilter }),
        ...(ageFilter !== "all" && { age: ageFilter }),
      });

      const res = await fetch(`/api/cases?${params.toString()}`);
      if (!res.ok) throw new Error(`Server returned HTTP ${res.status}`);
      const data = await res.json();
      setCases(data.cases || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
      if (data.stats) setStats(data.stats);
    } catch (err: any) {
      setError(err.message || "Failed to load queue cases");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCases();
  }, [page, search, statusFilter, ownerFilter, mechFilter, ageFilter, savedView]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(cases.map((c) => c.id));
    } else {
      setSelectedIds([]);
    }
  };

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleSavedViewChange = (viewKey: string) => {
    setSavedView(viewKey);
    setPage(1);
  };

  return (
    <div className="space-y-4">
      {/* Page Header (64px) (§4.1) */}
      <div className="page-header">
        <h1 className="page-title">
          Queue
          <span className="text-xs font-mono font-normal text-slate-400">
            ({total} cases)
          </span>
        </h1>
        <Link href="/imports/new" className="btn btn-primary">
          <Upload size={14} /> Import register
        </Link>
      </div>

      {/* Filter Row (52px) (§4.1) */}
      <div className="filter-row">
        {/* Search */}
        <div className="search-box">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="⌕ case ref, meter serial…"
          />
        </div>

        {/* Filter Dropdowns */}
        <div className="filter-group">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="filter-select"
          >
            <option value="all">Status▾ All</option>
            <option value="open">○ Open</option>
            <option value="evidence_ready">◐ Evidence ready</option>
            <option value="analysed">● Analysed</option>
            <option value="blocked">⛔ Blocked</option>
            <option value="in_review">◑ In review</option>
            <option value="closed">✓ Closed</option>
          </select>

          <select
            value={ownerFilter}
            onChange={(e) => {
              setOwnerFilter(e.target.value);
              setPage(1);
            }}
            className="filter-select"
          >
            <option value="all">Owner▾ All</option>
            <option value="SS">SS (Me)</option>
            <option value="RK">RK</option>
            <option value="AP">AP</option>
            <option value="VG">VG</option>
            <option value="unassigned">Unassigned</option>
          </select>

          <select
            value={mechFilter}
            onChange={(e) => {
              setMechFilter(e.target.value);
              setPage(1);
            }}
            className="filter-select"
          >
            <option value="all">Mechanism▾ All</option>
            <option value="Terminal degradation">Terminal degradation</option>
            <option value="Grid overvoltage">Grid overvoltage</option>
            <option value="SMPS defect">SMPS defect</option>
            <option value="Neutral open surge">Neutral open surge</option>
            <option value="Relay contact weld">Relay contact weld</option>
            <option value="Water ingress">Water ingress</option>
            <option value="Tamper / HV spark">Tamper / HV spark</option>
            <option value="No fault found">No fault found</option>
          </select>

          <select
            value={ageFilter}
            onChange={(e) => {
              setAgeFilter(e.target.value);
              setPage(1);
            }}
            className="filter-select"
          >
            <option value="all">Age▾ All</option>
            <option value="gt14">&gt; 14 days</option>
            <option value="gt30">&gt; 30 days</option>
            <option value="lte14">≤ 14 days</option>
          </select>

          <select
            value={savedView}
            onChange={(e) => handleSavedViewChange(e.target.value)}
            className="filter-select view-select"
          >
            <option value="all">Views▾ All Cases</option>
            <option value="needs_me">Views▾ Needs me</option>
            <option value="blocked_7d">Views▾ Blocked &gt; 7 days</option>
            <option value="high_conf_unadjudicated">Views▾ High confidence, unadjudicated</option>
          </select>
        </div>
      </div>

      {/* Stats Strip (56px) (§4.1) */}
      <div className="stats-strip">
        <button
          type="button"
          onClick={() => handleSavedViewChange("needs_me")}
          className={`stat-pill-btn ${savedView === "needs_me" ? "active" : ""}`}
        >
          <div className="stat-pill-label">
            <span className="stat-bar-indicator bg-blue-500" />
            <span>Needs me</span>
          </div>
          <span className="stat-pill-value">{stats.needsMe}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setStatusFilter("blocked");
            setSavedView("all");
          }}
          className={`stat-pill-btn ${statusFilter === "blocked" ? "active" : ""}`}
        >
          <div className="stat-pill-label">
            <span className="stat-bar-indicator bg-red-500" />
            <span>Blocked</span>
          </div>
          <span className="stat-pill-value text-red-400">{stats.blocked}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setStatusFilter("in_review");
            setSavedView("all");
          }}
          className={`stat-pill-btn ${statusFilter === "in_review" ? "active" : ""}`}
        >
          <div className="stat-pill-label">
            <span className="stat-bar-indicator bg-amber-500" />
            <span>Awaiting review</span>
          </div>
          <span className="stat-pill-value text-amber-300">{stats.awaitingReview}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setStatusFilter("closed");
            setSavedView("all");
          }}
          className={`stat-pill-btn ${statusFilter === "closed" ? "active" : ""}`}
        >
          <div className="stat-pill-label">
            <span className="stat-bar-indicator bg-emerald-500" />
            <span>Closed</span>
          </div>
          <span className="stat-pill-value text-emerald-400">{stats.closed}</span>
        </button>
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div className="bg-blue-950/80 border border-blue-700/60 rounded-lg p-3 flex items-center justify-between text-xs text-blue-200">
          <div>
            <strong>{selectedIds.length}</strong> case{selectedIds.length > 1 ? "s" : ""} selected
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => alert(`Assign ${selectedIds.length} cases`)}
              className="btn btn-primary btn-sm"
            >
              <UserCheck size={12} /> Assign
            </button>
            <button
              type="button"
              onClick={() => alert(`Export ${selectedIds.length} cases`)}
              className="btn btn-secondary btn-sm"
            >
              <Download size={12} /> Export
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="text-slate-400 hover:text-white px-2 py-1"
            >
              Deselect
            </button>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-lg bg-red-950/40 border border-red-800 flex items-center justify-between text-xs text-red-200">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-red-400" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={fetchCases}
            className="btn btn-secondary btn-sm"
          >
            <RotateCcw size={12} /> Retry
          </button>
        </div>
      )}

      {/* Table Container */}
      <div className="table-container">
        {loading ? (
          <QueueTableSkeleton />
        ) : cases.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <p className="text-sm font-semibold text-slate-300">
              {search || statusFilter !== "all"
                ? "No cases match these filters."
                : "No cases yet."}
            </p>
            <p className="text-xs text-slate-500">
              {search || statusFilter !== "all"
                ? "Try clearing filters to see the full queue."
                : "Import an FFR register to create your first batch."}
            </p>
            {search || statusFilter !== "all" ? (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setStatusFilter("all");
                  setOwnerFilter("all");
                  setMechFilter("all");
                  setAgeFilter("all");
                  setSavedView("all");
                  setPage(1);
                }}
                className="btn btn-secondary"
              >
                Clear filters
              </button>
            ) : (
              <Link href="/imports/new" className="btn btn-primary">
                Import register
              </Link>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="w-8 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.length === cases.length && cases.length > 0}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="cursor-pointer"
                      />
                    </th>
                    <th className="w-20">CASE</th>
                    <th className="w-28">METER</th>
                    <th className="w-40">COMPLAINT</th>
                    <th className="w-28">VOLTAGE</th>
                    <th>LEADING CAUSE</th>
                    <th className="w-20">CONF</th>
                    <th className="w-28">STATUS</th>
                    <th className="w-44">BLOCKER</th>
                    <th className="w-16 text-center">OWNER</th>
                    <th className="w-16 text-right">AGE</th>
                  </tr>
                </thead>
                <tbody>
                  {cases.map((c) => {
                    const isSelected = selectedIds.includes(c.id);
                    const isBlocked = c.status === "blocked";
                    const isOldAge = c.age_days > 14;

                    return (
                      <tr
                        key={c.id}
                        onClick={() => router.push(`/cases/${c.id}/verdict`)}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? "bg-blue-950/30" : ""
                        }`}
                      >
                        {/* 1. Select checkbox */}
                        <td className="text-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(c.id, {} as any)}
                            className="cursor-pointer"
                          />
                        </td>

                        {/* 2. Case (mono, 600) */}
                        <td className="font-mono font-bold text-slate-100">
                          {c.case_ref}
                        </td>

                        {/* 3. Meter serial */}
                        <td className="font-mono text-slate-300">
                          {c.meter_old}
                        </td>

                        {/* 4. Complaint */}
                        <td className="text-slate-300 truncate max-w-[160px]" title={c.complaint_label}>
                          {c.complaint_label}
                        </td>

                        {/* 5. Voltage Sparkline (88x24) */}
                        <td onClick={(e) => e.stopPropagation()}>
                          <VoltageSparkline
                            pointsJson={c.sparkline_points_json}
                            summaryJson={c.sparkline_summary_json}
                          />
                        </td>

                        {/* 6. Leading Cause */}
                        <td>
                          {c.leading_cause ? (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-medium text-slate-200">{c.leading_cause}</span>
                              {c.leading_family && (
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                                  {c.leading_family}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>

                        {/* 7. Confidence (4 micro-bars) */}
                        <td>
                          <ConfidenceDials
                            completeness={c.confidence_completeness}
                            discrimination={c.confidence_discrimination}
                            provenance={c.confidence_provenance}
                            cohort={c.confidence_cohort}
                            compact
                          />
                        </td>

                        {/* 8. Status */}
                        <td>
                          <StatusPill status={c.status} />
                        </td>

                        {/* 9. Blocker (only rendered when Blocked) */}
                        <td className="text-slate-400 truncate max-w-[180px]" title={c.blocked_reason || ""}>
                          {isBlocked && c.blocked_reason ? (
                            <span className="text-red-400 font-mono text-[11px]">{c.blocked_reason}</span>
                          ) : null}
                        </td>

                        {/* 10. Owner */}
                        <td className="text-center">
                          {c.assignee_email ? (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-950 border border-blue-700/60 text-[11px] font-semibold text-blue-300">
                              {c.assignee_email}
                            </span>
                          ) : (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full border border-dashed border-slate-700 text-[10px] text-slate-600">
                              —
                            </span>
                          )}
                        </td>

                        {/* 11. Age */}
                        <td className={`text-right font-mono tabular-nums ${isOldAge ? "text-red-400 font-bold" : "text-slate-400"}`}>
                          {c.age_days}d
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List View (<768px) */}
            <div className="md:hidden divide-y divide-slate-800/80">
              {cases.map((c) => (
                <div
                  key={c.id}
                  onClick={() => router.push(`/cases/${c.id}/verdict`)}
                  className="p-4 space-y-2.5 hover:bg-slate-800/40 transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm text-white">Case {c.case_ref}</span>
                      <span className="font-mono text-xs text-slate-400">{c.meter_old}</span>
                    </div>
                    <StatusPill status={c.status} />
                  </div>

                  <div className="text-xs text-slate-300">{c.complaint_label}</div>

                  <div className="flex items-center justify-between pt-1">
                    <VoltageSparkline
                      pointsJson={c.sparkline_points_json}
                      summaryJson={c.sparkline_summary_json}
                    />
                    <ConfidenceDials
                      completeness={c.confidence_completeness}
                      discrimination={c.confidence_discrimination}
                      provenance={c.confidence_provenance}
                      cohort={c.confidence_cohort}
                      compact
                    />
                    <div className={`font-mono text-xs ${c.age_days > 14 ? "text-red-400 font-bold" : "text-slate-400"}`}>
                      {c.age_days}d old
                    </div>
                  </div>

                  {c.leading_cause && (
                    <div className="text-xs font-medium text-slate-200 flex items-center gap-1.5">
                      <span>{c.leading_cause}</span>
                      {c.leading_family && (
                        <span className="px-1 py-0.2 rounded text-[10px] font-mono bg-slate-800 text-slate-400">
                          {c.leading_family}
                        </span>
                      )}
                    </div>
                  )}

                  {c.status === "blocked" && c.blocked_reason && (
                    <div className="text-xs text-red-400 bg-red-950/30 p-2 rounded border border-red-900/60 font-mono">
                      ⛔ {c.blocked_reason}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Pagination Footer */}
            <div className="table-footer">
              <div>
                Showing <strong className="text-slate-200 font-mono">{(page - 1) * limit + 1}–{Math.min(page * limit, total)}</strong> of{" "}
                <strong className="text-slate-200 font-mono">{total}</strong> cases
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="pagination-btn"
                >
                  <ChevronLeft size={16} />
                </button>

                {Array.from({ length: totalPages }).map((_, idx) => {
                  const pNum = idx + 1;
                  if (totalPages > 7 && pNum > 3 && pNum < totalPages - 2 && Math.abs(pNum - page) > 1) {
                    if (pNum === 4 || pNum === totalPages - 3) {
                      return <span key={pNum} className="px-1 text-slate-600 font-mono">…</span>;
                    }
                    return null;
                  }

                  return (
                    <button
                      key={pNum}
                      type="button"
                      onClick={() => setPage(pNum)}
                      className={`pagination-btn ${page === pNum ? "active" : ""}`}
                    >
                      {pNum}
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="pagination-btn"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
