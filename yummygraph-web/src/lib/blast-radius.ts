/**
 * Client-side blast-radius computation.
 *
 * "What breaks if I change this symbol?" — a BFS over the already-loaded
 * knowledge graph that finds every symbol transitively depending on a target.
 * Runs entirely in the browser against the in-memory graphology data, so it
 * works in both browser-only and backend-connected modes with no extra request.
 *
 * Direction:
 *   - `upstream`   (default) — dependents: who CALLS / IMPORTS / EXTENDS the
 *                  target. These are the things that can break when it changes.
 *   - `downstream` — dependencies: what the target itself relies on.
 */
import type { KnowledgeGraph } from '../core/graph/types';

export type BlastDirection = 'upstream' | 'downstream';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/**
 * Relationship types that represent a *dependency* (one symbol relies on
 * another), as opposed to structural containment (CONTAINS / DEFINES /
 * MEMBER_OF / HAS_METHOD …). Changing a target only "breaks" symbols connected
 * through these edges. Unknown types simply never match, so this stays safe as
 * the schema grows.
 */
export const DEPENDENCY_EDGE_TYPES = new Set<string>([
  'CALLS', // caller → callee
  'IMPORTS', // importer → imported
  'USES', // user → used symbol
  'ACCESSES', // accessor → accessed field/property
  'EXTENDS', // subclass → superclass
  'IMPLEMENTS', // implementer → interface
  'INHERITS', // subclass → superclass
  'METHOD_OVERRIDES', // overriding method → base method
  'METHOD_IMPLEMENTS', // implementing method → interface method
  'DECORATES', // decorator → decorated symbol
  'WRAPS', // wrapper → wrapped symbol
]);

export interface BlastNode {
  id: string;
  name: string;
  label: string;
  /** Hops from the target. 1 = direct dependent, 2+ = transitive. */
  depth: number;
  /** Community/cluster index, or null if the symbol isn't clustered. */
  community: number | null;
}

export interface BlastRadiusResult {
  targetId: string;
  targetName: string;
  targetLabel: string;
  direction: BlastDirection;
  /** All impacted node ids (excludes the target itself). */
  idSet: Set<string>;
  /** id → hop distance, for depth-graded colouring. */
  depthById: Map<string, number>;
  /** Impacted nodes, sorted by depth then name. */
  nodes: BlastNode[];
  /** Depth-1 (direct) dependents. */
  directCount: number;
  /** Total impacted symbols. */
  totalCount: number;
  maxDepth: number;
  /** Distinct clusters the blast radius touches. */
  clusterCount: number;
  risk: RiskLevel;
  /** True when traversal was stopped by the node cap (result is partial). */
  truncated: boolean;
}

const DEFAULT_MAX_DEPTH = 8;
/** Visual/perf safety cap — a hub symbol can have thousands of dependents. */
const DEFAULT_MAX_NODES = 1500;

const riskFor = (total: number, clusterCount: number): RiskLevel => {
  if (total >= 50 || clusterCount >= 5) return 'CRITICAL';
  if (total >= 15) return 'HIGH';
  if (total >= 5) return 'MEDIUM';
  return 'LOW';
};

/**
 * Build a map of symbol id → community index from MEMBER_OF edges, mirroring
 * the logic GraphCanvas uses to colour communities.
 */
const buildCommunityMap = (graph: KnowledgeGraph): Map<string, number> => {
  const communityById = new Map<string, number>();
  for (const rel of graph.relationships) {
    if (rel.type !== 'MEMBER_OF') continue;
    const numericPart = rel.targetId.replace('comm_', '');
    const idx = /^\d+$/.test(numericPart) ? parseInt(numericPart, 10) : 0;
    communityById.set(rel.sourceId, idx);
  }
  return communityById;
};

export const computeBlastRadius = (
  graph: KnowledgeGraph,
  targetId: string,
  opts: { direction?: BlastDirection; maxDepth?: number; maxNodes?: number } = {},
): BlastRadiusResult => {
  const direction = opts.direction ?? 'upstream';
  const maxDepth = opts.maxDepth ?? DEFAULT_MAX_DEPTH;
  const maxNodes = opts.maxNodes ?? DEFAULT_MAX_NODES;

  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
  const communityById = buildCommunityMap(graph);

  // Adjacency over dependency edges only.
  // upstream  → step target→source (find who depends on the current node)
  // downstream→ step source→target (find what the current node depends on)
  const adjacency = new Map<string, string[]>();
  for (const rel of graph.relationships) {
    if (!DEPENDENCY_EDGE_TYPES.has(rel.type)) continue;
    const [from, to] =
      direction === 'upstream' ? [rel.targetId, rel.sourceId] : [rel.sourceId, rel.targetId];
    const bucket = adjacency.get(from);
    if (bucket) bucket.push(to);
    else adjacency.set(from, [to]);
  }

  const depthById = new Map<string, number>();
  const visited = new Set<string>([targetId]);
  let frontier: string[] = [targetId];
  let depth = 0;
  let truncated = false;

  while (frontier.length > 0 && depth < maxDepth && !truncated) {
    depth += 1;
    const next: string[] = [];
    for (const id of frontier) {
      const neighbors = adjacency.get(id);
      if (!neighbors) continue;
      for (const neighbor of neighbors) {
        if (visited.has(neighbor)) continue;
        visited.add(neighbor);
        depthById.set(neighbor, depth);
        next.push(neighbor);
        if (visited.size - 1 >= maxNodes) {
          truncated = true;
          break;
        }
      }
      if (truncated) break;
    }
    frontier = next;
  }

  const nodes: BlastNode[] = [];
  const clusters = new Set<number>();
  for (const [id, d] of depthById) {
    const node = nodeById.get(id);
    if (!node) continue;
    const community = communityById.has(id) ? (communityById.get(id) as number) : null;
    if (community !== null) clusters.add(community);
    nodes.push({
      id,
      name: node.properties?.name ?? id,
      label: node.label,
      depth: d,
      community,
    });
  }

  nodes.sort((a, b) => a.depth - b.depth || a.name.localeCompare(b.name));

  const directCount = nodes.filter((n) => n.depth === 1).length;
  const totalCount = nodes.length;
  const maxReached = nodes.reduce((m, n) => Math.max(m, n.depth), 0);
  const clusterCount = clusters.size;
  const target = nodeById.get(targetId);

  return {
    targetId,
    targetName: target?.properties?.name ?? targetId,
    targetLabel: target?.label ?? 'Symbol',
    direction,
    idSet: new Set(depthById.keys()),
    depthById,
    nodes,
    directCount,
    totalCount,
    maxDepth: maxReached,
    clusterCount,
    risk: riskFor(totalCount, clusterCount),
    truncated,
  };
};

/**
 * Depth → colour for the "heat" gradient: hottest (red) for direct dependents,
 * cooling to orange/amber for deeper transitive impact. Shared by the canvas
 * renderer and the summary panel legend so they stay in sync.
 */
export const blastDepthColor = (depth: number): string => {
  switch (depth) {
    case 1:
      return '#ef4444'; // red-500 — direct
    case 2:
      return '#f97316'; // orange-500
    case 3:
      return '#f59e0b'; // amber-500
    case 4:
      return '#eab308'; // yellow-500
    default:
      return '#a16207'; // yellow-700 — distant
  }
};

export const riskColor = (risk: RiskLevel): { text: string; bg: string; border: string } => {
  switch (risk) {
    case 'CRITICAL':
      return { text: '#fca5a5', bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.4)' };
    case 'HIGH':
      return { text: '#fdba74', bg: 'rgba(249,115,22,0.15)', border: 'rgba(249,115,22,0.4)' };
    case 'MEDIUM':
      return { text: '#fcd34d', bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.4)' };
    case 'LOW':
      return { text: '#6ee7b7', bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.4)' };
  }
};
