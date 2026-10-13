/**
 * All forecasting settings in one place, so the backtest and the final model
 * always clean and evaluate the data the same way.
 */
import type { BacktestOptions } from './backtest.js';
import { DEFAULT_GRID, type HoltGrid } from './gridSearch.js';
import type { HampelOptions } from './hampel.js';
import type { HoltParams } from './holt.js';

export const HORIZON = 10;

export const HAMPEL_OPTIONS: Required<HampelOptions> = {
  halfWindow: 3,
  threshold: 3,
  protectTail: 2,
};

export const BACKTEST_OPTIONS: Required<Omit<BacktestOptions, 'excludeIndices'>> = {
  horizon: HORIZON,
  minTrain: 52,
  step: 4,
  maxFolds: 12,
};

export const GRID: HoltGrid = DEFAULT_GRID;

/** Used when the series is too short to backtest. */
export const DEFAULT_PARAMS: HoltParams = { alpha: 0.3, beta: 0.1, phi: 0.9 };
