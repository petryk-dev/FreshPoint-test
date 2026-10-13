import { hampel, type HampelOptions } from './hampel.js';
import { computeMetrics, type Metrics } from './metrics.js';
import type { Forecaster } from './types.js';

export interface FoldOptions {
  horizon?: number;
  minTrain?: number;
  step?: number;
  maxFolds?: number;
}

export interface BacktestOptions extends FoldOptions {
  /** Global indices excluded from metrics (e.g. anomalous weeks). The model still sees them in training. */
  excludeIndices?: ReadonlySet<number>;
}

export interface Fold {
  origin: number;
  actual: number[];
  forecast: number[];
  /** null when every point of the fold was excluded. */
  metrics: Metrics | null;
}

export interface BacktestResult {
  folds: Fold[];
  metrics: Metrics;
}

/** Cleans the history with Hampel before forecasting, so each fold cleans only its own training data. */
export const withCleaning =
  (forecaster: Forecaster, hampelOptions?: HampelOptions): Forecaster =>
  (history, horizon) =>
    forecaster(hampel(history, hampelOptions).cleaned, horizon);

/**
 * Returns fold origins in ascending order. An origin is the training size of a fold:
 * train = values[0, origin), test = values[origin, origin + horizon).
 */
export const getFoldOrigins = (
  n: number,
  { horizon = 10, minTrain = 52, step = 4, maxFolds = 12 }: FoldOptions = {},
): number[] => {
  if (horizon < 1 || step < 1) {
    throw new Error('getFoldOrigins: horizon and step must be at least 1');
  }

  const origins: number[] = [];
  for (let origin = n - horizon; origin >= minTrain && origins.length < maxFolds; origin -= step) {
    origins.push(origin);
  }

  return origins.reverse();
};

export const backtest = (
  values: readonly number[],
  forecaster: Forecaster,
  { excludeIndices = new Set(), ...foldOptions }: BacktestOptions = {},
): BacktestResult => {
  const { horizon = 10, minTrain = 52 } = foldOptions;
  const origins = getFoldOrigins(values.length, foldOptions);
  if (origins.length === 0) {
    throw new Error(
      `backtest: series of length ${values.length} is too short, need at least minTrain + horizon = ${minTrain + horizon}`,
    );
  }

  const pooledActual: number[] = [];
  const pooledForecast: number[] = [];

  const folds = origins.map((origin): Fold => {
    const fullActual = values.slice(origin, origin + horizon);
    const fullForecast = forecaster(values.slice(0, origin), horizon);

    const actual: number[] = [];
    const forecast: number[] = [];
    fullActual.forEach((a, j) => {
      if (excludeIndices.has(origin + j)) return;
      actual.push(a);
      forecast.push(fullForecast[j]!);
    });

    pooledActual.push(...actual);
    pooledForecast.push(...forecast);

    return {
      origin,
      actual,
      forecast,
      metrics: actual.length > 0 ? computeMetrics(actual, forecast) : null,
    };
  });

  if (pooledActual.length === 0) {
    throw new Error('backtest: all test points are excluded');
  }

  return { folds, metrics: computeMetrics(pooledActual, pooledForecast) };
};
