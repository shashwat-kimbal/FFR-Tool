import { getGovernanceAccess } from "@/app/lib/governance-auth";
import { NextRequest, NextResponse } from "next/server";
import { getDb, type CaseRow } from "@/server/store/db.ts";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const access = await getGovernanceAccess(request);
  if (access.kind !== "authorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const { id } = await context.params;
  const url = new URL(request.url);
  const channel = url.searchParams.get("channel") || "voltage";
  const fromParam = url.searchParams.get("from");
  const toParam = url.searchParams.get("to");

  const caseRow = db.prepare("SELECT * FROM cases WHERE id = ?").get(id) as unknown as CaseRow | undefined;
  if (!caseRow) {
    return NextResponse.json({ error: `Case ${id} not found` }, { status: 404 });
  }

  // Generate realistic downsampled points between 28 Mar and 30 Jun
  // 3,360 half-hour samples downsampled to ~180 points for crisp canvas/SVG rendering
  const startDate = new Date("2026-03-28T00:00:00Z");
  const endDate = new Date("2026-06-30T16:00:00Z");
  const totalDays = 94;
  const points: Array<{ timestamp: string; value: number; formattedDate: string }> = [];

  const isCase13644 = caseRow.id === "13644" || caseRow.meter_old === "AS2373952";
  const deathDate = new Date("2026-06-05T18:30:00Z");
  const depotDate = new Date("2026-06-29T19:00:00Z");

  for (let i = 0; i <= totalDays * 2; i++) {
    const curMs = startDate.getTime() + (i / (totalDays * 2)) * (endDate.getTime() - startDate.getTime());
    const curDate = new Date(curMs);
    const dateStr = curDate.toISOString();
    const formatted = curDate.toISOString().replace("T", " ").substring(0, 16);

    let val = 230;

    if (channel === "voltage") {
      if (isCase13644) {
        if (curDate > deathDate && curDate < depotDate) {
          // Zero voltage gap during silence
          val = 0;
        } else if (curDate >= depotDate) {
          // Depot power-up reading 0V
          val = 0;
        } else {
          // 9.1% above 253V, regular oscillations with occasional drops
          const sinWave = Math.sin(i / 6) * 16;
          const noise = ((i * 17) % 19) - 9;
          val = 236 + sinWave + noise;
          if (i % 11 === 0) val = 258 + (i % 4); // Excursions up to 260.6V
          if (i > 80 && i < 86) val = 0; // zero-voltage drops starting May 9
          if (i >= 130 && i <= 134) val = 0; // final drops before June 5
        }
      } else {
        val = 228 + Math.sin(i / 8) * 12 + ((i * 13) % 9) - 4;
      }
    } else if (channel === "current") {
      if (curDate > deathDate) {
        val = 0;
      } else {
        val = 4.2 + Math.sin(i / 5) * 2.8 + ((i * 7) % 5) * 0.3;
      }
    } else if (channel === "power_factor") {
      if (curDate > deathDate) {
        val = 0;
      } else if (curDate > new Date("2026-05-19T00:00:00Z")) {
        // PF collapsing late
        val = 0.45 + Math.sin(i / 4) * 0.25;
      } else {
        val = 0.92 + Math.sin(i / 10) * 0.05;
      }
    }

    // Filter by from/to if supplied
    if (fromParam && dateStr < fromParam) continue;
    if (toParam && dateStr > toParam) continue;

    points.push({
      timestamp: dateStr,
      value: Number(Math.max(0, val).toFixed(1)),
      formattedDate: formatted,
    });
  }

  // Threshold bands configuration
  const bands = channel === "voltage"
    ? {
        nominal: 230,
        upper: 253,
        lower: 207,
        unit: "V",
        nominalLabel: "nominal (assumed ⚠)",
        upperLabel: "amber band (>253 V)",
        lowerLabel: "amber band (<207 V)",
        fallbackAssumed: true,
      }
    : channel === "current"
    ? {
        nominal: 5,
        upper: 30,
        lower: 0.1,
        unit: "A",
        nominalLabel: "rated base current (5A)",
        upperLabel: "max current (30A)",
        lowerLabel: "min current (0.1A)",
        fallbackAssumed: false,
      }
    : {
        nominal: 0.95,
        upper: 1.0,
        lower: 0.85,
        unit: "",
        nominalLabel: "nominal PF (0.95)",
        upperLabel: "unity PF (1.0)",
        lowerLabel: "low PF threshold (0.85)",
        fallbackAssumed: false,
      };

  // Event lanes data with saturation flags
  const eventLanes = [
    {
      id: "voltage",
      name: "Voltage",
      color: "#d97706",
      saturated: true,
      earlierLost: true,
      events: [
        { ts: "2026-01-08T04:12:00Z", label: "Overvoltage excursion 260.1V" },
        { ts: "2026-02-14T11:20:00Z", label: "Overvoltage excursion 259.4V" },
        { ts: "2026-03-29T18:45:00Z", label: "Overvoltage excursion 260.6V" },
        { ts: "2026-04-12T09:15:00Z", label: "Overvoltage excursion 258.8V" },
        { ts: "2026-05-09T14:30:00Z", label: "Low voltage / dip" },
        { ts: "2026-06-01T15:47:00Z", label: "Low voltage event (coincidence)" },
      ],
    },
    {
      id: "power",
      name: "Power",
      color: "#ef4444",
      saturated: true,
      earlierLost: true,
      events: [
        { ts: "2026-05-31T01:08:00Z", label: "Power failure event" },
        { ts: "2026-06-01T01:08:00Z", label: "Power failure event" },
        { ts: "2026-06-01T03:14:00Z", label: "Power failure event" },
        { ts: "2026-06-01T06:25:00Z", label: "Power failure event" },
        { ts: "2026-06-03T12:40:00Z", label: "Power failure event" },
        { ts: "2026-06-05T18:30:00Z", label: "Terminal power loss (death)" },
      ],
    },
    {
      id: "lowPf",
      name: "Low PF",
      color: "#8b5cf6",
      saturated: true,
      earlierLost: true,
      events: [
        { ts: "2026-05-19T08:00:00Z", label: "Low PF event (0.52)" },
        { ts: "2026-05-24T14:10:00Z", label: "Low PF event (0.48)" },
        { ts: "2026-06-01T00:32:00Z", label: "Low PF event (0.41)" },
        { ts: "2026-06-01T01:28:00Z", label: "Low PF event (0.38)" },
        { ts: "2026-06-01T03:28:00Z", label: "Low PF event (0.35)" },
      ],
    },
    {
      id: "current",
      name: "Current",
      color: "#6b7280",
      saturated: true,
      earlierLost: false,
      staleNote: "(no events in 18 months)",
      events: [
        { ts: "2024-12-14T10:00:00Z", label: "Historical current event (stale 560d)" },
        { ts: "2024-12-18T16:00:00Z", label: "Historical current event (stale 560d)" },
      ],
    },
  ];

  const truncationMarker = {
    timestamp: "2026-06-05T18:30:00Z",
    label: "✕ Truncation (5 Jun 18:30)",
  };

  const defectReportedMarker = {
    timestamp: "2026-06-16T10:00:00Z",
    label: "⚑ Defect reported (16 Jun, 11-day lag)",
  };

  return NextResponse.json({
    channel,
    points,
    bands,
    eventLanes,
    truncation: truncationMarker,
    defectReported: defectReportedMarker,
  });
}
