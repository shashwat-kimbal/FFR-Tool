"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowLeft,
  ExternalLink,
  Loader2,
} from "lucide-react";

export default function ImportPreviewPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id);

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [committing, setCommitting] = useState(false);
  const [commitStatus, setCommitStatus] = useState("");

  useEffect(() => {
    fetch(`/api/imports/${id}`)
      .then((res) => res.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  const handleCommit = async () => {
    setCommitting(true);
    setCommitStatus(`Creating… ${data?.summary?.newRows || 19} of ${data?.summary?.newRows || 19}`);

    try {
      const res = await fetch(`/api/imports/${id}/commit`, { method: "POST" });
      const result = await res.json();
      setTimeout(() => {
        router.push("/queue");
      }, 500);
    } catch {
      router.push("/queue");
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-12 text-center text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500 mb-2" />
        <div>Loading reconciliation preview…</div>
      </div>
    );
  }

  const preview = data?.preview || [];
  const summary = data?.summary || { total: 24, newRows: 19, existingRows: 4, rejectedRows: 1 };
  const filename = data?.filename || "FFR_IG_Aug2026.xlsx";
  const sha256 = data?.sha256 || "4a1c9e8b2a5d3f109b3ac41f0d4d5df2";

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <Link
            href="/queue"
            className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-white">
              Import · {filename}
            </h1>
            <p className="text-xs font-mono text-slate-400 mt-0.5">
              sha256 {sha256.substring(0, 12)}…
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/queue"
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
          >
            Cancel
          </Link>
          <button
            type="button"
            onClick={handleCommit}
            disabled={committing || summary.newRows === 0}
            className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-600/30 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {committing ? commitStatus : `Create ${summary.newRows} cases`}
          </button>
        </div>
      </div>

      {/* Reconciliation Summary Bar */}
      <div className="grid grid-cols-4 gap-3 bg-slate-900/60 p-3 rounded-lg border border-slate-800 text-xs">
        <div className="text-center p-2 rounded bg-slate-950 border border-slate-800">
          <div className="text-slate-400">Total Rows Found</div>
          <div className="font-mono text-base font-bold text-white mt-1">{summary.total}</div>
        </div>
        <div className="text-center p-2 rounded bg-blue-950/40 border border-blue-800/60">
          <div className="text-blue-300 font-medium">New Cases</div>
          <div className="font-mono text-base font-bold text-blue-400 mt-1">{summary.newRows}</div>
        </div>
        <div className="text-center p-2 rounded bg-slate-950 border border-slate-800">
          <div className="text-slate-400">Already Imported</div>
          <div className="font-mono text-base font-bold text-slate-300 mt-1">{summary.existingRows}</div>
        </div>
        <div className="text-center p-2 rounded bg-red-950/40 border border-red-800/60">
          <div className="text-red-300">Rejected</div>
          <div className="font-mono text-base font-bold text-red-400 mt-1">{summary.rejectedRows}</div>
        </div>
      </div>

      {/* Reconciliation Table */}
      <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl overflow-hidden shadow-xl">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-950/80 text-slate-400 font-semibold uppercase text-[11px]">
              <th className="py-3 px-4 w-12 text-center">Status</th>
              <th className="py-3 px-4 w-20">Case</th>
              <th className="py-3 px-4 w-28">Meter Old</th>
              <th className="py-3 px-4 w-28">Meter New</th>
              <th className="py-3 px-4 w-40">Complaint</th>
              <th className="py-3 px-4">Action / Rejection Reason</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {preview.map((row: any, idx: number) => {
              const isWillCreate = row.status === "will_create";
              const isExists = row.status === "exists";
              const isRejected = row.status === "rejected";

              return (
                <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-3 px-4 text-center">
                    {isWillCreate ? (
                      <CheckCircle2 size={16} className="text-emerald-400 inline" />
                    ) : isExists ? (
                      <span className="text-amber-400 font-bold text-sm">⊘</span>
                    ) : (
                      <XCircle size={16} className="text-red-400 inline" />
                    )}
                  </td>
                  <td className="py-3 px-4 font-mono font-bold text-slate-200">
                    {row.caseRef}
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-300">
                    {row.meterOld}
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-400">
                    {row.meterNew || "—"}
                  </td>
                  <td className="py-3 px-4 text-slate-300">
                    {row.complaintLabel}
                  </td>
                  <td className="py-3 px-4">
                    {isWillCreate && (
                      <span className="text-emerald-400 font-medium">will create</span>
                    )}
                    {isExists && (
                      <span className="text-slate-400 flex items-center gap-1.5">
                        exists — imported 6 Aug
                        {row.existingCaseId && (
                          <Link
                            href={`/cases/${row.existingCaseId}/verdict`}
                            className="text-blue-400 hover:underline inline-flex items-center gap-0.5 ml-1"
                          >
                            [ open <ExternalLink size={10} /> ]
                          </Link>
                        )}
                      </span>
                    )}
                    {isRejected && (
                      <span className="text-red-400 font-mono text-[11px]">
                        {row.rejectionReason || "rejected: Old_Meter_Number is empty"}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
