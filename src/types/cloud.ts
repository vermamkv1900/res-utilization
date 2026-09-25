export type CloudProvider = 'aws' | 'azure';

export type ResourceStatus = 'active' | 'inactive' | 'idle' | 'overprovisioned' | 'stopped';

export type CloudServiceType =
  | 'EC2'
  | 'EBS'
  | 'RDS'
  | 'S3'
  | 'ELB'
  | 'EIP'
  | 'NAT_GW'
  | 'AZURE_VM'
  | 'AZURE_DISK'
  | 'AZURE_SQL'
  | 'AZURE_BLOB'
  | 'AZURE_PUBLIC_IP';

export interface CloudCredentials {
  provider: CloudProvider;
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  sessionToken?: string;
  subscriptionId?: string;
  tenantId?: string;
  clientId?: string;
  clientSecret?: string;
}

export interface ResourceMetrics {
  cpuAvgPercent?: number;
  cpuMaxPercent?: number;
  memoryUsagePercent?: number;
  iopsAvg?: number;
  networkInBytesPerDay?: number;
  networkOutBytesPerDay?: number;
  activeConnections?: number;
  storageUsedGB?: number;
  storageAllocatedGB?: number;
  daysUnattached?: number;
  daysStopped?: number;
}

export interface CloudResource {
  id: string;
  name: string;
  provider: CloudProvider;
  service: CloudServiceType;
  serviceCategory: 'Compute' | 'Storage' | 'Database' | 'Networking';
  region: string;
  status: ResourceStatus;
  typeOrSize: string;
  metrics: ResourceMetrics;
  monthlyCostUSD: number;
  estimatedWasteUSD: number;
  savingsPotentialPercent: number;
  isInactive: boolean;
  inactiveReason?: string;
  lastActivityDate: string;
  tags: Record<string, string>;
  recommendedAction: string;
  remediationCommand: string;
  remediated?: boolean;
  // Architecture & Topology Relationships
  attachedToResourceId?: string;
  connectedToResourceIds?: string[];
  networkTier?: 'Edge & Ingress' | 'Compute Tier' | 'Storage Tier' | 'Database Tier';
  vpcId?: string;
  subnetId?: string;
}

export interface MonthlyCostPoint {
  month: string;
  totalSpend: number;
  activeSpend: number;
  wasteSpend: number;
  computeCost: number;
  storageCost: number;
  databaseCost: number;
  networkingCost: number;
}

export interface OptimizationRecommendation {
  id: string;
  title: string;
  description: string;
  category: 'Idle Resource' | 'Rightsizing' | 'Storage Tiering' | 'Orphaned Assets' | 'Commitment';
  estimatedMonthlySavings: number;
  effort: 'Low' | 'Medium' | 'High';
  risk: 'None' | 'Low' | 'Medium';
  affectedResourceIds: string[];
  cliCommand: string;
  status: 'pending' | 'applied' | 'ignored';
}

export interface AuditSummary {
  accountId: string;
  provider: CloudProvider;
  scannedAt: string;
  totalResources: number;
  activeResources: number;
  inactiveResources: number;
  overprovisionedResources: number;
  totalMonthlySpend: number;
  totalMonthlyWaste: number;
  potentialMonthlySavings: number;
  wastePercentage: number;
}

export interface CloudAuditState {
  credentials: CloudCredentials;
  summary: AuditSummary;
  resources: CloudResource[];
  monthlyTrends: MonthlyCostPoint[];
  recommendations: OptimizationRecommendation[];
  isScanning: boolean;
  lastScannedAt: string;
}
