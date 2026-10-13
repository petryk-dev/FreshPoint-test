import { describe, expect, it } from 'vitest';
import {
  fitHolt,
  forecastHolt,
  holtForecast,
  holtStep,
  type HoltParams,
} from '../../src/forecast/holt.js';

const params: HoltParams = { alpha: 0.5, beta: 0.5, phi: 1 };

describe('holtStep', () => {
  it('updates level and trend', () => {
    // prediction = 10 + 2 = 12; level = 0.5·13 + 0.5·12 = 12.5; trend = 0.5·2.5 + 0.5·2 = 2.25
    expect(holtStep({ level: 10, trend: 2 }, 13, params)).toEqual({ level: 12.5, trend: 2.25 });
  });

  it('damps the trend with phi', () => {
    // prediction = 10 + 0.5·2 = 11; level = 0.5·11 + 0.5·11 = 11; trend = 0.5·1 + 0.5·0.5·2 = 1
    expect(holtStep({ level: 10, trend: 2 }, 11, { ...params, phi: 0.5 })).toEqual({
      level: 11,
      trend: 1,
    });
  });

  it('does not mutate the input state', () => {
    const state = { level: 10, trend: 2 };
    holtStep(state, 13, params);
    expect(state).toEqual({ level: 10, trend: 2 });
  });
});

describe('fitHolt', () => {
  it('tracks a perfectly linear series exactly', () => {
    expect(fitHolt([1, 2, 3, 4], params)).toEqual({ level: 4, trend: 1 });
  });

  it('initializes from the first two values', () => {
    expect(fitHolt([5, 8], params)).toEqual({ level: 8, trend: 3 });
  });

  it('throws on fewer than 2 values', () => {
    expect(() => fitHolt([], params)).toThrow();
    expect(() => fitHolt([1], params)).toThrow();
  });
});

describe('forecastHolt', () => {
  it('extrapolates a linear trend when phi = 1', () => {
    expect(forecastHolt({ level: 10, trend: 2 }, 3, 1)).toEqual([12, 14, 16]);
  });

  it('accumulates damped trend phi + phi² + … + phiʰ', () => {
    expect(forecastHolt({ level: 10, trend: 2 }, 3, 0.5)).toEqual([11, 11.5, 11.75]);
  });

  it('returns empty array for horizon 0', () => {
    expect(forecastHolt({ level: 10, trend: 2 }, 0, 1)).toEqual([]);
  });
});

describe('parameter validation', () => {
  const state = { level: 10, trend: 2 };

  it.each(['alpha', 'beta', 'phi'] as const)('rejects %s outside (0, 1]', (name) => {
    for (const bad of [0, -0.1, 1.1, Number.NaN]) {
      const p = { ...params, [name]: bad };
      expect(() => holtStep(state, 1, p)).toThrow(name);
      expect(() => fitHolt([1, 2], p)).toThrow(name);
    }
  });

  it('accepts the upper bound 1', () => {
    expect(() => holtStep(state, 1, { alpha: 1, beta: 1, phi: 1 })).not.toThrow();
  });

  it('rejects invalid phi in forecastHolt', () => {
    expect(() => forecastHolt(state, 3, 0)).toThrow('phi');
    expect(() => forecastHolt(state, 3, 1.5)).toThrow('phi');
  });
});

describe('holtForecast', () => {
  it('fits and forecasts in one call', () => {
    expect(holtForecast([1, 2, 3, 4], params, 2)).toEqual([5, 6]);
  });
});
