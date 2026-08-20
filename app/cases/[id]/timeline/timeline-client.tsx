"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  RotateCcw,
  Sparkles,
  Zap,
  ArrowRight,
} from "lucide-react";
import { TimelineSkeleton } from "@/app/components/Skeleton";

interface TimelineClientViewProps {
  caseId: string;
  caseData: any;
}

export default function TimelineClientView({
  caseId,
  caseData,
}: TimelineClientViewProps) {
  const [channel, setChannel] = useState<"voltage" | "current" | "power_factor">("voltage");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Brushing & hover state
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [brushStart, setBrushStart] = useState<number | null>(null);
  const [brushEnd, setBrushEnd] = useState<number | null>(null);
  const [isBrushing, setIsBrushing] = useState(false);
  const [brushedRange, setBrushedRange] = useState<{ from: string; to: string } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  const fetchSeries = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/series?channel=${channel}`);
      if (res.ok) {
        const d = await res.json();
        setData(d);
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    fetchSeries();
  }, [caseId, channel]);

  const points: Array<{ timestamp: string; value: number; formattedDate: string }> = data?.points || [];
  const bands = data?.bands || { nominal: 230, upper: 253, lower: 207, unit: "V", nominalLabel: "nominal (assumed ⚠)", fallbackAssumed: true };
  const eventLanes = data?.eventLanes || [];
  const truncation = data?.truncation;
  const defectReported = data?.defectReported;

  // Chart dimensions
  const chartWidth = 960;
  const chartHeight = 320;
  const paddingLeft = 50;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 30;

  const innerWidth = chartWidth - paddingLeft - paddingRight;
  const innerHeight = chartHeight - paddingTop - paddingBottom;

  const minVal = channel === "voltage" ? 0 : channel === "current" ? 0 : 0;
  const maxVal = channel === "voltage" ? 280 : channel === "current" ? 35 : 1.1;

  const getY = (val: number) => {
    const norm = Math.max(0, Math.min(1, (val - minVal) / (maxVal - minVal)));
    return paddingTop + innerHeight - norm * innerHeight;
  };

  const getX = (idx: number) => {
    return paddingLeft + (idx / Math.max(1, points.length - 1)) * innerWidth;
  };

  // Build SVG path
  let pathD = "";
  points.forEach((p, i) => {
    const x = getX(i);
    const y = getY(p.value);
    pathD += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
  });

  // Handle Brush Drag
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current || points.length === 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const normX = Math.max(0, Math.min(1, (mouseX - paddingLeft) / innerWidth));
    const idx = Math.round(normX * (points.length - 1));
    setBrushStart(idx);
    setBrushEnd(idx);
    setIsBrushing(true);
    setBrushedRange(null);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current || points.length === 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const normX = Math.max(0, Math.min(1, (mouseX - paddingLeft) / innerWidth));
    const idx = Math.round(normX * (points.length - 1));
    setHoverIndex(idx);

    if (isBrushing) {
      setBrushEnd(idx);
    }
  };

  const handleMouseUp = () => {
    if (isBrushing && brushStart !== null && brushEnd !== null) {
      setIsBrushing(false);
      const startIdx = Math.min(brushStart, brushEnd);
      const endIdx = Math.max(brushStart, brushEnd);
      if (endIdx - startIdx > 2 && points[startIdx] && points[endIdx]) {
        setBrushedRange({
          from: points[startIdx].formattedDate,
          to: points[endIdx].formattedDate,
        });
      } else {
        setBrushStart(null);
        setBrushEnd(null);
        setBrushedRange(null);
      }
    }
  };

  const resetBrush = () => {
    setBrushStart(null);
    setBrushEnd(null);
    setBrushedRange(null);
  };

  if (loading) {
    return <TimelineSkeleton />;
  }

  // Calculate brush rect coordinates
  let brushLeftX = 0;
  let brushWidthX = 0;
  if (brushStart !== null && brushEnd !== null) {
    const startIdx = Math.min(brushStart, brushEnd);
    const endIdx = Math.max(brushStart, brushEnd);
    brushLeftX = getX(startIdx);
    brushWidthX = Math.max(2, getX(endIdx) - brushLeftX);
  }

  return (
    <div className="max-w-5xl mx-auto space-y-4 pb-12">
      {/* Top Toolbar: Series Switcher & Range Info (§5.3) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-lg border border-slate-800 text-xs">
        {/* Switcher */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setChannel("voltage");
              resetBrush();
            }}
            className={`btn btn-sm ${channel === "voltage" ? "btn-primary" : "btn-secondary"}`}
          >
            Voltage
          </button>
          <button
            type="button"
            onClick={() => {
              setChannel("current");
              resetBrush();
            }}
            className={`btn btn-sm ${channel === "current" ? "btn-primary" : "btn-secondary"}`}
          >
            Current
          </button>
          <button
            type="button"
            onClick={() => {
              setChannel("power_factor");
              resetBrush();
            }}
            className={`btn btn-sm ${channel === "power_factor" ? "btn-primary" : "btn-secondary"}`}
          >
            Power factor
          </button>
        </div>

        {/* Date Span & Reset */}
        <div className="flex items-center gap-3 font-mono text-slate-300">
          <span>28 Mar 2026 ──────── 30 Jun 2026</span>
          <button
            type="button"
            onClick={resetBrush}
            title="Reset zoom & selection"
            className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <RotateCcw size={14} />
          </button>
        </div>
      </div>

      {/* Main Instrument Container */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          setHoverIndex(null);
          if (isBrushing) setIsBrushing(false);
        }}
        className="relative bg-slate-950 border border-slate-800 rounded-xl p-4 shadow-2xl select-none"
      >
        {/* SVG Chart */}
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="w-full h-auto block overflow-visible cursor-crosshair"
        >
          {/* Y Axis Grid & Labels */}
          {channel === "voltage" && (
            <>
              {/* Amber Band Above 253V */}
              <rect
                x={paddingLeft}
                y={paddingTop}
                width={innerWidth}
                height={Math.max(0, getY(253) - paddingTop)}
                fill="rgba(245, 158, 11, 0.08)"
              />
              <line
                x1={paddingLeft}
                y1={getY(253)}
                x2={paddingLeft + innerWidth}
                y2={getY(253)}
                stroke="#d97706"
                strokeDasharray="3,3"
                strokeWidth="1"
              />
              <text
                x={paddingLeft + innerWidth - 8}
                y={getY(253) - 6}
                textAnchor="end"
                className="fill-amber-400 font-mono text-[10px]"
              >
                amber band (&gt;253)
              </text>

              {/* Nominal Centerline (230V) */}
              <line
                x1={paddingLeft}
                y1={getY(230)}
                x2={paddingLeft + innerWidth}
                y2={getY(230)}
                stroke="#334155"
                strokeWidth="1"
              />
              <text
                x={paddingLeft + innerWidth - 8}
                y={getY(230) - 4}
                textAnchor="end"
                className="fill-amber-500 font-mono text-[10px]"
              >
                nominal (assumed ⚠)
              </text>

              {/* Amber Band Below 207V */}
              <rect
                x={paddingLeft}
                y={getY(207)}
                width={innerWidth}
                height={Math.max(0, getY(0) - getY(207))}
                fill="rgba(245, 158, 11, 0.08)"
              />
              <line
                x1={paddingLeft}
                y1={getY(207)}
                x2={paddingLeft + innerWidth}
                y2={getY(207)}
                stroke="#d97706"
                strokeDasharray="3,3"
                strokeWidth="1"
              />
              <text
                x={paddingLeft + innerWidth - 8}
                y={getY(207) + 12}
                textAnchor="end"
                className="fill-amber-400 font-mono text-[10px]"
              >
                amber band (&lt;207)
              </text>

              {/* Y Axis numbers */}
              <text x={paddingLeft - 8} y={getY(260) + 4} textAnchor="end" className="fill-slate-500 font-mono text-[10px]">260</text>
              <text x={paddingLeft - 8} y={getY(230) + 4} textAnchor="end" className="fill-slate-500 font-mono text-[10px]">230</text>
              <text x={paddingLeft - 8} y={getY(207) + 4} textAnchor="end" className="fill-slate-500 font-mono text-[10px]">207</text>
              <text x={paddingLeft - 8} y={getY(0) + 4} textAnchor="end" className="fill-slate-500 font-mono text-[10px]">0</text>
            </>
          )}

          {/* X Axis Baseline */}
          <line
            x1={paddingLeft}
            y1={paddingTop + innerHeight}
            x2={paddingLeft + innerWidth}
            y2={paddingTop + innerHeight}
            stroke="#334155"
            strokeWidth="1"
          />

          {/* Time Series Curve */}
          <path
            d={pathD}
            fill="none"
            stroke="#38bdf8"
            strokeWidth="2"
            strokeLinejoin="round"
          />

          {/* Truncation Marker ✕ (5 Jun 18:30) */}
          {truncation && (
            <g transform={`translate(${paddingLeft + innerWidth * 0.76}, ${getY(0)})`}>
              <circle r="10" fill="rgba(220, 38, 38, 0.2)" stroke="#ef4444" strokeWidth="1.5" />
              <line x1="-5" y1="-5" x2="5" y2="5" stroke="#ef4444" strokeWidth="2" />
              <line x1="5" y1="-5" x2="-5" y2="5" stroke="#ef4444" strokeWidth="2" />
              <text y="-14" textAnchor="middle" className="fill-red-400 font-bold font-mono text-[10px]">
                ✕ 5 Jun 18:30 (Death)
              </text>
            </g>
          )}

          {/* Defect Reported Marker ⚑ (16 Jun) */}
          {defectReported && (
            <g transform={`translate(${paddingLeft + innerWidth * 0.85}, ${paddingTop + 30})`}>
              <line x1="0" y1="0" x2="0" y2={innerHeight - 30} stroke="#f59e0b" strokeDasharray="3,3" strokeWidth="1.5" />
              <text y="-8" textAnchor="middle" className="fill-amber-400 font-bold font-mono text-[10px]">
                ⚑ 16 Jun (Reported)
              </text>
            </g>
          )}

          {/* Brush selection highlight overlay */}
          {brushStart !== null && brushEnd !== null && (
            <rect
              x={brushLeftX}
              y={paddingTop}
              width={brushWidthX}
              height={innerHeight}
              fill="rgba(59, 130, 246, 0.25)"
              stroke="#3b82f6"
              strokeWidth="1.5"
            />
          )}

          {/* Hover Crosshair */}
          {hoverIndex !== null && points[hoverIndex] && (
            <g>
              <line
                x1={getX(hoverIndex)}
                y1={paddingTop}
                x2={getX(hoverIndex)}
                y2={paddingTop + innerHeight}
                stroke="#94a3b8"
                strokeDasharray="2,2"
                strokeWidth="1"
              />
              <circle
                cx={getX(hoverIndex)}
                cy={getY(points[hoverIndex].value)}
                r="4"
                fill="#38bdf8"
                stroke="#ffffff"
                strokeWidth="1.5"
              />
            </g>
          )}
        </svg>

        {/* Floating Crosshair Info Box */}
        {hoverIndex !== null && points[hoverIndex] && !brushedRange && (
          <div
            className="absolute top-6 left-16 bg-slate-900 border border-slate-700 px-3 py-1.5 rounded text-xs font-mono text-slate-200 pointer-events-none shadow-xl"
          >
            <span className="text-slate-400">{points[hoverIndex].formattedDate}</span>
            <span className="text-slate-600"> │ </span>
            <span className="text-blue-400 font-bold">{points[hoverIndex].value} {bands.unit}</span>
          </div>
        )}

        {/* Floating Action Toolbar on Brush Selection (§5.3 & §8 F5) */}
        {brushedRange && (
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-slate-900 border-2 border-blue-500 rounded-xl p-4 shadow-2xl text-xs text-white space-y-3 z-30">
            <div className="flex items-center justify-between gap-4 border-b border-slate-800 pb-2">
              <div className="font-semibold text-blue-300 flex items-center gap-1.5">
                <Sparkles size={14} className="text-blue-400" />
                Brushed Window: {brushedRange.from} → {brushedRange.to}
              </div>
              <button
                type="button"
                onClick={resetBrush}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="text-[11px] text-slate-300">
              Selected 5-day window shows accelerating interruptions before truncation.
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => alert(`Explaining window: ${brushedRange.from} - ${brushedRange.to}`)}
                className="btn btn-secondary btn-sm"
              >
                Explain this window
              </button>
              <Link
                href={`/knowledge/rules/forge?caseId=${caseId}&series=${channel}&from=${encodeURIComponent(brushedRange.from)}&to=${encodeURIComponent(brushedRange.to)}`}
                className="btn btn-primary btn-sm"
              >
                Teach a rule from this →
              </Link>
            </div>
          </div>
        )}

        {/* Event Lanes Below Chart (§5.3) */}
        <div className="mt-4 pt-3 border-t border-slate-800 space-y-2">
          <div className="text-[11px] font-bold tracking-wider text-slate-400 uppercase mb-2">
            Event Lanes (16 circular buffers)
          </div>

          {eventLanes.map((lane: any) => (
            <div
              key={lane.id}
              className="flex items-center gap-3 p-2 rounded-lg bg-slate-900/40 border border-slate-800 text-xs font-mono"
            >
              {/* Lane Name + Saturation indicator */}
              <div className="w-28 flex items-center gap-1.5 shrink-0">
                {lane.earlierLost && (
                  <span
                    className="text-amber-400 font-bold text-sm cursor-help"
                    title="Buffer saturated (50 entries) — earlier events lost"
                  >
                    ⟨
                  </span>
                )}
                <span className="font-semibold text-slate-300">{lane.name}</span>
              </div>

              {/* Event Markers Strip */}
              <div className="flex-1 relative h-4 bg-slate-950 rounded flex items-center px-2">
                {lane.staleNote ? (
                  <span className="text-slate-600 italic text-[11px]">{lane.staleNote}</span>
                ) : (
                  lane.events.map((evt: any, i: number) => (
                    <span
                      key={i}
                      className="inline-block w-2.5 h-2.5 rounded-[1px] mr-1.5 cursor-pointer hover:scale-125 transition-transform"
                      style={{ backgroundColor: lane.color }}
                      title={`${evt.label} at ${evt.ts}`}
                    />
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="text-xs text-slate-400 flex items-center justify-between">
        <div>Drag to select a window.</div>
        <div className="flex items-center gap-4">
          <span className="text-red-400">✕ truncation</span>
          <span className="text-amber-400">⚑ defect reported</span>
        </div>
      </div>
    </div>
  );
}
