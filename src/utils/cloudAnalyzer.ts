import { CloudResource, CloudCredentials, AuditSummary, OptimizationRecommendation, MonthlyCostPoint, CloudProvider } from '../types/cloud';

export function computeAuditSummary(resources: CloudResource[], credentials: CloudCredentials): AuditSummary {
  const totalSpend = resources.reduce((sum, r) => sum + r.monthlyCostUSD, 0);
  const totalWaste = resources.reduce((sum, r) => sum + (r.remediated ? 0 : r.estimatedWasteUSD), 0);
  const inactiveCount = resources.filter(r => r.isInactive && !r.remediated).length;
  const activeCount = resources.filter(r => !r.isInactive || r.remediated).length;
  const overprovisionedCount = resources.filter(r => r.status === 'overprovisioned' && !r.remediated).length;

  return {
    accountId: credentials.accountId || (credentials.provider === 'aws' ? 'AWS-9482-3841' : 'AZURE-SUB-89E4'),
    provider: credentials.provider,
    scannedAt: new Date().toISOString(),
    totalResources: resources.length,
    activeResources: activeCount,
    inactiveResources: inactiveCount,
    overprovisionedResources: overprovisionedCount,
    totalMonthlySpend: Number(totalSpend.toFixed(2)),
    totalMonthlyWaste: Number(totalWaste.toFixed(2)),
    potentialMonthlySavings: Number(totalWaste.toFixed(2)),
    wastePercentage: totalSpend > 0 ? Number(((totalWaste / totalSpend) * 100).toFixed(1)) : 0,
  };
}

export function generateRemediationScript(resources: CloudResource[], provider: CloudProvider): string {
  const pendingInactive = resources.filter(r => r.isInactive && !r.remediated);
  const dateStr = new Date().toISOString().split('T')[0];

  let script = `#!/usr/bin/env bash\n`;
  script += `# CloudPulse Automated Remediation Script\n`;
  script += `# Provider: ${provider.toUpperCase()} | Generated: ${dateStr}\n`;
  script += `# WARNING: Review commands before running in production environments.\n\n`;
  script += `set -e\n\necho "Starting cloud resource cleanup for ${pendingInactive.length} identified waste resources..."\n\n`;

  pendingInactive.forEach((r, idx) => {
    script += `# [${idx + 1}/${pendingInactive.length}] ${r.name} (${r.service} - ${r.typeOrSize})\n`;
    script += `# Reason: ${r.inactiveReason || 'Underutilized / Orphaned asset'}\n`;
    script += `# Monthly Waste: $${r.estimatedWasteUSD.toFixed(2)}\n`;
    script += `${r.remediationCommand}\n\n`;
  });

  script += `echo "Remediation execution complete! Estimated monthly savings: $${pendingInactive.reduce((acc, curr) => acc + curr.estimatedWasteUSD, 0).toFixed(2)}"\n`;
  return script;
}

export function exportToCSV(resources: CloudResource[]): string {
  const headers = [
    'Resource ID',
    'Resource Name',
    'Provider',
    'Service',
    'Category',
    'Region',
    'Status',
    'Type / Size',
    'Monthly Cost (USD)',
    'Estimated Waste (USD)',
    'Savings Potential (%)',
    'Is Inactive',
    'Inactive Reason',
    'Remediation Command',
    'Remediated'
  ];

  const rows = resources.map(r => [
    `"${r.id}"`,
    `"${r.name}"`,
    `"${r.provider}"`,
    `"${r.service}"`,
    `"${r.serviceCategory}"`,
    `"${r.region}"`,
    `"${r.status}"`,
    `"${r.typeOrSize}"`,
    r.monthlyCostUSD.toFixed(2),
    r.estimatedWasteUSD.toFixed(2),
    r.savingsPotentialPercent,
    r.isInactive ? 'TRUE' : 'FALSE',
    `"${(r.inactiveReason || '').replace(/"/g, '""')}"`,
    `"${(r.remediationCommand || '').replace(/"/g, '""')}"`,
    r.remediated ? 'TRUE' : 'FALSE',
  ]);

  return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
}

export function exportToJSON(
  summary: AuditSummary,
  resources: CloudResource[],
  trends: MonthlyCostPoint[],
  recommendations: OptimizationRecommendation[]
): string {
  return JSON.stringify(
    {
      reportTitle: 'CloudPulse FinOps Resource & Cost Audit Report',
      generatedAt: new Date().toISOString(),
      summary,
      monthlyTrends: trends,
      recommendations,
      resources,
    },
    null,
    2
  );
}
