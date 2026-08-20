import { NextRequest, NextResponse } from "next/server";
import { getDb, type CaseRow } from "@/server/store/db.ts";
import { seedDatabase } from "@/server/store/seed.ts";

export async function GET(request: NextRequest) {
  seedDatabase();
  const db = getDb();
  const url = new URL(request.url);

  const q = url.searchParams.get("q")?.trim();
  const status = url.searchParams.get("status")?.trim();
  const owner = url.searchParams.get("owner")?.trim();
  const mechanism = url.searchParams.get("mechanism")?.trim();
  const age = url.searchParams.get("age")?.trim();
  const view = url.searchParams.get("view")?.trim() || "all";
  const limit = Math.max(1, Math.min(100, Number(url.searchParams.get("limit") || 25)));
  const page = Math.max(1, Number(url.searchParams.get("page") || 1));
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const params: any[] = [];

  // Search filter
  if (q) {
    conditions.push("(case_ref LIKE ? OR meter_old LIKE ? OR meter_new LIKE ? OR sub_division LIKE ?)");
    const likeQ = `%${q}%`;
    params.push(likeQ, likeQ, likeQ, likeQ);
  }

  // Saved views filter
  if (view === "needs_me") {
    conditions.push("(assignee_email = 'SS' AND status NOT IN ('closed'))");
  } else if (view === "blocked_7d") {
    conditions.push("(status = 'blocked' AND age_days >= 7)");
  } else if (view === "high_conf_unadjudicated") {
    conditions.push("(status = 'analysed' AND posterior_probability >= 0.70)");
  }

  // Column filters
  if (status && status !== "all") {
    conditions.push("status = ?");
    params.push(status);
  }
  if (owner && owner !== "all") {
    if (owner === "unassigned") {
      conditions.push("(assignee_email IS NULL OR assignee_email = '')");
    } else {
      conditions.push("assignee_email = ?");
      params.push(owner);
    }
  }
  if (mechanism && mechanism !== "all") {
    conditions.push("leading_cause = ?");
    params.push(mechanism);
  }
  if (age) {
    if (age === "gt14") conditions.push("age_days > 14");
    else if (age === "gt30") conditions.push("age_days > 30");
    else if (age === "lte14") conditions.push("age_days <= 14");
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  // Count total matching
  const countSql = `SELECT COUNT(*) as count FROM cases ${whereClause}`;
  const totalMatching = (db.prepare(countSql).get(...params) as { count: number }).count;

  // Query paginated rows
  const querySql = `
    SELECT * FROM cases
    ${whereClause}
    ORDER BY CAST(case_ref AS INTEGER) DESC
    LIMIT ? OFFSET ?
  `;
  const rows = db.prepare(querySql).all(...params, limit, offset) as unknown as CaseRow[];

  // Global counts for the 4 summary pills
  const statsNeedsMe = (db.prepare("SELECT COUNT(*) as c FROM cases WHERE assignee_email = 'SS' AND status != 'closed'").get() as { c: number }).c;
  const statsBlocked = (db.prepare("SELECT COUNT(*) as c FROM cases WHERE status = 'blocked'").get() as { c: number }).c;
  const statsAwaitingReview = (db.prepare("SELECT COUNT(*) as c FROM cases WHERE status = 'in_review'").get() as { c: number }).c;
  const statsClosed = (db.prepare("SELECT COUNT(*) as c FROM cases WHERE status = 'closed'").get() as { c: number }).c;

  return NextResponse.json({
    cases: rows,
    total: totalMatching,
    page,
    limit,
    totalPages: Math.ceil(totalMatching / limit) || 1,
    stats: {
      needsMe: statsNeedsMe,
      blocked: statsBlocked,
      awaitingReview: statsAwaitingReview,
      closed: statsClosed,
    },
  });
}
