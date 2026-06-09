/**
 * Draws translucent, labeled boundary regions (convex hulls) around the nodes
 * of each folder/module on the graph, so the codebase's structure is readable
 * instead of one undifferentiated cloud.
 *
 * Implementation: a separate overlay <canvas> layered over the sigma container.
 * On every sigma render frame (and camera move) it groups the currently-visible
 * nodes by their directory (`filePath`), converts each member's position to
 * screen pixels via sigma's coordinate API, and draws a padded convex hull
 * (d3-polygon) with a folder-name label. Reading live positions each frame keeps
 * the hulls aligned through pan/zoom/layout with no extra wiring.
 *
 * Tightest in Tree/Circles layouts (folder members sit together); in Force
 * layout (which clusters by community) the regions are looser.
 */
import { useEffect } from 'react';
import type { RefObject } from 'react';
import type Sigma from 'sigma';
import type Graph from 'graphology';
import { polygonHull, polygonCentroid } from 'd3-polygon';
import type { SigmaNodeAttributes, SigmaEdgeAttributes } from '../lib/graph-adapter';
import { COMMUNITY_COLORS } from '../lib/constants';

const GROUP_MAX = 24; // draw at most this many folders (largest by member count)
const MIN_NODES = 3; // a hull needs at least 3 points
const PAD = 20; // px of breathing room around member nodes
const FILL_ALPHA = 0.15;
const STROKE_ALPHA = 0.9;
const STROKE_WIDTH = 2.5;

type Point = [number, number];

interface UseFolderHullsArgs {
  // Untyped Sigma to match what useSigma returns; the graph is cast below.
  sigmaRef: RefObject<Sigma | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  enabled: boolean;
}

// Only hull the code symbols (these are what the folder-clustered layout groups
// together) — including files/folders/properties would scatter the hull.
const HULL_TYPES = new Set(['Function', 'Class', 'Method', 'Interface']);

const folderKeyOf = (filePath: string): string | null => {
  if (!filePath) return null;
  const slash = filePath.lastIndexOf('/');
  // File at repo root → its own group key ('').
  return slash >= 0 ? filePath.slice(0, slash) : '';
};

const shortLabel = (folderKey: string): string => {
  if (folderKey === '') return '/';
  const seg = folderKey.slice(folderKey.lastIndexOf('/') + 1);
  return seg || folderKey;
};

// Deterministic color per folder from the shared community palette.
const colorFor = (folderKey: string): string => {
  let h = 0;
  for (let i = 0; i < folderKey.length; i++) h = (h * 31 + folderKey.charCodeAt(i)) | 0;
  return COMMUNITY_COLORS[Math.abs(h) % COMMUNITY_COLORS.length];
};

const hexToRgba = (hex: string, alpha: number): string => {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return `rgba(124,58,237,${alpha})`;
  return `rgba(${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)},${alpha})`;
};

export const useFolderHulls = ({ sigmaRef, canvasRef, enabled }: UseFolderHullsArgs): void => {
  useEffect(() => {
    const sigma = sigmaRef.current;
    const canvas = canvasRef.current;
    if (!sigma || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const container = sigma.getContainer();

    const clear = () => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    if (!enabled) {
      clear();
      return;
    }

    const draw = () => {
      const graph = sigma.getGraph() as Graph<SigmaNodeAttributes, SigmaEdgeAttributes>;
      const dpr = window.devicePixelRatio || 1;
      const w = container.clientWidth;
      const h = container.clientHeight;
      // Keep the backing store sized to the container (handles resize/zoom).
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      // Group visible code-symbol nodes by folder, collecting screen-space
      // points and a representative color (matches the folder-clustered node
      // color so hull and nodes agree).
      const groups = new Map<string, Point[]>();
      const groupColor = new Map<string, string>();
      graph.forEachNode((id, attrs) => {
        if (attrs.hidden) return;
        if (!HULL_TYPES.has(attrs.nodeType)) return;
        const key = folderKeyOf(attrs.filePath);
        if (key === null) return;
        const dd = sigma.getNodeDisplayData(id);
        if (!dd) return;
        const p = sigma.graphToViewport(dd);
        const bucket = groups.get(key);
        if (bucket) bucket.push([p.x, p.y]);
        else {
          groups.set(key, [[p.x, p.y]]);
          groupColor.set(key, attrs.color);
        }
      });

      // Largest N folders with enough points to form a hull.
      const ranked = Array.from(groups.entries())
        .filter(([, pts]) => pts.length >= MIN_NODES)
        .sort((a, b) => b[1].length - a[1].length)
        .slice(0, GROUP_MAX);

      ctx.lineJoin = 'round';
      ctx.lineWidth = STROKE_WIDTH;
      ctx.font = '600 12px JetBrains Mono, monospace';

      for (const [key, pts] of ranked) {
        // Pad outward from the centroid so the hull wraps the nodes loosely.
        const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
        const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
        const padded: Point[] = pts.map(([x, y]) => {
          const dx = x - cx;
          const dy = y - cy;
          const d = Math.hypot(dx, dy) || 1;
          return [x + (dx / d) * PAD, y + (dy / d) * PAD];
        });
        const hull = polygonHull(padded);
        if (!hull || hull.length < 3) continue;

        const color = groupColor.get(key) || colorFor(key);
        ctx.beginPath();
        ctx.moveTo(hull[0][0], hull[0][1]);
        for (let i = 1; i < hull.length; i++) ctx.lineTo(hull[i][0], hull[i][1]);
        ctx.closePath();
        ctx.fillStyle = hexToRgba(color, FILL_ALPHA);
        ctx.fill();
        ctx.strokeStyle = hexToRgba(color, STROKE_ALPHA);
        ctx.stroke();

        // Folder label on a dark pill at the hull centroid.
        const [lx, ly] = polygonCentroid(hull);
        const text = shortLabel(key);
        const tw = ctx.measureText(text).width;
        const padX = 6;
        const padY = 4;
        const bw = tw + padX * 2;
        const bh = 12 + padY * 2;
        ctx.fillStyle = 'rgba(18,18,28,0.85)';
        ctx.beginPath();
        ctx.roundRect(lx - bw / 2, ly - bh / 2, bw, bh, 4);
        ctx.fill();
        ctx.strokeStyle = hexToRgba(color, 0.7);
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = '#e4e4ed';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, lx, ly);
        ctx.lineWidth = STROKE_WIDTH; // restore for next hull
      }
    };

    const camera = sigma.getCamera();
    sigma.on('afterRender', draw);
    camera.on('updated', draw);
    const ro = new ResizeObserver(draw);
    ro.observe(container);
    draw();

    return () => {
      sigma.off('afterRender', draw);
      camera.off('updated', draw);
      ro.disconnect();
      clear();
    };
  }, [sigmaRef, canvasRef, enabled]);
};
