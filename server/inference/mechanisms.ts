export type MechanismFamily =
  | "installation"
  | "product"
  | "grid"
  | "customer"
  | "environment"
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
  warranty: "installer" | "manufacturer" | "discom" | "customer" | "none";
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
      "Contact resistance at an incoming terminal rises, heats, intermittently opens under load, then fails fully. Heat damage presents as internal burning near the terminal block.",
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
      "Grid supply sustained chronic high voltage (>253V) or high-energy transient spikes exceeding varistor/capacitor voltage ratings, causing thermal failure.",
    signature: {
      requires: ["VOLTAGE_CHRONIC_STRESS"],
      supports: ["TRUNCATION_AT_PEAK_VOLTAGE", "OVERVOLTAGE_EVENTS_SATURATED"],
      contradicts: ["VOLTAGE_WITHIN_NORMAL_BAND"],
      disqualifiers: ["ZERO_VOLTAGE_PROLONGED_NORMAL"],
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
      "Internal switch-mode power supply (SMPS) component defect (primary capacitor breakdown, diode short) under normal operating grid parameters.",
    signature: {
      requires: ["VOLTAGE_WITHIN_NORMAL_BAND", "TRUNCATION_AT_ZERO_VOLTS"],
      supports: ["CURRENT_AXIS_SILENT", "SINGLE_LOT_CLUSTER"],
      contradicts: ["VOLTAGE_CHRONIC_STRESS", "EXTERNAL_SURGE_EVENT"],
      disqualifiers: ["TERMINAL_BLOCK_MELTED"],
    },
    discriminators: [
      {
        vsMechanismId: "MECH-TERM-PROGRESSIVE",
        test: "cohort.same_batch.failure_rate",
        reading:
          "Clustered in specific manufacturing batch/component lot confirms supplier CAPA.",
      },
    ],
    confirmations: {
      visual: "Exploded capacitor / shorted diode on SMPS sub-board without external terminal charring.",
      bench: "X-ray or destructive physical analysis of SMPS controller IC.",
    },
    routes: {
      warranty: "manufacturer",
      capaTrigger: true,
      cohortQuery: "same_batch AND same_mfg_year",
    },
  },
  {
    id: "MECH-NEUTRAL-OPEN",
    name: "Neutral floating / open neutral high potential",
    family: "grid",
    narrative:
      "Floating or severed neutral conductor causing line-to-neutral voltage to rise toward line-to-line 400V+ during load imbalance.",
    signature: {
      requires: ["VOLTAGE_EXTREME_SURGE"],
      supports: ["OVERVOLTAGE_EVENTS_SATURATED", "SIMULTANEOUS_PHASE_SPIKE"],
      contradicts: ["VOLTAGE_WITHIN_NORMAL_BAND"],
      disqualifiers: ["BALANCED_SUPPLY_MAINTAINED"],
    },
    discriminators: [
      {
        vsMechanismId: "MECH-GRID-OV-THERMAL",
        test: "cohort.same_transformer.multi_meter_surge",
        reading: "Coincident multi-premise surge on DT confirms open neutral.",
      },
    ],
    confirmations: {
      visual: "Flash marks across neutral sensing divider resistors.",
      bench: "Dielectric breakdown test on neutral path.",
    },
    routes: {
      warranty: "discom",
      capaTrigger: false,
      cohortQuery: "same_transformer_id",
    },
  },
  {
    id: "MECH-RELAY-WELD",
    name: "Internal load switch / relay contact weld",
    family: "product",
    narrative:
      "Latching relay contacts welded closed due to sustained high inrush currents or defective contact alloy plating.",
    signature: {
      requires: ["RELAY_STATUS_MISMATCH"],
      supports: ["HIGH_INRUSH_CURRENT_RECORDED"],
      contradicts: ["RELAY_OPENS_CLEANLY"],
      disqualifiers: ["NON_DISCONNECT_MODEL"],
    },
    discriminators: [
      {
        vsMechanismId: "MECH-PROD-SMPS",
        test: "bench.relay_contact_resistance",
        reading: "Direct contact continuity under disconnect command confirms relay weld.",
      },
    ],
    confirmations: {
      visual: "Contact pitting or micro-welding inside sealed relay housing.",
      bench: "Coil pulse actuation test with 0V load drop.",
    },
    routes: {
      warranty: "manufacturer",
      capaTrigger: true,
      cohortQuery: "same_relay_vendor_lot",
    },
  },
  {
    id: "MECH-PHYSICAL-WATER",
    name: "External moisture / water ingress corrosion",
    family: "environment",
    narrative:
      "Gasket seal degradation or cable entry water penetration leading to electrochemical dendrite growth and conductive track short-circuiting.",
    signature: {
      requires: ["ENVIRONMENTAL_STRESS_SIGNS"],
      supports: ["PF_DEGRADATION_GRADUAL", "TAMPER_COVER_HISTORY"],
      contradicts: ["ENCLOSURE_SEAL_INTACT"],
      disqualifiers: ["IP54_PRESSURE_PASS"],
    },
    discriminators: [
      {
        vsMechanismId: "MECH-TERM-PROGRESSIVE",
        test: "visual.internal_corrosion_pattern",
        reading: "Green copper patina across PCB traces confirms moisture path.",
      },
    ],
    confirmations: {
      visual: "Mineral residue / rust patterns on internal optical port or lower PCB edge.",
      bench: "IP ingress water immersion leak test.",
    },
    routes: {
      warranty: "none",
      capaTrigger: false,
      cohortQuery: "same_geographic_zone AND rainy_season",
    },
  },
  {
    id: "MECH-TAMPER-ESD",
    name: "High-voltage electrostatic discharge (ESD) / spark attack",
    family: "customer",
    narrative:
      "Intentional high-voltage discharge applied to meter terminals or display window to freeze micro-controller or bypass energy recording.",
    signature: {
      requires: ["TAMPER_MAGNET_OR_ESD_LOGGED"],
      supports: ["CORRUPTED_TRANSACTION_RECORDS", "SUDDEN_CLOCK_ANOMALY"],
      contradicts: ["NORMAL_LOGICAL_SHUTDOWN"],
      disqualifiers: ["CLEAN_POWER_CYCLE_HISTORY"],
    },
    discriminators: [
      {
        vsMechanismId: "MECH-PROD-SMPS",
        test: "visual.spark_gap_carbonization",
        reading: "Arc traces near optical head or push button confirm external HV spark.",
      },
    ],
    confirmations: {
      visual: "Carbonized pinholes on front cover or LCD glass edge.",
      bench: "EEPROM memory map read showing corrupted checksum sectors.",
    },
    routes: {
      warranty: "customer",
      capaTrigger: false,
      cohortQuery: "same_sub_division AND high_tamper_cluster",
    },
  },
  {
    id: "MECH-NO-FAULT",
    name: "No fault found / normal operational status",
    family: "no-fault",
    narrative:
      "Meter is fully functional; return was driven by cosmetic complaint, field installation error, or misdiagnosis at premise.",
    signature: {
      requires: ["VOLTAGE_WITHIN_NORMAL_BAND", "ENERGY_REGISTERS_ADVANCING"],
      supports: ["CLEAN_DIAGNOSTIC_FLAGS", "NO_CENSORED_BUFFERS"],
      contradicts: ["TRUNCATION_AT_ZERO_VOLTS", "VOLTAGE_CHRONIC_STRESS"],
      disqualifiers: ["INTERNAL_PCB_BURN"],
    },
    discriminators: [
      {
        vsMechanismId: "MECH-TERM-PROGRESSIVE",
        test: "bench.full_accuracy_calibration",
        reading: "Accuracy within Class 1.0 limits with zero communication errors.",
      },
    ],
    confirmations: {
      visual: "No physical damage, pristine terminal block and PCB.",
      bench: "Standard DLMS reading and 0.5S/1.0 calibration sweep passed.",
    },
    routes: {
      warranty: "none",
      capaTrigger: false,
      cohortQuery: "same_reporting_officer",
    },
  },
];

export function getMechanismById(id: string): PhysicalMechanism | undefined {
  return MECHANISM_LIBRARY.find((m) => m.id === id);
}
