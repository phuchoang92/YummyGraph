/**
 * Draws translucent, labeled boundary regions around the nodes of each
 * folder/module on the graph, so the codebase's structure is readable instead
 * of one undifferentiated cloud.
 *
 * Implementation: a separate overlay <canvas> layered over the sigma container.
 * On every sigma render frame (and camera move) it groups the currently-visible
 * code-symbol nodes by their directory (`filePath`), converts each member's
 * position to screen pixels via sigma's coordinate API, builds a padded convex
 * hull (d3-polygon), and renders it as a smooth closed Catmull-Rom blob
 * (d3-shape) with a folder-name label. Reading live positions each frame keeps
 * the hulls aligned through pan/zoom/layout with no extra wiring.
 *
 * Works in every layout (Force / Tree / Circles); folder members sit together
 * in all three, so the regions stay tight.
 *
 * Styling is theme-aware: the label pill/text colors are read from the active
 * theme's CSS custom properties and refreshed when the theme changes.
 */
import { useEffect } from 'react';
import type { RefObject } from 'react';
import type Sigma from 'sigma';
import type Graph from 'graphology';
import { polygonHull, polygonCentroid, polygonContains } from 'd3-polygon';
import { line, curveCatmullRomClosed } from 'd3-shape';
import type { SigmaNodeAttributes, SigmaEdgeAttributes } from '../lib/graph-adapter';
import { COMMUNITY_COLORS } from '../lib/constants';

const GROUP_MAX = 24; // draw at most this many folders (largest by member count)
const MIN_NODES = 3; // a hull needs at least 3 points
const PAD = 20; // px of breathing room around member nodes
const FILL_ALPHA = 0.15;
const STROKE_ALPHA = 0.9;
const STROKE_WIDTH = 2.5;
const HOVER_STROKE_WIDTH = 4; // thicker outline on the hovered folder

// Fallbacks if the theme variables can't be read (match the Dark palette).
const FALLBACK_PILL = '#131c16';
const FALLBACK_TEXT = '#c8ddd2';

type Point = [number, number];
interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface UseFolderHullsArgs {
  // Untyped Sigma to match what useSigma returns; the graph is cast below.
  sigmaRef: RefObject<Sigma | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  enabled: boolean;
}

// Only hull the code symbols (these are what the folder-clustered layout groups
// together) — including files/folders/properties would scatter the hull.
const HULL_TYPES = new Set(['Function', 'Class', 'Method', 'Interface']);

export const folderKeyOf = (filePath: string): string | null => {
  if (!filePath) return null;
  const slash = filePath.lastIndexOf('/');
  // File at repo root → its own group key ('').
  return slash >= 0 ? filePath.slice(0, slash) : '';
};

export const shortLabel = (folderKey: string): string => {
  if (folderKey === '') return '/';
  const seg = folderKey.slice(folderKey.lastIndexOf('/') + 1);
  return seg || folderKey;
};

// Folder name + member count, e.g. `auth · 12`.
export const formatHullLabel = (name: string, count: number): string => `${name} · ${count}`;

// Axis-aligned bounding-box overlap test, used to skip colliding labels.
export const rectsOverlap = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

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

    // Theme-aware label colors, refreshed whenever the active theme changes.
    const theme = { pill: FALLBACK_PILL, text: FALLBACK_TEXT };
    const readTheme = () => {
      const cs = getComputedStyle(document.documentElement);
      const pill = cs.getPropertyValue('--color-elevated').trim();
      const text = cs.getPropertyValue('--color-text-primary').trim();
      if (pill) theme.pill = pill;
      if (text) theme.text = text;
    };
    readTheme();

    // Cursor position in container pixels (null when outside) — drives the
    // hover affordance (full path + thicker outline).
    let mouse: Point | null = null;

    // Smooth closed-curve generator that emits path commands to our 2D context.
    const drawCurve = line<Point>()
      .x((p) => p[0])
      .y((p) => p[1])
      .curve(curveCatmullRomClosed)
      .context(ctx);

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

      // Pass 1 — build the padded hull for each folder (drop degenerate ones).
      interface Hull {
        key: string;
        hull: Point[];
        count: number;
        color: string;
      }
      const hulls: Hull[] = [];
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
        hulls.push({ key, hull, count: pts.length, color: groupColor.get(key) || colorFor(key) });
      }

      // Which folder is under the cursor? Later (smaller) hulls draw on top, so
      // the last containing hull wins.
      let hoveredIdx = -1;
      if (mouse) {
        for (let i = 0; i < hulls.length; i++) {
          if (polygonContains(hulls[i].hull, mouse)) hoveredIdx = i;
        }
      }

      ctx.lineJoin = 'round';
      ctx.font = '600 12px JetBrains Mono, monospace';

      // Pass 2 — fill + stroke each smooth blob.
      hulls.forEach(({ hull, color }, i) => {
        ctx.beginPath();
        drawCurve(hull);
        ctx.fillStyle = hexToRgba(color, FILL_ALPHA);
        ctx.fill();
        ctx.lineWidth = i === hoveredIdx ? HOVER_STROKE_WIDTH : STROKE_WIDTH;
        ctx.strokeStyle = hexToRgba(color, STROKE_ALPHA);
        ctx.stroke();
      });

      // Pass 3 — labels: a dark pill at each hull centroid. Larger folders are
      // placed first; a smaller folder's label is skipped if it would collide
      // (the hovered folder always shows, with its full path).
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const placed: Rect[] = [];
      hulls.forEach(({ key, hull, count, color }, i) => {
        const hovered = i === hoveredIdx;
        const text = hovered ? (key === '' ? '/' : key) : formatHullLabel(shortLabel(key), count);
        const [lx, ly] = polygonCentroid(hull);
        const tw = ctx.measureText(text).width;
        const padX = 6;
        const padY = 4;
        const bw = tw + padX * 2;
        const bh = 12 + padY * 2;
        const rect: Rect = { x: lx - bw / 2, y: ly - bh / 2, w: bw, h: bh };

        if (!hovered && placed.some((r) => rectsOverlap(rect, r))) return;
        placed.push(rect);

        ctx.fillStyle = hexToRgba(theme.pill, 0.85);
        ctx.beginPath();
        ctx.roundRect(rect.x, rect.y, bw, bh, 4);
        ctx.fill();
        ctx.strokeStyle = hexToRgba(color, hovered ? 0.95 : 0.7);
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = theme.text;
        ctx.fillText(text, lx, ly);
      });
    };

    const onMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mouse = [e.clientX - rect.left, e.clientY - rect.top];
      draw();
    };
    const onLeave = () => {
      mouse = null;
      draw();
    };

    const camera = sigma.getCamera();
    sigma.on('afterRender', draw);
    camera.on('updated', draw);
    const ro = new ResizeObserver(draw);
    ro.observe(container);
    container.addEventListener('mousemove', onMove);
    container.addEventListener('mouseleave', onLeave);
    // Refresh label colors when the theme attribute on <html> flips.
    const mo = new MutationObserver(() => {
      readTheme();
      draw();
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    draw();

    return () => {
      sigma.off('afterRender', draw);
      camera.off('updated', draw);
      ro.disconnect();
      container.removeEventListener('mousemove', onMove);
      container.removeEventListener('mouseleave', onLeave);
      mo.disconnect();
      clear();
    };
  }, [sigmaRef, canvasRef, enabled]);
};
