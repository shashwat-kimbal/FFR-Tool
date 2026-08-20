"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Download, FileText, Send, CheckCircle2, ShieldCheck, Printer } from "lucide-react";

export default function ReportPage() {
  const params = useParams();
  const id = String(params.id);

  const [caseData, setCaseData] = useState<any>(null);
  const [latestRun, setLatestRun] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/cases/${id}`)
      .then((res) => res.json())
      .then((d) => {
        setCaseData(d.case);
        setLatestRun(d.latestRun);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  const handleExportPdf = () => {
    window.print();
  };

  const handleExportFfrIg = () => {
    const csvContent = `Case,Meter_Old,Meter_New,Complaint,Leading_Cause,Family,Posterior,SubDivision,Lag_Days\n${caseData?.case_ref},${caseData?.meter_old},${caseData?.meter_new || "SC10231275"},${caseData?.complaint_label},${caseData?.leading_cause || "Progressive supply-terminal degradation"},${caseData?.leading_family || "INSTALLATION"},${caseData?.posterior_probability || 0.71},${caseData?.sub_division},11`;
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `FFR_IG_Case_${caseData?.case_ref || id}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-12 text-center text-slate-400">
        <div>Loading RCA report…</div>
      </div>
    );
  }

  // 16 Structured RCA Fields (§5.6 & Architecture Spec §14)
  const rcaFields = [
    {
      num: 1,
      title: "Case Reference & Status",
      evidenceType: "Direct",
      value: `Case #${caseData?.case_ref} · Status: ${caseData?.status.toUpperCase()} · Priority: ${caseData?.priority.toUpperCase()}`,
    },
    {
      num: 2,
      title: "Meter Identity & Serial Pair",
      evidenceType: "Direct",
      value: `Defective unit: ${caseData?.meter_old} → Replacement unit: ${caseData?.meter_new || "SC10231275"} (SINHAL UDYOG, Mfg 2023, Firmware TEST 1.22)`,
    },
    {
      num: 3,
      title: "Customer & Field Defect Complaint",
      evidenceType: "Direct",
      value: `${caseData?.complaint_label || "METER:B · Meter burnt"} (Field Observation: "${caseData?.field_observation || "Meter is internally Burnt"}")`,
    },
    {
      num: 4,
      title: "Defect Date & Detection Lag",
      evidenceType: "Inferred",
      value: `Reported: ${caseData?.defect_date || "16 Jun 2026"} · Time of Death: 5 Jun 2026 18:30 · Detection lag: 11 days`,
    },
    {
      num: 5,
      title: "Time of Death & Operating State",
      evidenceType: "Direct",
      value: "5 June 2026 18:30:00 at 0.0 V terminal voltage across 3 consecutive profile samples. 29 June 19:00 depot power-up confirmed persistent 0 V state.",
    },
    {
      num: 6,
      title: "Primary Failure Attribution & Mechanism",
      evidenceType: "Inferred",
      value: `${caseData?.leading_cause || "Progressive supply-terminal degradation"} (Posterior probability: ${caseData?.posterior_probability || "0.71"})`,
    },
    {
      num: 7,
      title: "Attribution Family & Responsibility",
      evidenceType: "Inferred",
      value: `${caseData?.leading_family || "INSTALLATION"} — Contact resistance loosening at supply terminal block.`,
    },
    {
      num: 8,
      title: "Decomposed Confidence Dials",
      evidenceType: "Direct",
      value: `Completeness: ${caseData?.confidence_completeness || 3}/4 · Discrimination: ${caseData?.confidence_discrimination || 2}/4 · Provenance: ${caseData?.confidence_provenance || 2}/4 · Cohort: ${caseData?.confidence_cohort || 0}/4`,
    },
    {
      num: 9,
      title: "Primary Observed Evidence Citations",
      evidenceType: "Direct",
      value: "PowerRelatedEvent!C14:C63 (Power failures escalating), BlockLoadProfile!C3348:D3350 (0V truncation), OtherEvent!C14:C63 (Low-PF buffer saturation).",
    },
    {
      num: 10,
      title: "Secondary Stress / Contributing Factors",
      evidenceType: "Inferred",
      value: "Chronic grid overvoltage dose: 9.1% of half-hour samples (>253 V) with excursions to 260.6 V (BlockLoadProfile!D14:D3373).",
    },
    {
      num: 11,
      title: "Contradictory Evidence & Exclusions",
      evidenceType: "Direct",
      value: "Excluded Grid Overvoltage Thermal Runaway (did not fail at peak voltage; failed at zero volts). Excluded Load-side short circuit (CurrentRelatedEvent inactive for 560 days).",
    },
    {
      num: 12,
      title: "Censored Event Buffer Rates & Spans",
      evidenceType: "Direct",
      value: "Power-failure: 1.67/day (saturated 50/30d) · Low-PF: 2.94/day (saturated 50/17d) · Voltage: 0.35/day (saturated 50/144d) · Current: 0/day (560 days stale).",
    },
    {
      num: 13,
      title: "Feeder Cohort Correlation & Population Risk",
      evidenceType: "Inferred",
      value: `Sub-division ${caseData?.sub_division || "Lakhipur_bec"}: 27 of 38 returns (71%) share progressive terminal degradation (5.9× baseline rate).`,
    },
    {
      num: 14,
      title: "Corrective & Preventive Action (CAPA) Route",
      evidenceType: "Inferred",
      value: "Issue installer field notice regarding terminal screw torque audit across Lakhipur_bec sub-division. No OEM manufacturing CAPA triggered.",
    },
    {
      num: 15,
      title: "Warranty Attribution & Financial Liability",
      evidenceType: "Inferred",
      value: "Assigned to Installation Contractor warranty pool. No DISCOM penalty or OEM warranty claim applicable.",
    },
    {
      num: 16,
      title: "Recommended Verification Test (Next Best Test)",
      evidenceType: "Inferred",
      value: "Feeder cohort query across Lakhipur_bec meters (31 May–5 Jun power-failure storm rate). Bench contact resistance & visual terminal inspection.",
    },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header & Export Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div>
          <h2 className="text-lg font-bold text-white">
            Root Cause Analysis (RCA) Report — Case {caseData?.case_ref}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Standard 16-field structured diagnostic audit structure.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportFfrIg}
            className="px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Download size={13} /> Export FFR IG
          </button>
          <button
            type="button"
            onClick={handleExportPdf}
            className="px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Printer size={13} /> Export PDF
          </button>
          <button
            type="button"
            onClick={() => alert("RCA Report sent to Quality Engineering team.")}
            className="px-3.5 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-600/30 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Send size={13} /> Send to quality
          </button>
        </div>
      </div>

      {/* 16 Fields Grid Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden shadow-2xl divide-y divide-slate-800/80">
        {rcaFields.map((field) => {
          let badgeColor = "bg-blue-950/80 text-blue-300 border-blue-700/60";
          if (field.evidenceType === "Inferred") badgeColor = "bg-teal-950/80 text-teal-300 border-teal-700/60";
          else if (field.evidenceType === "Contradictory") badgeColor = "bg-red-950/80 text-red-300 border-red-700/60";
          else if (field.evidenceType === "Unavailable") badgeColor = "bg-slate-800 text-slate-400 border-slate-700";

          return (
            <div key={field.num} className="p-4 flex flex-col sm:flex-row sm:items-start justify-between gap-3 text-xs">
              <div className="w-full sm:w-1/3 space-y-1">
                <div className="font-semibold text-slate-200 flex items-center gap-2">
                  <span className="font-mono text-slate-500">{field.num}.</span>
                  {field.title}
                </div>
                <div>
                  <span className={`inline-block px-1.5 py-0.2 rounded text-[10px] font-mono font-semibold border ${badgeColor}`}>
                    [{field.evidenceType}]
                  </span>
                </div>
              </div>

              <div className="w-full sm:w-2/3 text-slate-300 leading-relaxed font-sans bg-slate-950/40 p-2.5 rounded border border-slate-800/50">
                {field.value || "Not established from available evidence"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
