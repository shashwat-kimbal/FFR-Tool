import { NextRequest, NextResponse } from "next/server";
import { runRuleForgeAgentLoop, type ForgeInput } from "@/server/forge/agent.ts";

export async function POST(request: NextRequest) {
  const body = await request.json();
  if (!body.caseId) {
    return NextResponse.json({ error: "caseId is required" }, { status: 400 });
  }
  const input: ForgeInput = {
    caseId: body.caseId,
    series: body.series || "voltage",
    fromTs: body.fromTs || "2026-06-01T00:00:00Z",
    toTs: body.toTs || "2026-06-06T00:00:00Z",
    intentText: body.intentText || "power failures accelerating right before the log stops",
  };

  const proposal = runRuleForgeAgentLoop(input);
  return NextResponse.json(proposal);
}
