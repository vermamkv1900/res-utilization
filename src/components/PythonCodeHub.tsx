import React, { useState } from 'react';
import {
  PYTHON_APP_CODE,
  PYTHON_REQUIREMENTS,
  STANDALONE_HTML_CODE,
  PYTHON_SETUP_INSTRUCTIONS,
} from '../data/pythonTemplates';

export const PythonCodeHub: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<
    'app.py' | 'index.html' | 'requirements.txt' | 'README.md' | 'apis'
  >('app.py');
  const [copied, setCopied] = useState(false);

  const getCodeContent = () => {
    switch (selectedFile) {
      case 'app.py':
        return PYTHON_APP_CODE;
      case 'index.html':
        return STANDALONE_HTML_CODE;
      case 'requirements.txt':
        return PYTHON_REQUIREMENTS;
      case 'README.md':
        return PYTHON_SETUP_INSTRUCTIONS;
      case 'apis':
        return `# Cloud Monitoring APIs Integration Reference

## 1. AWS CloudWatch Metrics API
Namespace: "AWS/EC2"
Metric: "CPUUtilization"
Dimensions: [{'Name': 'InstanceId', 'Value': instance_id}]
Statistics: ['Average', 'Maximum']
Period: 86400 (Daily)

## 2. AWS Cost Explorer API
Command: ce:GetCostAndUsage
Granularity: 'MONTHLY'
Metrics: ['UnblendedCost', 'UsageQuantity']
GroupBy: [{'Type': 'DIMENSION', 'Key': 'SERVICE'}]

## 3. Azure Monitor Metrics API
Resource URI: /subscriptions/{subId}/resourceGroups/{rg}/providers/Microsoft.Compute/virtualMachines/{vmName}
Metric: "Percentage CPU"
Aggregation: "Average"
Timespan: "P14D"

## 4. Azure Cost Management API
Query: Usage details by Resource ID and Meter Category (Compute, Storage, Databases)
`;
      default:
        return '';
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getCodeContent());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const content = getCodeContent();
    const filename = selectedFile === 'apis' ? 'cloud_monitoring_apis.md' : selectedFile;
    const mime = selectedFile === 'app.py' ? 'text/x-python' : 'text/plain';
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Code Hub Header */}
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wider text-cyan-400 font-semibold">
              Source Code & Standalone Package
            </span>
            <span className="text-slate-600">·</span>
            <span className="text-xs text-slate-400">Python 3.9+ & HTML5</span>
          </div>
          <h2 className="text-xl font-bold text-white font-sans mt-1">
            Complete Python & HTML Cloud Monitoring Code
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Everything needed to run this solution as a standalone service on your local machine, Docker container, or EC2/Azure VM using Boto3 and the Azure Management SDKs.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleCopy}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors cursor-pointer whitespace-nowrap"
          >
            {copied ? 'Copied to Clipboard!' : 'Copy Active File'}
          </button>
          <button
            onClick={handleDownload}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-cyan-400 text-slate-950 hover:bg-cyan-300 transition-colors cursor-pointer whitespace-nowrap"
          >
            Download {selectedFile}
          </button>
        </div>
      </div>

      {/* File Explorer Bar */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 text-xs overflow-x-auto">
        {[
          { id: 'app.py', label: 'app.py (Flask + Cloud SDKs)' },
          { id: 'index.html', label: 'templates/index.html' },
          { id: 'requirements.txt', label: 'requirements.txt' },
          { id: 'README.md', label: 'README.md (Setup Guide)' },
          { id: 'apis', label: 'API Integrations Architecture' },
        ].map((file) => (
          <button
            key={file.id}
            onClick={() => setSelectedFile(file.id as any)}
            className={`px-3 py-1.5 rounded-lg font-mono text-xs transition-colors cursor-pointer whitespace-nowrap ${
              selectedFile === file.id
                ? 'bg-slate-800 text-cyan-400 border border-slate-700 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {file.label}
          </button>
        ))}
      </div>

      {/* Code Editor Frame */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
        <div className="px-4 py-2.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block" />
            <span className="ml-2 font-mono text-slate-400">{selectedFile}</span>
          </div>
          <span className="text-[11px] text-slate-500 font-mono">
            {getCodeContent().split('\n').length} lines · UTF-8
          </span>
        </div>

        <div className="p-4 overflow-x-auto max-h-[580px] font-mono text-xs leading-relaxed text-slate-300">
          <pre className="whitespace-pre">
            {getCodeContent().split('\n').map((line, idx) => (
              <div key={idx} className="table-row hover:bg-slate-900/40">
                <span className="table-cell pr-4 text-right select-none text-slate-600 w-12 font-mono text-[11px]">
                  {idx + 1}
                </span>
                <span className="table-cell whitespace-pre">{line}</span>
              </div>
            ))}
          </pre>
        </div>
      </div>
    </div>
  );
};
