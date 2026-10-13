# Weekly Sales Forecast API

A REST API that forecasts weekly sales 10 weeks ahead using the damped Holt method. Outliers are removed
with a Hampel filter, and parameters are selected automatically by a rolling-origin backtest. The
forecasting logic is implemented from scratch, without external libraries.

## Quick start

Requires Node ≥ 20.

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

| Block       | Details                                                                                                                                                                                                                                                                                                                                                                                                            |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Hampel      | Window of 7 weeks (±3), outlier if \|x − median\| > 3σ with σ = 1.4826 · MAD; replaced by the window median. Windows always use the original series (non-recursive). The last 2 points are protected — a drop at the very end may be a real change. Skipped when MAD = 0.                                                                                                                                          |
| Holt        | Level ℓ<sub>t</sub> = α·y<sub>t</sub> + (1 − α)(ℓ<sub>t−1</sub> + φ·b<sub>t−1</sub>); trend b<sub>t</sub> = β(ℓ<sub>t</sub> − ℓ<sub>t−1</sub>) + (1 − β)·φ·b<sub>t−1</sub>; forecast ŷ<sub>t+h</sub> = ℓ<sub>t</sub> + (φ + φ² + … + φ<sup>h</sup>)·b<sub>t</sub>. Initialized with ℓ = y₀, b = y₁ − y₀. For φ < 1 the forecast flattens towards a ceiling of ℓ + b·φ/(1 − φ); φ = 1 is an undamped straight line. |
| Backtest    | Rolling origin: up to 12 folds, step 4 weeks, horizon 10, at least 52 weeks of training. Each fold runs the full pipeline (Hampel + Holt) on its training data only — no leakage. Anomalous weeks are excluded from scoring only. Metrics are pooled over all test points.                                                                                                                                         |
| Grid search | α 0.05–0.95, β 0.05–0.50, φ 0.80–1.00 → 2,090 combinations; lowest WAPE wins, ties keep the first one, so the result is deterministic.                                                                                                                                                                                                                                                                             |

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
  steady over the backtest period.
- **Ablation:** tuning improves WAPE by 1.4 pp and Hampel cleaning by 1.5 pp. Tuned Holt beats naive
  clearly, but the 4-week moving average is only 0.8 pp behind. All methods underestimate the growing
  series (negative bias); tuned Holt the least.
- **The estimate is slightly optimistic**: parameters were selected on the same folds they are scored on
  (see nested validation below).
- **Timing:** grid search ~1.7 s; `POST /predict` with the full dataset ~1.65 s.

Detected anomalies:

| Week       | Original | Replaced by | Cause                      |
| ---------- | -------: | ----------: | -------------------------- |
| 2018-11-19 |     1313 |         861 | Spike shortly after launch |
| 2019-04-15 |     1110 |        2456 | Easter                     |
| 2020-04-06 |     2993 |        4830 | COVID lockdown low         |
| 2020-11-16 |     9336 |       11777 | 17 November public holiday |
| 2020-12-21 |     4667 |       11777 | Christmas                  |
| 2020-12-28 |     3854 |       11722 | Christmas                  |
| 2021-03-29 |     8835 |       12078 | Easter                     |

Forecast:

| Week       | Forecast | Week       | Forecast |
| ---------- | -------: | ---------- | -------: |
| 2021-06-28 |   15,427 | 2021-08-02 |   16,110 |
| 2021-07-05 |   15,564 | 2021-08-09 |   16,246 |
| 2021-07-12 |   15,700 | 2021-08-16 |   16,383 |
| 2021-07-19 |   15,837 | 2021-08-23 |   16,520 |
| 2021-07-26 |   15,973 | 2021-08-30 |   16,656 |

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
- **COVID needs no special handling** — the earliest backtest window starts in June 2020, after the drop.

## Limitations & future work

- **Holiday calendar** — Christmas 2018 and 2019 are not flagged: neighbouring holiday weeks also drop and
  inflate the MAD (2019 window `5613, 5306, 3745, [76], 2231, 6718, 5760` → threshold ≈ 6280 > |76 − 5306|).
  Impact is negligible (far from the end of the series, outside every backtest window); a calendar rule
  for 24 December – 1 January would fix it.
- **Seasonality** — Holt-Winters once several clean years are available.
- **Quantile forecasts / intervals** — stockouts and overstock have asymmetric costs.
- **Per-product and per-location forecasts.**
- **Nested validation** — select parameters on inner folds, score on outer ones, for an unbiased estimate.
- **Worker threads or a queue** for the CPU-bound `POST`.
- **An optimizer (Nelder-Mead)** instead of the grid search.

## Project structure

```
src/
  server.ts          entry point: file store, HTTP server, graceful shutdown
  app.ts             createApp({ store }): body parsers, routes, error handling
  config.ts          environment variables (PORT, PREDICTION_FILE)
  api/               routes, validation, CSV parser, error classes and handler
  forecast/          pipeline, Hampel, Holt, backtest, grid search, metrics, baselines, dates, config
  store/             PredictionStore interface, in-memory and file implementations
  routes/health.ts   GET /health
scripts/evaluate.ts  evaluation report (npm run evaluate)
tests/               Vitest + Supertest tests
data/                sample data (JSON and CSV)
```
