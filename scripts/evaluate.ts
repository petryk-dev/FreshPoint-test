/**
 * Evaluates the forecasting pipeline on real data: detected anomalies, grid search,
 * method comparison on identical folds, and the final forecast.
 *
 * Usage: npm run evaluate [-- path/to/weekly-sales.json]
 */
import { readFileSync } from 'node:fs';
import { backtest, withCleaning } from '../src/forecast/backtest.js';
import { drift, movingAverage, naive } from '../src/forecast/baselines.js';
import { BACKTEST_OPTIONS, DEFAULT_PARAMS, GRID, HAMPEL_OPTIONS } from '../src/forecast/config.js';
import { gridSearchHolt } from '../src/forecast/gridSearch.js';
import { hampel } from '../src/forecast/hampel.js';
import { holtForecast, type HoltParams } from '../src/forecast/holt.js';
import type { Metrics } from '../src/forecast/metrics.js';
import { predict, type SalesPoint } from '../src/forecast/pipeline.js';
import type { Forecaster } from '../src/forecast/types.js';

const dataPath = process.argv[2] ?? 'data/weekly-sales.json';
const points = JSON.parse(readFileSync(dataPath, 'utf8')) as SalesPoint[];
const values = points.map((p) => p.value);
const date = (i: number) => points[i]!.timestamp.slice(0, 10);

console.log(`Loaded ${points.length} weeks: ${date(0)} … ${date(points.length - 1)}\n`);

// Anomalies
const { cleaned, outlierIndices } = hampel(values, HAMPEL_OPTIONS);
console.log(`## Anomalies (${outlierIndices.length})\n`);
console.log('| date | original | replacement |');
console.log('| --- | ---: | ---: |');
for (const i of outlierIndices) {
  console.log(`| ${date(i)} | ${values[i]} | ${cleaned[i]} |`);
}

// Grid search
const excludeIndices = new Set(outlierIndices);
const started = performance.now();
const best = gridSearchHolt(values, {
  ...BACKTEST_OPTIONS,
  grid: GRID,
  hampelOptions: HAMPEL_OPTIONS,
  excludeIndices,
});
const elapsed = performance.now() - started;
console.log(`\n## Grid search\n`);
console.log(`Best params: ${JSON.stringify(best.params)}`);
console.log(`Evaluated ${best.evaluated} combinations in ${Math.round(elapsed)} ms\n`);

// Method comparison: same folds, same exclusions, same cleaning (except the ablation row)
const holt =
  (params: HoltParams): Forecaster =>
  (history, horizon) =>
    holtForecast(history, params, horizon);
const clean = (forecaster: Forecaster) => withCleaning(forecaster, HAMPEL_OPTIONS);

const methods: [string, Forecaster][] = [
  ['naive', clean(naive)],
  ['movingAverage(4)', clean(movingAverage(4))],
  ['drift(8)', clean(drift(8))],
  ['Holt, default params', clean(holt(DEFAULT_PARAMS))],
  ['Holt, tuned params', clean(holt(best.params))],
  ['Holt, tuned params, no cleaning', holt(best.params)],
];

const percent = (x: number) => `${(x * 100).toFixed(2)}%`;
const signed = (x: number) => `${x > 0 ? '+' : ''}${Math.round(x)}`;
const row = (name: string, m: Metrics) =>
  `| ${name} | ${percent(m.wape)} | ${percent(m.mape)} | ${Math.round(m.mae)} | ${signed(m.bias)} |`;

console.log('## Method comparison\n');
console.log('| method | WAPE | MAPE | MAE | bias |');
console.log('| --- | ---: | ---: | ---: | ---: |');
for (const [name, forecaster] of methods) {
  const { metrics } = backtest(values, forecaster, { ...BACKTEST_OPTIONS, excludeIndices });
  console.log(row(name, metrics));
}

// Final forecast
const result = predict(points);
console.log(`\n## Forecast (${result.model.tuning}, ${JSON.stringify(result.model.params)})\n`);
console.log('| week | forecast |');
console.log('| --- | ---: |');
for (const { timestamp, value } of result.forecast) {
  console.log(`| ${timestamp.slice(0, 10)} | ${value} |`);
}
