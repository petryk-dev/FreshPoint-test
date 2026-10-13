import { z } from 'zod';
import { WEEK_MS } from '../forecast/dates.js';
import type { SalesPoint } from '../forecast/pipeline.js';
import { ValidationError } from './errors.js';

/** Fewer points leave less than two Hampel windows and only a few Holt steps. */
export const MIN_POINTS = 12;
/** Guards against huge requests, together with the body size limit. */
export const MAX_POINTS = 10_000;

const DAY_MS = 24 * 60 * 60 * 1000;

const pointSchema = z.object({
  timestamp: z.iso.datetime(),
  value: z.number().min(0),
});

const salesSchema = z.array(pointSchema).min(MIN_POINTS).max(MAX_POINTS);

const fail = (path: string, message: string): never => {
  throw new ValidationError(message, [{ path, message }]);
};

const day = (timestamp: string) => timestamp.slice(0, 10);

/**
 * Validates each point with Zod, then checks the series as a whole: sorted by time,
 * no duplicate dates, exactly 7 days between neighbours. Returns a sorted copy.
 */
export const validateSalesInput = (body: unknown): SalesPoint[] => {
  const result = salesSchema.safeParse(body);
  if (!result.success) {
    throw new ValidationError(
      'Invalid sales data',
      result.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    );
  }

  // Keep original indices so errors point at the client's input, not the sorted copy.
  const sorted = result.data
    .map((point, index) => ({ point, index, time: new Date(point.timestamp).getTime() }))
    .sort((a, b) => a.time - b.time);

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!;
    const curr = sorted[i]!;
    const diff = curr.time - prev.time;
    const path = `${curr.index}.timestamp`;

    if (diff === 0) {
      fail(path, `Duplicate timestamp ${day(curr.point.timestamp)}`);
    }
    if (diff !== WEEK_MS) {
      const hint = diff > WEEK_MS ? ' (missing week?)' : '';
      fail(
        path,
        `Expected 7 days between ${day(prev.point.timestamp)} and ${day(curr.point.timestamp)}, got ${diff / DAY_MS}${hint}`,
      );
    }
  }

  return sorted.map(({ point }) => point);
};
