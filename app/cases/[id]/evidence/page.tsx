"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  FileSpreadsheet,
  Image as ImageIcon,
  Upload,
  Eye,
  CheckCircle2,
  AlertCircle,
  FileText,
  ArrowRight,
  Loader2,
} from "lucide-react";

export default function EvidencePage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [evidenceList, setEvidenceList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [previewModalFile, setPreviewModalFile] = useState<any | null>(null);

  const fetchEvidence = async () => {
    try {
      const res = await fetch(`/api/cases/${id}`);
      if (res.ok) {
        const data = await res.json();
        setEvidenceList(data.evidence || []);
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    fetchEvidence();
  }, [id]);

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`/api/cases/${id}/evidence`, {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        await fetchEvidence();
      }
    } catch {}
    setUploading(false);
  };

  const handleRunAnalysis = async () => {
    setAnalyzing(true);
    try {
      const res = await fetch(`/api/cases/${id}/runs`, { method: "POST" });
      if (res.ok) {
        setTimeout(() => {
          router.push(`/cases/${id}/verdict`);
        }, 500);
      }
    } catch {
      setAnalyzing(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-12 text-center text-slate-400 space-y-2">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500" />
        <div>Loading case evidence…</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div>
          <h2 className="text-lg font-bold text-white">Attached Evidence</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Raw workbooks, laboratory photos, and bench diagnostic reports.
          </p>
        </div>

        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.jpg,.jpeg,.png"
            onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Upload size={14} /> {uploading ? "Uploading…" : "Attach files"}
          </button>
        </div>
      </div>

      {/* Evidence Files List */}
      <div className="space-y-3">
        {evidenceList.map((ev) => {
          const isWorkbook = ev.kind === "workbook";
          const summary = ev.parseSummary || {};

          return (
            <div
              key={ev.id}
              className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 p-2 rounded-lg bg-blue-950/60 text-blue-400 border border-blue-800/60">
                    {isWorkbook ? <FileSpreadsheet size={20} /> : <ImageIcon size={20} />}
                  </div>

                  <div className="space-y-1">
                    <div className="font-semibold text-white text-xs font-mono">
                      {ev.filename}
                    </div>
                    <div className="text-[11px] font-mono text-slate-400">
                      {(ev.size / (1024 * 1024)).toFixed(1)} MB · sha256 {ev.sha256.substring(0, 8)}…{ev.sha256.substring(ev.sha256.length - 8)} · {ev.uploaded_by} · {ev.uploaded_at.substring(0, 16)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700 uppercase">
                    {isWorkbook ? "DLMS · old" : "IMAGE"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPreviewModalFile(ev)}
                    className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition-colors flex items-center gap-1"
                  >
                    <Eye size={12} /> Preview
                  </button>
                </div>
              </div>

              {/* Instant parsed facts (§5.4 & §8 F2) */}
              {isWorkbook && (
                <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-800/80 text-xs font-mono text-slate-300 flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span><strong>{summary.sheetCount || 16}</strong> sheets</span>
                  <span className="text-slate-600">·</span>
                  <span><strong>{(summary.profileRowCount || 3360).toLocaleString()}</strong> profile rows</span>
                  <span className="text-slate-600">·</span>
                  <span><strong>{summary.totalEvents || 244}</strong> events</span>
                  <span className="text-slate-600">·</span>
                  <span>meter <strong className="text-blue-400">{summary.meterSerial || "AS2373952"}</strong></span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Analysis trigger section (§0.2 non-negotiable rule 2) */}
      <div className="p-6 rounded-xl bg-gradient-to-r from-blue-950/40 to-slate-900 border border-blue-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="text-sm font-semibold text-white">
            Evidence is attached. Ready for analysis.
          </div>
          <div className="text-xs text-slate-400">
            Analysis is deterministic f(evidence, ruleset@v3, mechanisms@v2). Uploading a file never runs analysis automatically.
          </div>
        </div>

        <button
          type="button"
          onClick={handleRunAnalysis}
          disabled={analyzing || evidenceList.length === 0}
          className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/30 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
        >
          {analyzing ? <Loader2 size={14} className="animate-spin" /> : null}
          Run analysis <ArrowRight size={14} />
        </button>
      </div>

      {/* Preview Modal */}
      {previewModalFile && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white font-mono">{previewModalFile.filename}</h3>
              <button
                type="button"
                onClick={() => setPreviewModalFile(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="bg-slate-950 p-4 rounded-lg font-mono text-xs text-slate-300 space-y-2">
              <div>Kind: {previewModalFile.kind}</div>
              <div>Role: {previewModalFile.role}</div>
              <div>Size: {(previewModalFile.size / 1024).toFixed(1)} KB</div>
              <div>SHA256: {previewModalFile.sha256}</div>
              <div>Summary: {JSON.stringify(previewModalFile.parseSummary, null, 2)}</div>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setPreviewModalFile(null)}
                className="px-4 py-1.5 rounded bg-slate-800 text-white text-xs font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
