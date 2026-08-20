"use client";

import React, { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { UploadCloud, FileSpreadsheet, AlertCircle, ArrowLeft, Loader2 } from "lucide-react";

export default function ImportNewPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
      setError("Please select an Excel workbook (.xlsx or .xls)");
      return;
    }

    setError(null);
    setUploading(true);
    setStatusText(`Uploading… ${(file.size / (1024 * 1024)).toFixed(1)} MB`);

    const formData = new FormData();
    formData.append("file", file);

    try {
      setTimeout(() => {
        setStatusText("Reading and reconciling server-side…");
      }, 400);

      const res = await fetch("/api/imports", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Upload failed with HTTP ${res.status}`);
      }

      const data = await res.json();
      router.push(`/imports/${data.importId}`);
    } catch (err: any) {
      setError(err.message || "Failed to upload and parse register");
      setUploading(false);
    }
  };

  const onDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
        <a
          href="/queue"
          className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={18} />
        </a>
        <div>
          <h1 className="text-xl font-bold text-white">Import FFR Register</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Upload an Excel register containing customer returns. Cases will be reconciled idempotently.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-950/40 border border-red-800 flex items-center gap-2 text-xs text-red-300">
          <AlertCircle size={16} className="text-red-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Upload Drop Zone */}
      <div
        onDragEnter={onDrag}
        onDragLeave={onDrag}
        onDragOver={onDrag}
        onDrop={onDrop}
        onClick={() => !uploading && fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-12 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-4 ${
          dragActive
            ? "border-blue-500 bg-blue-950/20"
            : "border-slate-700 hover:border-slate-500 bg-slate-900/40"
        } ${uploading ? "opacity-75 pointer-events-none" : ""}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          className="hidden"
        />

        {uploading ? (
          <div className="space-y-3">
            <Loader2 size={36} className="animate-spin text-blue-400 mx-auto" />
            <div className="text-sm font-semibold text-slate-200">{statusText}</div>
            <div className="text-xs text-slate-500">Checking for duplicate rows and verifying serials…</div>
          </div>
        ) : (
          <>
            <div className="w-16 h-16 rounded-full bg-blue-950/60 border border-blue-700/60 flex items-center justify-center text-blue-400">
              <UploadCloud size={32} />
            </div>
            <div className="space-y-1">
              <div className="text-sm font-semibold text-slate-200">
                Drop your FFR register workbook here
              </div>
              <div className="text-xs text-slate-400">
                or <span className="text-blue-400 underline">browse your files</span> (e.g. FFR_IG_Aug2026.xlsx)
              </div>
            </div>
            <div className="text-[11px] text-slate-500 max-w-sm">
              Server-side reconciliation compares against existing cases by (registerHash, rowNumber). Duplicate rows are skipped automatically.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
