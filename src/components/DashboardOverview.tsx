import React, { useState } from 'react';
import { AuditSummary, CloudResource, MonthlyCostPoint } from '../types/cloud';

interface DashboardOverviewProps {
  summary: AuditSummary;
  resources: CloudResource[];
  monthlyTrends: MonthlyCostPoint[];
  onNavigateToResources: () => void;
  onNavigateToTopology: () => void;
  onNavigateToRecommendations: () => void;
  onNavigateToPython: () => void;
  onOpenConnectModal: () => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  summary,
  resources,
  monthlyTrends,
  onNavigateToResources,
  onNavigateToTopology,
  onNavigateToRecommendations,
  onNavigateToPython,
  onOpenConnectModal,
}) => {
  const [hoveredMonthIndex, setHoveredMonthIndex] = useState<number | null>(null);

  // Calculate waste category breakdown
  const idleComputeWaste = resources
    .filter((r) => r.serviceCategory === 'Compute' && r.isInactive && !r.remediated)
    .reduce((sum, r) => sum + r.estimatedWasteUSD, 0);

  const orphanedStorageWaste = resources
    .filter((r) => r.serviceCategory === 'Storage' && r.isInactive && !r.remediated)
    .reduce((sum, r) => sum + r.estimatedWasteUSD, 0);

  const idleDatabaseWaste = resources
    .filter((r) => r.serviceCategory === 'Database' && r.isInactive && !r.remediated)
    .reduce((sum, r) => sum + r.estimatedWasteUSD, 0);

  const unusedNetworkWaste = resources
    .filter((r) => r.serviceCategory === 'Networking' && r.isInactive && !r.remediated)
    .reduce((sum, r) => sum + r.estimatedWasteUSD, 0);

  // Maximum spend for scaling chart
  const maxSpend = Math.max(...monthlyTrends.map((t) => t.totalSpend), 5000);

  return (
    <div className="space-y-8">
      {/* Account Info Banner & Intake Trigger */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-xl bg-slate-900 border border-slate-800 shadow-sm">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
              Audited Cloud Account
            </span>
            <span className="text-slate-600">·</span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-xs font-mono font-bold text-cyan-300">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
              {summary.provider.toUpperCase()} Account ID: {summary.accountId}
            </span>
            <button
              onClick={onOpenConnectModal}
              className="text-xs text-cyan-400 hover:text-cyan-300 underline font-medium cursor-pointer ml-1"
            >
              Change Account ID / Secret Key
            </button>
          </div>
          <p className="text-xs text-slate-300">
            Real-time utilization audit complete. Monitoring {summary.totalResources} active & inactive resources across compute, storage, and database tiers.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onNavigateToTopology}
            className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-cyan-950/70 text-cyan-300 border border-cyan-700/50 hover:bg-cyan-900/50 transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5"
          >
            <span>Resource Map</span>
          </button>
          <button
            onClick={onOpenConnectModal}
            className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-cyan-400 text-slate-950 hover:bg-cyan-300 transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5"
          >
            <span>Enter Credentials</span>
          </button>
          <button
            onClick={onNavigateToRecommendations}
            className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 transition-colors whitespace-nowrap cursor-pointer"
          >
            Save ${summary.potentialMonthlySavings.toFixed(0)}/mo
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Monthly Spend */}
        <div className="p-5 rounded-xl bg-slate-900 border border-slate-800">
          <div className="text-xs text-slate-400 font-medium">Total Monthly Cloud Spend</div>
          <div className="text-2xl font-bold font-mono text-white mt-2">
            ${summary.totalMonthlySpend.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-slate-500 mt-2">
            Based on current on-demand & provisioned run rates
          </div>
        </div>

        {/* Wasted Spend */}
        <div className="p-5 rounded-xl bg-slate-900 border border-slate-800">
          <div className="text-xs text-rose-400 font-medium">Identified Monthly Waste</div>
          <div className="text-2xl font-bold font-mono text-rose-400 mt-2">
            ${summary.totalMonthlyWaste.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-slate-400 mt-2">
            <span className="font-semibold text-rose-300">{summary.wastePercentage}%</span> of total cloud expenditure is idle
          </div>
        </div>

        {/* Active vs Inactive Count */}
        <div className="p-5 rounded-xl bg-slate-900 border border-slate-800">
          <div className="text-xs text-slate-400 font-medium">Resource Utilization Ratio</div>
          <div className="text-2xl font-bold font-mono text-white mt-2">
            <span className="text-emerald-400">{summary.activeResources} Active</span>
            <span className="text-slate-500 text-lg font-normal"> / </span>
            <span className="text-amber-400">{summary.inactiveResources} Idle</span>
          </div>
          <div className="text-xs text-slate-400 mt-2">
            {summary.inactiveResources} zombie or unattached assets detected
          </div>
        </div>

        {/* Projected Optimized Spend */}
        <div className="p-5 rounded-xl bg-slate-900 border border-slate-800">
          <div className="text-xs text-emerald-400 font-medium">Projected Optimized Spend</div>
          <div className="text-2xl font-bold font-mono text-emerald-400 mt-2">
            ${(summary.totalMonthlySpend - summary.totalMonthlyWaste).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-slate-400 mt-2">
            Monthly savings after applying recommendations
          </div>
        </div>
      </div>

      {/* Visual Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart: Monthly Usage & Spend Trends */}
        <div className="lg:col-span-2 p-6 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-semibold text-white">Monthly Cloud Spend & Waste Trends</h3>
                <p className="text-xs text-slate-400 mt-0.5">Historical breakdown of productive workloads vs idle waste</p>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-xs bg-cyan-500" />
                  <span className="text-slate-300">Active Workload</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-xs bg-rose-500" />
                  <span className="text-slate-300">Idle / Inactive Waste</span>
                </div>
              </div>
            </div>

            {/* SVG Interactive Trend Visualizer */}
            <div className="pt-6 pb-2">
              <div className="h-56 flex items-end justify-between gap-4 px-2">
                {monthlyTrends.map((pt, idx) => {
                  const activeHeightPct = (pt.activeSpend / maxSpend) * 100;
                  const wasteHeightPct = (pt.wasteSpend / maxSpend) * 100;
                  const isHovered = hoveredMonthIndex === idx;

                  return (
                    <div
                      key={pt.month}
                      onMouseEnter={() => setHoveredMonthIndex(idx)}
                      onMouseLeave={() => setHoveredMonthIndex(null)}
                      className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer relative"
                    >
                      {/* Tooltip on hover */}
                      {isHovered && (
                        <div className="absolute -top-14 bg-slate-950 border border-slate-700 text-xs px-2.5 py-1.5 rounded-lg shadow-xl z-10 font-mono whitespace-nowrap text-left">
                          <div className="text-slate-400 text-[10px]">{pt.month}</div>
                          <div className="text-white font-bold">Total: ${pt.totalSpend}</div>
                          <div className="text-rose-400 text-[11px]">Waste: ${pt.wasteSpend} ({(pt.wasteSpend/pt.totalSpend*100).toFixed(0)}%)</div>
                        </div>
                      )}

                      {/* Stacked Bar Container */}
                      <div className="w-full max-w-[48px] flex flex-col justify-end rounded-t-md overflow-hidden transition-all duration-200 group-hover:brightness-110">
                        {/* Waste Segment (Top) */}
                        <div
                          style={{ height: `${wasteHeightPct}%` }}
                          className="w-full bg-rose-500/80 border-t border-rose-400/50"
                        />
                        {/* Active Segment (Bottom) */}
                        <div
                          style={{ height: `${activeHeightPct}%` }}
                          className="w-full bg-cyan-600/80 border-t border-cyan-400/30"
                        />
                      </div>

                      {/* Month Label */}
                      <span className="text-xs text-slate-400 mt-3 font-mono">
                        {pt.month.split(' ')[0]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 font-mono">
            <span>Growth trend: Inactive waste grew by +151% over 6 months without automated lifecycle rules.</span>
          </div>
        </div>

        {/* Waste Distribution by Category */}
        <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">Waste Breakdown by Category</h3>
            <p className="text-xs text-slate-400 mt-0.5">Where the monthly losses are concentrated</p>

            <div className="space-y-4 mt-6">
              {/* Compute Waste */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-300 font-medium">Idle & Stopped Compute</span>
                  <span className="font-mono text-white font-semibold">${idleComputeWaste.toFixed(2)}/mo</span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    style={{ width: `${summary.totalMonthlyWaste > 0 ? (idleComputeWaste / summary.totalMonthlyWaste) * 100 : 0}%` }}
                    className="bg-rose-500 h-full rounded-full"
                  />
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5 font-mono">
                  Low CPU EC2 / Azure VMs & stopped instances with attached disks
                </div>
              </div>

              {/* Storage Waste */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-300 font-medium">Unattached Volumes & Disks</span>
                  <span className="font-mono text-white font-semibold">${orphanedStorageWaste.toFixed(2)}/mo</span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    style={{ width: `${summary.totalMonthlyWaste > 0 ? (orphanedStorageWaste / summary.totalMonthlyWaste) * 100 : 0}%` }}
                    className="bg-amber-500 h-full rounded-full"
                  />
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5 font-mono">
                  Orphaned EBS volumes & unattached Azure Managed Disks
                </div>
              </div>

              {/* Database Waste */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-300 font-medium">Zero-Connection Databases</span>
                  <span className="font-mono text-white font-semibold">${idleDatabaseWaste.toFixed(2)}/mo</span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    style={{ width: `${summary.totalMonthlyWaste > 0 ? (idleDatabaseWaste / summary.totalMonthlyWaste) * 100 : 0}%` }}
                    className="bg-purple-500 h-full rounded-full"
                  />
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5 font-mono">
                  RDS QA replicas & un-paused Azure SQL serverless databases
                </div>
              </div>

              {/* Networking Waste */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-300 font-medium">Unused Elastic IPs & Load Balancers</span>
                  <span className="font-mono text-white font-semibold">${unusedNetworkWaste.toFixed(2)}/mo</span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    style={{ width: `${summary.totalMonthlyWaste > 0 ? (unusedNetworkWaste / summary.totalMonthlyWaste) * 100 : 0}%` }}
                    className="bg-blue-500 h-full rounded-full"
                  />
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5 font-mono">
                  Disassociated Public IPs & empty ALB target groups
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              onClick={onNavigateToTopology}
              className="py-2 text-xs font-semibold text-cyan-300 bg-cyan-950/60 border border-cyan-800/60 rounded-lg hover:bg-cyan-900/60 transition-colors text-center cursor-pointer"
            >
              Interactive Resource Map →
            </button>
            <button
              onClick={onNavigateToResources}
              className="py-2 text-xs font-semibold text-slate-300 bg-slate-900 border border-slate-800 rounded-lg hover:bg-slate-800 hover:text-white transition-colors text-center cursor-pointer"
            >
              Table View ({summary.totalResources}) →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
