import { nextWeeks } from '../src/forecast/dates.js';
import type { SalesPoint } from '../src/forecast/pipeline.js';

/** n consecutive weekly points, the first one on `start`. */
export const weeks = (n: number, start = '2020-01-06T00:00:00.000Z'): SalesPoint[] =>
  [start, ...nextWeeks(start, Math.max(0, n - 1))]
    .slice(0, n)
    .map((timestamp, i) => ({ timestamp, value: 1000 + i }));
