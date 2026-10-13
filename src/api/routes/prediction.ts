import { Router } from 'express';
import type { PredictionStore } from '../../store/predictionStore.js';
import { createPredictionController } from '../controllers/predictionController.js';

export const createPredictionRouter = (store: PredictionStore): Router => {
  const controller = createPredictionController(store);
  const router = Router();

  router.post('/predict', controller.createPrediction);
  router.get('/prediction', controller.getLatestPrediction);

  return router;
};
