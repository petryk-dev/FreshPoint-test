import { describe, expect, it } from 'vitest';
import { backtest, getFoldOrigins, withCleaning } from '../../src/forecast/backtest.js';
import { drift, naive } from '../../src/forecast/baselines.js';
import { hampel } from '../../src/forecast/hampel.js';
import type { Forecaster } from '../../src/forecast/types.js';

const spy = (inner: Forecaster = naive) => {
  const calls: number[][] = [];
  const forecaster: Forecaster = (history, horizon) => {
    calls.push([...history]);
    return inner(history, horizon);
  };
  return { forecaster, calls };
};

describe('getFoldOrigins', () => {
  it('is limited by minTrain with defaults', () => {
    expect(getFoldOrigins(100)).toEqual([54, 58, 62, 66, 70, 74, 78, 82, 86, 90]);
  });

  it('returns at most maxFolds for long series, the last ending at the end of data', () => {
    const origins = getFoldOrigins(500);

    expect(origins).toHaveLength(12);
    expect(origins.at(-1)).toBe(490);
  });

  it('returns no folds when the series is too short', () => {
    expect(getFoldOrigins(61)).toEqual([]);
    expect(getFoldOrigins(62)).toEqual([52]);
  });
});

describe('backtest', () => {
  it('passes each fold only its training data (no leakage)', () => {
    const values = Array.from({ length: 100 }, (_, i) => i);
    const { forecaster, calls } = spy();

    const { folds } = backtest(values, forecaster);

    expect(calls).toHaveLength(folds.length);
    folds.forEach((fold, k) => {
      expect(calls[k]).toEqual(values.slice(0, fold.origin));
    });
  });

  it('gives zero error for a linear series with drift', () => {
    const values = Array.from({ length: 100 }, (_, i) => 100 + 10 * i);

    expect(backtest(values, drift()).metrics.mae).toBe(0);
  });

  it('does not penalize excluded indices', () => {
    const values = Array.from({ length: 62 }, () => 100);
    values[55] = 1000;

    expect(backtest(values, naive).metrics.mae).toBeGreaterThan(0);

    const { folds, metrics } = backtest(values, naive, { excludeIndices: new Set([55]) });
    expect(metrics.mae).toBe(0);
    expect(folds[0]!.actual).toHaveLength(9);
  });

  it('pools all pairs instead of averaging fold metrics', () => {
    // Fold 1 (origin 52) has all but one point excluded, fold 2 (origin 56) is full.
    const values = Array.from({ length: 66 }, (_, i) => (i === 52 ? 110 : 100));
    const exclude = new Set([53, 54, 55]);

    const { folds, metrics } = backtest(values, naive, {
      horizon: 10,
      step: 4,
      excludeIndices: exclude,
    });

    expect(folds.map((f) => f.origin)).toEqual([52, 56]);
    // 7 pairs from fold 1 (one with error 10), 10 pairs from fold 2 (no error).
    expect(metrics.mae).toBeCloseTo(10 / 17);
  });

  it('sets fold metrics to null when the whole fold is excluded', () => {
    const values = Array.from({ length: 66 }, () => 100);
    const exclude = new Set([54, 55, 56, 57]);

    const { folds } = backtest(values, naive, { horizon: 4, excludeIndices: exclude, maxFolds: 4 });

    expect(folds[0]).toMatchObject({ origin: 54, actual: [], metrics: null });
  });

  it('throws when the series is too short', () => {
    expect(() =>
      backtest(
        Array.from({ length: 61 }, () => 1),
        naive,
      ),
    ).toThrow('too short');
  });
});

describe('withCleaning', () => {
  it('passes the forecaster a history with outliers replaced', () => {
    const history = [100, 102, 98, 101, 99, 1000, 100, 102, 98, 101, 99];
    const { forecaster, calls } = spy();

    withCleaning(forecaster)(history, 1);

    expect(calls[0]![5]).not.toBe(1000);
    expect(calls[0]).toEqual(hampel(history).cleaned);
    expect(history[5]).toBe(1000);
  });
});
