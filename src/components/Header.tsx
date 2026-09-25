import React from 'react';
import { CloudProvider } from '../types/cloud';

interface HeaderProps {
  activeTab: 'dashboard' | 'resources' | 'trends' | 'recommendations' | 'python';
  setActiveTab: (tab: 'dashboard' | 'resources' | 'trends' | 'recommendations' | 'python') => void;
  provider: CloudProvider;
  setProvider: (provider: CloudProvider) => void;
  accountId: string;
  onOpenConnectModal: () => void;
  onOpenExportModal: () => void;
  isScanning: boolean;
  onQuickRescan: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  provider,
  setProvider,
  accountId,
  onOpenConnectModal,
  onOpenExportModal,
  isScanning,
  onQuickRescan,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Zone 1: Single text element wordmark */}
        <div className="flex items-center gap-6">
          <button
            onClick={() => setActiveTab('dashboard')}
            className="text-lg font-bold tracking-tight text-white hover:text-cyan-400 transition-colors cursor-pointer text-left"
          >
            CloudPulse
          </button>

          {/* Cloud Provider Segmented Switch */}
          <div className="hidden sm:flex items-center p-0.5 bg-slate-900 border border-slate-800 rounded-md">
            <button
              onClick={() => setProvider('aws')}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
                provider === 'aws'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              AWS
            </button>
            <button
              onClick={() => setProvider('azure')}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
                provider === 'azure'
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Azure
            </button>
          </div>
        </div>

        {/* Zone 2: 4-6 clean text navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'dashboard' ? 'text-cyan-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('resources')}
            className={`transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'resources' ? 'text-cyan-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Resources
          </button>
          <button
            onClick={() => setActiveTab('trends')}
            className={`transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'trends' ? 'text-cyan-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Cost Trends
          </button>
          <button
            onClick={() => setActiveTab('recommendations')}
            className={`transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'recommendations' ? 'text-cyan-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Recommendations
          </button>
          <button
            onClick={() => setActiveTab('python')}
            className={`transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'python' ? 'text-cyan-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Python & APIs</span>
          </button>
        </nav>

        {/* Zone 3: 1-2 primary actions */}
        <div className="flex items-center gap-3">
          {/* Active Account ID Indicator */}
          <button
            onClick={onOpenConnectModal}
            className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono bg-slate-900 border border-slate-700/80 rounded-md text-slate-300 hover:text-white hover:border-cyan-500 transition-colors cursor-pointer"
            title="Click to view or edit Account ID & Secret Key"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-slate-400 font-sans text-[11px]">ID:</span>
            <span className="text-cyan-300 font-semibold">{accountId || 'Configure'}</span>
          </button>

          <button
            onClick={onQuickRescan}
            disabled={isScanning}
            className="hidden md:inline-flex items-center px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-900 border border-slate-700/80 rounded-md hover:bg-slate-800 hover:text-white transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
          >
            {isScanning ? 'Auditing...' : 'Scan Now'}
          </button>

          <button
            onClick={onOpenConnectModal}
            className="px-3.5 py-1.5 text-xs font-medium text-slate-950 bg-cyan-400 rounded-md hover:bg-cyan-300 transition-colors font-semibold cursor-pointer whitespace-nowrap"
          >
            Connect Cloud
          </button>

          <button
            onClick={onOpenExportModal}
            className="hidden lg:inline-flex px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-900 border border-slate-700/80 rounded-md hover:bg-slate-800 hover:text-white transition-colors cursor-pointer whitespace-nowrap"
          >
            Export
          </button>
        </div>
      </div>
    </header>
  );
};
