import { backtest, withCleaning, type BacktestOptions } from './backtest.js';
import type { HampelOptions } from './hampel.js';
import { holtForecast, type HoltParams } from './holt.js';
import type { Metrics } from './metrics.js';

export interface HoltGrid {
  alpha: readonly number[];
  beta: readonly number[];
  phi: readonly number[];
}

export interface GridSearchOptions extends BacktestOptions {
  grid?: HoltGrid;
  /** Hampel options used to clean each fold's training data. */
  hampelOptions?: HampelOptions;
}

export interface GridSearchResult {
  params: HoltParams;
  metrics: Metrics;
  evaluated: number;
}

const DECIMALS = 4;

/**
 * Inclusive range from start to end. Each value is computed as start + i·step and rounded,
 * so floating-point error doesn't accumulate or drop the last value.
 */
export const range = (start: number, end: number, step: number): number[] => {
  if (!(step > 0)) {
    throw new Error(`range: step must be positive, got ${step}`);
  }

  const count = Math.floor((end - start) / step + 1e-9) + 1;
  const factor = 10 ** DECIMALS;
  return Array.from(
    { length: Math.max(0, count) },
    (_, i) => Math.round((start + i * step) * factor) / factor,
  );
};

export const DEFAULT_GRID: HoltGrid = {
  alpha: range(0.05, 0.95, 0.05),
  beta: range(0.05, 0.5, 0.05),
  phi: range(0.8, 1, 0.02),
};

/** Picks Holt params with the lowest backtest WAPE. Ties keep the first combination found. */
export const gridSearchHolt = (
  values: readonly number[],
  { grid = DEFAULT_GRID, hampelOptions, ...backtestOptions }: GridSearchOptions = {},
): GridSearchResult => {
  let best: { params: HoltParams; metrics: Metrics } | undefined;
  let evaluated = 0;

  for (const alpha of grid.alpha) {
    for (const beta of grid.beta) {
      for (const phi of grid.phi) {
        const params = { alpha, beta, phi };
        const forecaster = withCleaning(
          (history, horizon) => holtForecast(history, params, horizon),
          hampelOptions,
        );
        const { metrics } = backtest(values, forecaster, backtestOptions);
        evaluated++;

        if (best === undefined || metrics.wape < best.metrics.wape) {
          best = { params, metrics };
        }
      }
    }
  }

  if (best === undefined) {
    throw new Error('gridSearchHolt: grid must not be empty');
  }

  return { ...best, evaluated };
};
