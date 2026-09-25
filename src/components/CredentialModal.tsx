import React, { useState } from 'react';
import { CloudCredentials, CloudProvider } from '../types/cloud';
import { INITIAL_AWS_CREDENTIALS, INITIAL_AZURE_CREDENTIALS } from '../data/mockData';

interface CredentialModalProps {
  isOpen: boolean;
  onClose: () => void;
  credentials: CloudCredentials;
  onSaveAndScan: (creds: CloudCredentials) => void;
  onLoadSandbox: (provider: CloudProvider) => void;
  isScanning: boolean;
}

export const CredentialModal: React.FC<CredentialModalProps> = ({
  isOpen,
  onClose,
  credentials,
  onSaveAndScan,
  onLoadSandbox,
  isScanning,
}) => {
  const [provider, setProvider] = useState<CloudProvider>(credentials.provider);
  const [accountId, setAccountId] = useState(credentials.accountId);
  const [accessKeyId, setAccessKeyId] = useState(credentials.accessKeyId);
  const [secretAccessKey, setSecretAccessKey] = useState(credentials.secretAccessKey);
  const [region, setRegion] = useState(credentials.region);
  const [showSecret, setShowSecret] = useState(false);

  // Azure specific
  const [subscriptionId, setSubscriptionId] = useState(credentials.subscriptionId || '');
  const [tenantId, setTenantId] = useState(credentials.tenantId || '');
  const [clientId, setClientId] = useState(credentials.clientId || '');
  const [clientSecret, setClientSecret] = useState(credentials.clientSecret || '');

  if (!isOpen) return null;

  const handleProviderChange = (p: CloudProvider) => {
    setProvider(p);
    if (p === 'aws') {
      setAccountId(INITIAL_AWS_CREDENTIALS.accountId);
      setAccessKeyId(INITIAL_AWS_CREDENTIALS.accessKeyId);
      setSecretAccessKey(INITIAL_AWS_CREDENTIALS.secretAccessKey);
      setRegion(INITIAL_AWS_CREDENTIALS.region);
    } else {
      setSubscriptionId(INITIAL_AZURE_CREDENTIALS.subscriptionId);
      setTenantId(INITIAL_AZURE_CREDENTIALS.tenantId);
      setClientId(INITIAL_AZURE_CREDENTIALS.clientId);
      setClientSecret(INITIAL_AZURE_CREDENTIALS.clientSecret);
      setAccountId(INITIAL_AZURE_CREDENTIALS.accountId);
      setAccessKeyId(INITIAL_AZURE_CREDENTIALS.accessKeyId);
      setSecretAccessKey(INITIAL_AZURE_CREDENTIALS.secretAccessKey);
      setRegion(INITIAL_AZURE_CREDENTIALS.region);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: CloudCredentials = {
      provider,
      accountId: provider === 'aws' ? accountId : subscriptionId,
      accessKeyId: provider === 'aws' ? accessKeyId : clientId,
      secretAccessKey: provider === 'aws' ? secretAccessKey : clientSecret,
      region,
      subscriptionId,
      tenantId,
      clientId,
      clientSecret,
    };
    onSaveAndScan(updated);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-xl w-full p-6 text-slate-200 shadow-2xl relative">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-base font-semibold text-white">Connect Cloud Infrastructure</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Enter your read-only IAM credentials to scan active and inactive resource utilization
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-sm p-1 rounded hover:bg-slate-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Provider Selector Tabs */}
        <div className="flex items-center p-1 bg-slate-950 rounded-lg border border-slate-800 my-5">
          <button
            type="button"
            onClick={() => handleProviderChange('aws')}
            className={`flex-1 py-2 text-xs font-semibold rounded-md transition-colors ${
              provider === 'aws'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Amazon Web Services (AWS)
          </button>
          <button
            type="button"
            onClick={() => handleProviderChange('azure')}
            className={`flex-1 py-2 text-xs font-semibold rounded-md transition-colors ${
              provider === 'azure'
                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Microsoft Azure
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {provider === 'aws' ? (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1 flex items-center justify-between">
                  <span>AWS Account ID (12 digits)</span>
                  <span className="text-[10px] text-cyan-400 font-normal">Required for billing & scope</span>
                </label>
                <input
                  type="text"
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  placeholder="e.g. 8492-3841-9024"
                  required
                  className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-white font-mono focus:outline-hidden focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Access Key ID
                </label>
                <input
                  type="text"
                  value={accessKeyId}
                  onChange={(e) => setAccessKeyId(e.target.value)}
                  placeholder="e.g. AKIAIOSFODNN7EXAMPLE"
                  required
                  className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-white font-mono focus:outline-hidden focus:border-cyan-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-slate-300">
                    Secret Access Key
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    className="text-[11px] text-cyan-400 hover:underline"
                  >
                    {showSecret ? 'Hide' : 'Show'}
                  </button>
                </div>
                <input
                  type={showSecret ? 'text' : 'password'}
                  value={secretAccessKey}
                  onChange={(e) => setSecretAccessKey(e.target.value)}
                  placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                  required
                  className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-white font-mono focus:outline-hidden focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Primary Region
                </label>
                <select
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-white font-mono focus:outline-hidden focus:border-cyan-500"
                >
                  <option value="us-east-1">US East (N. Virginia) us-east-1</option>
                  <option value="us-west-2">US West (Oregon) us-west-2</option>
                  <option value="eu-west-1">Europe (Ireland) eu-west-1</option>
                  <option value="eu-central-1">Europe (Frankfurt) eu-central-1</option>
                  <option value="ap-southeast-1">Asia Pacific (Singapore) ap-southeast-1</option>
                </select>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1 flex items-center justify-between">
                  <span>Azure Subscription / Account ID</span>
                  <span className="text-[10px] text-cyan-400 font-normal">Subscription UUID</span>
                </label>
                <input
                  type="text"
                  value={subscriptionId}
                  onChange={(e) => setSubscriptionId(e.target.value)}
                  placeholder="e.g. sub-89e4-491a-821f-893021948192"
                  required
                  className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-white font-mono focus:outline-hidden focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Tenant Directory ID
                </label>
                <input
                  type="text"
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value)}
                  placeholder="e.g. tenant-48a1-b829-corp-contoso"
                  required
                  className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-white font-mono focus:outline-hidden focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Client ID (Application ID)
                </label>
                <input
                  type="text"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="e.g. az-client-app-8392-prod"
                  required
                  className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-white font-mono focus:outline-hidden focus:border-cyan-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-slate-300">
                    Client Secret (Secret Access Key)
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    className="text-[11px] text-cyan-400 hover:underline"
                  >
                    {showSecret ? 'Hide' : 'Show'}
                  </button>
                </div>
                <input
                  type={showSecret ? 'text' : 'password'}
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  placeholder="sec_7x89Q~Klmp48190391295842_EXMPL"
                  required
                  className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-white font-mono focus:outline-hidden focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Azure Region
                </label>
                <select
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-white font-mono focus:outline-hidden focus:border-cyan-500"
                >
                  <option value="eastus">East US (Virginia)</option>
                  <option value="westus2">West US 2 (Washington)</option>
                  <option value="westeurope">West Europe (Netherlands)</option>
                  <option value="southeastasia">Southeast Asia (Singapore)</option>
                </select>
              </div>
            </>
          )}

          {/* Security & Sandbox Tip */}
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-[11px] text-slate-400 space-y-1">
            <div className="flex items-center justify-between text-slate-300 font-medium">
              <span>Security & Sandbox Mode</span>
              <button
                type="button"
                onClick={() => onLoadSandbox(provider)}
                className="text-cyan-400 hover:text-cyan-300 underline font-semibold cursor-pointer"
              >
                Load {provider.toUpperCase()} Demo Workload
              </button>
            </div>
            <p>
              Credentials are verified for CloudWatch / Azure Monitor read permissions only and are never saved to external storage.
            </p>
          </div>

          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isScanning}
              className="px-4 py-2 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-2"
            >
              {isScanning ? (
                <>
                  <span className="w-3 h-3 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>Auditing Infrastructure...</span>
                </>
              ) : (
                <span>Connect & Scan Resources</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
