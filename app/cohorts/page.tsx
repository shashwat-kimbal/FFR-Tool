import Link from "next/link";
import { GitFork } from "lucide-react";

export default function CohortsIndexPage() {
  return (
    <div className="max-w-4xl mx-auto py-8 px-6">
      <h1 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
        <GitFork className="text-blue-400" />
        Cohort Analysis
      </h1>
      <p className="text-slate-400 mb-8">Select a cohort to view aggregated findings and failure mechanisms.</p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <a href="/cohorts/feeder/Lakhipur_bec" className="block p-6 bg-slate-800 rounded-lg border border-slate-700 hover:border-blue-500 transition-colors">
          <h2 className="text-lg font-semibold text-white mb-2">Feeder: Lakhipur_bec</h2>
          <p className="text-sm text-slate-400">View performance distribution for the Lakhipur_bec feeder.</p>
        </a>
        <a href="/cohorts/contractor/Apex Power Infra" className="block p-6 bg-slate-800 rounded-lg border border-slate-700 hover:border-blue-500 transition-colors">
          <h2 className="text-lg font-semibold text-white mb-2">Contractor: Apex Power Infra</h2>
          <p className="text-sm text-slate-400">View return patterns for this installation contractor.</p>
        </a>
      </div>
    </div>
  );
}
