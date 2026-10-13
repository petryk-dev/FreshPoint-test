import { readFileSync } from 'node:fs';
import request from 'supertest';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import type { SalesPoint } from '../src/forecast/pipeline.js';
import { InMemoryPredictionStore } from '../src/store/inMemoryPredictionStore.js';
import type { PredictionStore } from '../src/store/predictionStore.js';
import { weeks } from './helpers.js';

const read = (name: string) => readFileSync(new URL(`../data/${name}`, import.meta.url), 'utf8');

/** Short enough to skip grid search (tuning = "default"), so these requests are instant. */
const shortSeries = weeks(20);

let realJson: SalesPoint[];
let realCsv: string;
let store: InMemoryPredictionStore;
let app: ReturnType<typeof createApp>;

beforeAll(() => {
  realJson = JSON.parse(read('weekly-sales.json')) as SalesPoint[];
  realCsv = read('predict.csv');
});

beforeEach(() => {
  store = new InMemoryPredictionStore();
  app = createApp({ store });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('main scenario', () => {
  it('GET /prediction before any POST returns 404', async () => {
    const res = await request(app).get('/prediction');

    expect(res.status).toBe(404);
    expect(res.body.error).toContain('POST /predict');
  });

  it(
    'POST JSON forecasts, GET returns it, CSV gives the same forecast',
    { timeout: 30_000 },
    async () => {
      const posted = await request(app).post('/predict').send(realJson);

      expect(posted.status).toBe(200);
      expect(posted.body.forecast).toHaveLength(10);
      expect(posted.body.forecast[0].timestamp).toBe('2021-06-28T00:00:00.000Z');
      expect(posted.body.model.tuning).toBe('grid-search');
      expect(posted.body.adjustedWeeks).toContain('2020-12-21T00:00:00.000Z');

      const latest = await request(app).get('/prediction');
      expect(latest.status).toBe(200);
      expect(latest.body).toEqual(posted.body);

      const fromCsv = await request(app)
        .post('/predict')
        .set('Content-Type', 'text/csv')
        .send(realCsv);
      expect(fromCsv.status).toBe(200);
      expect(fromCsv.body.forecast).toEqual(posted.body.forecast);
      expect(fromCsv.body.model).toEqual(posted.body.model);
    },
  );
});

describe('errors', () => {
  it('returns 400 with details for a negative value', async () => {
    const invalid = shortSeries.map((p, i) => (i === 3 ? { ...p, value: -5 } : p));

    const res = await request(app).post('/predict').send(invalid);

    expect(res.status).toBe(400);
    expect(res.body.details).toContainEqual(expect.objectContaining({ path: '3.value' }));
  });

  it('a failed request does not overwrite the previous forecast', async () => {
    const first = await request(app).post('/predict').send(shortSeries);
    expect(first.status).toBe(200);
    expect(first.body.model.tuning).toBe('default');

    const failed = await request(app).post('/predict').send(shortSeries.slice(0, 5));
    expect(failed.status).toBe(400);

    const latest = await request(app).get('/prediction');
    expect(latest.body).toEqual(first.body);
  });

  it('rejects text/plain with 415', async () => {
    const res = await request(app).post('/predict').set('Content-Type', 'text/plain').send('x');

    expect(res.status).toBe(415);
    expect(res.body).toEqual({ error: 'Use application/json or text/csv' });
  });

  it('rejects a POST without body and Content-Type with 415', async () => {
    const res = await request(app).post('/predict');

    expect(res.status).toBe(415);
  });

  it('returns 400 for malformed JSON', async () => {
    const res = await request(app)
      .post('/predict')
      .set('Content-Type', 'application/json')
      .send('{"a":');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid JSON body' });
  });

  it('returns JSON 404 for an unknown route', async () => {
    const res = await request(app).get('/nope');

    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body).toEqual({ error: 'Not Found' });
  });

  it('returns a generic 500 when the store fails', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const failingStore: PredictionStore = {
      save: () => Promise.reject(new Error('EACCES: permission denied, open /secret/path')),
      getLatest: () => Promise.resolve(null),
    };

    const res = await request(createApp({ store: failingStore }))
      .post('/predict')
      .send(shortSeries);

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Internal Server Error' });
    expect(res.text).not.toContain('/secret/path');
    expect(log).toHaveBeenCalled();
  });
});

describe('GET /health', () => {
  it('returns ok', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});
