import { describe, expect, it } from 'vitest';
import { hampel } from '../../src/forecast/hampel.js';

describe('hampel', () => {
  it('replaces the Easter dip with the window median', () => {
    const { cleaned, outlierIndices } = hampel([
      2067, 2283, 1929, 3237, 1110, 2615, 2520, 2456, 2534,
    ]);

    expect(outlierIndices).toEqual([4]);
    expect(cleaned[4]).toBe(2456);
    expect(cleaned[3]).toBe(3237);
  });

  it('replaces both Christmas dips', () => {
    const { cleaned, outlierIndices } = hampel([
      11810, 11998, 11777, 12430, 4667, 3854, 13081, 11722, 11300, 12824,
    ]);

    expect(outlierIndices).toEqual([4, 5]);
    expect(cleaned[4]).toBe(11777);
    expect(cleaned[5]).toBe(11722);
  });

  it('protects the tail by default', () => {
    const values = [100, 102, 98, 101, 99, 100, 10];

    expect(hampel(values).outlierIndices).toEqual([]);

    const { cleaned, outlierIndices } = hampel(values, { protectTail: 0 });
    expect(outlierIndices).toEqual([6]);
    expect(cleaned[6]).toBe(99.5);
  });

  it('skips points whose window has zero MAD', () => {
    const { cleaned, outlierIndices } = hampel([5, 5, 5, 5, 5, 9, 5, 5, 5, 5, 5]);

    expect(outlierIndices).toEqual([]);
    expect(cleaned[5]).toBe(9);
  });

  it('does not mutate the input', () => {
    const values = [11810, 11998, 11777, 12430, 4667, 3854, 13081, 11722, 11300, 12824];
    const copy = [...values];

    hampel(values);

    expect(values).toEqual(copy);
  });

  it('returns empty result for empty input', () => {
    expect(hampel([])).toEqual({ cleaned: [], outlierIndices: [] });
  });
});
