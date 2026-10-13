import { mad, median } from './stats.js';

/** Scales MAD to a consistent estimator of the standard deviation for normal data. */
const MAD_TO_SIGMA = 1.4826;

export interface HampelOptions {
  halfWindow?: number;
  threshold?: number;
  protectTail?: number;
}

export interface HampelResult {
  cleaned: number[];
  outlierIndices: number[];
}

export const hampel = (
  values: readonly number[],
  { halfWindow = 3, threshold = 3, protectTail = 2 }: HampelOptions = {},
): HampelResult => {
  const cleaned = [...values];
  const outlierIndices: number[] = [];
  const lastChecked = values.length - protectTail;

  for (let i = 0; i < lastChecked; i++) {
    const window = values.slice(Math.max(0, i - halfWindow), i + halfWindow + 1);
    const med = median(window);
    const sigma = MAD_TO_SIGMA * mad(window, med);

    if (sigma === 0) continue;

    if (Math.abs(values[i]! - med) > threshold * sigma) {
      cleaned[i] = med;
      outlierIndices.push(i);
    }
  }

  return { cleaned, outlierIndices };
};
