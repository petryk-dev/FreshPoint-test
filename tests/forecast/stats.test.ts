import { describe, expect, it } from 'vitest';
import { mad, median } from '../../src/forecast/stats.js';

describe('median', () => {
  it('returns the middle element for odd length', () => {
    expect(median([3, 1, 2])).toBe(2);
  });

  it('returns the average of the two central elements for even length', () => {
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });

  it('sorts numerically, not as strings', () => {
    expect(median([10, 9, 100])).toBe(10);
  });

  it('throws on empty array', () => {
    expect(() => median([])).toThrow();
  });

  it('does not mutate the input', () => {
    const values = [3, 1, 2];
    median(values);
    expect(values).toEqual([3, 1, 2]);
  });
});

describe('mad', () => {
  it('uses the median as center by default', () => {
    expect(mad([11998, 11777, 12430, 4667, 3854, 13081, 11722])).toBe(653);
  });

  it('uses the provided center', () => {
    expect(mad([1, 2, 3], 0)).toBe(2);
  });

  it('throws on empty array', () => {
    expect(() => mad([])).toThrow();
  });
});
