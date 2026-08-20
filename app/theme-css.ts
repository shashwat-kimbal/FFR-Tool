export const THEME_CSS = `
/* ==========================================================================
   KIMBAL — Fast Failure Resolution (FFR) Design System
   Strict adherence to docs/FFR_BUILD_SPEC.md & docs/FFR_UI_UX_DESIGN_SYSTEM.md
   ========================================================================== */

:root {
  --font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --font-mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;

  /* Theme Palette */
  --bg-app: #090d16;
  --bg-rail: #0b1120;
  --bg-surface: #0f172a;
  --bg-surface-elevated: #1e293b;
  --bg-surface-subtle: #131d31;
  --bg-card: #0f172a;

  --border-subtle: #1e293b;
  --border-muted: #334155;
  --border-active: #475569;

  /* Typography Colors */
  --text-primary: #f8fafc;
  --text-secondary: #94a3b8;
  --text-muted: #64748b;
  --text-faint: #475569;

  /* Accent — Kimbal Blue */
  --accent-primary: #2563eb;
  --accent-hover: #1d4ed8;
  --accent-subtle: rgba(37, 99, 235, 0.15);
  --accent-border: rgba(37, 99, 235, 0.4);

  /* Semantic Colors */
  --semantic-good: #16a34a;
  --semantic-good-bg: rgba(22, 163, 74, 0.15);
  --semantic-warn: #d97706;
  --semantic-warn-bg: rgba(217, 119, 6, 0.15);
  --semantic-danger: #dc2626;
  --semantic-danger-bg: rgba(220, 38, 38, 0.15);
  --semantic-neutral: #64748b;
  --semantic-neutral-bg: rgba(100, 116, 139, 0.15);

  /* Evidence Color Axis */
  --ev-source: #3b82f6;
  --ev-source-bg: rgba(59, 130, 246, 0.12);
  --ev-calc: #14b8a6;
  --ev-calc-bg: rgba(20, 184, 166, 0.12);
  --ev-assumed: #f59e0b;
  --ev-assumed-bg: rgba(245, 158, 11, 0.12);
  --ev-missing: #94a3b8;
  --ev-missing-bg: rgba(148, 163, 184, 0.08);

  /* Geometry */
  --h-header: 64px;
  --h-case-header: 96px;
  --w-rail: 248px;
  --w-rail-min: 64px;
  --w-content: 1440px;
  --r-sm: 4px;
  --r-md: 8px;
  --r-lg: 12px;
}

/* Reset & Box Sizing */
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html, body {
  background-color: var(--bg-app);
  color: var(--text-primary);
  font-family: var(--font-family);
  font-size: 14px;
  line-height: 21px;
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
}

a { color: inherit; text-decoration: none; }
button, input, select, textarea { font-family: inherit; font-size: inherit; color: inherit; }

.font-mono { font-family: var(--font-mono); }
.tabular-nums { font-variant-numeric: tabular-nums; }

/* 7 Typography Token Roles */
.t-display { font-size: 28px; line-height: 34px; font-weight: 600; }
.t-title { font-size: 20px; line-height: 27px; font-weight: 600; }
.t-subtitle { font-size: 16px; line-height: 24px; font-weight: 600; }
.t-body { font-size: 14px; line-height: 21px; font-weight: 400; }
.t-data { font-size: 13px; line-height: 19px; font-weight: 400; }
.t-meta { font-size: 12px; line-height: 17px; font-weight: 400; }
.t-label { font-size: 11px; line-height: 15px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; }

/* ==========================================================================
   Application Shell Layout (§3)
   ========================================================================== */

.app-layout {
  display: flex;
  min-height: 100vh;
  background-color: var(--bg-app);
}

.mobile-header {
  display: none;
  height: 64px;
  background-color: var(--bg-surface);
  border-bottom: 1px solid var(--border-subtle);
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  position: sticky;
  top: 0;
  z-index: 40;
}

.mobile-header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.menu-btn {
  background: transparent;
  border: 0;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 6px;
  border-radius: var(--r-sm);
  display: flex;
  align-items: center;
  justify-content: center;
}

.menu-btn:hover {
  background-color: var(--border-subtle);
  color: var(--text-primary);
}

.brand-logo {
  display: flex;
  align-items: center;
  gap: 8px;
}

.brand-dot {
  width: 10px;
  height: 10px;
  background-color: var(--accent-primary);
  border-radius: 2px;
}

.brand-text {
  font-weight: 700;
  letter-spacing: 0.08em;
  color: #60a5fa;
  font-size: 16px;
}

.user-chip-mobile {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: rgba(37, 99, 235, 0.2);
  border: 1px solid rgba(59, 130, 246, 0.4);
  color: #93c5fd;
  font-size: 11px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Nav Rail */
.nav-rail {
  width: var(--w-rail);
  background-color: var(--bg-rail);
  border-right: 1px solid var(--border-subtle);
  position: fixed;
  top: 0;
  bottom: 0;
  left: 0;
  z-index: 50;
  display: flex;
  flex-direction: column;
  transition: width 0.2s, transform 0.2s;
}

.rail-brand {
  height: var(--h-header);
  display: flex;
  align-items: center;
  padding: 0 20px;
  border-bottom: 1px solid var(--border-subtle);
  gap: 12px;
}

.brand-icon {
  width: 28px;
  height: 28px;
  background-color: var(--accent-primary);
  border-radius: var(--r-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 14px;
  color: white;
  box-shadow: 0 2px 10px rgba(37, 99, 235, 0.35);
}

.brand-title {
  font-weight: 700;
  letter-spacing: 0.08em;
  font-size: 16px;
  color: var(--text-primary);
}

.rail-nav {
  flex: 1;
  padding: 16px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.rail-nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-radius: var(--r-md);
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  transition: all 0.15s;
}

.rail-nav-item:hover {
  background-color: rgba(30, 41, 59, 0.6);
  color: var(--text-primary);
}

.rail-nav-item.active {
  background-color: var(--accent-subtle);
  color: #60a5fa;
  border: 1px solid var(--accent-border);
  font-weight: 600;
}

.rail-item-icon { flex-shrink: 0; }

.rail-footer {
  padding: 14px 12px;
  border-top: 1px solid var(--border-subtle);
}

.rail-user-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 10px;
  border-radius: var(--r-md);
  cursor: pointer;
}

.user-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background-color: #0f1d40;
  border: 1px solid rgba(59, 130, 246, 0.5);
  color: #93c5fd;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
}

.user-details { overflow: hidden; }
.user-name { font-size: 12px; font-weight: 600; color: var(--text-primary); }
.user-role { font-size: 11px; color: var(--text-muted); }

.main-content {
  flex: 1;
  min-width: 0;
  padding-left: var(--w-rail);
  transition: padding-left 0.2s;
}

.content-container {
  max-width: var(--w-content);
  margin: 0 auto;
  padding: 24px;
}

/* Responsive Rail Breakpoints */
@media (min-width: 1024px) and (max-width: 1279px) {
  .nav-rail { width: var(--w-rail-min); }
  .brand-title, .rail-item-label, .user-details { display: none; }
  .rail-brand { padding: 0 16px; justify-content: center; }
  .rail-nav { padding: 16px 6px; }
  .rail-nav-item { justify-content: center; padding: 10px; }
  .rail-user-card { justify-content: center; padding: 6px 0; }
  .main-content { padding-left: var(--w-rail-min); }
}

@media (max-width: 1023px) {
  .app-layout { flex-direction: column; }
  .mobile-header { display: flex; }
  .nav-rail { transform: translateX(-100%); width: var(--w-rail); }
  .nav-rail.drawer-open { transform: translateX(0); }
  .drawer-backdrop { position: fixed; inset: 0; background-color: rgba(0, 0, 0, 0.7); backdrop-filter: blur(4px); z-index: 45; }
  .main-content { padding-left: 0; }
  .content-container { padding: 16px; }
}

/* ==========================================================================
   Page Headers & Sticky Headers (§4.1 & §5.1)
   ========================================================================== */

.page-header {
  height: var(--h-header);
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--border-subtle);
  margin-bottom: 20px;
  padding-bottom: 12px;
}

.page-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 8px;
}

.case-header-sticky {
  position: sticky;
  top: 0;
  z-index: 30;
  background-color: rgba(11, 17, 32, 0.95);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border-subtle);
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
  margin: -24px -24px 24px -24px;
  padding: 16px 24px 0 24px;
}

.case-header-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding-bottom: 12px;
}

.case-identity-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.case-back-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--text-muted);
}
.case-back-link:hover { color: var(--text-primary); }

.case-ref-title {
  font-family: var(--font-mono);
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
}

.case-subline-1 {
  font-size: 12px;
  color: var(--text-secondary);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-top: 2px;
}

.case-subline-2 {
  font-size: 11px;
  color: var(--text-muted);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-top: 2px;
}

.case-tabs-row {
  display: flex;
  align-items: center;
  gap: 4px;
  border-top: 1px solid var(--border-subtle);
  margin: 0 -24px;
  padding: 0 24px;
}

.case-tab-item {
  padding: 10px 16px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-muted);
  border-bottom: 2px solid transparent;
  transition: all 0.15s;
}

.case-tab-item:hover {
  color: var(--text-primary);
  border-bottom-color: var(--border-muted);
}

.case-tab-item.active {
  color: #60a5fa;
  font-weight: 600;
  border-bottom-color: var(--accent-primary);
  background: rgba(37, 99, 235, 0.08);
}

/* ==========================================================================
   Buttons & Controls
   ========================================================================== */

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 36px;
  padding: 0 16px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.15s;
  white-space: nowrap;
}

.btn-primary {
  background-color: var(--accent-primary);
  color: #ffffff;
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
}
.btn-primary:hover { background-color: var(--accent-hover); }

.btn-secondary {
  background-color: var(--bg-surface-elevated);
  border-color: var(--border-muted);
  color: var(--text-secondary);
}
.btn-secondary:hover {
  background-color: var(--border-active);
  color: var(--text-primary);
}

.btn-danger {
  background-color: #dc2626;
  color: #ffffff;
  box-shadow: 0 4px 12px rgba(220, 38, 38, 0.3);
}
.btn-danger:hover { background-color: #b91c1c; }

.btn-sm {
  height: 28px;
  padding: 0 10px;
  font-size: 11px;
}

/* ==========================================================================
   Status Pills (§4.3)
   ========================================================================== */

.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  border: 1px solid transparent;
  white-space: nowrap;
}

.status-open {
  background-color: rgba(30, 41, 59, 0.6);
  border-color: #334155;
  color: #94a3b8;
}

.status-ready {
  background-color: rgba(14, 165, 233, 0.12);
  border-color: rgba(14, 165, 233, 0.3);
  color: #38bdf8;
}

.status-analysed {
  background-color: rgba(37, 99, 235, 0.15);
  border-color: rgba(37, 99, 235, 0.4);
  color: #60a5fa;
}

.status-blocked {
  background-color: rgba(220, 38, 38, 0.15);
  border-color: rgba(220, 38, 38, 0.4);
  color: #f87171;
}

.status-in-review {
  background-color: rgba(217, 119, 6, 0.15);
  border-color: rgba(217, 119, 6, 0.4);
  color: #fbbf24;
}

.status-closed {
  background-color: rgba(22, 163, 74, 0.15);
  border-color: rgba(22, 163, 74, 0.4);
  color: #4ade80;
}

/* ==========================================================================
   Filter Row & Stats Strip (§4.1)
   ========================================================================== */

.filter-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  background-color: rgba(15, 23, 42, 0.6);
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid #1e293b;
  margin-bottom: 16px;
}

.search-box {
  position: relative;
  flex: 1;
  min-width: 220px;
  max-width: 340px;
}

.search-box input {
  width: 100%;
  padding: 6px 12px 6px 32px;
  background-color: #090d16;
  border: 1px solid #334155;
  border-radius: 6px;
  font-size: 12px;
  color: #f8fafc;
}

.search-box input:focus {
  outline: none;
  border-color: #2563eb;
}

.filter-group {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.filter-select {
  padding: 6px 10px;
  background-color: #090d16;
  border: 1px solid #334155;
  border-radius: 6px;
  font-size: 12px;
  color: #94a3b8;
  cursor: pointer;
}
.filter-select:focus {
  outline: none;
  border-color: #2563eb;
}

.view-select {
  background-color: rgba(15, 29, 64, 0.8);
  border-color: rgba(59, 130, 246, 0.4);
  color: #93c5fd;
  font-weight: 600;
}

.stats-strip {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}

.stat-pill-btn {
  padding: 12px 16px;
  border-radius: 8px;
  border: 1px solid #1e293b;
  background-color: rgba(15, 23, 42, 0.5);
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  transition: all 0.15s;
}

.stat-pill-btn:hover {
  border-color: #334155;
}

.stat-pill-btn.active {
  border-color: #2563eb;
  background-color: rgba(37, 99, 235, 0.15);
}

.stat-pill-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 500;
  color: #94a3b8;
}

.stat-bar-indicator {
  width: 4px;
  height: 14px;
  border-radius: 2px;
}

.stat-pill-value {
  font-family: var(--font-mono);
  font-size: 16px;
  font-weight: 700;
  color: #f8fafc;
}

/* ==========================================================================
   Tables & Lists
   ========================================================================== */

.table-container {
  background-color: rgba(15, 23, 42, 0.4);
  border: 1px solid #1e293b;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.25);
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: 12px;
}

.data-table th {
  padding: 12px 14px;
  background-color: rgba(2, 6, 23, 0.8);
  color: #64748b;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  border-bottom: 1px solid #1e293b;
}

.data-table td {
  padding: 12px 14px;
  border-bottom: 1px solid rgba(30, 41, 59, 0.5);
  color: #94a3b8;
  vertical-align: middle;
}

.data-table tr:hover td {
  background-color: rgba(30, 41, 59, 0.4);
}

.table-footer {
  padding: 14px 18px;
  background-color: rgba(2, 6, 23, 0.8);
  border-top: 1px solid #1e293b;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  color: #64748b;
}

.pagination-btn {
  width: 28px;
  height: 28px;
  border-radius: 4px;
  background: transparent;
  border: 0;
  color: #64748b;
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.pagination-btn:hover {
  background-color: #1e293b;
  color: #f8fafc;
}

.pagination-btn.active {
  background-color: #2563eb;
  color: white;
  font-weight: 700;
}

/* ==========================================================================
   Verdict Bands & Dials (§5.2)
   ========================================================================== */

.verdict-section {
  padding: 24px;
  border-radius: 12px;
  background-color: rgba(15, 23, 42, 0.6);
  border: 1px solid #1e293b;
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2);
  margin-bottom: 24px;
}

.band-header {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #64748b;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.posterior-bar-wrap {
  display: flex;
  align-items: center;
  gap: 16px;
  margin: 12px 0;
}

.posterior-progress-track {
  flex: 1;
  height: 14px;
  background-color: #090d16;
  border: 1px solid #1e293b;
  border-radius: 9999px;
  overflow: hidden;
}

.posterior-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #2563eb, #60a5fa);
  border-radius: 9999px;
}

.posterior-number {
  font-family: var(--font-mono);
  font-size: 26px;
  font-weight: 700;
  color: #f8fafc;
}

.next-best-box {
  padding: 16px;
  border-radius: 8px;
  background: linear-gradient(90deg, rgba(15, 29, 64, 0.8), rgba(15, 23, 42, 0.9));
  border: 1px solid rgba(59, 130, 246, 0.4);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: 16px;
}

/* Utilities */
.flex { display: flex; }
.inline-flex { display: inline-flex; }
.grid { display: grid; }
.hidden { display: none; }
.block { display: block; }
.inline-block { display: inline-block; }
.flex-col { flex-direction: column; }
.flex-row { flex-direction: row; }
.flex-wrap { flex-wrap: wrap; }
.items-center { align-items: center; }
.items-start { align-items: flex-start; }
.justify-between { justify-content: space-between; }
.justify-center { justify-content: center; }
.justify-end { justify-content: flex-end; }
.flex-1 { flex: 1 1 0%; }
.shrink-0 { flex-shrink: 0; }
.min-w-0 { min-width: 0px; }

.gap-1 { gap: 4px; } .gap-1\.5 { gap: 6px; } .gap-2 { gap: 8px; } .gap-2\.5 { gap: 10px; }
.gap-3 { gap: 12px; } .gap-4 { gap: 16px; } .gap-5 { gap: 20px; } .gap-6 { gap: 24px; }

.grid-cols-1 { grid-template-columns: repeat(1, minmax(0, 1fr)); }
.grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.grid-cols-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }

.w-full { width: 100%; } .h-full { height: 100%; }
.max-w-2xl { max-width: 42rem; } .max-w-4xl { max-width: 56rem; }
.max-w-5xl { max-width: 64rem; } .max-w-6xl { max-width: 72rem; }
.max-w-lg { max-width: 32rem; } .max-w-md { max-width: 28rem; }
.mx-auto { margin-left: auto; margin-right: auto; }

.p-2 { padding: 8px; } .p-3 { padding: 12px; } .p-3\.5 { padding: 14px; } .p-4 { padding: 16px; } .p-6 { padding: 24px; } .p-12 { padding: 48px; }
.px-2 { padding-left: 8px; padding-right: 8px; } .px-3 { padding-left: 12px; padding-right: 12px; } .px-4 { padding-left: 16px; padding-right: 16px; }
.py-1 { padding-top: 4px; padding-bottom: 4px; } .py-1\.5 { padding-top: 6px; padding-bottom: 6px; } .py-2 { padding-top: 8px; padding-bottom: 8px; } .py-3 { padding-top: 12px; padding-bottom: 12px; }
.space-y-1 > * + * { margin-top: 4px; }
.space-y-2 > * + * { margin-top: 8px; }
.space-y-3 > * + * { margin-top: 12px; }
.space-y-4 > * + * { margin-top: 16px; }
.space-y-5 > * + * { margin-top: 20px; }
.space-y-6 > * + * { margin-top: 24px; }

.bg-slate-950 { background-color: #020617; }
.bg-slate-900 { background-color: #0f172a; }
.bg-slate-800 { background-color: #1e293b; }
.bg-blue-600 { background-color: #2563eb; }
.bg-blue-950 { background-color: #0f1d40; }
.bg-amber-600 { background-color: #d97706; }
.bg-amber-950 { background-color: #451a03; }
.bg-red-600 { background-color: #dc2626; }
.bg-red-950 { background-color: #450a0a; }
.bg-emerald-600 { background-color: #16a34a; }
.bg-emerald-950 { background-color: #064e3b; }

.border { border: 1px solid #1e293b; }
.border-2 { border: 2px solid #1e293b; }
.border-t { border-top: 1px solid #1e293b; }
.border-b { border-bottom: 1px solid #1e293b; }
.border-slate-800 { border-color: #1e293b; }
.border-slate-700 { border-color: #334155; }
.border-blue-500 { border-color: #3b82f6; }
.border-blue-700 { border-color: #1d4ed8; }
.border-amber-700 { border-color: #b45309; }
.border-red-600 { border-color: #dc2626; }
.border-red-700 { border-color: #b91c1c; }
.border-emerald-600 { border-color: #16a34a; }

.rounded-sm { border-radius: 4px; }
.rounded { border-radius: 4px; }
.rounded-md { border-radius: 6px; }
.rounded-lg { border-radius: 8px; }
.rounded-xl { border-radius: 12px; }
.rounded-full { border-radius: 9999px; }

.text-white { color: #ffffff; }
.text-slate-100 { color: #f8fafc; }
.text-slate-200 { color: #e2e8f0; }
.text-slate-300 { color: #cbd5e1; }
.text-slate-400 { color: #94a3b8; }
.text-slate-500 { color: #64748b; }
.text-slate-600 { color: #475569; }
.text-blue-300 { color: #93c5fd; }
.text-blue-400 { color: #60a5fa; }
.text-amber-300 { color: #fcd34d; }
.text-amber-400 { color: #fbbf24; }
.text-red-300 { color: #fca5a5; }
.text-red-400 { color: #f87171; }
.text-emerald-300 { color: #6ee7b7; }
.text-emerald-400 { color: #34d399; }
.text-teal-300 { color: #5eead4; }

.font-medium { font-weight: 500; }
.font-semibold { font-weight: 600; }
.font-bold { font-weight: 700; }
.italic { font-style: italic; }
.uppercase { text-transform: uppercase; }
.tracking-wider { letter-spacing: 0.05em; }
.text-right { text-align: right; }
.text-center { text-align: center; }
.truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.shadow-lg { box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); }
.shadow-xl { box-shadow: 0 20px 25px -5px rgba(0,0,0,0.2); }
.shadow-2xl { box-shadow: 0 25px 50px -12px rgba(0,0,0,0.35); }

.cursor-pointer { cursor: pointer; }
.cursor-crosshair { cursor: crosshair; }

@keyframes spin { to { transform: rotate(360deg); } }
.animate-spin { animation: spin 1s linear infinite; }

@keyframes skeleton-shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.skeleton-box {
  background: linear-gradient(90deg, #1e293b 25%, #334155 50%, #1e293b 75%);
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.8s infinite;
  border-radius: 4px;
}
`;
