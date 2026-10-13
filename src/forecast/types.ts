/** Takes a history of weekly values and returns forecasts for the next `horizon` weeks. */
export type Forecaster = (history: readonly number[], horizon: number) => number[];
