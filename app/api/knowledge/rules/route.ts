import { NextRequest, NextResponse } from "next/server";
import { genericProvisionalBundle } from "@/server/rules/dlms-analysis.ts";

// In-memory toggle state
const ruleToggles: Record<string, boolean> = {};

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.toLowerCase();
  const group = url.searchParams.get("group");
  const status = url.searchParams.get("status");

  let rules = genericProvisionalBundle.rules.map((r, idx) => {
    const isEnabled = ruleToggles[r.id] ?? true;
    const firesCount = (idx * 7) % 65 + 5;
    const precision = Number((0.75 + (idx % 20) * 0.01).toFixed(2));

    return {
      id: r.id,
      name: r.title,
      group: r.group,
      severity: r.severity,
      description: r.why,
      why: r.why,
      limitation: r.limitation,
      followUp: r.followUp,
      enabled: isEnabled,
      firesOnCount: firesCount,
      totalCases: 214,
      precision,
      fixturesCount: (idx % 4) + 1,
    };
  });

  if (q) {
    rules = rules.filter((r) => r.id.toLowerCase().includes(q) || r.name.toLowerCase().includes(q) || r.description.toLowerCase().includes(q));
  }
  if (group && group !== "all") {
    rules = rules.filter((r) => r.group === group);
  }
  if (status && status !== "all") {
    const wantEnabled = status === "enabled";
    rules = rules.filter((r) => r.enabled === wantEnabled);
  }

  const groups = ["Foundation", "Profile & data quality", "Events", "Complaint context"];

  return NextResponse.json({
    rules,
    total: rules.length,
    groups,
  });
}
