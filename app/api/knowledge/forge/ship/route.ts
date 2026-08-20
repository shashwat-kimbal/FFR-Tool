import { getGovernanceAccess } from "@/app/lib/governance-auth";
import { NextRequest, NextResponse } from "next/server";
import { shipForgeRule } from "@/server/forge/agent.ts";

export async function POST(request: NextRequest) {
  const access = await getGovernanceAccess(request);
  if (access.kind !== "authorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const ruleId = body.ruleId || "P-PWR-ESC";
  const result = shipForgeRule(ruleId);
  return NextResponse.json(result);
}
