import React from 'react';
import { MonthlyCostPoint } from '../types/cloud';

interface CostTrendsProps {
  monthlyTrends: MonthlyCostPoint[];
  totalMonthlyWaste: number;
}

export const CostTrends: React.FC<CostTrendsProps> = ({
  monthlyTrends,
  totalMonthlyWaste,
}) => {
  const currentMonth = monthlyTrends[monthlyTrends.length - 1];
  const firstMonth = monthlyTrends[0];
  const spendGrowthPct = firstMonth
    ? (((currentMonth.totalSpend - firstMonth.totalSpend) / firstMonth.totalSpend) * 100).toFixed(1)
    : '0';

  const annualizedWaste = totalMonthlyWaste * 12;

  return (
    <div className="space-y-8">
      {/* Top Trend Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-xl bg-slate-900 border border-slate-800">
          <div className="text-xs text-slate-400 font-medium">6-Month Spend Trajectory</div>
          <div className="text-2xl font-bold font-mono text-white mt-1">
            +${currentMonth.totalSpend - firstMonth.totalSpend}{' '}
            <span className="text-sm font-normal text-rose-400 font-sans">
              (+{spendGrowthPct}%)
            </span>
          </div>
          <div className="text-xs text-slate-500 mt-2">
            From ${firstMonth.totalSpend} in {firstMonth.month} to ${currentMonth.totalSpend} currently
          </div>
        </div>

        <div className="p-5 rounded-xl bg-slate-900 border border-slate-800">
          <div className="text-xs text-rose-400 font-medium">Annualized Inactive Waste</div>
          <div className="text-2xl font-bold font-mono text-rose-400 mt-1">
            ${annualizedWaste.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-slate-500 mt-2">
            Projected 12-month drain without automated decommissioning
          </div>
        </div>

        <div className="p-5 rounded-xl bg-slate-900 border border-slate-800">
          <div className="text-xs text-emerald-400 font-medium">Optimized Annual Runway</div>
          <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">
            +${annualizedWaste.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-slate-500 mt-2">
            Available engineering capital unlocked by executing cleanup actions
          </div>
        </div>
      </div>

      {/* Monthly Breakdown Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">Monthly Usage & Cost Ledger</h3>
            <p className="text-xs text-slate-400 mt-0.5">Historical utilization audited via Cloud Billing & Cost Explorer</p>
          </div>
          <span className="text-xs text-slate-400 font-mono">USD ($) Currency</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
              <tr>
                <th className="px-6 py-3">Billing Cycle</th>
                <th className="px-6 py-3 text-right">Compute Cost</th>
                <th className="px-6 py-3 text-right">Storage Cost</th>
                <th className="px-6 py-3 text-right">Database Cost</th>
                <th className="px-6 py-3 text-right">Network Cost</th>
                <th className="px-6 py-3 text-right">Productive Spend</th>
                <th className="px-6 py-3 text-right text-rose-400">Idle Waste</th>
                <th className="px-6 py-3 text-right text-white font-bold">Total Invoiced</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 font-mono text-slate-300">
              {monthlyTrends.map((pt) => {
                const wastePct = ((pt.wasteSpend / pt.totalSpend) * 100).toFixed(1);
                return (
                  <tr key={pt.month} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-6 py-3 font-semibold text-white font-sans">{pt.month}</td>
                    <td className="px-6 py-3 text-right text-slate-400">${pt.computeCost}</td>
                    <td className="px-6 py-3 text-right text-slate-400">${pt.storageCost}</td>
                    <td className="px-6 py-3 text-right text-slate-400">${pt.databaseCost}</td>
                    <td className="px-6 py-3 text-right text-slate-400">${pt.networkingCost}</td>
                    <td className="px-6 py-3 text-right text-cyan-400">${pt.activeSpend}</td>
                    <td className="px-6 py-3 text-right text-rose-400 font-medium">
                      ${pt.wasteSpend} <span className="text-[10px] text-slate-500 font-sans">({wastePct}%)</span>
                    </td>
                    <td className="px-6 py-3 text-right font-bold text-white">${pt.totalSpend}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Service Share Proportions */}
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
        <h3 className="text-sm font-semibold text-white">Current Month Service Allocation</h3>
        <div className="w-full bg-slate-950 h-5 rounded-lg overflow-hidden flex font-mono text-[10px] text-white font-bold">
          <div
            style={{ width: `${(currentMonth.computeCost / currentMonth.totalSpend) * 100}%` }}
            className="bg-blue-600 flex items-center justify-center truncate px-1"
            title={`Compute: $${currentMonth.computeCost}`}
          >
            Compute {((currentMonth.computeCost / currentMonth.totalSpend) * 100).toFixed(0)}%
          </div>
          <div
            style={{ width: `${(currentMonth.storageCost / currentMonth.totalSpend) * 100}%` }}
            className="bg-amber-600 flex items-center justify-center truncate px-1"
            title={`Storage: $${currentMonth.storageCost}`}
          >
            Storage {((currentMonth.storageCost / currentMonth.totalSpend) * 100).toFixed(0)}%
          </div>
          <div
            style={{ width: `${(currentMonth.databaseCost / currentMonth.totalSpend) * 100}%` }}
            className="bg-purple-600 flex items-center justify-center truncate px-1"
            title={`Database: $${currentMonth.databaseCost}`}
          >
            DB {((currentMonth.databaseCost / currentMonth.totalSpend) * 100).toFixed(0)}%
          </div>
          <div
            style={{ width: `${(currentMonth.networkingCost / currentMonth.totalSpend) * 100}%` }}
            className="bg-emerald-600 flex items-center justify-center truncate px-1"
            title={`Networking: $${currentMonth.networkingCost}`}
          >
            Net
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono pt-2">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-xs bg-blue-600 inline-block" />
            <span className="text-slate-300">Compute: ${currentMonth.computeCost}/mo</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-xs bg-amber-600 inline-block" />
            <span className="text-slate-300">Storage: ${currentMonth.storageCost}/mo</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-xs bg-purple-600 inline-block" />
            <span className="text-slate-300">Database: ${currentMonth.databaseCost}/mo</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-xs bg-emerald-600 inline-block" />
            <span className="text-slate-300">Networking: ${currentMonth.networkingCost}/mo</span>
          </div>
        </div>
      </div>
    </div>
  );
};
