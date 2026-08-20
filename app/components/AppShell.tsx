"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Inbox,
  GitFork,
  BookOpen,
  Menu,
  X,
  User,
} from "lucide-react";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  const navItems = [
    {
      label: "Queue",
      href: "/queue",
      icon: Inbox,
      active: pathname.startsWith("/queue") || pathname.startsWith("/cases") || pathname.startsWith("/imports"),
    },
    {
      label: "Cohorts",
      href: "/cohorts",
      icon: GitFork,
      active: pathname.startsWith("/cohorts"),
    },
    {
      label: "Knowledge",
      href: "/knowledge/mechanisms",
      icon: BookOpen,
      active: pathname.startsWith("/knowledge"),
    },
  ];

  return (
    <div className="app-layout">
      {/* Mobile / Tablet Top Header (<1024px) */}
      <header className="mobile-header">
        <div className="mobile-header-left">
          <button
            type="button"
            onClick={() => setDrawerOpen(!drawerOpen)}
            className="menu-btn"
            aria-label="Toggle navigation"
          >
            {drawerOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div className="brand-logo">
            <span className="brand-dot" />
            <span className="brand-text">KIMBAL</span>
          </div>
        </div>
        <div className="user-chip-mobile">
          <User size={14} />
        </div>
      </header>

      {/* Backdrop for Off-Canvas Drawer on < 1024px */}
      {drawerOpen && (
        <div
          className="drawer-backdrop"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* Navigation Rail (248px on >=1280px, 64px on 1024-1279px, off-canvas on <1024px) */}
      <aside className={`nav-rail ${drawerOpen ? "drawer-open" : ""}`}>
        {/* Brand Header */}
        <div className="rail-brand">
          <div className="brand-icon">K</div>
          <span className="brand-title">KIMBAL</span>
        </div>

        {/* Navigation Items (Exactly 3 items) */}
        <nav className="rail-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <a
                key={item.label}
                href={item.href}
                className={`rail-nav-item ${item.active ? "active" : ""}`}
                title={item.label}
              >
                <Icon size={18} className="rail-item-icon" />
                <span className="rail-item-label">{item.label}</span>
              </a>
            );
          })}
        </nav>

        {/* Bottom User Chip */}
        <div className="rail-footer">
          <div className="rail-user-card">
            <div className="user-avatar">
              <User size={16} />
            </div>
            <div className="user-details">
              <div className="user-name">Analyst</div>
              <div className="user-role">FFR</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        <div className="content-container">{children}</div>
      </main>
    </div>
  );
}
