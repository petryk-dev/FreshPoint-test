import express from 'express';
import { errorHandler } from './middleware/errorHandler.js';
import { healthRouter } from './routes/health.js';

export const createApp = () => {
  const app = express();

  app.use(express.json());

  app.use('/health', healthRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: 'NotFound' });
  });

  app.use(errorHandler);

  return app;
};
