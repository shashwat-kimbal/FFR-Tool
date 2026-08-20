"use client";

import React, { useState } from "react";
import type { SparklinePoint, SparklineSummary } from "@/server/store/db.ts";

interface VoltageSparklineProps {
  pointsJson?: string | null;
  summaryJson?: string | null;
}

export function VoltageSparkline({ pointsJson, summaryJson }: VoltageSparklineProps) {
  const [hovered, setHovered] = useState(false);

  let points: SparklinePoint[] = [];
  let summary: SparklineSummary | null = null;

  try {
    if (pointsJson) points = JSON.parse(pointsJson);
    if (summaryJson) summary = JSON.parse(summaryJson);
  } catch {}

  if (!points.length) {
    return (
      <div className="w-[88px] h-[24px] bg-slate-800/40 border border-slate-800/60 rounded flex items-center justify-center text-[10px] text-slate-600">
        —
      </div>
    );
  }

  const width = 88;
  const height = 24;
  const paddingY = 2;

  // Determine bounds
  const minVal = 0;
  const maxVal = 280;

  // Build SVG segments
  const svgSegments: React.ReactNode[] = [];
  let lastX = 0;
  let lastY = height / 2;
  let truncationPos: { x: number; y: number } | null = null;

  const stepX = (width - 6) / Math.max(1, points.length - 1);

  points.forEach((pt, i) => {
    const x = 3 + i * stepX;
    const norm = Math.max(0, Math.min(1, (pt.avgV - minVal) / (maxVal - minVal)));
    const y = height - paddingY - norm * (height - paddingY * 2);

    if (pt.truncated && !truncationPos) {
      truncationPos = { x, y };
    }

    if (i > 0) {
      let strokeColor = "#64748b"; // neutral grey
      if (pt.avgV === 0 || pt.pctBelow > 0) {
        strokeColor = "#ef4444"; // Red below band (<207)
      } else if (pt.pctAbove > 0 || pt.avgV > 253) {
        strokeColor = "#f59e0b"; // Amber above band (>253)
      } else {
        strokeColor = "#3b82f6"; // Blue normal
      }

      svgSegments.push(
        <line
          key={i}
          x1={lastX}
          y1={lastY}
          x2={x}
          y2={y}
          stroke={strokeColor}
          strokeWidth="1.25"
          strokeLinecap="round"
        />,
      );
    }

    lastX = x;
    lastY = y;
  });

  return (
    <div
      className="relative inline-block cursor-crosshair"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <svg
        width={width}
        height={height}
        className="block bg-slate-950/70 border border-slate-800/80 rounded"
        viewBox={`0 0 ${width} ${height}`}
      >
        {/* Shaded baseline */}
        <line
          x1="0"
          y1={height - (230 / 280) * height}
          x2={width}
          y2={height - (230 / 280) * height}
          stroke="#1e293b"
          strokeDasharray="2,2"
          strokeWidth="1"
        />

        {svgSegments}

        {/* Truncation marker ✕ */}
        {truncationPos && (
          <g transform={`translate(${truncationPos.x}, ${Math.min(height - 4, Math.max(4, truncationPos.y))})`}>
            <line x1="-3" y1="-3" x2="3" y2="3" stroke="#ef4444" strokeWidth="1.5" />
            <line x1="3" y1="-3" x2="-3" y2="3" stroke="#ef4444" strokeWidth="1.5" />
          </g>
        )}
      </svg>

      {hovered && summary && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-48 p-2 rounded bg-slate-950 border border-slate-700 shadow-2xl text-[11px] text-slate-200 z-50 pointer-events-none whitespace-normal">
          <div className="font-semibold text-white border-b border-slate-800 pb-1 mb-1">
            90-Day Voltage Profile
          </div>
          <div className="flex justify-between py-0.5">
            <span className="text-slate-400">Min Voltage:</span>
            <span className="font-mono text-slate-200">{summary.minV} V</span>
          </div>
          <div className="flex justify-between py-0.5">
            <span className="text-slate-400">Max Voltage:</span>
            <span className="font-mono text-slate-200">{summary.maxV} V</span>
          </div>
          <div className="flex justify-between py-0.5">
            <span className="text-slate-400">&lt; 207 V (below):</span>
            <span className="font-mono text-red-400">{summary.pctBelow}%</span>
          </div>
          <div className="flex justify-between py-0.5">
            <span className="text-slate-400">&gt; 253 V (above):</span>
            <span className="font-mono text-amber-400">{summary.pctAbove}%</span>
          </div>
          {summary.truncationDate && (
            <div className="flex justify-between py-0.5 text-red-400 border-t border-slate-800/80 mt-1 pt-1">
              <span>✕ Truncated:</span>
              <span className="font-mono text-[10px]">{summary.truncationDate}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
