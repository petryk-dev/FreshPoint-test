import { describe, expect, it } from 'vitest';
import { nextWeeks } from '../../src/forecast/dates.js';

describe('nextWeeks', () => {
  it('returns subsequent weeks in the input format', () => {
    const weeks = nextWeeks('2021-06-21T00:00:00.000Z', 10);

    expect(weeks).toHaveLength(10);
    expect(weeks[0]).toBe('2021-06-28T00:00:00.000Z');
    expect(weeks.at(-1)).toBe('2021-08-30T00:00:00.000Z');
  });

  it('crosses the year boundary', () => {
    expect(nextWeeks('2020-12-28T00:00:00.000Z', 2)).toEqual([
      '2021-01-04T00:00:00.000Z',
      '2021-01-11T00:00:00.000Z',
    ]);
  });

  it('is not shifted by a daylight saving time change', () => {
    expect(nextWeeks('2021-03-22T00:00:00.000Z', 1)).toEqual(['2021-03-29T00:00:00.000Z']);
  });

  it('returns empty array for count 0', () => {
    expect(nextWeeks('2021-06-21T00:00:00.000Z', 0)).toEqual([]);
  });

  it('throws on an invalid date', () => {
    expect(() => nextWeeks('not-a-date', 1)).toThrow('invalid date');
  });

  it('throws on a negative or fractional count', () => {
    expect(() => nextWeeks('2021-06-21T00:00:00.000Z', -1)).toThrow();
    expect(() => nextWeeks('2021-06-21T00:00:00.000Z', 1.5)).toThrow();
  });
});
