import type { PredictionResult } from '../forecast/pipeline.js';
import type { PredictionStore } from './predictionStore.js';

export class InMemoryPredictionStore implements PredictionStore {
  private latest: PredictionResult | null = null;

  async save(prediction: PredictionResult): Promise<void> {
    this.latest = structuredClone(prediction);
  }

  async getLatest(): Promise<PredictionResult | null> {
    return this.latest && structuredClone(this.latest);
  }
}
