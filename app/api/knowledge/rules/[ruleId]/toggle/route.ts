import { getGovernanceAccess } from "@/app/lib/governance-auth";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ ruleId: string }> },
) {
  const access = await getGovernanceAccess(request);
  if (access.kind !== "authorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { ruleId } = await context.params;
  const body = await request.json().catch(() => ({}));
  const enabled = body.enabled ?? true;

  const ruleToggles = ((globalThis as any).__RULE_TOGGLES ||= {}) as Record<string, boolean>;
  ruleToggles[ruleId] = enabled;

  return NextResponse.json({
    success: true,
    ruleId,
    enabled,
    message: `Rule ${ruleId} is now ${enabled ? "enabled" : "disabled"}.`,
  });
}
