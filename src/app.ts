import express from 'express';
import { errorHandler, notFoundHandler } from './api/errorHandler.js';
import { createPredictionRouter } from './api/routes.js';
import { healthRouter } from './routes/health.js';
import type { PredictionStore } from './store/predictionStore.js';

export interface AppDependencies {
  store: PredictionStore;
}

export const createApp = ({ store }: AppDependencies) => {
  const app = express();

  app.use(express.json({ limit: '1mb' }));
  app.use(express.text({ type: 'text/csv', limit: '1mb' }));

  app.use('/health', healthRouter);
  app.use(createPredictionRouter(store));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
