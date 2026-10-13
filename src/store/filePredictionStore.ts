import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { PredictionResult } from '../forecast/pipeline.js';
import type { PredictionStore } from './predictionStore.js';

/**
 * Persists the latest prediction as a JSON file. Writes go to a uniquely named temp file
 * and are renamed into place, which is atomic within one file system: readers see either
 * the old or the new file, never a partial one. Concurrent saves: last write wins.
 */
export class FilePredictionStore implements PredictionStore {
  constructor(private readonly filePath: string) {}

  async save(prediction: PredictionResult): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });

    const tmpPath = `${this.filePath}.${randomUUID()}.tmp`;
    try {
      await writeFile(tmpPath, JSON.stringify(prediction, null, 2));
      await rename(tmpPath, this.filePath);
    } catch (error) {
      await rm(tmpPath, { force: true });
      throw error;
    }
  }

  async getLatest(): Promise<PredictionResult | null> {
    let text: string;
    try {
      text = await readFile(this.filePath, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }

    // Corrupted JSON throws on purpose: data corruption must surface as a 500, not as "no prediction".
    return JSON.parse(text) as PredictionResult;
  }
}
