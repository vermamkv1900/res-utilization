import React, { useState, useMemo, useRef, useEffect } from 'react';
import { CloudResource, CloudProvider } from '../types/cloud';
import {
  buildTopologyGraph,
  TopologyNode,
  TopologyLink,
  ArchitectureTier,
  getRelatedNodeIds,
} from '../utils/topologyGraph';
import {
  Network,
  Cpu,
  HardDrive,
  Database,
  Search,
  Filter,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Copy,
  Check,
  X,
  ExternalLink,
  Layers,
  Sparkles,
} from 'lucide-react';

interface TopologyMapProps {
  resources: CloudResource[];
  provider: CloudProvider;
  onOpenConnectModal?: () => void;
  onNavigateToRecommendations?: () => void;
}

const TIER_META: Record<
  ArchitectureTier,
  { label: string; sub: string; icon: React.FC<{ className?: string }> }
> = {
  ingress: {
    label: 'Edge & Ingress',
    sub: 'Load Balancers, EIPs, NAT Gateways',
    icon: Network,
  },
  compute: {
    label: 'Compute Tier',
    sub: 'Virtual Machines, Nodes & Containers',
    icon: Cpu,
  },
  storage: {
    label: 'Storage Tier',
    sub: 'Block Volumes, Object Stores, Disks',
    icon: HardDrive,
  },
  database: {
    label: 'Database Tier',
    sub: 'Managed DBs, Replicas, Multi-AZ Clusters',
    icon: Database,
  },
};

export const TopologyMap: React.FC<TopologyMapProps> = ({
  resources,
  provider,
  onOpenConnectModal,
  onNavigateToRecommendations,
}) => {
  // Filtering states
  const [selectedTier, setSelectedTier] = useState<ArchitectureTier | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'waste' | 'active'>('all');
  const [selectedService, setSelectedService] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isolateMode, setIsolateMode] = useState(false);

  // Canvas zoom & pan
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Node selection & custom drag positions
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [nodePositions, setNodePositions] = useState<Record<string, { x: number; y: number }>>({});
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Clipboard copy state
  const [copiedCommand, setCopiedCommand] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Build full topology graph from current resources
  const baseGraph = useMemo(() => {
    return buildTopologyGraph(resources);
  }, [resources]);

  // Unique services list for filtering
  const availableServices = useMemo(() => {
    const set = new Set<string>();
    resources.forEach((r) => set.add(r.service));
    return Array.from(set);
  }, [resources]);

  // Related node IDs if a node is selected
  const relatedNodeIds = useMemo(() => {
    if (!selectedNodeId) return new Set<string>();
    return getRelatedNodeIds(selectedNodeId, baseGraph.links);
  }, [selectedNodeId, baseGraph.links]);

  // Filtered nodes
  const filteredNodes = useMemo(() => {
    return baseGraph.nodes.filter((node) => {
      // Tier filter
      if (selectedTier !== 'all' && node.tier !== selectedTier) return false;

      // Status filter
      if (statusFilter === 'waste' && !node.isInactive) return false;
      if (statusFilter === 'active' && node.isInactive) return false;

      // Service filter
      if (selectedService !== 'all' && node.resource.service !== selectedService) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = node.name.toLowerCase().includes(q);
        const matchesId = node.id.toLowerCase().includes(q);
        const matchesType = node.resource.typeOrSize.toLowerCase().includes(q);
        const matchesTag = Object.values(node.resource.tags || {}).some((v) =>
          v.toLowerCase().includes(q)
        );
        if (!matchesName && !matchesId && !matchesType && !matchesTag) return false;
      }

      // Isolate mode
      if (isolateMode && selectedNodeId) {
        if (!relatedNodeIds.has(node.id)) return false;
      }

      return true;
    });
  }, [
    baseGraph.nodes,
    selectedTier,
    statusFilter,
    selectedService,
    searchQuery,
    isolateMode,
    selectedNodeId,
    relatedNodeIds,
  ]);

  const filteredNodeIdSet = useMemo(() => {
    return new Set(filteredNodes.map((n) => n.id));
  }, [filteredNodes]);

  // Filtered links (only between visible nodes)
  const visibleLinks = useMemo(() => {
    return baseGraph.links.filter(
      (link) => filteredNodeIdSet.has(link.sourceId) && filteredNodeIdSet.has(link.targetId)
    );
  }, [baseGraph.links, filteredNodeIdSet]);

  // Selected node object
  const selectedNode = useMemo(() => {
    return baseGraph.nodes.find((n) => n.id === selectedNodeId) || null;
  }, [baseGraph.nodes, selectedNodeId]);

  // Connected links for selected node
  const selectedNodeLinks = useMemo(() => {
    if (!selectedNodeId) return { incoming: [], outgoing: [] };
    const incoming = baseGraph.links.filter((l) => l.targetId === selectedNodeId);
    const outgoing = baseGraph.links.filter((l) => l.sourceId === selectedNodeId);
    return { incoming, outgoing };
  }, [selectedNodeId, baseGraph.links]);

  // Get current coordinate for a node
  const getNodeCoord = (nodeId: string, defaultX: number, defaultY: number) => {
    if (nodePositions[nodeId]) {
      return nodePositions[nodeId];
    }
    return { x: defaultX, y: defaultY };
  };

  // Node dimensions
  const NODE_WIDTH = 250;
  const NODE_HEIGHT = 100;

  // Handle canvas pan
  const handleMouseDownCanvas = (e: React.MouseEvent) => {
    // If clicking on background
    if ((e.target as HTMLElement).tagName === 'svg' || (e.target as HTMLElement).id === 'canvas-bg') {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMoveCanvas = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan(panStart ? { x: e.clientX - panStart.x, y: e.clientY - panStart.y } : pan);
    } else if (draggingNodeId) {
      const parentRect = containerRef.current?.getBoundingClientRect();
      if (!parentRect) return;

      const currentMouseX = (e.clientX - parentRect.left - pan.x) / zoom;
      const currentMouseY = (e.clientY - parentRect.top - pan.y) / zoom;

      setNodePositions((prev) => ({
        ...prev,
        [draggingNodeId]: {
          x: Math.max(20, currentMouseX - dragOffset.x),
          y: Math.max(20, currentMouseY - dragOffset.y),
        },
      }));
    }
  };

  const handleMouseUpCanvas = () => {
    setIsPanning(false);
    setDraggingNodeId(null);
  };

  const handleStartDragNode = (node: TopologyNode, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedNodeId(node.id);
    setDraggingNodeId(node.id);

    const currentPos = getNodeCoord(node.id, node.x, node.y);
    const parentRect = containerRef.current?.getBoundingClientRect();
    if (!parentRect) return;

    const mouseX = (e.clientX - parentRect.left - pan.x) / zoom;
    const mouseY = (e.clientY - parentRect.top - pan.y) / zoom;

    setDragOffset({
      x: mouseX - currentPos.x,
      y: mouseY - currentPos.y,
    });
  };

  const handleResetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setNodePositions({});
    setSelectedNodeId(null);
    setIsolateMode(false);
    setSelectedTier('all');
    setStatusFilter('all');
    setSelectedService('all');
    setSearchQuery('');
  };

  const handleCopyCommand = (command: string) => {
    navigator.clipboard.writeText(command);
    setCopiedCommand(true);
    setTimeout(() => setCopiedCommand(false), 2000);
  };

  // Canvas bounds calculation
  const maxY = useMemo(() => {
    let max = 700;
    baseGraph.nodes.forEach((n) => {
      const pos = getNodeCoord(n.id, n.x, n.y);
      if (pos.y + 180 > max) max = pos.y + 180;
    });
    return max;
  }, [baseGraph.nodes, nodePositions]);

  return (
    <div className="space-y-4">
      {/* 1. Header & Global Topology Summary Banner */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              Full Infrastructure Topology & Relations
            </span>
            <span className="text-slate-600">·</span>
            <span className="text-xs text-cyan-300 font-mono font-bold">
              {provider.toUpperCase()} Architecture Graph
            </span>
            <span className="text-slate-600">·</span>
            <span className="text-xs text-slate-400">
              Interactive end-to-end component dependencies
            </span>
          </div>
          <p className="text-xs text-slate-300">
            Click any component to inspect parent/child relations, active network links, storage attachments, and live waste metrics. Drag components to customize layout.
          </p>
        </div>

        {/* Global Topology Summary Counters */}
        <div className="flex items-center gap-2 text-xs font-mono shrink-0">
          <div className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center gap-2">
            <span className="text-slate-400 font-sans text-[11px]">Total Mapped:</span>
            <span className="text-cyan-300 font-bold">{baseGraph.nodes.length}</span>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center gap-2">
            <span className="text-slate-400 font-sans text-[11px]">Active Links:</span>
            <span className="text-emerald-400 font-bold">{baseGraph.links.length}</span>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-slate-950 border border-rose-900/50 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
            <span className="text-slate-400 font-sans text-[11px]">Waste:</span>
            <span className="text-rose-400 font-bold">${baseGraph.totalWaste.toFixed(0)}/mo</span>
          </div>
        </div>
      </div>

      {/* 2. Interactive Filtering Toolbar (Filter to Any Resource Level) */}
      <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Tier Level Selector Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800/80">
            <button
              onClick={() => setSelectedTier('all')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                selectedTier === 'all'
                  ? 'bg-cyan-500 text-slate-950 font-semibold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              All Tiers ({baseGraph.nodes.length})
            </button>
            {(Object.keys(TIER_META) as ArchitectureTier[]).map((tierKey) => {
              const meta = TIER_META[tierKey];
              const Icon = meta.icon;
              const count = baseGraph.tierCounts[tierKey] || 0;
              return (
                <button
                  key={tierKey}
                  onClick={() => setSelectedTier(tierKey)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                    selectedTier === tierKey
                      ? 'bg-cyan-500 text-slate-950 font-semibold'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  <span>{meta.label}</span>
                  <span className="opacity-70 font-mono text-[10px]">({count})</span>
                </button>
              );
            })}
          </div>

          {/* Quick Search */}
          <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search ID, tag, name, IP..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* Secondary Filters & View Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/60 text-xs">
          {/* Health / FinOps Filter */}
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-[11px] font-medium flex items-center gap-1">
              <Filter className="w-3 h-3 text-cyan-400" /> Filter Health:
            </span>
            <div className="inline-flex rounded-md bg-slate-950 border border-slate-800 p-0.5">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-2.5 py-1 text-[11px] rounded transition-colors cursor-pointer ${
                  statusFilter === 'all'
                    ? 'bg-slate-800 text-cyan-300 font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                All Components
              </button>
              <button
                onClick={() => setStatusFilter('waste')}
                className={`px-2.5 py-1 text-[11px] rounded transition-colors cursor-pointer flex items-center gap-1 ${
                  statusFilter === 'waste'
                    ? 'bg-rose-950 text-rose-300 border border-rose-800 font-semibold'
                    : 'text-rose-400/80 hover:text-rose-300'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                Waste / Inactive Only
              </button>
              <button
                onClick={() => setStatusFilter('active')}
                className={`px-2.5 py-1 text-[11px] rounded transition-colors cursor-pointer flex items-center gap-1 ${
                  statusFilter === 'active'
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-800 font-semibold'
                    : 'text-emerald-400/80 hover:text-emerald-300'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Active Only
              </button>
            </div>

            {/* Service filter */}
            <select
              value={selectedService}
              onChange={(e) => setSelectedService(e.target.value)}
              className="px-2.5 py-1 bg-slate-950 border border-slate-800 rounded-md text-xs text-slate-300 font-mono focus:outline-none focus:border-cyan-500 cursor-pointer"
            >
              <option value="all">All Services ({availableServices.length})</option>
              {availableServices.map((svc) => (
                <option key={svc} value={svc}>
                  {svc}
                </option>
              ))}
            </select>
          </div>

          {/* Canvas Actions & Zoom Tools */}
          <div className="flex items-center gap-2">
            {selectedNodeId && (
              <button
                onClick={() => setIsolateMode(!isolateMode)}
                className={`px-2.5 py-1 text-xs rounded-md border transition-colors cursor-pointer flex items-center gap-1.5 ${
                  isolateMode
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50'
                    : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800'
                }`}
              >
                <Sparkles className="w-3 h-3 text-cyan-400" />
                <span>{isolateMode ? 'Show All Nodes' : 'Isolate Node Flow'}</span>
              </button>
            )}

            <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-lg p-0.5">
              <button
                onClick={() => setZoom((z) => Math.max(0.6, z - 0.1))}
                className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 cursor-pointer"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="px-1.5 text-[10px] font-mono text-slate-400 select-none">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={() => setZoom((z) => Math.min(1.8, z + 0.1))}
                className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 cursor-pointer"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleResetView}
                className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 cursor-pointer"
                title="Reset View and Layout"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Main Topology Canvas & Inspector Drawer */}
      <div className="relative flex rounded-xl border border-slate-800 bg-slate-950 overflow-hidden shadow-2xl min-h-[640px]">
        {/* Canvas Area */}
        <div
          ref={containerRef}
          id="canvas-bg"
          onMouseDown={handleMouseDownCanvas}
          onMouseMove={handleMouseMoveCanvas}
          onMouseUp={handleMouseUpCanvas}
          className="flex-1 overflow-auto relative cursor-grab active:cursor-grabbing select-none"
          style={{ minHeight: '640px' }}
        >
          {/* Subtle Grid Background Pattern */}
          <div
            className="absolute inset-0 pointer-events-none opacity-20"
            style={{
              backgroundImage: `radial-gradient(circle, #38bdf8 1px, transparent 1px)`,
              backgroundSize: '28px 28px',
            }}
          />

          {/* Scalable & Pannable Graph World */}
          <div
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: 'top left',
              width: '1440px',
              height: `${Math.max(750, maxY + 100)}px`,
              position: 'relative',
              transition: isPanning || draggingNodeId ? 'none' : 'transform 0.15s ease-out',
            }}
          >
            {/* Column Tier Guides */}
            <div className="absolute inset-0 pointer-events-none grid grid-cols-4 divide-x divide-slate-800/40">
              {(Object.keys(TIER_META) as ArchitectureTier[]).map((tierKey) => {
                const meta = TIER_META[tierKey];
                const Icon = meta.icon;
                return (
                  <div key={tierKey} className="px-4 py-3 flex flex-col justify-start">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      <Icon className="w-3.5 h-3.5 text-cyan-400" />
                      <span>{meta.label}</span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono mt-0.5">{meta.sub}</span>
                  </div>
                );
              })}
            </div>

            {/* SVG Connecting Relationship Links */}
            <svg
              className="absolute inset-0 pointer-events-none"
              style={{ width: '100%', height: '100%', overflow: 'visible' }}
            >
              <defs>
                <linearGradient id="link-gradient-active" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.8" />
                </linearGradient>
                <linearGradient id="link-gradient-waste" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity="0.8" />
                </linearGradient>
                <filter id="glow-cyan" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#06b6d4" floodOpacity="0.7" />
                </filter>
              </defs>

              {visibleLinks.map((link) => {
                const sNode = baseGraph.nodes.find((n) => n.id === link.sourceId);
                const tNode = baseGraph.nodes.find((n) => n.id === link.targetId);
                if (!sNode || !tNode) return null;

                const sPos = getNodeCoord(sNode.id, sNode.x, sNode.y);
                const tPos = getNodeCoord(tNode.id, tNode.x, tNode.y);

                // Right side of source to left side of target
                const startX = sPos.x + NODE_WIDTH;
                const startY = sPos.y + NODE_HEIGHT / 2;
                const endX = tPos.x;
                const endY = tPos.y + NODE_HEIGHT / 2;

                const dx = Math.abs(endX - startX);
                const controlX1 = startX + dx * 0.5;
                const controlX2 = endX - dx * 0.5;

                const pathData = `M ${startX} ${startY} C ${controlX1} ${startY}, ${controlX2} ${endY}, ${endX} ${endY}`;

                const isLinkHighlighted =
                  selectedNodeId &&
                  (link.sourceId === selectedNodeId || link.targetId === selectedNodeId);
                const isDimmed = selectedNodeId && !isLinkHighlighted;

                const isWaste = link.status === 'waste';

                return (
                  <g key={link.id} opacity={isDimmed ? 0.15 : 1}>
                    {/* Shadow / Glow Line */}
                    <path
                      d={pathData}
                      fill="none"
                      stroke={isWaste ? '#ef4444' : '#06b6d4'}
                      strokeWidth={isLinkHighlighted ? 4 : 2}
                      strokeOpacity={isLinkHighlighted ? 0.9 : 0.35}
                      strokeDasharray={isWaste ? '6,4' : undefined}
                      filter={isLinkHighlighted ? 'url(#glow-cyan)' : undefined}
                    />

                    {/* Flow Animation Dot */}
                    {link.animated && !isDimmed && (
                      <circle r={isLinkHighlighted ? 4 : 2.5} fill="#38bdf8">
                        <animateMotion path={pathData} dur="3s" repeatCount="indefinite" />
                      </circle>
                    )}
                  </g>
                );
              })}
            </svg>

            {/* Mapped Node Cards */}
            {filteredNodes.map((node) => {
              const pos = getNodeCoord(node.id, node.x, node.y);
              const isSelected = selectedNodeId === node.id;
              const isRelated = selectedNodeId && relatedNodeIds.has(node.id);
              const isDimmed = selectedNodeId && !isSelected && !isRelated;

              const isWaste = node.isInactive;
              const statusColor = isWaste
                ? node.status === 'stopped'
                  ? 'bg-rose-500 text-rose-300'
                  : 'bg-amber-500 text-amber-300'
                : 'bg-emerald-500 text-emerald-300';

              return (
                <div
                  key={node.id}
                  onMouseDown={(e) => handleStartDragNode(node, e)}
                  style={{
                    position: 'absolute',
                    left: `${pos.x}px`,
                    top: `${pos.y}px`,
                    width: `${NODE_WIDTH}px`,
                    minHeight: `${NODE_HEIGHT}px`,
                    transition: draggingNodeId === node.id ? 'none' : 'opacity 0.2s, box-shadow 0.2s',
                    opacity: isDimmed ? 0.25 : 1,
                    zIndex: isSelected ? 40 : isRelated ? 20 : 10,
                  }}
                  className={`group rounded-xl border p-3 cursor-pointer select-none bg-slate-900 shadow-md ${
                    isSelected
                      ? 'border-cyan-400 ring-2 ring-cyan-400/40 shadow-cyan-950/80 shadow-xl'
                      : isRelated
                      ? 'border-cyan-600/80 bg-slate-900/90'
                      : isWaste
                      ? 'border-rose-900/70 hover:border-rose-600'
                      : 'border-slate-800 hover:border-slate-600'
                  }`}
                >
                  {/* Top Bar: Service tag & Status badge */}
                  <div className="flex items-center justify-between gap-1 mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-[10px] font-mono font-bold text-slate-300">
                        {node.resource.service}
                      </span>
                      {node.isOrphaned && (
                        <span className="text-[10px] text-rose-400 font-semibold flex items-center gap-1">
                          <AlertTriangle className="w-2.5 h-2.5" />
                          Severed / Detached
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className={`w-1.5 h-1.5 rounded-full ${statusColor}`} />
                      <span className="text-[10px] font-mono uppercase text-slate-400">
                        {node.status}
                      </span>
                    </div>
                  </div>

                  {/* Resource Name & ID */}
                  <div className="text-xs font-semibold text-white truncate" title={node.name}>
                    {node.name}
                  </div>
                  <div className="text-[10px] font-mono text-slate-500 truncate" title={node.id}>
                    {node.id}
                  </div>

                  {/* Sizing & Cost Footprint */}
                  <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono">
                    <span className="text-slate-400 text-[10px] truncate max-w-[130px]">
                      {node.resource.typeOrSize}
                    </span>
                    <div className="text-right">
                      <span className="text-slate-200">${node.resource.monthlyCostUSD.toFixed(0)}</span>
                      {isWaste && (
                        <div className="text-[10px] text-rose-400 font-bold">
                          -${node.resource.estimatedWasteUSD.toFixed(0)}/mo
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Connection Count Badge */}
                  {node.connectedCount > 0 && (
                    <div className="absolute -bottom-2 right-3 px-1.5 py-0.2 rounded bg-slate-950 border border-slate-700 text-[9px] font-mono text-cyan-300">
                      {node.connectedCount} link{node.connectedCount > 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 4. Component Details & Relations Inspector (Right Drawer) */}
        {selectedNode && (
          <aside className="w-80 md:w-96 border-l border-slate-800 bg-slate-900/95 backdrop-blur p-5 flex flex-col justify-between overflow-y-auto shrink-0 shadow-2xl z-30">
            <div className="space-y-5">
              {/* Header with Close */}
              <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-3">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-[11px] font-mono font-bold text-cyan-300">
                      {selectedNode.resource.service}
                    </span>
                    <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
                      {selectedNode.tier.toUpperCase()} TIER
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-white mt-1 break-words">
                    {selectedNode.name}
                  </h3>
                  <div className="text-[11px] font-mono text-slate-400 break-all select-all">
                    {selectedNode.id}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedNodeId(null)}
                  className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Status & FinOps Waste Card */}
              <div
                className={`p-3.5 rounded-xl border ${
                  selectedNode.isInactive
                    ? 'bg-rose-950/30 border-rose-800/80 text-rose-200'
                    : 'bg-emerald-950/20 border-emerald-800/80 text-emerald-200'
                }`}
              >
                <div className="flex items-center justify-between text-xs font-semibold">
                  <div className="flex items-center gap-1.5">
                    {selectedNode.isInactive ? (
                      <AlertTriangle className="w-4 h-4 text-rose-400" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    )}
                    <span>
                      {selectedNode.isInactive ? 'Wasted / Inactive Resource' : 'Active & Healthy'}
                    </span>
                  </div>
                  <span className="font-mono uppercase text-[11px]">
                    {selectedNode.status}
                  </span>
                </div>
                {selectedNode.resource.inactiveReason && (
                  <p className="text-[11px] text-slate-300 mt-2 leading-relaxed">
                    {selectedNode.resource.inactiveReason}
                  </p>
                )}
                <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-400 font-sans">Monthly Cost:</span>
                  <span className="font-bold text-white">
                    ${selectedNode.resource.monthlyCostUSD.toFixed(2)}/mo
                  </span>
                </div>
                {selectedNode.isInactive && (
                  <div className="mt-1 flex items-center justify-between text-xs font-mono text-rose-300">
                    <span className="font-sans">Recoverable Waste:</span>
                    <span className="font-bold">
                      ${selectedNode.resource.estimatedWasteUSD.toFixed(2)}/mo (
                      {selectedNode.resource.savingsPotentialPercent}%)
                    </span>
                  </div>
                )}
              </div>

              {/* Connected Relationships (Upstream & Downstream) */}
              <div className="space-y-3">
                <h4 className="text-xs uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1.5">
                  <Network className="w-3.5 h-3.5 text-cyan-400" />
                  Topology Connections ({selectedNode.connectedCount})
                </h4>

                {/* Upstream Parents */}
                <div className="space-y-1.5">
                  <span className="text-[11px] text-slate-400 font-medium">Upstream Traffic / Ingress Sources:</span>
                  {selectedNodeLinks.incoming.length === 0 ? (
                    <div className="text-[11px] text-slate-500 italic pl-2">
                      No incoming connections detected (Edge entry or direct host)
                    </div>
                  ) : (
                    selectedNodeLinks.incoming.map((link) => {
                      const parent = baseGraph.nodes.find((n) => n.id === link.sourceId);
                      if (!parent) return null;
                      return (
                        <button
                          key={link.id}
                          onClick={() => setSelectedNodeId(parent.id)}
                          className="w-full text-left p-2 rounded-lg bg-slate-950 border border-slate-800 hover:border-cyan-500 transition-colors cursor-pointer group flex items-center justify-between"
                        >
                          <div className="truncate">
                            <div className="text-xs font-semibold text-slate-200 group-hover:text-cyan-300 truncate">
                              {parent.name}
                            </div>
                            <div className="text-[10px] font-mono text-slate-500">
                              {parent.resource.service} · {link.label}
                            </div>
                          </div>
                          <ArrowRight className="w-3 h-3 text-slate-500 group-hover:text-cyan-400 shrink-0" />
                        </button>
                      );
                    })
                  )}
                </div>

                {/* Downstream Dependents */}
                <div className="space-y-1.5 pt-2">
                  <span className="text-[11px] text-slate-400 font-medium">Downstream Targets / Attached Assets:</span>
                  {selectedNodeLinks.outgoing.length === 0 ? (
                    <div className="text-[11px] text-slate-500 italic pl-2">
                      {selectedNode.isOrphaned
                        ? '⚠️ Isolated / Severed: No attached dependencies or target groups.'
                        : 'Terminal node (e.g. database or isolated volume)'}
                    </div>
                  ) : (
                    selectedNodeLinks.outgoing.map((link) => {
                      const child = baseGraph.nodes.find((n) => n.id === link.targetId);
                      if (!child) return null;
                      return (
                        <button
                          key={link.id}
                          onClick={() => setSelectedNodeId(child.id)}
                          className="w-full text-left p-2 rounded-lg bg-slate-950 border border-slate-800 hover:border-cyan-500 transition-colors cursor-pointer group flex items-center justify-between"
                        >
                          <div className="truncate">
                            <div className="text-xs font-semibold text-slate-200 group-hover:text-cyan-300 truncate">
                              {child.name}
                            </div>
                            <div className="text-[10px] font-mono text-slate-500">
                              {child.resource.service} · {link.label}
                            </div>
                          </div>
                          <ArrowRight className="w-3 h-3 text-slate-500 group-hover:text-cyan-400 shrink-0" />
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Technical Specifications */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <h4 className="text-xs uppercase font-bold text-slate-400 tracking-wider">
                  Specifications & Environment
                </h4>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="p-2 rounded bg-slate-950 border border-slate-800">
                    <span className="text-slate-500 text-[10px] block">Region / Zone</span>
                    <span className="text-slate-300">{selectedNode.resource.region}</span>
                  </div>
                  <div className="p-2 rounded bg-slate-950 border border-slate-800">
                    <span className="text-slate-500 text-[10px] block">Tier Level</span>
                    <span className="text-slate-300 capitalize">{selectedNode.tier}</span>
                  </div>
                  <div className="p-2 rounded bg-slate-950 border border-slate-800 col-span-2">
                    <span className="text-slate-500 text-[10px] block">Sizing / SKU</span>
                    <span className="text-slate-300 truncate block">
                      {selectedNode.resource.typeOrSize}
                    </span>
                  </div>
                </div>

                {/* Utilization Metrics */}
                {selectedNode.resource.metrics && (
                  <div className="p-2.5 rounded bg-slate-950 border border-slate-800 text-xs font-mono space-y-1">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider block mb-1">
                      Live Telemetry Metrics
                    </span>
                    {selectedNode.resource.metrics.cpuAvgPercent !== undefined && (
                      <div className="flex justify-between text-slate-300">
                        <span className="text-slate-500">Avg CPU:</span>
                        <span>{selectedNode.resource.metrics.cpuAvgPercent}%</span>
                      </div>
                    )}
                    {selectedNode.resource.metrics.daysStopped !== undefined && (
                      <div className="flex justify-between text-amber-300">
                        <span className="text-slate-500">Days Stopped:</span>
                        <span>{selectedNode.resource.metrics.daysStopped} days</span>
                      </div>
                    )}
                    {selectedNode.resource.metrics.daysUnattached !== undefined && (
                      <div className="flex justify-between text-rose-300">
                        <span className="text-slate-500">Days Unattached:</span>
                        <span>{selectedNode.resource.metrics.daysUnattached} days</span>
                      </div>
                    )}
                    {selectedNode.resource.metrics.storageAllocatedGB !== undefined && (
                      <div className="flex justify-between text-slate-300">
                        <span className="text-slate-500">Allocated Storage:</span>
                        <span>{selectedNode.resource.metrics.storageAllocatedGB} GB</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Recommended Remediation & CLI Command */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <h4 className="text-xs uppercase font-bold text-slate-400 tracking-wider">
                  Remediation Action
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {selectedNode.resource.recommendedAction}
                </p>

                {selectedNode.resource.remediationCommand && (
                  <div className="mt-2 relative">
                    <pre className="p-2.5 rounded bg-slate-950 border border-slate-800 font-mono text-[11px] text-cyan-300 overflow-x-auto whitespace-pre-wrap break-all pr-8">
                      {selectedNode.resource.remediationCommand}
                    </pre>
                    <button
                      onClick={() =>
                        handleCopyCommand(selectedNode.resource.remediationCommand)
                      }
                      className="absolute right-2 top-2 p-1 text-slate-400 hover:text-white bg-slate-900 rounded border border-slate-800 cursor-pointer"
                      title="Copy CLI command"
                    >
                      {copiedCommand ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-2">
              <button
                onClick={() => setIsolateMode(!isolateMode)}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors cursor-pointer w-full text-center"
              >
                {isolateMode ? 'Show Full Topology' : 'Isolate Connection Tree'}
              </button>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
};
