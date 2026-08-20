// In-memory mock database compatible with Cloudflare Workers (Miniflare)
// Replaces node:sqlite which is a native C++ module and crashes in workers.

export interface CaseRow {
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
}

export interface SparklinePoint {
  day: string;
  minV: number;
  maxV: number;
  avgV: number;
  pctBelow: number;
  pctAbove: number;
  truncated: boolean;
}

export interface SparklineSummary {
  minV: number;
  maxV: number;
  pctBelow: number;
  pctAbove: number;
  truncationDate: string | null;
  hasGap: boolean;
}

const store = {
  cases: [] as any[],
  evidence: [] as any[],
  runs: [] as any[],
  imports: [] as any[],
  adjudication: [] as any[],
};

// Expose on globalThis to persist across hot reloads in dev
const globalStore = (globalThis as any).__FFR_STORE || store;
(globalThis as any).__FFR_STORE = globalStore;

class MockStatement {
  sql: string;
  constructor(sql: string) {
    this.sql = sql.trim().replace(/\s+/g, " ");
  }

  get(...params: any[]) {
    const all = this.all(...params);
    return all.length > 0 ? all[0] : undefined;
  }

  all(...params: any[]) {
    // 1. SELECT * FROM cases WHERE id = ?
    if (this.sql.includes("SELECT * FROM cases WHERE id = ?")) {
      return globalStore.cases.filter((c: any) => c.id === params[0]);
    }
    if (this.sql.includes("SELECT COUNT(*) as c FROM cases") && !this.sql.includes("WHERE")) {
      return [{ c: globalStore.cases.length }];
    }
    if (this.sql.includes("SELECT COUNT(*) as c FROM cases WHERE assignee_email = 'SS' AND status != 'closed'")) {
      return [{ c: globalStore.cases.filter((c: any) => c.assignee_email === 'SS' && c.status !== 'closed').length }];
    }
    if (this.sql.includes("SELECT COUNT(*) as c FROM cases WHERE status = 'blocked'")) {
      return [{ c: globalStore.cases.filter((c: any) => c.status === 'blocked').length }];
    }
    if (this.sql.includes("SELECT COUNT(*) as c FROM cases WHERE status = 'in_review'")) {
      return [{ c: globalStore.cases.filter((c: any) => c.status === 'in_review').length }];
    }
    if (this.sql.includes("SELECT COUNT(*) as c FROM cases WHERE status = 'closed'")) {
      return [{ c: globalStore.cases.filter((c: any) => c.status === 'closed').length }];
    }
    if (this.sql.includes("SELECT COUNT(*) as c FROM evidence WHERE case_id = ?")) {
      return [{ c: globalStore.evidence.filter((e: any) => e.case_id === params[0]).length }];
    }
    if (this.sql.includes("SELECT COUNT(*) as c FROM runs WHERE case_id = ?")) {
      return [{ c: globalStore.runs.filter((r: any) => r.case_id === params[0]).length }];
    }
    
    // Dynamic Filter Query for API
    if (this.sql.startsWith("SELECT * FROM cases") && this.sql.includes("LIMIT ? OFFSET ?")) {
      const limit = params[params.length - 2];
      const offset = params[params.length - 1];
      
      let filtered = [...globalStore.cases];
      
      if (this.sql.includes("case_ref LIKE ?")) {
        const q = params[0].replace(/%/g, "").toLowerCase();
        filtered = filtered.filter((c: any) => 
          c.case_ref.toLowerCase().includes(q) || 
          c.meter_old.toLowerCase().includes(q) || 
          (c.meter_new && c.meter_new.toLowerCase().includes(q)) ||
          c.sub_division.toLowerCase().includes(q)
        );
      }
      
      if (this.sql.includes("assignee_email = 'SS' AND status NOT IN ('closed')")) {
        filtered = filtered.filter((c: any) => c.assignee_email === 'SS' && c.status !== 'closed');
      }
      if (this.sql.includes("status = 'blocked' AND age_days >= 7")) {
        filtered = filtered.filter((c: any) => c.status === 'blocked' && c.age_days >= 7);
      }
      if (this.sql.includes("status = 'analysed' AND posterior_probability >= 0.70")) {
        filtered = filtered.filter((c: any) => c.status === 'analysed' && c.posterior_probability >= 0.70);
      }
      if (this.sql.includes("status = ?")) {
        const stat = params[params.length - 3];
        filtered = filtered.filter((c: any) => c.status === stat);
      }
      
      filtered.sort((a, b) => Number(b.case_ref) - Number(a.case_ref));
      return filtered.slice(offset, offset + limit);
    }

    if (this.sql.startsWith("SELECT COUNT(*) as count FROM cases WHERE")) {
      return [{ count: 12 }]; // Mock count for filtered
    }

    if (this.sql.includes("SELECT * FROM cases ORDER BY CAST(case_ref AS INTEGER) DESC LIMIT 25 OFFSET 0")) {
      return [...globalStore.cases].sort((a, b) => Number(b.case_ref) - Number(a.case_ref)).slice(0, 25);
    }
    
    if (this.sql.includes("SELECT * FROM evidence WHERE case_id = ? ORDER BY uploaded_at DESC")) {
      return globalStore.evidence.filter((e: any) => e.case_id === params[0]).sort((a: any, b: any) => b.uploaded_at.localeCompare(a.uploaded_at));
    }
    
    if (this.sql.includes("SELECT id, run_number") && this.sql.includes("FROM runs WHERE case_id = ?")) {
      return globalStore.runs.filter((r: any) => r.case_id === params[0]).sort((a: any, b: any) => b.run_number - a.run_number);
    }
    if (this.sql.includes("SELECT * FROM runs WHERE case_id = ? ORDER BY run_number DESC")) {
      return globalStore.runs.filter((r: any) => r.case_id === params[0]).sort((a: any, b: any) => b.run_number - a.run_number);
    }

    if (this.sql.includes("SELECT * FROM runs WHERE id = ?")) {
      return globalStore.runs.filter((r: any) => r.id === params[0]);
    }
    
    if (this.sql.includes("SELECT MAX(run_number) as maxNum FROM runs WHERE case_id = ?")) {
      const runs = globalStore.runs.filter((r: any) => r.case_id === params[0]);
      const max = runs.reduce((m: number, r: any) => Math.max(m, r.run_number), 0);
      return [{ maxNum: max }];
    }

    if (this.sql.includes("SELECT id, case_ref FROM cases WHERE case_ref = ? OR meter_old = ?")) {
      return globalStore.cases.filter((c: any) => c.case_ref === params[0] || c.meter_old === params[1]);
    }

    if (this.sql.includes("SELECT * FROM imports WHERE id = ?")) {
      return globalStore.imports.filter((i: any) => i.id === params[0]);
    }

    // Cohorts
    if (this.sql.includes("SELECT COUNT(*) as c FROM cases WHERE leading_cause IS NOT NULL")) {
      return [{ c: globalStore.cases.filter((c: any) => c.leading_cause).length }];
    }
    if (this.sql.includes("SELECT leading_cause, COUNT(*) as cnt FROM cases WHERE leading_cause IS NOT NULL GROUP BY leading_cause")) {
      const groups: Record<string, number> = {};
      globalStore.cases.forEach((c: any) => {
        if (c.leading_cause) groups[c.leading_cause] = (groups[c.leading_cause] || 0) + 1;
      });
      return Object.entries(groups).map(([leading_cause, cnt]) => ({ leading_cause, cnt }));
    }
    
    if (this.sql.includes("SELECT * FROM cases WHERE sub_division = ?")) {
      return globalStore.cases.filter((c: any) => c.sub_division === params[0]).sort((a: any, b: any) => Number(b.case_ref) - Number(a.case_ref));
    }
    if (this.sql.includes("SELECT * FROM cases WHERE product_family = 'METER'")) {
      return globalStore.cases.filter((c: any) => c.product_family === 'METER').sort((a: any, b: any) => Number(b.case_ref) - Number(a.case_ref));
    }

    return [];
  }

  run(...params: any[]) {
    if (this.sql.startsWith("DELETE FROM")) {
      globalStore.cases = [];
      globalStore.evidence = [];
      globalStore.runs = [];
      globalStore.imports = [];
      globalStore.adjudication = [];
      return { changes: 1 };
    }

    if (this.sql.startsWith("INSERT INTO cases")) {
      const obj = {
        id: params[0], case_ref: params[1], register_hash: params[2], register_row: params[3],
        status: params[4], blocked_reason: params[5], assignee_email: params[6], priority: params[7],
        meter_old: params[8], meter_new: params[9], complaint_key: params[10], complaint_label: params[11],
        product_family: params[12], sub_division: params[13], defect_date: params[14], field_observation: params[15],
        leading_cause: params[16], leading_family: params[17], posterior_probability: params[18],
        confidence_completeness: params[19], confidence_discrimination: params[20], confidence_provenance: params[21],
        confidence_cohort: params[22], sparkline_points_json: params[23], sparkline_summary_json: params[24],
        age_days: params[25], created_at: params[26], concluded_at: params[27], closed_at: params[28]
      };
      globalStore.cases.push(obj);
      return { changes: 1 };
    }

    if (this.sql.startsWith("INSERT OR IGNORE INTO cases")) {
      // Mock for import commit
      globalStore.cases.push({
        id: params[0], case_ref: params[1], register_hash: params[2], register_row: params[3],
        status: params[4], assignee_email: params[5], priority: params[6],
        meter_old: params[7], meter_new: params[8], complaint_key: params[9], complaint_label: params[10],
        product_family: params[11], sub_division: params[12], defect_date: params[13], field_observation: params[14],
        age_days: params[15], created_at: params[16]
      });
      return { changes: 1 };
    }

    if (this.sql.startsWith("INSERT INTO evidence")) {
      globalStore.evidence.push({
        id: params[0], case_id: params[1], kind: params[2], role: params[3], filename: params[4],
        sha256: params[5], size: params[6], storage_key: params[7], parse_summary_json: params[8],
        uploaded_by: params[9], uploaded_at: params[10]
      });
      return { changes: 1 };
    }

    if (this.sql.startsWith("INSERT INTO runs")) {
      globalStore.runs.push({
        id: params[0], case_id: params[1], run_number: params[2], evidence_hash: params[3], ruleset_v: params[4],
        mechanisms_v: params[5], adapter_v: params[6], status: params[7], leading_mechanism_id: params[8],
        leading_cause: params[9], posterior_probability: params[10], dials_json: params[11], ledger_json: params[12],
        timeline_json: params[13], timeline_narrative: params[14], next_tests_json: params[15], alternatives_json: params[16],
        started_at: params[17], finished_at: params[18]
      });
      return { changes: 1 };
    }

    if (this.sql.startsWith("INSERT INTO imports")) {
      globalStore.imports.push({
        id: params[0], filename: params[1], sha256: params[2], total_rows: params[3], new_rows: params[4],
        existing_rows: params[5], rejected_rows: params[6], preview_rows_json: params[7], created_at: params[8]
      });
      return { changes: 1 };
    }

    if (this.sql.startsWith("INSERT INTO adjudication")) {
      globalStore.adjudication.push({
        id: params[0], case_id: params[1], run_id: params[2], mechanism_id: params[3], verdict: params[4],
        note: params[5], by: params[6], at: params[7]
      });
      return { changes: 1 };
    }

    if (this.sql.startsWith("UPDATE cases SET status = 'blocked', blocked_reason =")) {
      const caseItem = globalStore.cases.find((c: any) => c.id === params[1]);
      if (caseItem) {
        caseItem.status = 'blocked';
        caseItem.blocked_reason = `Identity mismatch: report contains serial ${params[0]}`;
      }
      return { changes: 1 };
    }
    
    if (this.sql.startsWith("UPDATE cases SET status = 'evidence_ready'")) {
      const caseItem = globalStore.cases.find((c: any) => c.id === params[0]);
      if (caseItem) {
        caseItem.status = 'evidence_ready';
        caseItem.blocked_reason = null;
      }
      return { changes: 1 };
    }

    if (this.sql.startsWith("UPDATE cases SET status = 'analysed'")) {
      const caseItem = globalStore.cases.find((c: any) => c.id === params[7]);
      if (caseItem) {
        caseItem.status = 'analysed';
        caseItem.blocked_reason = null;
        caseItem.leading_cause = params[0];
        caseItem.leading_family = params[1];
        caseItem.posterior_probability = params[2];
        caseItem.confidence_completeness = params[3];
        caseItem.confidence_discrimination = params[4];
        caseItem.confidence_provenance = params[5];
        caseItem.confidence_cohort = params[6];
      }
      return { changes: 1 };
    }

    if (this.sql.startsWith("UPDATE cases SET status = 'in_review'")) {
      const caseItem = globalStore.cases.find((c: any) => c.id === params[1]);
      if (caseItem) {
        caseItem.status = 'in_review';
        caseItem.concluded_at = params[0];
      }
      return { changes: 1 };
    }

    return { changes: 0 };
  }
}

class MockDB {
  exec(sql: string) {
    if (sql.includes("DELETE FROM")) {
      new MockStatement("DELETE FROM").run();
    }
  }
  prepare(sql: string) {
    return new MockStatement(sql);
  }
}

let mockDbInstance: MockDB | null = null;

export function getDb() {
  if (!mockDbInstance) {
    mockDbInstance = new MockDB();
  }
  return mockDbInstance;
}
