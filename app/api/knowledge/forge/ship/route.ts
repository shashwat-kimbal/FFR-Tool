import { NextRequest, NextResponse } from "next/server";
import { shipForgeRule } from "@/server/forge/agent.ts";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const ruleId = body.ruleId || "P-PWR-ESC";
  const result = shipForgeRule(ruleId);
  return NextResponse.json(result);
}
