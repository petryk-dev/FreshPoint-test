import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3009),
  PREDICTION_FILE: z.string().min(1).default('data/prediction.json'),
});

export const config = envSchema.parse(process.env);
