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
