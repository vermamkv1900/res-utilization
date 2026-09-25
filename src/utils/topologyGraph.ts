import { CloudResource, ResourceStatus } from '../types/cloud';

export type ArchitectureTier = 'ingress' | 'compute' | 'storage' | 'database';

export interface TopologyNode {
  id: string;
  name: string;
  resource: CloudResource;
  tier: ArchitectureTier;
  x: number;
  y: number;
  status: ResourceStatus;
  isInactive: boolean;
  isOrphaned: boolean;
  connectedCount: number;
}

export interface TopologyLink {
  id: string;
  sourceId: string;
  targetId: string;
  sourceTier: ArchitectureTier;
  targetTier: ArchitectureTier;
  label: string;
  status: 'active' | 'waste' | 'severed';
  animated?: boolean;
}

export interface TopologyGraphData {
  nodes: TopologyNode[];
  links: TopologyLink[];
  tierCounts: Record<ArchitectureTier, number>;
  totalSpend: number;
  totalWaste: number;
}

export function getResourceTier(res: CloudResource): ArchitectureTier {
  if (res.networkTier) {
    if (res.networkTier.includes('Edge') || res.networkTier.includes('Ingress')) return 'ingress';
    if (res.networkTier.includes('Compute')) return 'compute';
    if (res.networkTier.includes('Storage')) return 'storage';
    if (res.networkTier.includes('Database')) return 'database';
  }

  const s = res.service.toUpperCase();
  if (['ELB', 'EIP', 'NAT_GW', 'AZURE_PUBLIC_IP'].includes(s)) return 'ingress';
  if (['EC2', 'AZURE_VM'].includes(s)) return 'compute';
  if (['EBS', 'S3', 'AZURE_DISK', 'AZURE_BLOB'].includes(s)) return 'storage';
  if (['RDS', 'AZURE_SQL'].includes(s)) return 'database';

  switch (res.serviceCategory) {
    case 'Networking':
      return 'ingress';
    case 'Compute':
      return 'compute';
    case 'Storage':
      return 'storage';
    case 'Database':
      return 'database';
    default:
      return 'compute';
  }
}

/**
 * Builds nodes, spatial layout coordinates, and dependency connections
 */
export function buildTopologyGraph(resources: CloudResource[]): TopologyGraphData {
  const links: TopologyLink[] = [];
  const linkKeySet = new Set<string>();

  const addLink = (sourceId: string, targetId: string, label: string, status: 'active' | 'waste' | 'severed') => {
    const key = `${sourceId}->${targetId}`;
    if (linkKeySet.has(key) || sourceId === targetId) return;
    linkKeySet.add(key);

    const sRes = resources.find((r) => r.id === sourceId);
    const tRes = resources.find((r) => r.id === targetId);
    if (!sRes || !tRes) return;

    links.push({
      id: key,
      sourceId,
      targetId,
      sourceTier: getResourceTier(sRes),
      targetTier: getResourceTier(tRes),
      label,
      status,
      animated: status === 'active',
    });
  };

  // 1. Map explicit connections
  for (const r of resources) {
    // Volume/EIP attachedTo
    if (r.attachedToResourceId) {
      const parent = resources.find((p) => p.id === r.attachedToResourceId);
      if (parent) {
        addLink(parent.id, r.id, 'Block Device Attach', r.isInactive || parent.isInactive ? 'waste' : 'active');
      }
    }

    // Connected to list
    if (r.connectedToResourceIds && Array.isArray(r.connectedToResourceIds)) {
      for (const targetId of r.connectedToResourceIds) {
        const target = resources.find((t) => t.id === targetId);
        if (target) {
          const isWaste = r.isInactive || target.isInactive;
          addLink(r.id, target.id, 'Traffic / RPC Flow', isWaste ? 'waste' : 'active');
        }
      }
    }
  }

  // 2. Derive intuitive implicit architecture links if none explicit
  const computeNodes = resources.filter((r) => getResourceTier(r) === 'compute');
  const ingressNodes = resources.filter((r) => getResourceTier(r) === 'ingress');
  const dbNodes = resources.filter((r) => getResourceTier(r) === 'database');
  const storageNodes = resources.filter((r) => getResourceTier(r) === 'storage');

  // Link Load Balancers to compute instances (unless 0 targets)
  ingressNodes.forEach((ing) => {
    if (ing.service === 'ELB') {
      const isUnused = ing.isInactive || ing.metrics?.activeConnections === 0;
      if (!isUnused) {
        // Link to active production compute nodes
        computeNodes
          .filter((c) => !c.isInactive)
          .slice(0, 2)
          .forEach((c) => {
            addLink(ing.id, c.id, 'HTTP Target Routing', 'active');
          });
      }
    } else if (ing.service === 'NAT_GW') {
      // Connect to compute nodes in VPC
      computeNodes.slice(0, 2).forEach((c) => {
        addLink(ing.id, c.id, 'Egress Outbound NAT', 'active');
      });
    }
  });

  // Link Compute nodes to Databases
  computeNodes.forEach((c) => {
    if (!c.isInactive) {
      const primaryDb = dbNodes.find((d) => !d.isInactive);
      if (primaryDb) {
        addLink(c.id, primaryDb.id, 'SQL Pool Queries', 'active');
      }
    } else {
      // Idle or stopped compute
      const idleDb = dbNodes.find((d) => d.isInactive);
      if (idleDb) {
        addLink(c.id, idleDb.id, 'Zombie Staging RPC', 'waste');
      }
    }
  });

  // Link Compute nodes to Storage
  computeNodes.forEach((c) => {
    // If compute has attached volumes or tags
    const matchingStorage = storageNodes.find((s) => !s.isInactive && s.tags?.Environment === c.tags?.Environment);
    if (matchingStorage) {
      addLink(c.id, matchingStorage.id, 'Root Volume', 'active');
    }
  });

  // Calculate layout coordinates by architecture tier columns
  const tierXMap: Record<ArchitectureTier, number> = {
    ingress: 120,
    compute: 460,
    storage: 800,
    database: 1140,
  };

  const tierBuckets: Record<ArchitectureTier, CloudResource[]> = {
    ingress: [],
    compute: [],
    storage: [],
    database: [],
  };

  resources.forEach((r) => {
    const tier = getResourceTier(r);
    tierBuckets[tier].push(r);
  });

  const nodeConnectedMap = new Map<string, number>();
  links.forEach((l) => {
    nodeConnectedMap.set(l.sourceId, (nodeConnectedMap.get(l.sourceId) || 0) + 1);
    nodeConnectedMap.set(l.targetId, (nodeConnectedMap.get(l.targetId) || 0) + 1);
  });

  const nodes: TopologyNode[] = [];
  const nodeSpacingY = 135;
  const startY = 80;

  (Object.keys(tierBuckets) as ArchitectureTier[]).forEach((tier) => {
    const items = tierBuckets[tier];
    // Sort so wasted/orphaned items appear with clear visibility
    items.sort((a, b) => (b.isInactive ? 1 : 0) - (a.isInactive ? 1 : 0));

    items.forEach((r, idx) => {
      const connectedCount = nodeConnectedMap.get(r.id) || 0;
      const isOrphaned = connectedCount === 0 || (r.isInactive && (r.service === 'EBS' || r.service === 'EIP' || r.service === 'AZURE_DISK'));

      nodes.push({
        id: r.id,
        name: r.name,
        resource: r,
        tier,
        x: tierXMap[tier],
        y: startY + idx * nodeSpacingY,
        status: r.status,
        isInactive: r.isInactive,
        isOrphaned,
        connectedCount,
      });
    });
  });

  const tierCounts: Record<ArchitectureTier, number> = {
    ingress: tierBuckets.ingress.length,
    compute: tierBuckets.compute.length,
    storage: tierBuckets.storage.length,
    database: tierBuckets.database.length,
  };

  const totalSpend = resources.reduce((acc, r) => acc + (r.monthlyCostUSD || 0), 0);
  const totalWaste = resources.reduce((acc, r) => acc + (r.estimatedWasteUSD || 0), 0);

  return {
    nodes,
    links,
    tierCounts,
    totalSpend,
    totalWaste,
  };
}

/**
 * Given a selected node, finds all directly and indirectly connected nodes
 */
export function getRelatedNodeIds(selectedNodeId: string, links: TopologyLink[]): Set<string> {
  const result = new Set<string>([selectedNodeId]);
  const queue = [selectedNodeId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    links.forEach((link) => {
      if (link.sourceId === current && !result.has(link.targetId)) {
        result.add(link.targetId);
        queue.push(link.targetId);
      }
      if (link.targetId === current && !result.has(link.sourceId)) {
        result.add(link.sourceId);
        queue.push(link.sourceId);
      }
    });
  }

  return result;
}
