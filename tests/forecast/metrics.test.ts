import { describe, expect, it } from 'vitest';
import { bias, computeMetrics, mae, mape, wape } from '../../src/forecast/metrics.js';

const actual = [12922, 14148, 13892, 14826];
const forecast = [13200, 13450, 13700, 13950];

describe('metrics', () => {
  it('mae', () => {
    expect(mae(actual, forecast)).toBe(511);
  });

  it('mape', () => {
    expect(mape(actual, forecast)).toBeCloseTo(0.0359, 4);
  });

  it('wape', () => {
    expect(wape(actual, forecast)).toBeCloseTo(0.0366, 4);
  });

  it('bias is negative when the model underestimates', () => {
    expect(bias(actual, forecast)).toBe(-372);
  });

  it('computeMetrics returns all metrics', () => {
    expect(computeMetrics(actual, forecast)).toEqual({
      mae: 511,
      mape: expect.closeTo(0.0359, 4),
      wape: expect.closeTo(0.0366, 4),
      bias: -372,
    });
  });

  it('mape skips pairs with zero actual', () => {
    expect(mape([0, 100], [10, 110])).toBeCloseTo(0.1);
  });

  it('mape throws when all actuals are zero', () => {
    expect(() => mape([0, 0], [1, 2])).toThrow();
  });

  it('wape throws when sum of actuals is zero', () => {
    expect(() => wape([0, 0], [1, 2])).toThrow();
  });

  it.each([mae, mape, wape, bias, computeMetrics])('%o validates input', (metric) => {
    expect(() => metric([1, 2], [1])).toThrow('equal length');
    expect(() => metric([], [])).toThrow('empty');
  });
});
