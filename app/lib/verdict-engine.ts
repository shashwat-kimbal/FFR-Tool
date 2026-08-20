import type { FirstPrinciplesPatterns } from "./first-principles-patterns.ts";
import {
  MECHANISM_LIBRARY,
  getMechanismById,
  type PhysicalMechanism,
  type MechanismFamily,
} from "./mechanisms.ts";

export interface EvidenceLedgerItem {
  id: string;
  family: string;
  description: string;
  likelihoodRatio: number;
  direction: "supports" | "contradicts" | "neutral";
  sourceRef?: string;
}

export interface MechanismScore {
  mechanism: PhysicalMechanism;
  priorOdds: number;
  posteriorOdds: number;
  posteriorProbability: number;
  cappedProbability: number;
  evidenceLedger: EvidenceLedgerItem[];
}

export interface ConfidenceDials {
  /** % of expected mechanism signature observable in evidence */
  completeness: number;
  /** Probability gap between #1 leading mechanism and #2 runner-up */
  discrimination: number;
  /** Ratio of meter configuration parameters vs provisional fallback defaults */
  provenance: number;
  /** Ratio of cohort cases sharing this leading mechanism */
  corroboration: number;
}

export interface NextBestTest {
  rank: number;
  title: string;
  cost: "seconds" | "minutes" | "hours";
  expectedPosteriorShift: "HIGH" | "MODERATE" | "LOW";
  description: string;
  readingOutcomes: {
    outcome: string;
    impliesMechanismId: string;
  }[];
}

export interface VerdictObject {
  leadingMechanism: PhysicalMechanism;
  family: MechanismFamily;
  posteriorProbability: number;
  cappedProbability: number;
  rankings: Array<{
    mechanismId: string;
    mechanismName: string;
    family: MechanismFamily;
    probability: number;
  }>;
  dials: ConfidenceDials;
  ledger: {
    supporting: EvidenceLedgerItem[];
    contradicting: EvidenceLedgerItem[];
    missingGaps: EvidenceLedgerItem[];
  };
  timelineNarrative: string;
  nextBestTests: NextBestTest[];
  routes: {
    warranty: string;
    capaTrigger: boolean;
    cohortQuery: string;
  };
  provenance: {
    rulesetVersion: string;
    mechanismsVersion: string;
    adapterId: string;
  };
}

/**
 * Calculates Likelihood Ratio (LR) for observed patterns against a mechanism.
 */
function evaluatePatternForMechanism(
  patternKey: string,
  patterns: FirstPrinciplesPatterns,
  mechanism: PhysicalMechanism,
  profileSources: Record<string, "workbook" | "provisional fallback">,
): EvidenceLedgerItem | null {
  const { dose, truncation, coincidence, censoredStreams, testimonyConflict, decoupling } = patterns;

  switch (patternKey) {
    case "VOLTAGE_CHRONIC_STRESS": {
      if (dose.percentAboveUpper > 5) {
        const isGridOV = mechanism.id === "MECH-GRID-OV-THERMAL";
        const isTerm = mechanism.id === "MECH-TERM-PROGRESSIVE";
        const lr = isGridOV ? 6.0 : isTerm ? 2.5 : 0.8;
        return {
          id: "VOLTAGE_CHRONIC_STRESS",
          family: "voltage-stress",
          description: `Chronic overvoltage observed: ${dose.percentAboveUpper}% samples > 253V (peak ${dose.peakVoltage ?? 260}V)`,
          likelihoodRatio: lr,
          direction: lr > 1 ? "supports" : "contradicts",
        };
      }
      return null;
    }

    case "PWR_FAIL_ACCELERATING": {
      const pwr = censoredStreams.powerEvent;
      if (pwr && pwr.saturated && pwr.ratePerDay && pwr.ratePerDay > 0.5) {
        const isTerm = mechanism.id === "MECH-TERM-PROGRESSIVE";
        const isGrid = mechanism.id === "MECH-GRID-OV-THERMAL";
        const lr = isTerm ? 5.5 : isGrid ? 2.0 : 0.5;
        return {
          id: "PWR_FAIL_ACCELERATING",
          family: "termination",
          description: `Power failure events saturated buffer at ~${pwr.ratePerDay} events/day`,
          likelihoodRatio: lr,
          direction: lr > 1 ? "supports" : "contradicts",
        };
      }
      return null;
    }

    case "TRUNCATION_AT_ZERO_VOLTS": {
      if (truncation.terminalVoltages.length > 0) {
        const zeroV = truncation.terminalVoltages.every((v) => v === 0);
        if (zeroV) {
          const isTerm = mechanism.id === "MECH-TERM-PROGRESSIVE" || mechanism.id === "MECH-PROD-SMPS";
          const isOV = mechanism.id === "MECH-GRID-OV-THERMAL";
          const lr = isTerm ? 4.0 : isOV ? 0.3 : 1.0;
          return {
            id: "TRUNCATION_AT_ZERO_VOLTS",
            family: "timing/truncation",
            description: `DLMS profile truncated at zero volts [${truncation.terminalVoltages.join(", ")}V]`,
            likelihoodRatio: lr,
            direction: lr > 1 ? "supports" : "contradicts",
          };
        }
      }
      return null;
    }

    case "TRUNCATION_AT_PEAK_VOLTAGE": {
      if (dose.peakVoltage && dose.peakVoltage > 258 && truncation.lastLiveTs) {
        const isOV = mechanism.id === "MECH-GRID-OV-THERMAL";
        const lr = isOV ? 5.0 : 0.2;
        return {
          id: "TRUNCATION_AT_PEAK_VOLTAGE",
          family: "timing/truncation",
          description: `Profile truncated directly at peak voltage excursion (${dose.peakVoltage}V)`,
          likelihoodRatio: lr,
          direction: lr > 1 ? "supports" : "contradicts",
        };
      }
      return null;
    }

    case "PF_COLLAPSE_LATE": {
      const pf = censoredStreams.otherEvent;
      if (pf && pf.saturated && pf.ratePerDay && pf.ratePerDay > 1.0) {
        const isTerm = mechanism.id === "MECH-TERM-PROGRESSIVE";
        const lr = isTerm ? 3.5 : 0.7;
        return {
          id: "PF_COLLAPSE_LATE",
          family: "termination",
          description: `Power factor disturbance events saturated buffer at ~${pf.ratePerDay} events/day in final weeks`,
          likelihoodRatio: lr,
          direction: lr > 1 ? "supports" : "contradicts",
        };
      }
      return null;
    }

    case "COINCIDENCE_MULTI_STREAM": {
      if (coincidence.eventsInWindowCount >= 3) {
        const isTerm = mechanism.id === "MECH-TERM-PROGRESSIVE";
        const lr = isTerm ? 3.0 : 1.2;
        return {
          id: "COINCIDENCE_MULTI_STREAM",
          family: "timing/truncation",
          description: `Convergence: ${coincidence.eventsInWindowCount} events across ${coincidence.streamsInvolved.join(", ")} inside ${coincidence.windowHours}h window`,
          likelihoodRatio: lr,
          direction: lr > 1 ? "supports" : "contradicts",
        };
      }
      return null;
    }

    case "FFR_CLAIM_BURN": {
      if (testimonyConflict.conflictDetected && testimonyConflict.conflictType === "FFR_CLAIM_BURN_VS_ZERO_VOLT_TERMINATION") {
        const isTerm = mechanism.id === "MECH-TERM-PROGRESSIVE";
        const lr = isTerm ? 2.5 : 0.8;
        return {
          id: "FFR_CLAIM_BURN",
          family: "physical",
          description: testimonyConflict.narrative,
          likelihoodRatio: lr,
          direction: lr > 1 ? "supports" : "contradicts",
        };
      }
      return null;
    }

    case "CURRENT_AXIS_ACTIVE": {
      const cur = censoredStreams.currentEvent;
      if (cur && cur.stalenessDays && cur.stalenessDays > 100) {
        // Current axis silent
        const isTerm = mechanism.id === "MECH-TERM-PROGRESSIVE";
        const isLoad = mechanism.id === "MECH-LOAD-OVERLOAD";
        const lr = isTerm ? 2.0 : isLoad ? 0.1 : 1.0;
        return {
          id: "CURRENT_AXIS_SILENT",
          family: "load-side",
          description: `Current-axis event log silent for ${Math.floor(cur.stalenessDays)} days (zero load disruptions)`,
          likelihoodRatio: lr,
          direction: lr > 1 ? "supports" : "contradicts",
        };
      }
      return null;
    }

    case "VOLTAGE_WITHIN_NORMAL_BAND": {
      if (dose.percentAboveUpper === 0 && dose.samplesBelowLower === 0) {
        const isNFF = mechanism.id === "MECH-NO-FAULT-FOUND";
        const isSMPS = mechanism.id === "MECH-PROD-SMPS";
        const lr = isNFF ? 4.0 : isSMPS ? 3.0 : 0.3;
        return {
          id: "VOLTAGE_WITHIN_NORMAL_BAND",
          family: "voltage-stress",
          description: "All profile voltage records remained strictly within nominal band",
          likelihoodRatio: lr,
          direction: lr > 1 ? "supports" : "contradicts",
        };
      }
      return null;
    }

    default:
      return null;
  }
}

/**
 * Runs abductive verdict analysis across all candidate mechanisms.
 */
export function evaluateVerdict(
  patterns: FirstPrinciplesPatterns,
  profileSources: Record<string, "workbook" | "provisional fallback"> = {},
  adapterId = "bcs-16-sheet-v1",
  cohortAgreedCount = 27,
  cohortTotalCount = 40,
): VerdictObject {
  const scores: MechanismScore[] = MECHANISM_LIBRARY.map((mechanism) => {
    // Base prior odds by mechanism family
    let prior = 0.15;
    if (mechanism.family === "installation") prior = 0.35;
    else if (mechanism.family === "grid") prior = 0.25;
    else if (mechanism.family === "product") prior = 0.20;

    const ledger: EvidenceLedgerItem[] = [];
    const checkKeys = [
      "VOLTAGE_CHRONIC_STRESS",
      "PWR_FAIL_ACCELERATING",
      "TRUNCATION_AT_ZERO_VOLTS",
      "TRUNCATION_AT_PEAK_VOLTAGE",
      "PF_COLLAPSE_LATE",
      "COINCIDENCE_MULTI_STREAM",
      "FFR_CLAIM_BURN",
      "CURRENT_AXIS_ACTIVE",
      "VOLTAGE_WITHIN_NORMAL_BAND",
    ];

    checkKeys.forEach((key) => {
      const item = evaluatePatternForMechanism(key, patterns, mechanism, profileSources);
      if (item) ledger.push(item);
    });

    // Calculate grouped likelihood ratio per evidence family to avoid overcounting
    const familyLrs: Record<string, number> = {};
    ledger.forEach((item) => {
      const current = familyLrs[item.family] ?? 1.0;
      if (item.likelihoodRatio > 1) {
        familyLrs[item.family] = Math.max(current, item.likelihoodRatio) * 1.15;
      } else {
        familyLrs[item.family] = current * item.likelihoodRatio;
      }
    });

    const combinedLr = Object.values(familyLrs).reduce((acc, val) => acc * val, 1.0);
    const posteriorOdds = prior * combinedLr;

    return {
      mechanism,
      priorOdds: prior,
      posteriorOdds,
      posteriorProbability: 0, // normalized next
      cappedProbability: 0,
      evidenceLedger: ledger,
    };
  });

  // Normalize posterior probabilities across mechanisms
  const totalPosteriorOdds = scores.reduce((sum, s) => sum + s.posteriorOdds, 0) || 1;
  scores.forEach((s) => {
    s.posteriorProbability = Number((s.posteriorOdds / totalPosteriorOdds).toFixed(3));
    // A5: Pure DLMS log inference capped at 0.95 without physical bench test
    s.cappedProbability = Number(Math.min(0.95, s.posteriorProbability).toFixed(3));
  });

  // Sort descending by posterior probability
  scores.sort((a, b) => b.posteriorProbability - a.posteriorProbability);

  const leading = scores[0];
  const runnerUp = scores[1];

  // 4 Confidence Dials
  const requiredCount = leading.mechanism.signature.requires.length || 1;
  const observedRequires = leading.evidenceLedger.filter((item) =>
    leading.mechanism.signature.requires.includes(item.id),
  ).length;

  const completeness = Number(((observedRequires / requiredCount) * 100).toFixed(0));
  const discrimination = Number(
    ((leading.cappedProbability - (runnerUp ? runnerUp.cappedProbability : 0)) * 100).toFixed(0),
  );

  const totalProfileKeys = Object.keys(profileSources).length || 1;
  const workbookKeys = Object.values(profileSources).filter((v) => v === "workbook").length;
  const provenance = Number(((workbookKeys / totalProfileKeys) * 100).toFixed(0));

  const corroboration = Number(((cohortAgreedCount / Math.max(1, cohortTotalCount)) * 100).toFixed(0));

  const supporting = leading.evidenceLedger.filter((item) => item.direction === "supports");
  const contradicting = leading.evidenceLedger.filter((item) => item.direction === "contradicts");
  const missingGaps = leading.mechanism.signature.requires
    .filter((req) => !leading.evidenceLedger.some((item) => item.id === req))
    .map((req) => ({
      id: req,
      family: "signature-gap",
      description: `Required signature component ${req} not observed in log`,
      likelihoodRatio: 1.0,
      direction: "neutral" as const,
    }));

  const nextBestTests: NextBestTest[] = [
    {
      rank: 1,
      title: "Feeder cohort query (Same feeder & date window)",
      cost: "seconds",
      expectedPosteriorShift: "HIGH",
      description: "Query meters on the same distribution transformer/feeder between 31 May and 5 Jun.",
      readingOutcomes: [
        {
          outcome: "Elevated failure rate across feeder",
          impliesMechanismId: "MECH-GRID-OV-THERMAL",
        },
        {
          outcome: "Isolated to this specific premise meter",
          impliesMechanismId: "MECH-TERM-PROGRESSIVE",
        },
      ],
    },
    {
      rank: 2,
      title: "High-resolution photograph inspection",
      cost: "minutes",
      expectedPosteriorShift: "MODERATE",
      description: "Inspect charring location (terminal block vs internal SMPS board).",
      readingOutcomes: [
        {
          outcome: "Charring localized at terminal block screw",
          impliesMechanismId: "MECH-TERM-PROGRESSIVE",
        },
        {
          outcome: "SMPS capacitor ruptured, terminal clean",
          impliesMechanismId: "MECH-PROD-SMPS",
        },
      ],
    },
    {
      rank: 3,
      title: "Bench contact resistance & torque check",
      cost: "hours",
      expectedPosteriorShift: "MODERATE",
      description: "Measure incoming phase/neutral terminal resistance on bench fixture.",
      readingOutcomes: [
        {
          outcome: "High contact resistance (> 50 mΩ) / under-torque",
          impliesMechanismId: "MECH-TERM-PROGRESSIVE",
        },
      ],
    },
  ];

  return {
    leadingMechanism: leading.mechanism,
    family: leading.mechanism.family,
    posteriorProbability: leading.posteriorProbability,
    cappedProbability: leading.cappedProbability,
    rankings: scores.map((s) => ({
      mechanismId: s.mechanism.id,
      mechanismName: s.mechanism.name,
      family: s.mechanism.family,
      probability: s.cappedProbability,
    })),
    dials: {
      completeness: Math.max(10, Math.min(100, completeness)),
      discrimination: Math.max(5, Math.min(100, discrimination)),
      provenance: Math.max(20, Math.min(100, provenance)),
      corroboration: Math.max(0, Math.min(100, corroboration)),
    },
    ledger: {
      supporting,
      contradicting,
      missingGaps,
    },
    timelineNarrative: patterns.reconstructedStory,
    nextBestTests,
    routes: {
      warranty: leading.mechanism.routes.warranty,
      capaTrigger: leading.mechanism.routes.capaTrigger,
      cohortQuery: leading.mechanism.routes.cohortQuery,
    },
    provenance: {
      rulesetVersion: "generic-provisional-v1",
      mechanismsVersion: "first-principles-v1",
      adapterId,
    },
  };
}
