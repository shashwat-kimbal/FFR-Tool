import { getGovernanceAccess } from "@/app/lib/governance-auth";
import { NextRequest, NextResponse } from "next/server";
import { getCohortAnalysis } from "@/server/cohorts/cohort-service.ts";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ axis: string; key: string }> },
) {
  const access = await getGovernanceAccess(request);
  if (access.kind !== "authorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { axis, key } = await context.params;
  const analysis = getCohortAnalysis(axis, key);
  return NextResponse.json(analysis);
}
