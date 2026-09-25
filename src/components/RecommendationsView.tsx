import React, { useState } from 'react';
import { OptimizationRecommendation, CloudProvider, CloudResource } from '../types/cloud';
import { generateRemediationScript } from '../utils/cloudAnalyzer';

interface RecommendationsViewProps {
  recommendations: OptimizationRecommendation[];
  resources: CloudResource[];
  provider: CloudProvider;
  onApplyRecommendation: (recId: string) => void;
}

export const RecommendationsView: React.FC<RecommendationsViewProps> = ({
  recommendations,
  resources,
  provider,
  onApplyRecommendation,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  const filteredRecs = recommendations.filter(
    (r) => selectedCategory === 'ALL' || r.category === selectedCategory
  );

  const totalPotentialSavings = recommendations.reduce(
    (sum, r) => sum + (r.status === 'applied' ? 0 : r.estimatedMonthlySavings),
    0
  );

  const appliedSavings = recommendations.reduce(
    (sum, r) => sum + (r.status === 'applied' ? r.estimatedMonthlySavings : 0),
    0
  );

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleDownloadScript = () => {
    const script = generateRemediationScript(resources, provider);
    const blob = new Blob([script], { type: 'text/x-sh' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `remediate_${provider}_waste.sh`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Banner with Total Savings & Script Downloader */}
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wider text-emerald-400 font-semibold">
              Actionable FinOps Blueprint
            </span>
            <span className="text-slate-600">·</span>
            <span className="text-xs text-slate-400">
              {recommendations.length} optimization opportunities
            </span>
          </div>
          <div className="text-2xl font-bold font-mono text-white mt-1">
            ${totalPotentialSavings.toFixed(2)}{' '}
            <span className="text-xs text-slate-400 font-sans font-normal">
              unclaimed monthly savings remaining
            </span>
          </div>
          {appliedSavings > 0 && (
            <p className="text-xs text-emerald-400 mt-1 font-mono">
              ✓ ${appliedSavings.toFixed(2)}/mo savings simulated & applied
            </p>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleDownloadScript}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-cyan-400 text-slate-950 hover:bg-cyan-300 transition-colors cursor-pointer flex items-center gap-2 whitespace-nowrap"
          >
            <span>Download Cleanup Script (.sh)</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        {['ALL', 'Idle Resource', 'Orphaned Assets', 'Storage Tiering'].map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer whitespace-nowrap ${
              selectedCategory === cat
                ? 'bg-slate-800 text-cyan-400 border border-slate-700'
                : 'text-slate-400 hover:text-white bg-slate-900/60'
            }`}
          >
            {cat === 'ALL' ? 'All Categories' : cat}
          </button>
        ))}
      </div>

      {/* Recommendations Cards Grid */}
      <div className="space-y-4">
        {filteredRecs.map((rec) => {
          const isApplied = rec.status === 'applied';

          return (
            <div
              key={rec.id}
              className={`p-5 rounded-xl border transition-all ${
                isApplied
                  ? 'bg-slate-950/60 border-slate-800/60 opacity-60'
                  : 'bg-slate-900 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-cyan-400 font-medium">{rec.category}</span>
                    <span className="text-slate-600">·</span>
                    <span className="text-slate-400">Effort: {rec.effort}</span>
                    <span className="text-slate-600">·</span>
                    <span className="text-slate-400">Risk: {rec.risk}</span>
                    {isApplied && (
                      <>
                        <span className="text-slate-600">·</span>
                        <span className="text-emerald-400 font-semibold font-mono">SIMULATED APPLIED</span>
                      </>
                    )}
                  </div>

                  <h4 className="text-base font-bold text-white font-sans">
                    {rec.title}
                  </h4>

                  <p className="text-xs text-slate-300 leading-relaxed max-w-3xl">
                    {rec.description}
                  </p>

                  {/* Affected Resource Identifiers */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px] font-mono text-slate-400">
                    <span className="text-slate-500">Affected:</span>
                    {rec.affectedResourceIds.map((rid) => (
                      <span
                        key={rid}
                        className="px-2 py-0.5 bg-slate-950 rounded border border-slate-800 text-slate-300"
                      >
                        {rid}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Savings and Quick Apply Action */}
                <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-3 shrink-0">
                  <div className="text-right">
                    <span className="text-[11px] text-slate-500 block">Potential Savings</span>
                    <span className="text-xl font-bold font-mono text-emerald-400">
                      +${rec.estimatedMonthlySavings.toFixed(2)}
                      <span className="text-xs text-slate-400 font-sans font-normal">/mo</span>
                    </span>
                  </div>

                  <button
                    onClick={() => onApplyRecommendation(rec.id)}
                    className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                      isApplied
                        ? 'bg-slate-800 text-slate-400 hover:text-white'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30'
                    }`}
                  >
                    {isApplied ? 'Undo Applied' : 'Simulate Fix'}
                  </button>
                </div>
              </div>

              {/* CLI Command Box */}
              <div className="mt-4 pt-4 border-t border-slate-800/80 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-medium">Remediation Shell Command:</span>
                  <button
                    onClick={() => handleCopy(rec.cliCommand, rec.id)}
                    className="text-cyan-400 hover:text-cyan-300 text-xs font-medium cursor-pointer"
                  >
                    {copiedId === rec.id ? 'Copied to Clipboard!' : 'Copy CLI'}
                  </button>
                </div>
                <pre className="p-3 bg-slate-950 rounded-lg border border-slate-800/80 text-xs font-mono text-cyan-300 overflow-x-auto whitespace-pre-wrap">
                  {rec.cliCommand}
                </pre>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
