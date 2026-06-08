/**
 * Blast-radius summary panel — the human-readable "what breaks if I change
 * this" view that accompanies the red heat highlight on the graph. Surfaces the
 * numbers that make impact tangible: total dependents, direct vs transitive,
 * clusters touched, and a risk rating, plus a clickable list to jump to any
 * affected symbol.
 */
import { Zap, X, AlertTriangle } from '@/lib/lucide-icons';
import type { BlastRadiusResult } from '../lib/blast-radius';
import { blastDepthColor, riskColor } from '../lib/blast-radius';

interface BlastRadiusPanelProps {
  result: BlastRadiusResult;
  onClose: () => void;
  onFocusNode: (nodeId: string) => void;
}

const depthBucketLabel = (depth: number): string => {
  if (depth === 1) return 'Direct dependents';
  return `${depth} hops away`;
};

export const BlastRadiusPanel = ({ result, onClose, onFocusNode }: BlastRadiusPanelProps) => {
  const risk = riskColor(result.risk);

  // Group impacted nodes by depth for a scannable list.
  const byDepth = new Map<number, typeof result.nodes>();
  for (const node of result.nodes) {
    const bucket = byDepth.get(node.depth);
    if (bucket) bucket.push(node);
    else byDepth.set(node.depth, [node]);
  }
  const depths = Array.from(byDepth.keys()).sort((a, b) => a - b);

  return (
    <div className="absolute top-4 left-4 z-30 flex max-h-[calc(100%-2rem)] w-80 animate-slide-up flex-col rounded-xl border border-border-subtle bg-elevated/95 shadow-2xl backdrop-blur-md">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-red-400" />
          <span className="text-sm font-semibold text-text-primary">Blast Radius</span>
        </div>
        <button
          onClick={onClose}
          className="rounded p-1 text-text-muted transition-colors hover:bg-white/10 hover:text-text-primary"
          title="Clear blast radius"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Headline */}
      <div className="px-4 py-3">
        <p className="text-xs text-text-secondary">
          Changing{' '}
          <span className="font-mono text-text-primary">{result.targetName}</span>{' '}
          <span className="text-text-muted">({result.targetLabel})</span> could affect
        </p>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-4xl font-bold text-text-primary tabular-nums">
            {result.totalCount}
          </span>
          <span className="text-sm text-text-secondary">
            symbol{result.totalCount === 1 ? '' : 's'}
          </span>
          <span
            className="ml-auto rounded-md border px-2 py-0.5 text-xs font-semibold"
            style={{ color: risk.text, backgroundColor: risk.bg, borderColor: risk.border }}
          >
            {result.risk}
          </span>
        </div>
        {result.totalCount === 0 && (
          <p className="mt-2 text-xs text-text-muted">
            No dependents found — this symbol is safe to change in isolation.
          </p>
        )}
      </div>

      {/* Stat grid */}
      {result.totalCount > 0 && (
        <div className="grid grid-cols-3 gap-px border-y border-border-subtle bg-border-subtle text-center">
          <div className="bg-elevated px-2 py-2">
            <div className="text-lg font-semibold text-text-primary tabular-nums">
              {result.directCount}
            </div>
            <div className="text-[10px] uppercase tracking-wide text-text-muted">Direct</div>
          </div>
          <div className="bg-elevated px-2 py-2">
            <div className="text-lg font-semibold text-text-primary tabular-nums">
              {result.clusterCount}
            </div>
            <div className="text-[10px] uppercase tracking-wide text-text-muted">Clusters</div>
          </div>
          <div className="bg-elevated px-2 py-2">
            <div className="text-lg font-semibold text-text-primary tabular-nums">
              {result.maxDepth}
            </div>
            <div className="text-[10px] uppercase tracking-wide text-text-muted">Max depth</div>
          </div>
        </div>
      )}

      {result.truncated && (
        <div className="flex items-center gap-1.5 px-4 py-2 text-[11px] text-amber-300/90">
          <AlertTriangle className="h-3 w-3 shrink-0" />
          Result capped — this is a high-impact hub; more dependents exist.
        </div>
      )}

      {/* Affected symbols, grouped by depth */}
      {result.totalCount > 0 && (
        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {depths.map((depth) => (
            <div key={depth} className="mb-2">
              <div className="flex items-center gap-1.5 px-2 py-1">
                <span
                  className="h-2.5 w-2.5 rounded-sm"
                  style={{ backgroundColor: blastDepthColor(depth) }}
                />
                <span className="text-[10px] font-medium uppercase tracking-wide text-text-muted">
                  {depthBucketLabel(depth)} · {byDepth.get(depth)!.length}
                </span>
              </div>
              <ul>
                {byDepth.get(depth)!.map((node) => (
                  <li key={node.id}>
                    <button
                      onClick={() => onFocusNode(node.id)}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left transition-colors hover:bg-white/5"
                      title={`Focus ${node.name}`}
                    >
                      <span className="truncate font-mono text-xs text-text-primary">
                        {node.name}
                      </span>
                      <span className="ml-auto shrink-0 text-[10px] text-text-muted">
                        {node.label}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
