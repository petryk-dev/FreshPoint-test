import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { PredictionResult } from '../../src/forecast/pipeline.js';
import { FilePredictionStore } from '../../src/store/filePredictionStore.js';
import { InMemoryPredictionStore } from '../../src/store/inMemoryPredictionStore.js';
import type { PredictionStore } from '../../src/store/predictionStore.js';

const prediction = (createdAt: string): PredictionResult => ({
  createdAt,
  forecast: [
    { timestamp: '2021-06-28T00:00:00.000Z', value: 15427 },
    { timestamp: '2021-07-05T00:00:00.000Z', value: 15564 },
  ],
  model: {
    name: 'damped-holt',
    params: { alpha: 0.2, beta: 0.05, phi: 1 },
    tuning: 'grid-search',
    backtest: { metrics: { mae: 1405, mape: 0.1158, wape: 0.1132, bias: -319 }, folds: 10 },
  },
  adjustedWeeks: ['2020-12-21T00:00:00.000Z'],
});

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'prediction-store-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe.each<[string, () => PredictionStore]>([
  ['InMemoryPredictionStore', () => new InMemoryPredictionStore()],
  ['FilePredictionStore', () => new FilePredictionStore(join(dir, 'prediction.json'))],
])('%s', (_, createStore) => {
  it('returns null before anything is saved', async () => {
    expect(await createStore().getLatest()).toBeNull();
  });

  it('returns the saved prediction', async () => {
    const store = createStore();
    await store.save(prediction('2021-07-01T00:00:00.000Z'));

    expect(await store.getLatest()).toEqual(prediction('2021-07-01T00:00:00.000Z'));
  });

  it('returns the most recently saved prediction', async () => {
    const store = createStore();
    await store.save(prediction('2021-07-01T00:00:00.000Z'));
    await store.save(prediction('2021-07-02T00:00:00.000Z'));

    expect((await store.getLatest())?.createdAt).toBe('2021-07-02T00:00:00.000Z');
  });
});

describe('FilePredictionStore', () => {
  it('survives a restart', async () => {
    const filePath = join(dir, 'prediction.json');
    await new FilePredictionStore(filePath).save(prediction('2021-07-01T00:00:00.000Z'));

    expect(await new FilePredictionStore(filePath).getLatest()).toEqual(
      prediction('2021-07-01T00:00:00.000Z'),
    );
  });

  it('creates a missing directory', async () => {
    const store = new FilePredictionStore(join(dir, 'nested', 'dir', 'prediction.json'));
    await store.save(prediction('2021-07-01T00:00:00.000Z'));

    expect(await store.getLatest()).not.toBeNull();
  });

  it('leaves no temp files behind', async () => {
    const store = new FilePredictionStore(join(dir, 'prediction.json'));
    await Promise.all([
      store.save(prediction('2021-07-01T00:00:00.000Z')),
      store.save(prediction('2021-07-02T00:00:00.000Z')),
    ]);

    expect(await readdir(dir)).toEqual(['prediction.json']);
  });

  it('throws on a corrupted file instead of returning null', async () => {
    const filePath = join(dir, 'prediction.json');
    await writeFile(filePath, '{not json');

    await expect(new FilePredictionStore(filePath).getLatest()).rejects.toThrow(SyntaxError);
  });
});
