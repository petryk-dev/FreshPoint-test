import { getFoldOrigins } from './backtest.js';
import { BACKTEST_OPTIONS, DEFAULT_PARAMS, GRID, HAMPEL_OPTIONS, HORIZON } from './config.js';
import { nextWeeks } from './dates.js';
import { gridSearchHolt } from './gridSearch.js';
import { hampel } from './hampel.js';
import { fitHolt, forecastHolt, type HoltParams } from './holt.js';
import type { Metrics } from './metrics.js';

export interface SalesPoint {
  timestamp: string;
  value: number;
}

export interface PredictionResult {
  createdAt: string;
  forecast: SalesPoint[];
  model: {
    name: 'damped-holt';
    params: HoltParams;
    tuning: 'grid-search' | 'default';
    backtest: { metrics: Metrics; folds: number } | null;
  };
  /** Timestamps of weeks replaced by the Hampel filter before fitting. */
  adjustedWeeks: string[];
}

export interface PredictOptions {
  now?: Date;
}

const METRIC_DECIMALS = 4;

const round = (x: number, decimals: number): number => {
  const factor = 10 ** decimals;
  return Math.round(x * factor) / factor;
};

const roundMetrics = (metrics: Metrics): Metrics => ({
  mae: round(metrics.mae, METRIC_DECIMALS),
  mape: round(metrics.mape, METRIC_DECIMALS),
  wape: round(metrics.wape, METRIC_DECIMALS),
  bias: round(metrics.bias, METRIC_DECIMALS),
});

/**
 * Forecasts the next HORIZON weeks. Expects points that are already validated and sorted by time.
 * Series too short to backtest fall back to DEFAULT_PARAMS instead of being rejected.
 */
export const predict = (
  points: readonly SalesPoint[],
  { now = new Date() }: PredictOptions = {},
): PredictionResult => {
  const values = points.map((p) => p.value);
  const timestamps = points.map((p) => p.timestamp);

  const { cleaned, outlierIndices } = hampel(values, HAMPEL_OPTIONS);

  let params = DEFAULT_PARAMS;
  let tuning: PredictionResult['model']['tuning'] = 'default';
  let backtest: PredictionResult['model']['backtest'] = null;

  if (values.length >= BACKTEST_OPTIONS.minTrain + HORIZON) {
    const best = gridSearchHolt(values, {
      ...BACKTEST_OPTIONS,
      grid: GRID,
      hampelOptions: HAMPEL_OPTIONS,
      excludeIndices: new Set(outlierIndices),
    });
    params = best.params;
    tuning = 'grid-search';
    backtest = {
      metrics: roundMetrics(best.metrics),
      folds: getFoldOrigins(values.length, BACKTEST_OPTIONS).length,
    };
  }

  const state = fitHolt(cleaned, params);
  const forecastValues = forecastHolt(state, HORIZON, params.phi).map((x) =>
    Math.max(0, Math.round(x)),
  );
  const forecastDates = nextWeeks(timestamps.at(-1)!, HORIZON);

  return {
    createdAt: now.toISOString(),
    forecast: forecastDates.map((timestamp, i) => ({ timestamp, value: forecastValues[i]! })),
    model: { name: 'damped-holt', params, tuning, backtest },
    adjustedWeeks: outlierIndices.map((i) => timestamps[i]!),
  };
};
