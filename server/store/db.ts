import { DatabaseSync } from "node:sqlite";

let dbInstance: DatabaseSync | null = null;

export function getDb(): any {
  if (dbInstance) return dbInstance;
  
  // Try to load from file to preserve data between reloads, fallback to memory
  try {
    dbInstance = new DatabaseSync(".data/ffr.sqlite");
  } catch (e) {
    dbInstance = new DatabaseSync(":memory:");
  }
  
  // Initialize schema exactly as the app expects
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS cases (
      id TEXT PRIMARY KEY,
      case_ref TEXT NOT NULL,
      register_hash TEXT,
      register_row INTEGER,
      status TEXT NOT NULL,
      blocked_reason TEXT,
      assignee_email TEXT,
      priority TEXT DEFAULT 'normal',
      meter_old TEXT NOT NULL,
      meter_new TEXT,
      complaint_key TEXT NOT NULL,
      complaint_label TEXT,
      product_family TEXT NOT NULL DEFAULT 'METER',
      sub_division TEXT NOT NULL,
      defect_date TEXT,
      field_observation TEXT,
      leading_cause TEXT,
      leading_family TEXT,
      posterior_probability REAL,
      confidence_completeness INTEGER DEFAULT 0,
      confidence_discrimination INTEGER DEFAULT 0,
      confidence_provenance INTEGER DEFAULT 0,
      confidence_cohort INTEGER DEFAULT 0,
      sparkline_points_json TEXT,
      sparkline_summary_json TEXT,
      age_days INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      concluded_at TEXT,
      closed_at TEXT,
      UNIQUE (register_hash, register_row)
    );

    CREATE TABLE IF NOT EXISTS evidence (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      role TEXT NOT NULL,
      filename TEXT NOT NULL,
      sha256 TEXT NOT NULL,
      size INTEGER NOT NULL,
      storage_key TEXT,
      parse_summary_json TEXT,
      uploaded_by TEXT NOT NULL,
      uploaded_at TEXT NOT NULL,
      FOREIGN KEY (case_id) REFERENCES cases(id)
    );

    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL,
      run_number INTEGER NOT NULL,
      evidence_hash TEXT,
      ruleset_v TEXT NOT NULL,
      mechanisms_v TEXT NOT NULL,
      adapter_v TEXT NOT NULL,
      status TEXT NOT NULL,
      leading_mechanism_id TEXT,
      leading_cause TEXT,
      posterior_probability REAL,
      dials_json TEXT,
      ledger_json TEXT,
      timeline_json TEXT,
      timeline_narrative TEXT,
      next_tests_json TEXT,
      alternatives_json TEXT,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      FOREIGN KEY (case_id) REFERENCES cases(id)
    );

    CREATE TABLE IF NOT EXISTS adjudication (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL,
      run_id TEXT,
      mechanism_id TEXT NOT NULL,
      verdict TEXT NOT NULL,
      note TEXT,
      by TEXT NOT NULL,
      at TEXT NOT NULL,
      FOREIGN KEY (case_id) REFERENCES cases(id)
    );

    CREATE TABLE IF NOT EXISTS imports (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      sha256 TEXT NOT NULL,
      total_rows INTEGER NOT NULL,
      new_rows INTEGER NOT NULL,
      existing_rows INTEGER NOT NULL,
      rejected_rows INTEGER NOT NULL,
      preview_rows_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
  
  return dbInstance;
}

export type CaseRow = {
  id: string;
  case_ref: string;
  register_hash?: string;
  register_row?: number;
  status: string;
  blocked_reason?: string | null;
  assignee_email?: string | null;
  priority: string;
  meter_old: string;
  meter_new?: string | null;
  complaint_key: string;
  complaint_label: string;
  product_family: string;
  sub_division: string;
  defect_date?: string | null;
  field_observation?: string | null;
  leading_cause?: string | null;
  leading_family?: string | null;
  posterior_probability?: number | null;
  confidence_completeness: number;
  confidence_discrimination: number;
  confidence_provenance: number;
  confidence_cohort: number;
  sparkline_points_json?: string | null;
  sparkline_summary_json?: string | null;
  age_days: number;
  created_at: string;
  concluded_at?: string | null;
  closed_at?: string | null;
};

export type SparklinePoint = {
  day: string;
  minV: number;
  maxV: number;
  avgV: number;
  pctBelow: number;
  pctAbove: number;
  events: number;
  truncated: boolean;
};

export type SparklineSummary = {
  days: number;
  trend: "stable" | "degrading" | "failing" | "dead" | "unknown";
  eventsCount: number;
  lastLiveTs: string | null;
};
