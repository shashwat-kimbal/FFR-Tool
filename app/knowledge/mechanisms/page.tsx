import React from "react";
import { MECHANISM_LIBRARY } from "@/server/inference/mechanisms.ts";
import MechanismsClientView from "./mechanisms-client";

export default function MechanismsKnowledgePage() {
  const mechanisms = MECHANISM_LIBRARY.map((m, idx) => {
    const usedCount = 214;
    const leadingCount = idx === 0 ? 61 : (idx * 17) % 40 + 10;
    const correctCount = Math.round(leadingCount * 0.85);

    return {
      ...m,
      metrics: {
        usedInRuns: usedCount,
        leadingInRuns: leadingCount,
        adjudicatedCorrect: correctCount,
        accuracyPct: 85,
      },
    };
  });

  return <MechanismsClientView initialMechanisms={mechanisms} />;
}
