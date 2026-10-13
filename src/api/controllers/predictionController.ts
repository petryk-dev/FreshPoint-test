import type { Request, RequestHandler } from 'express';
import { predict } from '../../forecast/pipeline.js';
import type { PredictionStore } from '../../store/predictionStore.js';
import { parseSalesCsv } from '../csv.js';
import { HttpError } from '../errors.js';
import { validateSalesInput } from '../validation.js';

export interface PredictionController {
  createPrediction: RequestHandler;
  getLatestPrediction: RequestHandler;
}

const readSalesInput = (req: Request): unknown => {
  if (req.is('application/json')) {
    return req.body;
  }
  if (req.is('text/csv')) {
    return parseSalesCsv(typeof req.body === 'string' ? req.body : '');
  }
  throw new HttpError(415, 'Use application/json or text/csv');
};

export const createPredictionController = (store: PredictionStore): PredictionController => ({
  createPrediction: async (req, res) => {
    const result = predict(validateSalesInput(readSalesInput(req)));
    await store.save(result);
    res.json(result);
  },

  getLatestPrediction: async (_req, res) => {
    const latest = await store.getLatest();
    if (latest === null) {
      throw new HttpError(404, 'No prediction yet. Call POST /predict first.');
    }
    res.json(latest);
  },
});
