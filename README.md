# Weekly Sales Forecast API

A REST API that forecasts weekly sales 10 weeks ahead using the damped Holt method. Outliers are removed
with a Hampel filter, and parameters are selected automatically by a rolling-origin backtest. The
forecasting logic is implemented from scratch, without external libraries.

Runtime dependencies are only `express` (HTTP) and `zod` (input validation); filtering, forecasting,
backtesting and metrics are hand-written.

## Quick start

Requires Node 22.12+ or 24+ (the versions supported by Vitest and ESLint).

```bash
npm install
npm start            # builds and starts on http://localhost:3009
npm test             # unit + API tests
npm run evaluate     # anomalies, method comparison and forecast on data/weekly-sales.json
```

| Variable          | Default                | Description                       |
| ----------------- | ---------------------- | --------------------------------- |
| `PORT`            | `3009`                 | HTTP port                         |
| `PREDICTION_FILE` | `data/prediction.json` | Where the latest forecast is kept |

## API

### `POST /predict`

Accepts `application/json` (array of `{ timestamp, value }`) or `text/csv` (`timestamp,value` header).
Returns the forecast and stores it as the latest one.

```bash
curl -X POST localhost:3009/predict -H "Content-Type: application/json" --data @data/weekly-sales.json
curl -X POST localhost:3009/predict -H "Content-Type: text/csv" --data-binary @data/predict.csv
```

Use `--data-binary` for CSV: `--data` strips line breaks.

```json
{
  "createdAt": "2026-10-13T20:18:11.269Z",
  "forecast": [
    { "timestamp": "2021-06-28T00:00:00.000Z", "value": 15427 },
    { "timestamp": "2021-07-05T00:00:00.000Z", "value": 15564 },
    "..."
  ],
  "model": {
    "name": "damped-holt",
    "params": { "alpha": 0.2, "beta": 0.05, "phi": 1 },
    "tuning": "grid-search",
    "backtest": {
      "metrics": { "mae": 1404.7985, "mape": 0.1158, "wape": 0.1132, "bias": -318.5446 },
      "folds": 12
    }
  },
  "adjustedWeeks": ["2018-11-19T00:00:00.000Z", "2019-04-15T00:00:00.000Z", "..."]
}
```

`tuning` is `"default"` and `backtest` is `null` for series shorter than 62 weeks (see design decisions).

| Status | When                                                   |
| ------ | ------------------------------------------------------ |
| 200    | Forecast created                                       |
| 400    | Invalid JSON, invalid CSV or failed validation         |
| 413    | Body larger than 1 MB                                  |
| 415    | `Content-Type` is not `application/json` or `text/csv` |

### `GET /prediction`

```bash
curl localhost:3009/prediction
```

200 with the latest forecast (same body as `POST /predict`), or 404 if nothing has been predicted yet.

### Errors and validation

All errors have the form `{ "error": string, "details"?: [{ "path", "message" }] }`, e.g.
`{ "error": "Invalid sales data", "details": [{ "path": "5.value", "message": "Too small: expected number to be >=0" }] }`.

- 12 to 10,000 points;
- `timestamp` is an ISO date-time in UTC (`…Z`), `value` is a number ≥ 0;
- exactly 7 days between consecutive weeks — missing weeks are rejected, naming both dates;
- no duplicate dates;
- unsorted input is accepted and sorted.

## Approach

```
input → validation → Hampel filter → grid search (rolling-origin backtest) → damped Holt → 10-week forecast
```

## Methods considered

| Method                 | Pros                                                             | Cons                                                            | Verdict     |
| ---------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------- | ----------- |
| Naive / moving average | Trivial, robust                                                  | Ignores trend, lags a growing series                            | Baseline    |
| Linear regression      | Simple, interpretable                                            | Growth is not linear (slow start, COVID)                        | Rejected    |
| Simple exp. smoothing  | Adapts to level                                                  | No trend → flat forecast                                        | Rejected    |
| **Damped Holt**        | Level + trend, adapts quickly, damping limits over-extrapolation | No seasonality                                                  | **Chosen**  |
| Holt-Winters           | Yearly seasonality                                               | Needs several clean years; we have ~2.8, one distorted by COVID | Future work |
| ARIMA / SARIMA         | Statistically rich                                               | Complex to implement from scratch, overkill for 144 points      | Rejected    |
| Prophet                | Trend + seasonality + holidays                                   | One library call — not the point of the task                    | Rejected    |
| ML / LSTM              | Flexible                                                         | 144 points → overfitting, black box                             | Rejected    |

## Why this approach

- **The series grows and is noisy** → the model needs a trend that adapts to recent data.
- **Anomalies distort training** (Christmas, Easter, COVID lockdown) → they are replaced before fitting
  and excluded from scoring.
- **Parameters are tuned on history, not guessed** → each candidate is scored by how it would have
  forecast the past.
- **Everything is interpretable**: three formulas, one filter, one metric — each step can be explained.

## Implementation

### Hampel filter

- Window of 7 weeks (±3); outlier if |x − median| > 3σ, where σ = 1.4826 · MAD.
- Outliers are replaced by the window median.
- Non-recursive: windows always use the original series, not the cleaned one.
- The last 2 points are protected — a jump at the very end may be a real change.
- Skipped when MAD = 0 (dispersion can't be estimated).

### Damped Holt

```
level:    ℓ_t = α·y_t + (1 − α)·(ℓ_{t−1} + φ·b_{t−1})
trend:    b_t = β·(ℓ_t − ℓ_{t−1}) + (1 − β)·φ·b_{t−1}
forecast: ŷ_{t+h} = ℓ_t + (φ + φ² + … + φ^h)·b_t
```

- Initialized with ℓ = y₀, b = y₁ − y₀.
- For φ < 1 the forecast flattens towards a ceiling of ℓ + b·φ/(1 − φ); φ = 1 is an undamped straight
  line.

### Backtest

- Rolling origin: up to 12 folds, step 4 weeks, horizon 10, at least 52 weeks of training.
- Each fold runs the full pipeline (Hampel + Holt) on its training data only — no leakage.
- Anomalous weeks are excluded from scoring only; the model still trains on them (cleaned).
- Metrics are pooled over all test points, so partly excluded folds don't get extra weight.

### Grid search

- α 0.05–0.95, β 0.05–0.50, φ 0.80–1.00 → 2,090 combinations.
- Lowest WAPE wins; ties keep the first one, so the result is deterministic.

## Results

From `npm run evaluate` on `data/weekly-sales.json` (144 weeks, 2018-09-24 … 2021-06-21; 12 folds).

| Method                          |       WAPE |       MAPE |      MAE |     Bias |
| ------------------------------- | ---------: | ---------: | -------: | -------: |
| naive                           |     17.64% |     17.21% |     2190 |    -1532 |
| movingAverage(4)                |     12.09% |     11.93% |     1500 |    -1131 |
| drift(8)                        |     24.30% |     23.69% |     3017 |    -1207 |
| Holt, default params            |     12.68% |     12.48% |     1573 |    -1050 |
| **Holt, tuned params**          | **11.32%** | **11.58%** | **1405** | **-319** |
| Holt, tuned params, no cleaning |     12.86% |     12.96% |     1596 |     -628 |

- **Selected parameters:** α = 0.2, β = 0.05, φ = 1. On this data the search chose no damping: growth was
  steady over the backtest period. β = 0.05 is the lower edge of the grid, so the true optimum may be
  slightly lower; extending the grid is a cheap next step.
- **Why Holt over the moving average:** the WAPE gain is modest (0.8 pp), but bias drops 3.5× (−319 vs
  −1131). A moving average structurally lags a growing series, which for fresh goods means systematic
  under-stocking every week.
- **Ablation:** tuning improves WAPE by 1.4 pp and Hampel cleaning by 1.5 pp; they also cut bias by 3.3×
  and 2× respectively.
- **The estimate is slightly optimistic**: parameters were selected on the same folds they are scored on
  (see nested validation below).
- **Timing:** grid search ~1.7 s; `POST /predict` with the full dataset ~1.65 s.

Detected anomalies:

| Week       | Original | Replaced by | Likely cause                 |
| ---------- | -------: | ----------: | ---------------------------- |
| 2018-11-19 |     1313 |         861 | Early-period spike (unknown) |
| 2019-04-15 |     1110 |        2456 | Easter                       |
| 2020-04-06 |     2993 |        4830 | COVID lockdown low           |
| 2020-11-16 |     9336 |       11777 | 17 November public holiday   |
| 2020-12-21 |     4667 |       11777 | Christmas                    |
| 2020-12-28 |     3854 |       11722 | Christmas                    |
| 2021-03-29 |     8835 |       12078 | Easter                       |

Forecast:

| Week       | Forecast | Week       | Forecast |
| ---------- | -------: | ---------- | -------: |
| 2021-06-28 |   15,427 | 2021-08-02 |   16,110 |
| 2021-07-05 |   15,564 | 2021-08-09 |   16,246 |
| 2021-07-12 |   15,700 | 2021-08-16 |   16,383 |
| 2021-07-19 |   15,837 | 2021-08-23 |   16,520 |
| 2021-07-26 |   15,973 | 2021-08-30 |   16,656 |

The forecast starts below the last observed week (17,109): with α = 0.2 the level is heavily smoothed and
treats the last jump as partly noise. This is what the backtest favoured; the remaining negative bias is
discussed under quantile forecasts.

## Design decisions & trade-offs

- **No database** — file storage behind a `PredictionStore` interface with atomic writes (temp file +
  `rename`); moving to Postgres means one new implementation, wired in `server.ts`.
- **Synchronous `POST`** (~1.65 s of CPU, blocks the event loop) — fine for one user; under load, move to
  `worker_threads` or a queue (`202 + jobId`, result via `GET`). Caching Hampel-cleaned folds across the
  grid would also cut most of the time.
- **Missing weeks are rejected, not interpolated** — interpolation is hidden magic; the client should know
  about the gap.
- **Short series fall back to default parameters** (α 0.3, β 0.1, φ 0.9) and say so in `tuning` — a
  forecast is more useful than a refusal.
- **WAPE is the primary metric** — it weights errors by volume, i.e. by business impact. MAPE is inflated
  by the low early weeks (43 units in September 2018) and undefined for zero sales (Christmas 2018).
- **Custom CSV parser** — the format is trivial; quoted fields (e.g. `"1,000"`) are not supported. A full
  RFC 4180 parser is a job for a library.
- **COVID needs no special handling** — the earliest backtest window starts in June 2020, after the drop;
  in training, Holt's exponential forgetting makes the 2020 dip negligible by mid-2021.

## Limitations & future work

- **Holiday calendar** — Christmas 2018 and 2019 are not flagged: neighbouring holiday weeks also drop and
  inflate the MAD (2019 window `5613, 5306, 3745, [76], 2231, 6718, 5760` → threshold ≈ 6280 > |76 − 5306|).
  Impact is negligible (far from the end of the series, outside every backtest window); a calendar rule
  for 24 December – 1 January would fix it.
- **Seasonality** — Holt-Winters once several clean years are available.
- **Quantile forecasts / intervals** — stockouts and overstock have asymmetric costs, and the point
  forecast still underestimates on average (bias −319).
- **Per-product and per-location forecasts.**
- **Nested validation** — select parameters on inner folds, score on outer ones, for an unbiased estimate.
- **Worker threads or a queue** for the CPU-bound `POST`.
- **An optimizer (Nelder-Mead)** instead of the grid search.

## Project structure

```
src/
├── server.ts                        entry point: file store, HTTP server, graceful shutdown
├── app.ts                           createApp({ store }): body parsers, routes, error handling
├── config.ts                        environment variables (PORT, PREDICTION_FILE)
├── api/
│   ├── controllers/
│   │   ├── healthController.ts      health check
│   │   └── predictionController.ts  read body → validate → predict → store; 404/415
│   ├── routes/
│   │   ├── health.ts                GET /health
│   │   └── prediction.ts            POST /predict, GET /prediction
│   ├── validation.ts                Zod schema + series checks (sorting, duplicates, 7-day gaps)
│   ├── csv.ts                       CSV parser (structure only)
│   ├── errors.ts                    HttpError, ValidationError
│   └── errorHandler.ts              404 handler and JSON error responses
├── forecast/
│   ├── pipeline.ts                  predict(): Hampel → grid search → Holt → forecast
│   ├── config.ts                    horizon, Hampel, backtest and grid settings in one place
│   ├── hampel.ts                    Hampel outlier filter
│   ├── holt.ts                      damped Holt: step, fit, forecast
│   ├── backtest.ts                  rolling-origin backtest, withCleaning
│   ├── gridSearch.ts                parameter grid and search by WAPE
│   ├── metrics.ts                   MAE, MAPE, WAPE, bias
│   ├── baselines.ts                 naive, moving average, drift
│   ├── stats.ts                     median, MAD, mean
│   ├── dates.ts                     next weekly timestamps in UTC
│   └── types.ts                     Forecaster type
└── store/
    ├── predictionStore.ts           PredictionStore interface
    ├── filePredictionStore.ts       JSON file with atomic writes
    └── inMemoryPredictionStore.ts   in-memory store for tests
scripts/
└── evaluate.ts                      evaluation report (npm run evaluate)
tests/
├── api.test.ts                      end-to-end API tests (Supertest)
├── api/                             validation, CSV, error handler
├── forecast/                        one test file per forecast module
├── store/                           shared contract tests for both stores
└── helpers.ts                       test data helpers
data/
├── weekly-sales.json                sample data (JSON)
└── predict.csv                      the same data as CSV
```
