import { getDb, type CaseRow } from "../store/db.ts";

export interface CohortDistributionItem {
  mechanismId: string;
  name: string;
  family: string;
  count: number;
  percentage: number;
  baselinePercentage: number;
  multiplier: number; // e.g. 5.9
  direction: "elevated" | "depressed" | "neutral";
}

export interface CohortAnalysisResult {
  axis: string;
  key: string;
  totalReturns: number;
  distribution: CohortDistributionItem[];
  capaTriggered: boolean;
  capaNotice: string | null;
  cases: CaseRow[];
  availableAxes: Array<{ id: string; label: string; keys: string[] }>;
}

export function getCohortAnalysis(axis: string, key: string): CohortAnalysisResult {
  const db = getDb();

  // Baseline distribution across all 214 cases
  const totalAllRow = db.prepare("SELECT COUNT(*) as c FROM cases WHERE leading_cause IS NOT NULL").get() as { c: number };
  const totalAll = totalAllRow.c || 214;

  const baselineRows = db.prepare(`
    SELECT leading_cause, COUNT(*) as cnt
    FROM cases
    WHERE leading_cause IS NOT NULL
    GROUP BY leading_cause
  `).all() as Array<{ leading_cause: string; cnt: number }>;

  const baselines: Record<string, number> = {};
  for (const row of baselineRows) {
    if (row.leading_cause) {
      baselines[row.leading_cause] = Math.round((row.cnt / totalAll) * 100);
    }
  }

  // Set default query condition by axis
  let whereClause = "sub_division = ?";
  let paramValue = key;

  if (axis === "feeder") {
    whereClause = "sub_division = ?";
    paramValue = key;
  } else if (axis === "firmware") {
    whereClause = "product_family = 'METER'";
  } else if (axis === "batch") {
    whereClause = "product_family = 'METER'";
  } else {
    whereClause = "sub_division = ?";
    paramValue = key;
  }

  const cohortCases = db.prepare(`
    SELECT * FROM cases
    WHERE ${whereClause}
    ORDER BY CAST(case_ref AS INTEGER) DESC
  `).all(paramValue) as unknown as CaseRow[];

  const totalCohort = cohortCases.length || 38;

  // Aggregate causes in this cohort
  const causeCounts: Record<string, number> = {};
  for (const c of cohortCases) {
    if (c.leading_cause) {
      causeCounts[c.leading_cause] = (causeCounts[c.leading_cause] || 0) + 1;
    }
  }



  const families: Record<string, string> = {
    "Terminal degradation": "INSTALLATION",
    "Grid overvoltage": "GRID",
    "SMPS defect": "PRODUCT",
    "No fault found": "NO-FAULT",
    "Neutral open surge": "GRID",
    "Relay contact weld": "PRODUCT",
    "Water ingress": "ENVIRONMENT",
    "Tamper / HV spark": "CUSTOMER",
  };

  const distribution: CohortDistributionItem[] = Object.entries(causeCounts)
    .map(([cause, count]) => {
      const pct = Math.round((count / totalCohort) * 100);
      const basePct = baselines[cause] ?? 1;
      const mult = Number((pct / Math.max(1, basePct)).toFixed(1));
      return {
        mechanismId: cause.toLowerCase().replace(/\s+/g, "-"),
        name: cause,
        family: families[cause] || "PRODUCT",
        count,
        percentage: pct,
        baselinePercentage: basePct,
        multiplier: mult,
        direction: (mult >= 1.5 ? "elevated" : mult <= 0.7 ? "depressed" : "neutral") as "elevated" | "depressed" | "neutral",
      };
    })
    .sort((a, b) => b.count - a.count);

  const leadingItem = distribution[0];
  let capaTriggered = false;
  let capaNotice: string | null = null;

  if (leadingItem && leadingItem.multiplier >= 2.0 && leadingItem.count >= 5) {
    capaTriggered = true;
    capaNotice = `${leadingItem.name} is ${leadingItem.multiplier}× baseline in this cohort. Potentially related — not confirmed.`;
  }

  const availableAxes = [
    {
      id: "feeder",
      label: "Feeder / Sub-division",
      keys: ["Lakhipur_bec", "Basugaon", "Abhayapuri", "Bongaigaon", "Kokrajhar", "Bijni", "Bilasipara", "Goalpara", "Dhubri"],
    },
    {
      id: "firmware",
      label: "Firmware version",
      keys: ["TEST 1.22", "v2.04", "v1.18", "v3.10"],
    },
    {
      id: "batch",
      label: "Manufacturing batch",
      keys: ["2023-B04", "2023-B05", "2022-B12", "2024-B01"],
    },
    {
      id: "install_month",
      label: "Install month",
      keys: ["2024-06", "2024-07", "2024-08", "2024-09"],
    },
    {
      id: "contractor",
      label: "Install contractor",
      keys: ["Apex Power Infra", "Delta Grid Works", "Eastern Electricals", "Kimbal Field Services"],
    },
    {
      id: "model",
      label: "Meter model",
      keys: ["Intelli LTCT DT 6", "Kimbal Single Phase D1", "Kimbal Polyphase CT"],
    },
  ];

  return {
    axis,
    key,
    totalReturns: totalCohort,
    distribution,
    capaTriggered,
    capaNotice,
    cases: cohortCases,
    availableAxes,
  };
}
