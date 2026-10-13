import { Router } from 'express';
import { predict } from '../../forecast/pipeline.js';
import type { PredictionStore } from '../../store/predictionStore.js';
import { parseSalesCsv } from '../csv.js';
import { HttpError } from '../errors.js';
import { validateSalesInput } from '../validation.js';

export const createPredictionRouter = (store: PredictionStore): Router => {
  const router = Router();

  router.post('/predict', async (req, res) => {
    let input: unknown;
    if (req.is('application/json')) {
      input = req.body;
    } else if (req.is('text/csv')) {
      input = parseSalesCsv(typeof req.body === 'string' ? req.body : '');
    } else {
      throw new HttpError(415, 'Use application/json or text/csv');
    }

    const result = predict(validateSalesInput(input));
    await store.save(result);
    res.json(result);
  });

  router.get('/prediction', async (_req, res) => {
    const latest = await store.getLatest();
    if (latest === null) {
      throw new HttpError(404, 'No prediction yet. Call POST /predict first.');
    }
    res.json(latest);
  });

  return router;
};
