export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Returns `count` dates following `lastTimestamp`, 7 days apart, as ISO strings.
 * Works in UTC milliseconds, so local DST changes can't shift the time of day.
 */
export const nextWeeks = (lastTimestamp: string, count: number): string[] => {
  const start = new Date(lastTimestamp).getTime();
  if (Number.isNaN(start)) {
    throw new Error(`nextWeeks: invalid date "${lastTimestamp}"`);
  }
  if (!Number.isInteger(count) || count < 0) {
    throw new Error(`nextWeeks: count must be a non-negative integer, got ${count}`);
  }

  return Array.from({ length: count }, (_, i) => new Date(start + (i + 1) * WEEK_MS).toISOString());
};
