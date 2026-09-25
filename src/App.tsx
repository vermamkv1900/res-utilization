/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  CloudProvider,
  CloudCredentials,
  CloudResource,
  MonthlyCostPoint,
  OptimizationRecommendation,
} from './types/cloud';
import {
  INITIAL_AWS_CREDENTIALS,
  INITIAL_AZURE_CREDENTIALS,
  MOCK_AWS_RESOURCES,
  MOCK_AZURE_RESOURCES,
  MOCK_AWS_MONTHLY_TRENDS,
  MOCK_AZURE_MONTHLY_TRENDS,
  MOCK_AWS_RECOMMENDATIONS,
  MOCK_AZURE_RECOMMENDATIONS,
} from './data/mockData';
import { computeAuditSummary } from './utils/cloudAnalyzer';
import { Header } from './components/Header';
import { CredentialModal } from './components/CredentialModal';
import { DashboardOverview } from './components/DashboardOverview';
import { ResourceTable } from './components/ResourceTable';
import { CostTrends } from './components/CostTrends';
import { RecommendationsView } from './components/RecommendationsView';
import { PythonCodeHub } from './components/PythonCodeHub';
import { ExportReportModal } from './components/ExportReportModal';
import { TopologyMap } from './components/TopologyMap';

export default function App() {
  const [activeTab, setActiveTab] = useState<
    'dashboard' | 'resources' | 'topology' | 'trends' | 'recommendations' | 'python'
  >('dashboard');
  const [provider, setProvider] = useState<CloudProvider>('aws');
  const [credentials, setCredentials] = useState<CloudCredentials>(INITIAL_AWS_CREDENTIALS);

  // Resources state
  const [awsResources, setAwsResources] = useState<CloudResource[]>(MOCK_AWS_RESOURCES);
  const [azureResources, setAzureResources] = useState<CloudResource[]>(MOCK_AZURE_RESOURCES);

  // Recommendations state
  const [awsRecs, setAwsRecs] = useState<OptimizationRecommendation[]>(MOCK_AWS_RECOMMENDATIONS);
  const [azureRecs, setAzureRecs] = useState<OptimizationRecommendation[]>(MOCK_AZURE_RECOMMENDATIONS);

  // UI Modals
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [isLiveConnected, setIsLiveConnected] = useState(false);

  // Current active dataset based on provider
  const currentResources = provider === 'aws' ? awsResources : azureResources;
  const currentTrends: MonthlyCostPoint[] = provider === 'aws' ? MOCK_AWS_MONTHLY_TRENDS : MOCK_AZURE_MONTHLY_TRENDS;
  const currentRecs = provider === 'aws' ? awsRecs : azureRecs;

  // Real-time calculated summary
  const summary = useMemo(() => {
    return computeAuditSummary(currentResources, credentials);
  }, [currentResources, credentials]);

  // Switch cloud provider
  const handleProviderChange = (newProvider: CloudProvider) => {
    setProvider(newProvider);
    setScanError(null);
    setIsLiveConnected(false);
    if (newProvider === 'aws') {
      setCredentials(INITIAL_AWS_CREDENTIALS);
      setAwsResources(MOCK_AWS_RESOURCES);
    } else {
      setCredentials(INITIAL_AZURE_CREDENTIALS);
      setAzureResources(MOCK_AZURE_RESOURCES);
    }
  };

  // Run audit scan with credentials
  const handleSaveAndScan = async (newCreds: CloudCredentials) => {
    setCredentials(newCreds);
    setProvider(newCreds.provider);
    setIsScanning(true);
    setScanError(null);

    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCreds),
      });

      const data = await res.json();

      if (!res.ok) {
        setScanError(data.details || data.error || 'Failed to authenticate with cloud provider');
        setIsScanning(false);
        return;
      }

      if (data.isLive) {
        setIsLiveConnected(true);
        if (data.resources && data.resources.length > 0) {
          if (newCreds.provider === 'aws') {
            setAwsResources(data.resources);
          } else {
            setAzureResources(data.resources);
          }
          setIsConnectModalOpen(false);
        } else {
          setScanError('Authenticated with AWS/Azure successfully! However, 0 instances or unattached volumes were discovered in this specific region. Try another region.');
        }
      } else {
        // Placeholder or Demo Mode
        setIsLiveConnected(false);
        setIsConnectModalOpen(false);
      }
    } catch (err: any) {
      setScanError(err.message || 'Error communicating with cloud proxy server.');
    } finally {
      setIsScanning(false);
    }
  };

  // Load Enterprise Sandbox
  const handleLoadSandbox = (targetProvider: CloudProvider) => {
    handleProviderChange(targetProvider);
    setScanError(null);
    setIsConnectModalOpen(false);
  };

  // Quick Rescan
  const handleQuickRescan = () => {
    handleSaveAndScan(credentials);
  };

  // Toggle remediation on a single resource
  const handleToggleRemediate = (resourceId: string) => {
    if (provider === 'aws') {
      setAwsResources((prev) =>
        prev.map((r) => (r.id === resourceId ? { ...r, remediated: !r.remediated } : r))
      );
    } else {
      setAzureResources((prev) =>
        prev.map((r) => (r.id === resourceId ? { ...r, remediated: !r.remediated } : r))
      );
    }
  };

  // Apply recommendation
  const handleApplyRecommendation = (recId: string) => {
    const updateRecs = (recs: OptimizationRecommendation[]) =>
      recs.map((r) => {
        if (r.id === recId) {
          const nextStatus: 'applied' | 'pending' = r.status === 'applied' ? 'pending' : 'applied';
          return { ...r, status: nextStatus };
        }
        return r;
      });

    if (provider === 'aws') {
      const targetRec = awsRecs.find((r) => r.id === recId);
      const isApplying = targetRec?.status !== 'applied';
      setAwsRecs(updateRecs);

      if (targetRec) {
        setAwsResources((prev) =>
          prev.map((res) =>
            targetRec.affectedResourceIds.includes(res.id)
              ? { ...res, remediated: isApplying }
              : res
          )
        );
      }
    } else {
      const targetRec = azureRecs.find((r) => r.id === recId);
      const isApplying = targetRec?.status !== 'applied';
      setAzureRecs(updateRecs);

      if (targetRec) {
        setAzureResources((prev) =>
          prev.map((res) =>
            targetRec.affectedResourceIds.includes(res.id)
              ? { ...res, remediated: isApplying }
              : res
          )
        );
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Strict 3-Zone Top Navigation Bar */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        provider={provider}
        setProvider={handleProviderChange}
        accountId={summary.accountId}
        onOpenConnectModal={() => setIsConnectModalOpen(true)}
        onOpenExportModal={() => setIsExportModalOpen(true)}
        isScanning={isScanning}
        onQuickRescan={handleQuickRescan}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8">
        {activeTab === 'dashboard' && (
          <DashboardOverview
            summary={summary}
            resources={currentResources}
            monthlyTrends={currentTrends}
            onNavigateToResources={() => setActiveTab('resources')}
            onNavigateToTopology={() => setActiveTab('topology')}
            onNavigateToRecommendations={() => setActiveTab('recommendations')}
            onNavigateToPython={() => setActiveTab('python')}
            onOpenConnectModal={() => setIsConnectModalOpen(true)}
          />
        )}

        {activeTab === 'resources' && (
          <ResourceTable
            resources={currentResources}
            onToggleRemediate={handleToggleRemediate}
          />
        )}

        {activeTab === 'topology' && (
          <TopologyMap
            resources={currentResources}
            provider={provider}
            onOpenConnectModal={() => setIsConnectModalOpen(true)}
            onNavigateToRecommendations={() => setActiveTab('recommendations')}
          />
        )}

        {activeTab === 'trends' && (
          <CostTrends
            monthlyTrends={currentTrends}
            totalMonthlyWaste={summary.totalMonthlyWaste}
          />
        )}

        {activeTab === 'recommendations' && (
          <RecommendationsView
            recommendations={currentRecs}
            resources={currentResources}
            provider={provider}
            onApplyRecommendation={handleApplyRecommendation}
          />
        )}

        {activeTab === 'python' && <PythonCodeHub />}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-950 py-6 text-xs text-slate-500 font-sans">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-400">CloudPulse FinOps Engine</span>
            <span>·</span>
            <span>AWS CloudWatch & Azure Monitor Resource Auditor</span>
          </div>
          <div>
            Built with strict read-only least privilege compliance. Zero external key retention.
          </div>
        </div>
      </footer>

      {/* Credential Connection Modal */}
      <CredentialModal
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
        credentials={credentials}
        onSaveAndScan={handleSaveAndScan}
        onLoadSandbox={handleLoadSandbox}
        isScanning={isScanning}
        errorMessage={scanError}
        isLiveConnected={isLiveConnected}
      />

      {/* Export Report Modal */}
      <ExportReportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        summary={summary}
        resources={currentResources}
        monthlyTrends={currentTrends}
        recommendations={currentRecs}
      />
    </div>
  );
}
