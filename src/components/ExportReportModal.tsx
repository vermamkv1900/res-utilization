import React, { useState } from 'react';
import { AuditSummary, CloudResource, MonthlyCostPoint, OptimizationRecommendation } from '../types/cloud';
import { exportToCSV, exportToJSON } from '../utils/cloudAnalyzer';

interface ExportReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  summary: AuditSummary;
  resources: CloudResource[];
  monthlyTrends: MonthlyCostPoint[];
  recommendations: OptimizationRecommendation[];
}

export const ExportReportModal: React.FC<ExportReportModalProps> = ({
  isOpen,
  onClose,
  summary,
  resources,
  monthlyTrends,
  recommendations,
}) => {
  const [copiedType, setCopiedType] = useState<string | null>(null);

  if (!isOpen) return null;

  const downloadCSV = () => {
    const csv = exportToCSV(resources);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cloudpulse_audit_${summary.provider}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadJSON = () => {
    const json = exportToJSON(summary, resources, monthlyTrends, recommendations);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cloudpulse_audit_${summary.provider}_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copyExecutiveSummary = () => {
    const text = `CLOUDPULSE FINOPS AUDIT REPORT
Target: ${summary.provider.toUpperCase()} (Account: ${summary.accountId})
Audited At: ${summary.scannedAt}

KEY STATISTICS:
- Total Monitored Resources: ${summary.totalResources}
- Active Productive Resources: ${summary.activeResources}
- Inactive / Zombie Resources: ${summary.inactiveResources}
- Total Monthly Cloud Spend: $${summary.totalMonthlySpend.toFixed(2)}
- Identified Monthly Waste: $${summary.totalMonthlyWaste.toFixed(2)} (${summary.wastePercentage}% of budget)
- Potential Monthly Savings: $${summary.potentialMonthlySavings.toFixed(2)}
- Annualized Runway Saved: $${(summary.potentialMonthlySavings * 12).toFixed(2)}

TOP SAVINGS OPPORTUNITIES:
${recommendations.map((r, i) => `${i + 1}. ${r.title} (Savings: +$${r.estimatedMonthlySavings.toFixed(2)}/mo)`).join('\n')}
`;
    navigator.clipboard.writeText(text);
    setCopiedType('summary');
    setTimeout(() => setCopiedType(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-6 text-slate-200 shadow-2xl relative space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-base font-bold text-white font-sans">
              Export Cloud Audit & Utilization Report
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Download audit artifacts for finance, engineering, and leadership
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800"
          >
            ✕
          </button>
        </div>

        <div className="space-y-3">
          {/* CSV Export Option */}
          <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-white">CSV Spreadsheet Export</div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Full resource catalog with CPU, memory, IOPS, and dollar waste columns
              </p>
            </div>
            <button
              onClick={downloadCSV}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-md bg-slate-800 hover:bg-slate-700 text-white transition-colors cursor-pointer whitespace-nowrap"
            >
              Download CSV
            </button>
          </div>

          {/* JSON Export Option */}
          <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-white">JSON Machine-Readable Audit</div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Structured ledger containing monthly trends and recommendation metadata
              </p>
            </div>
            <button
              onClick={downloadJSON}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-md bg-slate-800 hover:bg-slate-700 text-white transition-colors cursor-pointer whitespace-nowrap"
            >
              Download JSON
            </button>
          </div>

          {/* Executive Summary Clip */}
          <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-white">Executive Summary Digest</div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Formatted text breakdown for Slack, email, or stakeholder updates
              </p>
            </div>
            <button
              onClick={copyExecutiveSummary}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-md bg-cyan-400 text-slate-950 hover:bg-cyan-300 transition-colors cursor-pointer whitespace-nowrap"
            >
              {copiedType === 'summary' ? 'Copied!' : 'Copy Summary'}
            </button>
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
