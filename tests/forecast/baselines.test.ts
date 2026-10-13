import { describe, expect, it } from 'vitest';
import { drift, movingAverage, naive } from '../../src/forecast/baselines.js';
import type { Forecaster } from '../../src/forecast/types.js';

describe('naive', () => {
  it('repeats the last value', () => {
    expect(naive([1, 2, 3], 3)).toEqual([3, 3, 3]);
  });
});

describe('movingAverage', () => {
  it('averages the last window values', () => {
    expect(movingAverage(4)([10, 20, 30, 40, 50], 2)).toEqual([35, 35]);
  });

  it('uses all values when history is shorter than the window', () => {
    expect(movingAverage(4)([10, 20], 1)).toEqual([15]);
  });
});

describe('drift', () => {
  it('extrapolates the slope over the lookback', () => {
    expect(drift(8)([100, 110, 120, 130, 140, 150, 160, 170, 180], 2)).toEqual([190, 200]);
  });

  it('uses the oldest value when history is shorter than the lookback', () => {
    expect(drift(8)([100, 110, 120], 2)).toEqual([130, 140]);
  });

  it('returns a flat forecast for a single value', () => {
    expect(drift(8)([42], 2)).toEqual([42, 42]);
  });
});

describe('all baselines', () => {
  const forecasters: [string, Forecaster][] = [
    ['naive', naive],
    ['movingAverage', movingAverage()],
    ['drift', drift()],
  ];

  it.each(forecasters)('%s throws on empty history', (_, forecast) => {
    expect(() => forecast([], 1)).toThrow();
  });

  it.each(forecasters)('%s returns empty array for horizon 0', (_, forecast) => {
    expect(forecast([1, 2, 3], 0)).toEqual([]);
  });
});
