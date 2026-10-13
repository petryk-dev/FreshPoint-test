# predict-test-task

Weekly sales forecasting service: Node.js, TypeScript, Express, Zod.

## Scripts

| Command             | Description                  |
| ------------------- | ---------------------------- |
| `npm run dev`       | Start dev server with reload |
| `npm run build`     | Compile to `dist/`           |
| `npm start`         | Run compiled server          |
| `npm test`          | Run tests (Vitest)           |
| `npm run typecheck` | Type-check without emitting  |
| `npm run lint`      | ESLint                       |
| `npm run format`    | Prettier                     |

## Forecasting (`src/forecast`)

- `stats.ts` — `median`, `mad`, `mean`.
- `hampel.ts` — Hampel outlier filter.
- `holt.ts` — damped Holt linear trend.
- `baselines.ts` — `naive`, `movingAverage`, `drift`.
- `metrics.ts` — MAE, MAPE, WAPE, bias. Errors are `forecast − actual`; relative metrics are proportions.
- `backtest.ts` — rolling-origin backtest.

### Backtest

Each fold trains on `values[0, origin)` and tests on the next `horizon` weeks. Defaults: `horizon = 10`,
`minTrain = 52`, `step = 4`, `maxFolds = 12`; the last fold ends at the end of the series. Final metrics
pool all test pairs from all folds rather than averaging per-fold metrics.

- **Cleaning** — `withCleaning(forecaster)` runs Hampel on each fold's training data only, so there is no
  leakage from the test window.
- **Excluded weeks** — `excludeIndices` (e.g. a Hampel mask over the whole series, such as Christmas)
  removes points from evaluation only. The model still sees them in training, so this is not leakage; we
  just don't penalize the model for weeks it could not be expected to predict.
- **COVID** — needs no special handling: 12 folds of 4 weeks put the earliest test window around June 2020,
  after the initial drop.

## Evaluation

`npm run evaluate` prints detected anomalies, the grid search result and timing, a method comparison and
the final forecast. All methods are scored on the same folds and exclusions, and all are cleaned with
`withCleaning`, except the last row.

<!-- Paste the method comparison table from `npm run evaluate` here. -->

The last three rows are an ablation: Holt vs. simple baselines, tuned vs. default parameters, and the
effect of Hampel cleaning.

## Known limitations

- **Christmas 2018 and 2019 are not flagged as anomalies.** The neighbouring holiday weeks also drop,
  which inflates the window MAD. For example, in Christmas 2019 the window `5613, 5306, 3745, [76], 2231,
6718, 5760` gives median 5306 and MAD 1412, so the threshold 3σ ≈ 6280 is larger than |76 − 5306| = 5230.
  The impact is negligible: these weeks are 1.5+ years before the end of the series, Holt has
  effectively forgotten them, and they fall outside every backtest window (the earliest test starts in
  June 2020). Left as is on purpose.

### Possible improvement

Combine statistics with a calendar rule: always treat weeks spanning 24 December – 1 January as
anomalies, in addition to the Hampel filter.
