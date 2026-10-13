import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GRID } from '../../src/forecast/config.js';
import { nextWeeks } from '../../src/forecast/dates.js';
import { predict, type SalesPoint } from '../../src/forecast/pipeline.js';

const now = new Date('2021-07-01T12:00:00.000Z');

const toPoints = (values: number[]): SalesPoint[] => {
  const timestamps = nextWeeks('2019-12-30T00:00:00.000Z', values.length);
  return values.map((value, i) => ({ timestamp: timestamps[i]!, value }));
};

const dataPath = new URL('../../data/weekly-sales.json', import.meta.url);

describe.skipIf(!existsSync(dataPath))('predict on real data', () => {
  const points = () => JSON.parse(readFileSync(dataPath, 'utf8')) as SalesPoint[];

  it('produces a plausible grid-searched forecast', { timeout: 30_000 }, () => {
    const started = performance.now();
    const result = predict(points(), { now });
    console.log(`predict on real data: ${Math.round(performance.now() - started)} ms`);

    expect(result.forecast).toHaveLength(10);
    expect(result.forecast[0]!.timestamp).toBe('2021-06-28T00:00:00.000Z');
    for (const { value } of result.forecast) {
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(12_000);
      expect(value).toBeLessThanOrEqual(25_000);
    }

    expect(result.adjustedWeeks).toContain('2020-12-28T00:00:00.000Z');
    expect(result.adjustedWeeks).toContain('2020-12-21T00:00:00.000Z');

    const { params, tuning, backtest } = result.model;
    expect(tuning).toBe('grid-search');
    expect(backtest).not.toBeNull();
    expect(GRID.alpha).toContain(params.alpha);
    expect(GRID.beta).toContain(params.beta);
    expect(GRID.phi).toContain(params.phi);
  });
});

describe('predict on synthetic data', () => {
  it('falls back to default params for a short series', () => {
    const points = toPoints(Array.from({ length: 20 }, (_, i) => 1000 + 5 * i));

    const result = predict(points, { now });

    expect(result.model.tuning).toBe('default');
    expect(result.model.backtest).toBeNull();
    expect(result.forecast).toHaveLength(10);
    expect(result.forecast[0]!.timestamp).toBe(nextWeeks(points.at(-1)!.timestamp, 1)[0]);
  });

  it('never forecasts negative sales', () => {
    const points = toPoints(Array.from({ length: 30 }, (_, i) => 3000 - 100 * i));

    const { forecast } = predict(points, { now });

    expect(forecast.at(-1)!.value).toBe(0);
    for (const { value } of forecast) {
      expect(value).toBeGreaterThanOrEqual(0);
    }
  });

  it('reports adjusted weeks', () => {
    const values = Array.from({ length: 20 }, (_, i) => 1000 + ((i * 37) % 11));
    values[8] = 100;
    const points = toPoints(values);

    expect(predict(points, { now }).adjustedWeeks).toEqual([points[8]!.timestamp]);
  });

  it('is deterministic for the same now', { timeout: 30_000 }, () => {
    const points = toPoints(Array.from({ length: 70 }, (_, i) => 1000 + 10 * i + ((i * 37) % 11)));

    const first = predict(points, { now });

    expect(first.model.tuning).toBe('grid-search');
    expect(first.createdAt).toBe(now.toISOString());
    expect(predict(points, { now })).toEqual(first);
  });

  it('does not mutate the input', () => {
    const points = toPoints(Array.from({ length: 20 }, (_, i) => (i === 8 ? 100 : 1000 + i)));
    const copy = structuredClone(points);

    predict(points, { now });

    expect(points).toEqual(copy);
  });
});
