import {
  useEffect,
  useCallback,
  useMemo,
  useState,
  useRef,
  forwardRef,
  useImperativeHandle,
} from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Focus,
  RotateCcw,
  Play,
  Pause,
  Lightbulb,
  LightbulbOff,
  Network,
  GitBranch,
  Target,
  Zap,
  Boxes,
} from '@/lib/lucide-icons';
import { useSigma } from '../hooks/useSigma';
import { useFolderHulls } from '../hooks/useFolderHulls';
import { useAppState } from '../hooks/useAppState';
import {
  knowledgeGraphToGraphology,
  knowledgeGraphToTreeGraphology,
  knowledgeGraphToCirclesGraphology,
  filterGraphByDepth,
  SigmaNodeAttributes,
  SigmaEdgeAttributes,
} from '../lib/graph-adapter';
import type { GraphNode } from 'yummygraph-shared';
import { QueryFAB } from './QueryFAB';
import { BlastRadiusPanel } from './BlastRadiusPanel';
import { computeBlastRadius, type BlastRadiusResult } from '../lib/blast-radius';
import Graph from 'graphology';
import { useTranslation } from 'react-i18next';

export interface GraphCanvasHandle {
  focusNode: (nodeId: string) => void;
}

export const GraphCanvas = forwardRef<GraphCanvasHandle>((_, ref) => {
  const { t } = useTranslation('graph');
  const {
    graph,
    setSelectedNode,
    selectedNode: appSelectedNode,
    visibleLabels,
    visibleEdgeTypes,
    openCodePanel,
    setCodePanelOpen,
    depthFilter,
    highlightedNodeIds,
    setHighlightedNodeIds,
    aiCitationHighlightedNodeIds,
    aiToolHighlightedNodeIds,
    blastRadiusNodeIds,
    isAIHighlightsEnabled,
    toggleAIHighlights,
    clearAIToolHighlights,
    clearAICitationHighlights,
    clearBlastRadius,
    animatedNodes,
    graphViewMode,
    setGraphViewMode,
  } = useAppState();
  const [hoveredNodeName, setHoveredNodeName] = useState<string | null>(null);
  // User-initiated blast radius (independent of the AI-chat highlight flow).
  const [blast, setBlast] = useState<BlastRadiusResult | null>(null);
  // Folder/module boundary overlay.
  const hullCanvasRef = useRef<HTMLCanvasElement>(null);
  const [showHulls, setShowHulls] = useState(false);

  const effectiveHighlightedNodeIds = useMemo(() => {
    if (!isAIHighlightsEnabled) return highlightedNodeIds;
    const next = new Set(highlightedNodeIds);
    for (const id of aiCitationHighlightedNodeIds) next.add(id);
    for (const id of aiToolHighlightedNodeIds) next.add(id);
    // Note: blast radius nodes are handled separately with red color
    return next;
  }, [
    highlightedNodeIds,
    aiCitationHighlightedNodeIds,
    aiToolHighlightedNodeIds,
    isAIHighlightsEnabled,
  ]);

  // Blast radius nodes (only when AI highlights enabled)
  const effectiveBlastRadiusNodeIds = useMemo(() => {
    if (!isAIHighlightsEnabled) return new Set<string>();
    return blastRadiusNodeIds;
  }, [blastRadiusNodeIds, isAIHighlightsEnabled]);

  // Animated nodes (only when AI highlights enabled)
  const effectiveAnimatedNodes = useMemo(() => {
    if (!isAIHighlightsEnabled) return new Map();
    return animatedNodes;
  }, [animatedNodes, isAIHighlightsEnabled]);

  const nodeById = useMemo(() => {
    if (!graph) return new Map<string, GraphNode>();
    return new Map(graph.nodes.map((n) => [n.id, n]));
  }, [graph]);

  // nodeId -> folder index (by directory of filePath). Feeding this to the force
  // layout instead of community memberships clusters symbols by folder, so the
  // boundary hulls wrap tight groups (and nodes get per-folder colors).
  const folderMemberships = useMemo(() => {
    const m = new Map<string, number>();
    if (!graph) return m;
    const idxByDir = new Map<string, number>();
    for (const n of graph.nodes) {
      const fp = n.properties?.filePath;
      if (!fp) continue;
      const slash = fp.lastIndexOf('/');
      const dir = slash >= 0 ? fp.slice(0, slash) : '';
      let idx = idxByDir.get(dir);
      if (idx === undefined) {
        idx = idxByDir.size;
        idxByDir.set(dir, idx);
      }
      m.set(n.id, idx);
    }
    return m;
  }, [graph]);

  const handleNodeClick = useCallback(
    (nodeId: string) => {
      if (!graph) return;
      const node = nodeById.get(nodeId);
      if (node) {
        setSelectedNode(node);
        openCodePanel();
      }
    },
    [graph, nodeById, setSelectedNode, openCodePanel],
  );

  const handleNodeHover = useCallback(
    (nodeId: string | null) => {
      if (!nodeId || !graph) {
        setHoveredNodeName(null);
        return;
      }
      const node = nodeById.get(nodeId);
      setHoveredNodeName(node ? node.properties.name : null);
    },
    [graph, nodeById],
  );

  const handleStageClick = useCallback(() => {
    setSelectedNode(null);
    setBlast(null);
  }, [setSelectedNode]);

  // Compute the blast radius (upstream dependents) of the selected symbol and
  // light it up on the graph as depth-graded red heat.
  const handleBlastRadius = useCallback(() => {
    if (!graph || !appSelectedNode) return;
    setBlast(computeBlastRadius(graph, appSelectedNode.id, { direction: 'upstream' }));
    // Close the code overlay so the (draggable) summary panel is fully visible.
    setCodePanelOpen(false);
  }, [graph, appSelectedNode, setCodePanelOpen]);

  const handleToggleAIHighlights = useCallback(() => {
    if (isAIHighlightsEnabled) {
      clearAIToolHighlights();
      clearAICitationHighlights();
      clearBlastRadius();
      setSelectedNode(null);
      setSigmaSelectedNode(null);
    }
    toggleAIHighlights();
  }, [
    isAIHighlightsEnabled,
    clearAIToolHighlights,
    clearAICitationHighlights,
    clearBlastRadius,
    setSelectedNode,
    toggleAIHighlights,
  ]);

  const {
    containerRef,
    sigmaRef,
    setGraph: setSigmaGraph,
    zoomIn,
    zoomOut,
    resetZoom,
    focusNode,
    isLayoutRunning,
    startLayout,
    stopLayout,
    selectedNode: sigmaSelectedNode,
    setSelectedNode: setSigmaSelectedNode,
  } = useSigma({
    onNodeClick: handleNodeClick,
    onNodeHover: handleNodeHover,
    onStageClick: handleStageClick,
    highlightedNodeIds: effectiveHighlightedNodeIds,
    blastRadiusNodeIds: effectiveBlastRadiusNodeIds,
    blastRadiusDepth: blast?.depthById,
    animatedNodes: effectiveAnimatedNodes,
    visibleEdgeTypes,
    layoutMode: graphViewMode,
    noForceLayout: showHulls,
  });

  // Folder/module boundary regions — only in Force view, where the folder
  // clustering applies and hulls are tight.
  useFolderHulls({
    sigmaRef,
    canvasRef: hullCanvasRef,
    enabled: showHulls && graphViewMode === 'force',
  });

  const handleViewModeChange = useCallback(
    (mode: 'force' | 'tree' | 'circles') => {
      if (mode === graphViewMode) return;
      setSelectedNode(null);
      setSigmaSelectedNode(null);
      setHoveredNodeName(null);
      setGraphViewMode(mode);
      // Reset zoom when switching views
      resetZoom();
    },
    [graphViewMode, resetZoom, setGraphViewMode, setSelectedNode, setSigmaSelectedNode],
  );

  // Expose focusNode to parent via ref
  useImperativeHandle(
    ref,
    () => ({
      focusNode: (nodeId: string) => {
        // Also update app state so the selection syncs properly
        if (graph) {
          const node = nodeById.get(nodeId);
          if (node) {
            setSelectedNode(node);
            openCodePanel();
          }
        }
        focusNode(nodeId);
      },
    }),
    [focusNode, graph, nodeById, setSelectedNode, openCodePanel],
  );

  // Update Sigma graph when KnowledgeGraph changes
  useEffect(() => {
    if (!graph) return;

    let sigmaGraph: Graph<SigmaNodeAttributes, SigmaEdgeAttributes>;

    if (graphViewMode === 'tree') {
      sigmaGraph = knowledgeGraphToTreeGraphology(graph);
    } else if (graphViewMode === 'circles') {
      sigmaGraph = knowledgeGraphToCirclesGraphology(graph);
    } else {
      // Build community memberships map from MEMBER_OF relationships
      const communityMemberships = new Map<string, number>();
      graph.relationships.forEach((rel) => {
        if (rel.type === 'MEMBER_OF') {
          const communityNode = nodeById.get(rel.targetId);
          if (communityNode && communityNode.label === 'Community') {
            const numericPart = rel.targetId.replace('comm_', '');
            const communityIdx = /^\d+$/.test(numericPart) ? parseInt(numericPart, 10) : 0;
            communityMemberships.set(rel.sourceId, communityIdx);
          }
        }
      });
      // When folder boundaries are on, cluster by folder instead of community
      // so the hulls wrap tight groups.
      sigmaGraph = knowledgeGraphToGraphology(
        graph,
        showHulls ? folderMemberships : communityMemberships,
      );
    }

    setSigmaGraph(sigmaGraph);
  }, [graph, nodeById, setSigmaGraph, graphViewMode, showHulls, folderMemberships]);

  // Update node visibility when filters change
  useEffect(() => {
    const sigma = sigmaRef.current;
    if (!sigma) return;

    const sigmaGraph = sigma.getGraph() as Graph<SigmaNodeAttributes, SigmaEdgeAttributes>;
    if (sigmaGraph.order === 0) return; // Don't filter empty graph

    filterGraphByDepth(sigmaGraph, appSelectedNode?.id || null, depthFilter, visibleLabels);
    sigma.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sigmaRef identity never changes
  }, [graph, graphViewMode, visibleLabels, depthFilter, appSelectedNode]);

  // Sync app selected node with sigma
  useEffect(() => {
    if (appSelectedNode) {
      setSigmaSelectedNode(appSelectedNode.id);
    } else {
      setSigmaSelectedNode(null);
    }
  }, [appSelectedNode, setSigmaSelectedNode]);

  // Drop a stale blast radius when the selection moves to a different symbol.
  useEffect(() => {
    setBlast((prev) => (prev && prev.targetId !== appSelectedNode?.id ? null : prev));
  }, [appSelectedNode?.id]);

  // Select a symbol by name and open its blast radius. If the name is ambiguous,
  // the highest-impact match wins. Returns false when no symbol matches.
  const applyBlastByName = useCallback(
    (name: string): boolean => {
      if (!graph) return false;
      const matches = graph.nodes.filter(
        (n) => n.properties?.name?.toLowerCase() === name.toLowerCase(),
      );
      if (matches.length === 0) return false;
      let best = matches[0];
      let bestResult = computeBlastRadius(graph, best.id, { direction: 'upstream' });
      for (const cand of matches.slice(1)) {
        const r = computeBlastRadius(graph, cand.id, { direction: 'upstream' });
        if (r.totalCount > bestResult.totalCount) {
          best = cand;
          bestResult = r;
        }
      }
      setSelectedNode(best);
      setBlast(bestResult);
      // Fit the whole graph so the spread of red "heat" across the blast radius
      // is visible, rather than zooming into the single target.
      resetZoom();
      // Keep the graph (and its heat-map) in view — don't pop the code panel.
      setCodePanelOpen(false);
      return true;
    },
    [graph, setSelectedNode, resetZoom, setCodePanelOpen],
  );

  // Deep link `?blast=<symbolName>` auto-opens that symbol's blast radius once
  // the graph loads — shareable "what breaks if I change X" links / one-click
  // demos. Also exposes `window.__ygBlast(name)` for the same purpose.
  const demoBlastAppliedRef = useRef<string | null>(null);
  useEffect(() => {
    (window as unknown as { __ygBlast?: (name: string) => boolean }).__ygBlast = applyBlastByName;
    if (!graph) return;
    const wanted = new URLSearchParams(window.location.search).get('blast');
    if (wanted && demoBlastAppliedRef.current !== wanted && applyBlastByName(wanted)) {
      demoBlastAppliedRef.current = wanted;
    }
  }, [graph, applyBlastByName]);

  // Focus on selected node
  const handleFocusSelected = useCallback(() => {
    if (appSelectedNode) {
      focusNode(appSelectedNode.id);
    }
  }, [appSelectedNode, focusNode]);

  // Clear selection
  const handleClearSelection = useCallback(() => {
    setSelectedNode(null);
    setSigmaSelectedNode(null);
    setBlast(null);
    resetZoom();
  }, [setSelectedNode, setSigmaSelectedNode, resetZoom]);

  return (
    <div className="relative h-full w-full bg-void">
      {/* Background gradient */}
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(circle at 50% 50%, rgba(124, 58, 237, 0.03) 0%, transparent 70%),
              linear-gradient(to bottom, #06060a, #0a0a10)
            `,
          }}
        />
      </div>

      {/* View Mode Tabs */}
      <div
        role="tablist"
        aria-label={t('canvas.viewModes.label')}
        className="absolute top-4 left-1/2 z-20 flex -translate-x-1/2 gap-1 rounded-lg border border-border-subtle bg-elevated/90 p-1 backdrop-blur-sm"
      >
        <button
          role="tab"
          aria-selected={graphViewMode === 'force'}
          onClick={() => handleViewModeChange('force')}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
            graphViewMode === 'force'
              ? 'bg-accent text-white'
              : 'text-text-secondary hover:bg-hover hover:text-text-primary'
          }`}
        >
          <Network className="h-3.5 w-3.5" />
          {t('canvas.viewModes.force')}
        </button>
        <button
          role="tab"
          aria-selected={graphViewMode === 'tree'}
          onClick={() => handleViewModeChange('tree')}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
            graphViewMode === 'tree'
              ? 'bg-accent text-white'
              : 'text-text-secondary hover:bg-hover hover:text-text-primary'
          }`}
        >
          <GitBranch className="h-3.5 w-3.5" />
          {t('canvas.viewModes.tree')}
        </button>
        <button
          role="tab"
          aria-selected={graphViewMode === 'circles'}
          onClick={() => handleViewModeChange('circles')}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
            graphViewMode === 'circles'
              ? 'bg-accent text-white'
              : 'text-text-secondary hover:bg-hover hover:text-text-primary'
          }`}
        >
          <Target className="h-3.5 w-3.5" />
          {t('canvas.viewModes.circles')}
        </button>
      </div>

      {/* Sigma container */}
      <div
        ref={containerRef}
        className="sigma-container h-full w-full cursor-grab active:cursor-grabbing"
      />

      {/* Folder/module boundary overlay (drawn above the graph, below the panels) */}
      <canvas ref={hullCanvasRef} className="pointer-events-none absolute inset-0 z-[5]" />

      {/* Hovered node tooltip - only show when NOT selected */}
      {hoveredNodeName && !sigmaSelectedNode && (
        <div className="pointer-events-none absolute top-4 left-1/2 z-20 -translate-x-1/2 animate-fade-in rounded-lg border border-border-subtle bg-elevated/95 px-3 py-1.5 backdrop-blur-sm">
          <span className="font-mono text-sm text-text-primary">{hoveredNodeName}</span>
        </div>
      )}

      {/* Selection info bar */}
      {sigmaSelectedNode && appSelectedNode && (
        <div className="absolute top-4 left-1/2 z-20 flex -translate-x-1/2 animate-slide-up items-center gap-2 rounded-xl border border-accent/30 bg-accent/20 px-4 py-2 backdrop-blur-sm">
          <div className="h-2 w-2 animate-pulse rounded-full bg-accent" />
          <span className="font-mono text-sm text-text-primary">
            {appSelectedNode.properties.name}
          </span>
          <span className="text-xs text-text-muted">({appSelectedNode.label})</span>
          <button
            onClick={handleBlastRadius}
            className="ml-2 flex items-center gap-1 rounded-md border border-red-500/40 bg-red-500/15 px-2 py-0.5 text-xs font-medium text-red-300 transition-colors hover:bg-red-500/25"
            title="Show what breaks if you change this symbol"
          >
            <Zap className="h-3 w-3" />
            Blast radius
          </button>
          <button
            onClick={handleClearSelection}
            className="rounded px-2 py-0.5 text-xs text-text-secondary transition-colors hover:bg-white/10 hover:text-text-primary"
          >
            {t('canvas.clear')}
          </button>
        </div>
      )}

      {/* Blast-radius summary panel */}
      {blast && (
        <BlastRadiusPanel
          result={blast}
          onClose={() => setBlast(null)}
          onFocusNode={(nodeId) => focusNode(nodeId)}
        />
      )}

      {/* Graph Controls - Bottom Right */}
      <div className="absolute right-4 bottom-4 z-10 flex flex-col gap-1">
        <button
          onClick={zoomIn}
          className="flex h-9 w-9 items-center justify-center rounded-md border border-border-subtle bg-elevated text-text-secondary transition-colors hover:bg-hover hover:text-text-primary"
          title={t('canvas.zoomIn')}
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        <button
          onClick={zoomOut}
          className="flex h-9 w-9 items-center justify-center rounded-md border border-border-subtle bg-elevated text-text-secondary transition-colors hover:bg-hover hover:text-text-primary"
          title={t('canvas.zoomOut')}
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <button
          onClick={resetZoom}
          className="flex h-9 w-9 items-center justify-center rounded-md border border-border-subtle bg-elevated text-text-secondary transition-colors hover:bg-hover hover:text-text-primary"
          title={t('canvas.fit')}
        >
          <Maximize2 className="h-4 w-4" />
        </button>

        {/* Divider */}
        <div className="my-1 h-px bg-border-subtle" />

        {/* Focus on selected */}
        {appSelectedNode && (
          <button
            onClick={handleFocusSelected}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-accent/30 bg-accent/20 text-accent transition-colors hover:bg-accent/30"
            title={t('canvas.focusSelected')}
          >
            <Focus className="h-4 w-4" />
          </button>
        )}

        {/* Clear selection */}
        {sigmaSelectedNode && (
          <button
            onClick={handleClearSelection}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-border-subtle bg-elevated text-text-secondary transition-colors hover:bg-hover hover:text-text-primary"
            title={t('canvas.clearSelection')}
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        )}

        {/* Divider */}
        <div className="my-1 h-px bg-border-subtle" />

        {/* Layout control */}
        <button
          onClick={isLayoutRunning ? stopLayout : startLayout}
          className={`flex h-9 w-9 items-center justify-center rounded-md border transition-all ${
            isLayoutRunning
              ? 'animate-pulse border-accent bg-accent text-white shadow-glow'
              : 'border-border-subtle bg-elevated text-text-secondary hover:bg-hover hover:text-text-primary'
          } `}
          title={isLayoutRunning ? t('canvas.stopLayout') : t('canvas.runLayout')}
        >
          {isLayoutRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>

        {/* Folder boundaries toggle */}
        <button
          onClick={() => {
            const next = !showHulls;
            setShowHulls(next);
            if (next && graphViewMode !== 'force') setGraphViewMode('force');
          }}
          className={`flex h-9 w-9 items-center justify-center rounded-md border transition-all ${
            showHulls
              ? 'border-accent bg-accent/20 text-accent'
              : 'border-border-subtle bg-elevated text-text-secondary hover:bg-hover hover:text-text-primary'
          }`}
          title={showHulls ? 'Hide folder boundaries' : 'Show folder boundaries'}
          data-testid="folder-hulls-toggle"
        >
          <Boxes className="h-4 w-4" />
        </button>
      </div>

      {/* Layout running indicator */}
      {isLayoutRunning && (
        <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 animate-fade-in items-center gap-2 rounded-full border border-accent/30 bg-accent/20 px-3 py-1.5 backdrop-blur-sm">
          <div className="h-2 w-2 animate-ping rounded-full bg-accent" />
          <span className="text-xs font-medium text-accent">
            {t('canvas.layoutOptimizing')}
          </span>
        </div>
      )}

      {/* Query FAB */}
      <QueryFAB />

      {/* AI Highlights toggle - Top Right */}
      <div className="absolute top-4 right-4 z-20">
        <button
          onClick={handleToggleAIHighlights}
          className={
            isAIHighlightsEnabled
              ? 'flex h-10 w-10 items-center justify-center rounded-lg border border-cyan-400/40 bg-cyan-500/15 text-cyan-200 transition-colors hover:border-cyan-300/60 hover:bg-cyan-500/20'
              : 'flex h-10 w-10 items-center justify-center rounded-lg border border-border-subtle bg-elevated text-text-muted transition-colors hover:bg-hover hover:text-text-primary'
          }
          title={
            isAIHighlightsEnabled ? t('canvas.turnOffHighlights') : t('canvas.turnOnHighlights')
          }
          data-testid="ai-highlights-toggle"
        >
          {isAIHighlightsEnabled ? (
            <Lightbulb className="h-4 w-4" />
          ) : (
            <LightbulbOff className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );
});

GraphCanvas.displayName = 'GraphCanvas';
