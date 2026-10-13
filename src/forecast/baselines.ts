import { mean } from './stats.js';
import type { Forecaster } from './types.js';

const assertNonEmpty = (name: string, history: readonly number[]): void => {
  if (history.length === 0) {
    throw new Error(`${name}: history must not be empty`);
  }
};

export const naive: Forecaster = (history, horizon) => {
  assertNonEmpty('naive', history);

  return Array.from({ length: horizon }, () => history.at(-1)!);
};

export const movingAverage =
  (window = 4): Forecaster =>
  (history, horizon) => {
    assertNonEmpty('movingAverage', history);

    const avg = mean(history.slice(-window));
    return Array.from({ length: horizon }, () => avg);
  };

export const drift =
  (lookback = 8): Forecaster =>
  (history, horizon) => {
    assertNonEmpty('drift', history);

    const last = history.at(-1)!;
    const steps = Math.min(lookback, history.length - 1);
    const slope = steps === 0 ? 0 : (last - history.at(-1 - steps)!) / steps;

    return Array.from({ length: horizon }, (_, i) => last + (i + 1) * slope);
  };
