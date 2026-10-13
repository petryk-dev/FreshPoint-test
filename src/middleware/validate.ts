import type { RequestHandler } from 'express';
import type { z } from 'zod';

export const validateBody =
  <T extends z.ZodType>(schema: T): RequestHandler =>
  (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ error: 'ValidationError', issues: result.error.issues });
      return;
    }
    req.body = result.data;
    next();
  };
