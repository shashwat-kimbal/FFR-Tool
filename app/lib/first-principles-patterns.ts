import type { AnalysisFeature, SourceReference } from "./dlms-analysis";

export interface CensoredStreamResult {
  streamName: string;
  totalRows: number;
  saturated: boolean;
  spanDays: number | null;
  ratePerDay: number | null;
  stalenessDays: number | null;
  earliestTs: string | null;
  latestTs: string | null;
}

export interface TruncationResult {
  lastLiveTs: string | null;
  terminalVoltages: number[];
  terminalCurrents: number[];
  silenceDays: number | null;
  resumedInService: boolean;
  defectDate: string | null;
  detectionLagDays: number | null;
}

export interface CoincidenceResult {
  windowHours: number;
  eventsInWindowCount: number;
  streamsInvolved: string[];
  windowStartTs: string | null;
  windowEndTs: string | null;
  distanceToTruncationHours: number | null;
}

export interface DoseResult {
  totalSamples: number;
  samplesAboveUpper: number;
  samplesBelowLower: number;
  percentAboveUpper: number;
  voltHoursAboveUpper: number;
  peakVoltage: number | null;
  peakTs: string | null;
  trend: "rising" | "stable" | "falling" | "unknown";
}

export interface DecouplingResult {
  zeroVoltageWithCurrentCount: number;
  frozenEnergyWithProfileCount: number;
  divergenceStartTs: string | null;
}

export interface TestimonyConflictResult {
  conflictDetected: boolean;
  conflictType: string | null;
  confidence: number;
  narrative: string;
}

export interface FirstPrinciplesPatterns {
  censoredStreams: Record<string, CensoredStreamResult>;
  truncation: TruncationResult;
  coincidence: CoincidenceResult;
  dose: DoseResult;
  decoupling: DecouplingResult;
  testimonyConflict: TestimonyConflictResult;
  reconstructedStory: string;
}

function parseDateMs(value: unknown): number | null {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.getTime();
  const text = String(value ?? "").trim();
  if (!text) return null;
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatDate(ms: number | null): string | null {
  if (!ms) return null;
  return new Date(ms).toISOString().replace("T", " ").substring(0, 19);
}

/**
 * L2 Pattern: Censoring and Buffer-Rate
 * Saturated circular buffers (e.g. 50-row max) yield a rate & span, never just a count.
 */
export function analyzeCensoredStream(
  streamName: string,
  rowCount: number,
  timestamps: Array<unknown>,
  bufferCapacity = 50,
): CensoredStreamResult {
  const parsed = timestamps
    .map(parseDateMs)
    .filter((ms): ms is number => ms !== null)
    .sort((a, b) => a - b);

  const saturated = rowCount >= bufferCapacity;
  if (!parsed.length) {
    return {
      streamName,
      totalRows: rowCount,
      saturated,
      spanDays: null,
      ratePerDay: null,
      stalenessDays: null,
      earliestTs: null,
      latestTs: null,
    };
  }

  const minMs = parsed[0];
  const maxMs = parsed[parsed.length - 1];
  const nowMs = Date.now();
  const spanMs = maxMs - minMs;
  const spanDays = Math.max(0.1, spanMs / (1000 * 60 * 60 * 24));
  const ratePerDay = saturated ? Number((rowCount / spanDays).toFixed(2)) : Number((parsed.length / Math.max(1, spanDays)).toFixed(2));
  const stalenessDays = Number(((nowMs - maxMs) / (1000 * 60 * 60 * 24)).toFixed(1));

  return {
    streamName,
    totalRows: rowCount,
    saturated,
    spanDays: Number(spanDays.toFixed(1)),
    ratePerDay,
    stalenessDays,
    earliestTs: formatDate(minMs),
    latestTs: formatDate(maxMs),
  };
}

/**
 * L2 Pattern: Truncation Analysis (Time of Death vs Resumption)
 */
export function analyzeTruncation(
  profileRecords: Array<{ timestamp: unknown; voltage?: number; current?: number }>,
  defectDateStr?: string | null,
): TruncationResult {
  if (!profileRecords.length) {
    return {
      lastLiveTs: null,
      terminalVoltages: [],
      terminalCurrents: [],
      silenceDays: null,
      resumedInService: false,
      defectDate: defectDateStr ?? null,
      detectionLagDays: null,
    };
  }

  const validRecords = profileRecords
    .map((r) => ({
      ts: parseDateMs(r.timestamp),
      v: r.voltage ?? 0,
      i: r.current ?? 0,
    }))
    .filter((r): r is { ts: number; v: number; i: number } => r.ts !== null)
    .sort((a, b) => a.ts - b.ts);

  if (!validRecords.length) {
    return {
      lastLiveTs: null,
      terminalVoltages: [],
      terminalCurrents: [],
      silenceDays: null,
      resumedInService: false,
      defectDate: defectDateStr ?? null,
      detectionLagDays: null,
    };
  }

  let lastLiveIdx = validRecords.length - 1;
  let maxGapMs = 0;
  let gapIdx = -1;

  for (let i = 1; i < validRecords.length; i++) {
    const gap = validRecords[i].ts - validRecords[i - 1].ts;
    if (gap > maxGapMs) {
      maxGapMs = gap;
      gapIdx = i;
    }
  }

  const longGapDays = maxGapMs / (1000 * 60 * 60 * 24);
  let silenceDays: number | null = null;
  let resumedInService = false;

  if (longGapDays >= 2 && gapIdx > 0) {
    lastLiveIdx = gapIdx - 1;
    silenceDays = Number(longGapDays.toFixed(1));
    resumedInService = validRecords.length - gapIdx > 50;
  }

  const lastLive = validRecords[lastLiveIdx];
  const terminalSlice = validRecords.slice(Math.max(0, lastLiveIdx - 2), lastLiveIdx + 1);

  const defectMs = parseDateMs(defectDateStr);
  let detectionLagDays: number | null = null;
  if (defectMs && lastLive.ts) {
    detectionLagDays = Number(Math.max(0, (defectMs - lastLive.ts) / (1000 * 60 * 60 * 24)).toFixed(1));
  }

  return {
    lastLiveTs: formatDate(lastLive.ts),
    terminalVoltages: terminalSlice.map((r) => r.v),
    terminalCurrents: terminalSlice.map((r) => r.i),
    silenceDays,
    resumedInService,
    defectDate: defectDateStr ?? null,
    detectionLagDays,
  };
}

/**
 * L2 Pattern: Dose (Volt-Hours & Overvoltage Stress)
 */
export function analyzeDose(
  voltages: number[],
  timestamps: Array<unknown>,
  upperLimit = 253,
  lowerLimit = 207,
): DoseResult {
  if (!voltages.length) {
    return {
      totalSamples: 0,
      samplesAboveUpper: 0,
      samplesBelowLower: 0,
      percentAboveUpper: 0,
      voltHoursAboveUpper: 0,
      peakVoltage: null,
      peakTs: null,
      trend: "unknown",
    };
  }

  let countAbove = 0;
  let countBelow = 0;
  let voltHours = 0;
  let peakV = -1;
  let peakTsIdx = -1;

  voltages.forEach((v, idx) => {
    if (v > peakV) {
      peakV = v;
      peakTsIdx = idx;
    }
    if (v > upperLimit) {
      countAbove += 1;
      voltHours += (v - upperLimit) * 0.5;
    } else if (v < lowerLimit && v > 0) {
      countBelow += 1;
    }
  });

  const percentAbove = Number(((countAbove / voltages.length) * 100).toFixed(1));

  let trend: "rising" | "stable" | "falling" | "unknown" = "stable";
  if (voltages.length >= 30) {
    const third = Math.floor(voltages.length / 3);
    const v1 = voltages.slice(0, third).reduce((a, b) => a + b, 0) / third;
    const v3 = voltages.slice(2 * third).reduce((a, b) => a + b, 0) / third;
    if (v3 - v1 > 5) trend = "rising";
    else if (v1 - v3 > 5) trend = "falling";
  }

  const peakTsMs = parseDateMs(timestamps[peakTsIdx]);

  return {
    totalSamples: voltages.length,
    samplesAboveUpper: countAbove,
    samplesBelowLower: countBelow,
    percentAboveUpper: percentAbove,
    voltHoursAboveUpper: Number(voltHours.toFixed(1)),
    peakVoltage: peakV > 0 ? Number(peakV.toFixed(1)) : null,
    peakTs: formatDate(peakTsMs),
    trend,
  };
}

/**
 * L2 Pattern: Coincidence across event streams
 */
export function analyzeCoincidence(
  events: Array<{ stream: string; timestamp: unknown }>,
  truncationTsStr: string | null,
  windowHours = 24,
): CoincidenceResult {
  const parsed = events
    .map((e) => ({ stream: e.stream, ts: parseDateMs(e.timestamp) }))
    .filter((e): e is { stream: string; ts: number } => e.ts !== null)
    .sort((a, b) => a.ts - b.ts);

  if (!parsed.length) {
    return {
      windowHours,
      eventsInWindowCount: 0,
      streamsInvolved: [],
      windowStartTs: null,
      windowEndTs: null,
      distanceToTruncationHours: null,
    };
  }

  const windowMs = windowHours * 60 * 60 * 1000;
  let maxInWindow = 0;
  let bestStreams = new Set<string>();
  let bestStartMs = parsed[0].ts;

  for (let i = 0; i < parsed.length; i++) {
    const windowStart = parsed[i].ts;
    const windowEnd = windowStart + windowMs;
    const inWindow = parsed.filter((e) => e.ts >= windowStart && e.ts <= windowEnd);
    const streams = new Set(inWindow.map((e) => e.stream));

    if (streams.size > bestStreams.size || (streams.size === bestStreams.size && inWindow.length > maxInWindow)) {
      maxInWindow = inWindow.length;
      bestStreams = streams;
      bestStartMs = windowStart;
    }
  }

  const truncMs = parseDateMs(truncationTsStr);
  let distanceToTruncationHours: number | null = null;
  if (truncMs && bestStartMs) {
    distanceToTruncationHours = Number(Math.abs((truncMs - bestStartMs) / (1000 * 60 * 60)).toFixed(1));
  }

  return {
    windowHours,
    eventsInWindowCount: maxInWindow,
    streamsInvolved: Array.from(bestStreams),
    windowStartTs: formatDate(bestStartMs),
    windowEndTs: formatDate(bestStartMs + windowMs),
    distanceToTruncationHours,
  };
}

/**
 * L2 Pattern: Decoupling across electrical series
 */
export function analyzeDecoupling(
  voltages: number[],
  currents: number[],
  importEnergies: number[],
  timestamps: Array<unknown>,
): DecouplingResult {
  let zeroVoltageWithCurrent = 0;
  let frozenEnergyWithProfile = 0;
  let divergenceStartMs: number | null = null;

  const minLen = Math.min(voltages.length, currents.length);
  for (let i = 0; i < minLen; i++) {
    if (voltages[i] === 0 && currents[i] > 0.1) {
      zeroVoltageWithCurrent += 1;
      if (!divergenceStartMs) divergenceStartMs = parseDateMs(timestamps[i]);
    }
  }

  if (importEnergies.length >= 10) {
    let staticCount = 0;
    for (let i = 1; i < importEnergies.length; i++) {
      if (importEnergies[i] === importEnergies[i - 1]) staticCount++;
      else staticCount = 0;
      if (staticCount >= 10 && !frozenEnergyWithProfile) {
        frozenEnergyWithProfile = staticCount;
        if (!divergenceStartMs) divergenceStartMs = parseDateMs(timestamps[i]);
      }
    }
  }

  return {
    zeroVoltageWithCurrentCount: zeroVoltageWithCurrent,
    frozenEnergyWithProfileCount: frozenEnergyWithProfile,
    divergenceStartTs: formatDate(divergenceStartMs),
  };
}

/**
 * L2 Pattern: Testimony Conflict (FFR claim vs DLMS record)
 */
export function analyzeTestimonyConflict(
  ffrClaim: string | null,
  fieldObservation: string | null,
  truncation: TruncationResult,
  dose: DoseResult,
): TestimonyConflictResult {
  const claimText = `${ffrClaim ?? ""} ${fieldObservation ?? ""}`.toLowerCase();
  if (!claimText.trim()) {
    return {
      conflictDetected: false,
      conflictType: null,
      confidence: 0,
      narrative: "No field complaint claim supplied for conflict evaluation.",
    };
  }

  const isBurnClaim = claimText.includes("burn") || claimText.includes("fire") || claimText.includes("smoke");

  if (isBurnClaim && truncation.terminalVoltages.length > 0) {
    const diedAtZeroV = truncation.terminalVoltages.every((v) => v === 0);
    if (diedAtZeroV) {
      return {
        conflictDetected: true,
        conflictType: "FFR_CLAIM_BURN_VS_ZERO_VOLT_TERMINATION",
        confidence: 0.85,
        narrative: "Field reported internal burning, but DLMS log shows terminal death at 0V following supply interruptions rather than a load surge.",
      };
    }
  }

  if (truncation.detectionLagDays !== null && truncation.detectionLagDays < -1) {
    return {
      conflictDetected: true,
      conflictType: "METER_ALIVE_PAST_DEFECT_DATE",
      confidence: 0.95,
      narrative: "Meter continued logging DLMS records after the reported field defect date, indicating possible mismatched unit or incorrect ticket timing.",
    };
  }

  return {
    conflictDetected: false,
    conflictType: null,
    confidence: 0,
    narrative: "Field testimony is consistent with the DLMS meter log.",
  };
}

/**
 * Reconstructs the timeline story (§5.8)
 */
export function reconstructStory(
  truncation: TruncationResult,
  dose: DoseResult,
  censored: Record<string, CensoredStreamResult>,
  coincidence: CoincidenceResult,
): string {
  const parts: string[] = [];

  if (dose.totalSamples > 0) {
    if (dose.percentAboveUpper > 0) {
      parts.push(
        `Chronic supply overvoltage observed: ${dose.percentAboveUpper}% of samples exceeded 253V (peak ${dose.peakVoltage ?? "260"}V).`,
      );
    } else {
      parts.push(`Supply voltage remained within standard parameters across ${dose.totalSamples} records.`);
    }
  }

  const powerStream = censored.powerEvent;
  const pfStream = censored.otherEvent;
  const currentStream = censored.currentEvent;

  if (currentStream && currentStream.stalenessDays && currentStream.stalenessDays > 100) {
    parts.push(`Current-axis event log remained silent for over ${Math.floor(currentStream.stalenessDays)} days (zero load-side current disruptions).`);
  }

  if (pfStream && pfStream.saturated && pfStream.ratePerDay) {
    parts.push(`Power-factor disturbance events saturated 50-entry buffer at ~${pfStream.ratePerDay} events/day in the final period.`);
  }

  if (powerStream && powerStream.saturated && powerStream.ratePerDay) {
    parts.push(`Power-failure events accelerated, saturating buffer at ~${powerStream.ratePerDay} interruptions/day.`);
  }

  if (coincidence.eventsInWindowCount >= 3) {
    parts.push(
      `Multi-stream convergence observed: ${coincidence.eventsInWindowCount} events co-occurred across ${coincidence.streamsInvolved.join(", ")} within a ${coincidence.windowHours}h window before failure.`,
    );
  }

  if (truncation.lastLiveTs) {
    parts.push(`Time of death: ${truncation.lastLiveTs} at terminal voltages [${truncation.terminalVoltages.join(", ")}V].`);
  }

  if (truncation.silenceDays) {
    parts.push(`${truncation.silenceDays} days of data silence followed before readout.`);
  }

  if (truncation.detectionLagDays !== null && truncation.detectionLagDays > 0) {
    parts.push(`Field defect reported ${truncation.detectionLagDays} days after DLMS truncation (detection lag).`);
  }

  return parts.join(" ");
}
