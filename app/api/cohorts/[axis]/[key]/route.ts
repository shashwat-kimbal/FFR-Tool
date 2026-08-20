import { NextRequest, NextResponse } from "next/server";
import { getCohortAnalysis } from "@/server/cohorts/cohort-service.ts";
import { seedDatabase } from "@/server/store/seed.ts";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ axis: string; key: string }> },
) {
  seedDatabase();
  const { axis, key } = await context.params;
  const analysis = getCohortAnalysis(axis, key);
  return NextResponse.json(analysis);
}
