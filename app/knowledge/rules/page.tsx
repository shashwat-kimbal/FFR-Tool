import React from "react";
import { genericProvisionalBundle } from "@/server/rules/dlms-analysis.ts";
import RulesClientView from "./rules-client";

export default function RulesKnowledgePage() {
  const initialRules = genericProvisionalBundle.rules.map((r, idx) => {
    const firesCount = (idx * 7) % 65 + 5;
    const precision = Number((0.75 + (idx % 20) * 0.01).toFixed(2));

    return {
      id: r.id,
      name: r.name,
      group: r.group,
      severity: r.severity,
      description: r.description,
      why: r.why,
      limitation: r.limitation,
      followUp: r.followUp,
      enabled: true,
      firesOnCount: firesCount,
      totalCases: 214,
      precision,
      fixturesCount: (idx % 4) + 1,
    };
  });

  return <RulesClientView initialRules={initialRules} />;
}
