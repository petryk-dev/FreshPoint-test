import type { PredictionResult } from '../forecast/pipeline.js';

/**
 * Stores the latest prediction. Async even for in-memory storage, so routes don't change
 * when the implementation moves to files or a database.
 */
export interface PredictionStore {
  save(prediction: PredictionResult): Promise<void>;
  /** null when nothing has been predicted yet; that's a normal state, not an error. */
  getLatest(): Promise<PredictionResult | null>;
}
