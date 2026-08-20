export type MechanismFamily =
  | "installation"
  | "product"
  | "grid"
  | "customer"
  | "no-fault";

export interface Discriminator {
  vsMechanismId: string;
  test: string;
  reading: string;
}

export interface Confirmations {
  visual?: string;
  bench?: string;
}

export interface MechanismRoutes {
  warranty: "installer" | "manufacturer" | "discom" | "none";
  capaTrigger: boolean;
  cohortQuery: string;
}

export interface PhysicalMechanism {
  id: string;
  name: string;
  family: MechanismFamily;
  narrative: string;
  signature: {
    requires: string[];
    supports: string[];
    contradicts: string[];
    disqualifiers: string[];
  };
  discriminators: Discriminator[];
  confirmations: Confirmations;
  routes: MechanismRoutes;
}

export const MECHANISM_LIBRARY: PhysicalMechanism[] = [
  {
    id: "MECH-TERM-PROGRESSIVE",
    name: "Progressive supply-terminal degradation",
    family: "installation",
    narrative:
      "Contact resistance at incoming terminal or neutral rises through oxidation, loosening or under-torque. Ohmic heating accelerates degradation. Intermittent supply disconnects under load produce power-failure and PF disturbance events before total thermal breakdown.",
    signature: {
      requires: ["PWR_FAIL_ACCELERATING", "TRUNCATION_AT_ZERO_VOLTS"],
      supports: [
        "PF_COLLAPSE_LATE",
        "COINCIDENCE_MULTI_STREAM",
        "FFR_CLAIM_BURN",
        "VOLTAGE_CHRONIC_STRESS",
      ],
      contradicts: ["TRUNCATION_AT_PEAK_VOLTAGE", "CURRENT_AXIS_ACTIVE"],
      disqualifiers: ["METER_ALIVE_PAST_DEFECT_DATE"],
    },
    discriminators: [
      {
        vsMechanismId: "MECH-GRID-OV-THERMAL",
        test: "cohort.same_feeder.power_failure_rate",
        reading:
          "Elevated across feeder → grid overvoltage; isolated to this meter → supply termination.",
      },
      {
        vsMechanismId: "MECH-PROD-SMPS",
        test: "cohort.same_batch.termination_failure_rate",
        reading:
          "Batch clustered → product SMPS flaw; spatially/contractor clustered → installation workmanship.",
      },
    ],
    confirmations: {
      visual: "Burn/charring localized at terminal block or neutral link, not at internal SMPS PCB.",
      bench: "Contact resistance & terminal screw torque check on incoming phase/neutral terminals.",
    },
    routes: {
      warranty: "installer",
      capaTrigger: false,
      cohortQuery: "same_feeder AND same_install_contractor",
    },
  },
  {
    id: "MECH-GRID-OV-THERMAL",
    name: "Grid chronic / transient overvoltage stress",
    family: "grid",
    narrative:
      "Grid supply sustained chronic high voltage (>253V) or high-energy transient spikes exceeding varistor/capacitor voltage ratings, causing component breakdown.",
    signature: {
      requires: ["VOLTAGE_CHRONIC_STRESS"],
      supports: ["TRUNCATION_AT_PEAK_VOLTAGE", "OVERVOLTAGE_EVENTS_SATURATED"],
      contradicts: ["VOLTAGE_WITHIN_NORMAL_BAND"],
      disqualifiers: ["ZERO_VOLTAGE_PROALONGE_NORMAL"],
    },
    discriminators: [
      {
        vsMechanismId: "MECH-TERM-PROGRESSIVE",
        test: "cohort.same_feeder.overvoltage_rate",
        reading:
          "Widespread overvoltage across feeder confirms grid root cause.",
      },
    ],
    confirmations: {
      visual: "MOV (Varistor) discoloration or blown primary MOV.",
      bench: "Discom grid voltage log cross-reference at distribution transformer.",
    },
    routes: {
      warranty: "discom",
      capaTrigger: false,
      cohortQuery: "same_feeder AND date_window",
    },
  },
  {
    id: "MECH-PROD-SMPS",
    name: "Internal SMPS / component power supply defect",
    family: "product",
    narrative:
      "Internal switch-mode power supply (SMPS) component failure (e.g. primary capacitor breakdown, diode short) under normal operating grid parameters.",
    signature: {
      requires: ["VOLTAGE_WITHIN_NORMAL_BAND", "TRUNCATION_AT_ZERO_VOLTS"],
      supports: ["SMPS_FAILURE_SIGNALS"],
      contradicts: ["VOLTAGE_CHRONIC_STRESS", "PWR_FAIL_ACCELERATING"],
      disqualifiers: ["EXTERNAL_BURN_TERMINAL"],
    },
    discriminators: [
      {
        vsMechanismId: "MECH-TERM-PROGRESSIVE",
        test: "cohort.same_batch.failure_rate",
        reading:
          "High batch failure rate under normal grid voltage points to SMPS component defect.",
      },
    ],
    confirmations: {
      visual: "SMPS primary controller chip or capacitor ruptured, terminal block clean.",
      bench: "Internal DC rail voltage test on bench supply.",
    },
    routes: {
      warranty: "manufacturer",
      capaTrigger: true,
      cohortQuery: "same_manufacturing_batch AND same_firmware",
    },
  },
  {
    id: "MECH-LOAD-OVERLOAD",
    name: "Customer load overload / excess current",
    family: "customer",
    narrative:
      "Premise load exceeded rated meter current for extended duration, causing thermal overload on current sensing shunts or CTs.",
    signature: {
      requires: ["CURRENT_AXIS_ACTIVE"],
      supports: ["OVERCURRENT_EVENTS", "HIGH_PEAK_CURRENT"],
      contradicts: ["CURRENT_AXIS_SILENT"],
      disqualifiers: ["ZERO_CURRENT_ALWAYS"],
    },
    discriminators: [
      {
        vsMechanismId: "MECH-TERM-PROGRESSIVE",
        test: "profile.current_max vs rated_current",
        reading:
          "Current max exceeding 120% rated current indicates customer load overload.",
      },
    ],
    confirmations: {
      visual: "Current shunt or CT copper trace discoloration/melting.",
      bench: "Resistance check across phase current shunt.",
    },
    routes: {
      warranty: "none",
      capaTrigger: false,
      cohortQuery: "same_premise_tariff_class",
    },
  },
  {
    id: "MECH-TAMPER-BYPASS",
    name: "Meter tamper / bypass attempt",
    family: "customer",
    narrative:
      "Unauthorized physical opening, neutral bypass, magnetic interference, or reverse current connection attempt.",
    signature: {
      requires: ["TAMPER_EVENTS_PRESENT"],
      supports: ["CURRENT_REVERSAL_SATURATED", "COVER_OPEN_EVENTS"],
      contradicts: ["ZERO_TAMPER_EVENTS"],
      disqualifiers: [],
    },
    discriminators: [
      {
        vsMechanismId: "MECH-NO-FAULT-FOUND",
        test: "event.tamper.count",
        reading:
          "Presence of persistent tamper/cover-open events confirms physical intervention.",
      },
    ],
    confirmations: {
      visual: "Terminal cover seal broken or top cover latch tamper.",
      bench: "Tamper sensor microswitch continuity test.",
    },
    routes: {
      warranty: "none",
      capaTrigger: false,
      cohortQuery: "same_sub_division AND tamper_type",
    },
  },
  {
    id: "MECH-NO-FAULT-FOUND",
    name: "No fault found / cosmetic or communication issue",
    family: "no-fault",
    narrative:
      "Meter operates within all electrical parameters. Reported field defect was temporary comms drop, billing dispute, or cosmetic.",
    signature: {
      requires: ["VOLTAGE_WITHIN_NORMAL_BAND"],
      supports: ["DLMS_LOG_HEALTHY_TO_END"],
      contradicts: ["TRUNCATION_AT_ZERO_VOLTS", "VOLTAGE_CHRONIC_STRESS"],
      disqualifiers: ["INTERNAL_BURN_CONFIRMED"],
    },
    discriminators: [
      {
        vsMechanismId: "MECH-TERM-PROGRESSIVE",
        test: "profile.record_count",
        reading:
          "Healthy profile logging through end of period confirms no hardware failure.",
      },
    ],
    confirmations: {
      visual: "No physical burn, scratch or terminal damage.",
      bench: "Full bench calibration & accuracy test at 1.0 PF and 0.5 PF.",
    },
    routes: {
      warranty: "none",
      capaTrigger: false,
      cohortQuery: "same_complaint_type",
    },
  },
];

export function getMechanismById(id: string): PhysicalMechanism | undefined {
  return MECHANISM_LIBRARY.find((m) => m.id === id);
}
