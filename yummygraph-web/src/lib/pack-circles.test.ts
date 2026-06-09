import { describe, it, expect } from 'vitest';
import { packCircles } from './graph-adapter';

describe('packCircles', () => {
  const items = [
    { id: 0, r: 120 },
    { id: 1, r: 90 },
    { id: 2, r: 60 },
    { id: 3, r: 60 },
    { id: 4, r: 40 },
    { id: 5, r: 30 },
    { id: 6, r: 25 },
    { id: 7, r: 20 },
  ];

  it('places the first (largest) circle at the origin', () => {
    const pos = packCircles(items, 50);
    expect(pos.get(0)).toEqual({ x: 0, y: 0 });
  });

  it('returns a position for every item', () => {
    const pos = packCircles(items, 50);
    expect(pos.size).toBe(items.length);
  });

  it('produces no overlapping circles (respecting the gap)', () => {
    const gap = 50;
    const pos = packCircles(items, gap);
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = pos.get(items[i].id)!;
        const b = pos.get(items[j].id)!;
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const minDist = items[i].r + items[j].r + gap;
        // Allow a tiny epsilon for float comparison.
        expect(dist).toBeGreaterThanOrEqual(minDist - 1e-6);
      }
    }
  });

  it('is deterministic for the same input', () => {
    const a = packCircles(items, 50);
    const b = packCircles(items, 50);
    for (const { id } of items) {
      expect(a.get(id)).toEqual(b.get(id));
    }
  });
});
