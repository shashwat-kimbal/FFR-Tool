"use client";

import React from "react";

export function SkeletonBox({ className = "" }: { className?: string }) {
  return <div className={`skeleton-box ${className}`} />;
}

export function QueueTableSkeleton() {
  return (
    <div className="w-full space-y-2 p-4">
      {/* 8 skeleton rows with exact column layout */}
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 py-3 px-4 rounded bg-slate-900/40 border border-slate-800/60"
        >
          <SkeletonBox className="w-4 h-4 rounded" />
          <SkeletonBox className="w-16 h-4" />
          <SkeletonBox className="w-24 h-4" />
          <SkeletonBox className="w-36 h-4" />
          {/* Sparkline grey block */}
          <SkeletonBox className="w-[88px] h-[24px] rounded" />
          <SkeletonBox className="w-44 h-4" />
          {/* Confidence 4 bars */}
          <div className="flex gap-1">
            <SkeletonBox className="w-3 h-3" />
            <SkeletonBox className="w-3 h-3" />
            <SkeletonBox className="w-3 h-3" />
            <SkeletonBox className="w-3 h-3" />
          </div>
          <SkeletonBox className="w-20 h-5 rounded-full" />
          <SkeletonBox className="w-28 h-4 ml-auto" />
          <SkeletonBox className="w-8 h-8 rounded-full" />
          <SkeletonBox className="w-10 h-4" />
        </div>
      ))}
    </div>
  );
}

export function VerdictSkeleton() {
  return (
    <div className="space-y-6 p-6">
      {/* Band 1: Leading cause */}
      <div className="p-6 rounded-lg bg-slate-900/40 border border-slate-800 space-y-4">
        <SkeletonBox className="w-32 h-4" />
        <SkeletonBox className="w-80 h-7" />
        <SkeletonBox className="w-full h-4 rounded-full" />
        <SkeletonBox className="w-3/4 h-12" />
        <div className="flex gap-4">
          <SkeletonBox className="w-24 h-6" />
          <SkeletonBox className="w-24 h-6" />
          <SkeletonBox className="w-24 h-6" />
        </div>
        <SkeletonBox className="w-full h-20 rounded-md" />
      </div>

      {/* Band 2: Alternatives */}
      <div className="p-6 rounded-lg bg-slate-900/40 border border-slate-800 space-y-3">
        <SkeletonBox className="w-36 h-4" />
        <SkeletonBox className="w-full h-10" />
        <SkeletonBox className="w-full h-10" />
        <SkeletonBox className="w-full h-10" />
      </div>

      {/* Band 3: What happened */}
      <div className="p-6 rounded-lg bg-slate-900/40 border border-slate-800 space-y-3">
        <SkeletonBox className="w-40 h-4" />
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonBox key={i} className="w-full h-6" />
        ))}
      </div>

      {/* Band 4: Evidence ledger */}
      <div className="p-6 rounded-lg bg-slate-900/40 border border-slate-800 space-y-3">
        <div className="flex gap-3">
          <SkeletonBox className="w-24 h-8 rounded" />
          <SkeletonBox className="w-24 h-8 rounded" />
          <SkeletonBox className="w-24 h-8 rounded" />
        </div>
        <SkeletonBox className="w-full h-16" />
        <SkeletonBox className="w-full h-16" />
      </div>
    </div>
  );
}

export function TimelineSkeleton() {
  return (
    <div className="p-6 space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          <SkeletonBox className="w-20 h-8 rounded" />
          <SkeletonBox className="w-20 h-8 rounded" />
          <SkeletonBox className="w-24 h-8 rounded" />
        </div>
        <SkeletonBox className="w-36 h-8 rounded" />
      </div>
      {/* Chart canvas area */}
      <SkeletonBox className="w-full h-[360px] rounded-lg" />
      {/* Event lanes */}
      <div className="space-y-2 pt-2">
        <SkeletonBox className="w-full h-7 rounded" />
        <SkeletonBox className="w-full h-7 rounded" />
        <SkeletonBox className="w-full h-7 rounded" />
        <SkeletonBox className="w-full h-7 rounded" />
      </div>
    </div>
  );
}
