import React, { useState, useMemo } from 'react';
import { CloudResource } from '../types/cloud';

interface ResourceTableProps {
  resources: CloudResource[];
  onToggleRemediate: (resourceId: string) => void;
}

export const ResourceTable: React.FC<ResourceTableProps> = ({
  resources,
  onToggleRemediate,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [serviceFilter, setServiceFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'waste' | 'cost' | 'name'>('waste');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [selectedResource, setSelectedResource] = useState<CloudResource | null>(null);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  // Filtered and sorted resources
  const filteredResources = useMemo(() => {
    return resources
      .filter((r) => {
        const matchesSearch =
          r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          r.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
          r.typeOrSize.toLowerCase().includes(searchTerm.toLowerCase()) ||
          r.service.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesService =
          serviceFilter === 'ALL' ||
          r.service.toUpperCase() === serviceFilter.toUpperCase() ||
          r.serviceCategory.toUpperCase() === serviceFilter.toUpperCase();

        const matchesStatus =
          statusFilter === 'ALL' ||
          (statusFilter === 'INACTIVE' && r.isInactive) ||
          (statusFilter === 'ACTIVE' && !r.isInactive) ||
          r.status.toUpperCase() === statusFilter.toUpperCase();

        return matchesSearch && matchesService && matchesStatus;
      })
      .sort((a, b) => {
        let diff = 0;
        if (sortBy === 'waste') {
          diff = a.estimatedWasteUSD - b.estimatedWasteUSD;
        } else if (sortBy === 'cost') {
          diff = a.monthlyCostUSD - b.monthlyCostUSD;
        } else if (sortBy === 'name') {
          diff = a.name.localeCompare(b.name);
        }
        return sortOrder === 'desc' ? -diff : diff;
      });
  }, [resources, searchTerm, serviceFilter, statusFilter, sortBy, sortOrder]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(text);
    setTimeout(() => setCopiedCmd(null), 2500);
  };

  return (
    <div className="space-y-4">
      {/* Search and Filters Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-4 bg-slate-900 border border-slate-800 rounded-xl">
        <div className="flex flex-1 items-center gap-3">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by resource ID, name, or instance type..."
              className="w-full px-3.5 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-white font-mono placeholder:text-slate-500 focus:outline-hidden focus:border-cyan-500"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1.5 text-xs text-slate-500 hover:text-slate-300"
              >
                ✕
              </button>
            )}
          </div>

          {/* Service Category Filter */}
          <select
            value={serviceFilter}
            onChange={(e) => setServiceFilter(e.target.value)}
            className="px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-300 font-sans focus:outline-hidden focus:border-cyan-500"
          >
            <option value="ALL">All Cloud Services</option>
            <option value="Compute">Compute (EC2 / Azure VMs)</option>
            <option value="Storage">Storage (EBS / Disks / S3)</option>
            <option value="Database">Database (RDS / Azure SQL)</option>
            <option value="Networking">Networking (EIP / ELB / NAT)</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-300 font-sans focus:outline-hidden focus:border-cyan-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="INACTIVE">Flagged Inactive / Zombie</option>
            <option value="ACTIVE">Active Workloads</option>
            <option value="IDLE">Idle (Low CPU / Connections)</option>
            <option value="STOPPED">Stopped (Accumulating EBS)</option>
          </select>
        </div>

        {/* Sort Controls */}
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span>Sort:</span>
          <button
            onClick={() => {
              if (sortBy === 'waste') setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
              else {
                setSortBy('waste');
                setSortOrder('desc');
              }
            }}
            className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
              sortBy === 'waste'
                ? 'bg-slate-800 text-cyan-400 font-medium'
                : 'hover:text-slate-200'
            }`}
          >
            Highest Waste {sortBy === 'waste' && (sortOrder === 'desc' ? '↓' : '↑')}
          </button>
          <button
            onClick={() => {
              if (sortBy === 'cost') setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
              else {
                setSortBy('cost');
                setSortOrder('desc');
              }
            }}
            className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
              sortBy === 'cost'
                ? 'bg-slate-800 text-cyan-400 font-medium'
                : 'hover:text-slate-200'
            }`}
          >
            Monthly Cost {sortBy === 'cost' && (sortOrder === 'desc' ? '↓' : '↑')}
          </button>
        </div>
      </div>

      {/* Main High-Density Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800 select-none">
              <tr>
                <th className="px-5 py-3">Resource Identifier & Name</th>
                <th className="px-4 py-3">Service & Type</th>
                <th className="px-4 py-3">State / Flag</th>
                <th className="px-4 py-3">Utilization & Activity</th>
                <th className="px-4 py-3 text-right">Monthly Spend</th>
                <th className="px-4 py-3 text-right">Identified Waste</th>
                <th className="px-4 py-3 text-right">Quick Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 font-mono text-slate-300">
              {filteredResources.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500 font-sans">
                    No cloud resources matched the specified filters. Try clearing your search query.
                  </td>
                </tr>
              ) : (
                filteredResources.map((resource) => {
                  const isWaste = resource.isInactive && !resource.remediated;

                  return (
                    <tr
                      key={resource.id}
                      onClick={() => setSelectedResource(resource)}
                      className={`hover:bg-slate-800/50 transition-colors cursor-pointer ${
                        resource.remediated ? 'opacity-50 line-through decoration-slate-600' : ''
                      }`}
                    >
                      {/* Name and ID */}
                      <td className="px-5 py-3">
                        <div className="font-semibold text-white font-sans truncate max-w-[240px]">
                          {resource.name}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono truncate max-w-[240px]">
                          {resource.id}
                        </div>
                      </td>

                      {/* Service & Spec */}
                      <td className="px-4 py-3 font-sans">
                        <div className="text-slate-200 font-medium">
                          {resource.service}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono truncate max-w-[190px]">
                          {resource.typeOrSize}
                        </div>
                      </td>

                      {/* State / Flag */}
                      <td className="px-4 py-3 font-sans">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              resource.remediated
                                ? 'bg-slate-500'
                                : resource.status === 'active'
                                ? 'bg-emerald-500'
                                : resource.status === 'idle'
                                ? 'bg-amber-400'
                                : 'bg-rose-500'
                            }`}
                          />
                          <span
                            className={`font-medium ${
                              resource.remediated
                                ? 'text-slate-400'
                                : resource.status === 'active'
                                ? 'text-emerald-400'
                                : resource.status === 'idle'
                                ? 'text-amber-300'
                                : 'text-rose-400'
                            }`}
                          >
                            {resource.remediated ? 'Remediated' : resource.status.toUpperCase()}
                          </span>
                        </div>
                        {resource.inactiveReason && !resource.remediated && (
                          <div className="text-[10px] text-slate-400 truncate max-w-[210px] mt-0.5">
                            {resource.inactiveReason}
                          </div>
                        )}
                      </td>

                      {/* Utilization & Metrics */}
                      <td className="px-4 py-3 text-[11px]">
                        {resource.metrics.cpuAvgPercent !== undefined ? (
                          <div>
                            <span className="text-slate-400">Avg CPU: </span>
                            <span
                              className={`font-semibold ${
                                resource.metrics.cpuAvgPercent < 5 ? 'text-amber-400' : 'text-slate-200'
                              }`}
                            >
                              {resource.metrics.cpuAvgPercent}%
                            </span>
                            <span className="text-slate-500 ml-1">
                              (peak {resource.metrics.cpuMaxPercent}%)
                            </span>
                          </div>
                        ) : resource.metrics.daysUnattached !== undefined ? (
                          <div className="text-amber-300">
                            Unattached for {resource.metrics.daysUnattached} days
                          </div>
                        ) : resource.metrics.daysStopped !== undefined ? (
                          <div className="text-rose-400">
                            Stopped for {resource.metrics.daysStopped} days
                          </div>
                        ) : resource.metrics.activeConnections !== undefined ? (
                          <div>
                            <span className="text-slate-400">Connections: </span>
                            <span
                              className={`font-semibold ${
                                resource.metrics.activeConnections === 0 ? 'text-rose-400' : 'text-slate-200'
                              }`}
                            >
                              {resource.metrics.activeConnections}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-500">Telemetry nominal</span>
                        )}
                      </td>

                      {/* Monthly Spend */}
                      <td className="px-4 py-3 text-right text-slate-200 font-semibold tabular-nums">
                        ${resource.monthlyCostUSD.toFixed(2)}
                      </td>

                      {/* Estimated Waste */}
                      <td className="px-4 py-3 text-right tabular-nums">
                        {isWaste ? (
                          <span className="text-rose-400 font-bold">
                            ${resource.estimatedWasteUSD.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-slate-500">$0.00</span>
                        )}
                      </td>

                      {/* Quick Action Button */}
                      <td className="px-4 py-3 text-right">
                        {resource.isInactive ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleRemediate(resource.id);
                            }}
                            className={`px-2.5 py-1 text-[11px] font-sans font-medium rounded transition-colors cursor-pointer ${
                              resource.remediated
                                ? 'bg-slate-800 text-slate-400 hover:text-white'
                                : 'bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30'
                            }`}
                          >
                            {resource.remediated ? 'Undo' : 'Remediate'}
                          </button>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedResource(resource);
                            }}
                            className="px-2.5 py-1 text-[11px] font-sans font-medium rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                          >
                            Details
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info */}
        <div className="px-5 py-3 bg-slate-950/60 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 font-sans">
          <span>
            Showing {filteredResources.length} of {resources.length} monitored resources
          </span>
          <span className="text-slate-500">
            Click any row to inspect metrics, reason diagnosis, and remediation CLI
          </span>
        </div>
      </div>

      {/* Selected Resource Drawer / Modal */}
      {selectedResource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-2xl w-full p-6 text-slate-200 shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <span className="text-xs text-cyan-400 font-mono font-medium">
                  {selectedResource.provider.toUpperCase()} / {selectedResource.service}
                </span>
                <h3 className="text-base font-bold text-white font-sans mt-0.5">
                  {selectedResource.name}
                </h3>
              </div>
              <button
                onClick={() => setSelectedResource(null)}
                className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800/80">
                <span className="text-slate-500 block">Monthly Spend</span>
                <span className="font-mono text-white text-base font-bold">
                  ${selectedResource.monthlyCostUSD.toFixed(2)}
                </span>
              </div>
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800/80">
                <span className="text-slate-500 block">Estimated Waste</span>
                <span className="font-mono text-rose-400 text-base font-bold">
                  ${selectedResource.estimatedWasteUSD.toFixed(2)}
                </span>
              </div>
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800/80">
                <span className="text-slate-500 block">Region</span>
                <span className="font-mono text-slate-200 text-xs font-semibold">
                  {selectedResource.region}
                </span>
              </div>
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800/80">
                <span className="text-slate-500 block">Status</span>
                <span
                  className={`font-semibold font-sans ${
                    selectedResource.isInactive ? 'text-amber-400' : 'text-emerald-400'
                  }`}
                >
                  {selectedResource.status.toUpperCase()}
                </span>
              </div>
            </div>

            {/* Inactivity Explanation */}
            {selectedResource.inactiveReason && (
              <div className="p-3.5 bg-rose-950/20 border border-rose-900/40 rounded-lg text-xs space-y-1">
                <div className="font-semibold text-rose-300 font-sans">
                  FinOps Utilization Diagnosis:
                </div>
                <p className="text-slate-300 leading-relaxed font-sans">
                  {selectedResource.inactiveReason}
                </p>
              </div>
            )}

            {/* Recommended Action */}
            <div className="text-xs space-y-1">
              <span className="font-semibold text-slate-300">Recommended Optimization Action:</span>
              <p className="text-slate-400 font-sans leading-relaxed">
                {selectedResource.recommendedAction}
              </p>
            </div>

            {/* CLI Command */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-medium">Executable CLI Remediation:</span>
                <button
                  onClick={() => handleCopy(selectedResource.remediationCommand)}
                  className="text-cyan-400 hover:text-cyan-300 text-xs font-medium cursor-pointer"
                >
                  {copiedCmd === selectedResource.remediationCommand ? 'Copied!' : 'Copy Command'}
                </button>
              </div>
              <pre className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs font-mono text-cyan-300 overflow-x-auto">
                {selectedResource.remediationCommand}
              </pre>
            </div>

            <div className="pt-3 flex items-center justify-between border-t border-slate-800">
              <button
                onClick={() => onToggleRemediate(selectedResource.id)}
                className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  selectedResource.remediated
                    ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                }`}
              >
                {selectedResource.remediated ? 'Mark as Unresolved' : 'Simulate Remediation & Apply Savings'}
              </button>
              <button
                onClick={() => setSelectedResource(null)}
                className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
