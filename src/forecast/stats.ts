export const median = (values: readonly number[]): number => {
  if (values.length === 0) {
    throw new Error('median: values must not be empty');
  }

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 1) {
    return sorted[mid]!;
  }
  return (sorted[mid - 1]! + sorted[mid]!) / 2;
};

export const mad = (values: readonly number[], center: number = median(values)): number =>
  median(values.map((x) => Math.abs(x - center)));

export const mean = (values: readonly number[]): number => {
  if (values.length === 0) {
    throw new Error('mean: values must not be empty');
  }

  return values.reduce((sum, x) => sum + x, 0) / values.length;
};
