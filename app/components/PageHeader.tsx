"use client";

import React from "react";

interface PageHeaderProps {
  title: string;
  subline?: string;
  action?: React.ReactNode;
}

export function PageHeader({ title, subline, action }: PageHeaderProps) {
  return (
    <header className="h-16 flex items-center justify-between border-b border-slate-800/80 mb-6 pb-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-white">{title}</h1>
        {subline && <p className="text-xs text-slate-400 mt-0.5">{subline}</p>}
      </div>
      {action && <div className="flex items-center gap-3">{action}</div>}
    </header>
  );
}
