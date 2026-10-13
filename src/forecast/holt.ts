export interface HoltParams {
  alpha: number;
  beta: number;
  phi: number;
}

export interface HoltState {
  level: number;
  trend: number;
}

const assertUnitInterval = (name: string, value: number): void => {
  if (!(value > 0 && value <= 1)) {
    throw new Error(`holt: ${name} must be in (0, 1], got ${value}`);
  }
};

const validateParams = ({ alpha, beta, phi }: HoltParams): void => {
  assertUnitInterval('alpha', alpha);
  assertUnitInterval('beta', beta);
  assertUnitInterval('phi', phi);
};

export const holtStep = (state: HoltState, y: number, params: HoltParams): HoltState => {
  validateParams(params);
  const { alpha, beta, phi } = params;

  const prediction = state.level + phi * state.trend;
  const level = alpha * y + (1 - alpha) * prediction;
  const trend = beta * (level - state.level) + (1 - beta) * phi * state.trend;

  return { level, trend };
};

export const fitHolt = (values: readonly number[], params: HoltParams): HoltState => {
  validateParams(params);
  if (values.length < 2) {
    throw new Error('fitHolt: at least 2 values are required');
  }

  let state: HoltState = { level: values[0]!, trend: values[1]! - values[0]! };
  for (let i = 1; i < values.length; i++) {
    state = holtStep(state, values[i]!, params);
  }

  return state;
};

export const forecastHolt = (state: HoltState, horizon: number, phi: number): number[] => {
  assertUnitInterval('phi', phi);

  const forecasts: number[] = [];
  let phiPower = 1;
  let phiSum = 0;

  for (let h = 1; h <= horizon; h++) {
    phiPower *= phi;
    phiSum += phiPower;
    forecasts.push(state.level + phiSum * state.trend);
  }

  return forecasts;
};

export const holtForecast = (
  history: readonly number[],
  params: HoltParams,
  horizon: number,
): number[] => forecastHolt(fitHolt(history, params), horizon, params.phi);
