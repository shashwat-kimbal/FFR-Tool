"use client";

import React, { useState, useRef, useEffect } from "react";

interface PopoverProps {
  content: React.ReactNode;
  label?: string;
  title?: string;
}

export function Popover({ content, label = "?", title }: PopoverProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  return (
    <div className="relative inline-block" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center justify-center w-4 h-4 rounded text-[10px] font-mono font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 hover:border-slate-500 transition-colors cursor-pointer"
        aria-label="Explain this"
      >
        {label}
      </button>

      {open && (
        <div className="absolute left-0 bottom-full mb-2 w-72 p-3 rounded-lg bg-slate-900 border border-slate-700 shadow-2xl text-slate-300 text-xs z-50 animate-in fade-in zoom-in-95 duration-100">
          {title && <div className="font-semibold text-white mb-1">{title}</div>}
          <div className="leading-relaxed text-slate-300">{content}</div>
        </div>
      )}
    </div>
  );
}
