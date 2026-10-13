import express from 'express';
import { errorHandler, notFoundHandler } from './api/errorHandler.js';
import { healthRouter } from './routes/health.js';

export const createApp = () => {
  const app = express();

  app.use(express.json());

  app.use('/health', healthRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
