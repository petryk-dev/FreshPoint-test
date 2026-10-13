/**
 * Conventions for all metrics:
 * - argument order is (actual, forecast);
 * - error = forecast − actual, so a positive error means an overestimate;
 * - relative metrics are proportions (0.0366), not percentages (3.66).
 */
import { mean } from './stats.js';

export interface Metrics {
  mae: number;
  mape: number;
  wape: number;
  bias: number;
}

const errors = (name: string, actual: readonly number[], forecast: readonly number[]): number[] => {
  if (actual.length === 0) {
    throw new Error(`${name}: arrays must not be empty`);
  }
  if (actual.length !== forecast.length) {
    throw new Error(
      `${name}: actual and forecast must have equal length, got ${actual.length} and ${forecast.length}`,
    );
  }

  return actual.map((a, i) => forecast[i]! - a);
};

export const mae = (actual: readonly number[], forecast: readonly number[]): number =>
  mean(errors('mae', actual, forecast).map(Math.abs));

/** Pairs with actual = 0 are skipped to avoid division by zero. */
export const mape = (actual: readonly number[], forecast: readonly number[]): number => {
  const ratios = errors('mape', actual, forecast).flatMap((e, i) =>
    actual[i] === 0 ? [] : [Math.abs(e) / Math.abs(actual[i]!)],
  );
  if (ratios.length === 0) {
    throw new Error('mape: all actual values are zero');
  }

  return mean(ratios);
};

export const wape = (actual: readonly number[], forecast: readonly number[]): number => {
  const absErrorSum = errors('wape', actual, forecast).reduce((sum, e) => sum + Math.abs(e), 0);
  const actualSum = actual.reduce((sum, a) => sum + a, 0);
  if (actualSum === 0) {
    throw new Error('wape: sum of actual values is zero');
  }

  return absErrorSum / actualSum;
};

export const bias = (actual: readonly number[], forecast: readonly number[]): number =>
  mean(errors('bias', actual, forecast));

export const computeMetrics = (
  actual: readonly number[],
  forecast: readonly number[],
): Metrics => ({
  mae: mae(actual, forecast),
  mape: mape(actual, forecast),
  wape: wape(actual, forecast),
  bias: bias(actual, forecast),
});
