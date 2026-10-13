import { describe, expect, it } from 'vitest';
import { DEFAULT_GRID, gridSearchHolt, range } from '../../src/forecast/gridSearch.js';

const line = Array.from({ length: 70 }, (_, i) => 100 + 10 * i);

describe('range', () => {
  it('generates exact values without floating-point drift', () => {
    const values = range(0.05, 0.95, 0.05);

    expect(values).toHaveLength(19);
    expect(values.at(-1)).toBe(0.95);
    expect(values).toContain(0.15);
  });

  it('includes both ends', () => {
    expect(range(0.8, 1, 0.02)).toEqual([
      0.8, 0.82, 0.84, 0.86, 0.88, 0.9, 0.92, 0.94, 0.96, 0.98, 1,
    ]);
  });

  it('throws on non-positive step', () => {
    expect(() => range(0, 1, 0)).toThrow();
  });
});

describe('DEFAULT_GRID', () => {
  it('has 2090 combinations', () => {
    expect(DEFAULT_GRID.alpha).toHaveLength(19);
    expect(DEFAULT_GRID.beta).toHaveLength(10);
    expect(DEFAULT_GRID.phi).toHaveLength(11);
  });
});

describe('gridSearchHolt', () => {
  it('evaluates every combination', () => {
    const grid = { alpha: [0.2, 0.5], beta: [0.1, 0.3], phi: [0.8, 0.9, 1] };

    expect(gridSearchHolt(line, { grid }).evaluated).toBe(12);
  });

  it('selects an undamped trend for a straight line', () => {
    const grid = { alpha: [0.3, 0.6], beta: [0.1, 0.3], phi: [0.8, 1] };

    const { params, metrics } = gridSearchHolt(line, { grid });

    expect(params.phi).toBe(1);
    expect(metrics.wape).toBeCloseTo(0, 10);
  });

  it('keeps the first of equally good combinations', () => {
    // On a straight line every phi = 1 combination is perfect, so the first one wins.
    const grid = { alpha: [0.3, 0.6], beta: [0.1, 0.3], phi: [1] };

    expect(gridSearchHolt(line, { grid }).params).toEqual({ alpha: 0.3, beta: 0.1, phi: 1 });
  });

  it('is deterministic', () => {
    const noisy = line.map((y, i) => y + ((i * 37) % 11) - 5);
    const grid = { alpha: [0.2, 0.5, 0.8], beta: [0.1, 0.3], phi: [0.9, 1] };

    expect(gridSearchHolt(noisy, { grid })).toEqual(gridSearchHolt(noisy, { grid }));
  });

  it('throws on an empty grid', () => {
    expect(() => gridSearchHolt(line, { grid: { alpha: [], beta: [0.1], phi: [1] } })).toThrow();
  });
});
