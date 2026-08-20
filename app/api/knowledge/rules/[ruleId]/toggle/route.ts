import { NextRequest, NextResponse } from "next/server";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ ruleId: string }> },
) {
  const { ruleId } = await context.params;
  const body = await request.json().catch(() => ({}));
  const enabled = body.enabled ?? true;

  return NextResponse.json({
    success: true,
    ruleId,
    enabled,
    message: `Rule ${ruleId} is now ${enabled ? "enabled" : "disabled"}.`,
  });
}
