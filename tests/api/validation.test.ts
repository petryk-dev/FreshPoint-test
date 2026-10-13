import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ValidationError } from '../../src/api/errors.js';
import { validateSalesInput } from '../../src/api/validation.js';
import type { SalesPoint } from '../../src/forecast/pipeline.js';
import { weeks } from '../helpers.js';

const validationError = (body: unknown): ValidationError => {
  try {
    validateSalesInput(body);
  } catch (error) {
    expect(error).toBeInstanceOf(ValidationError);
    return error as ValidationError;
  }
  throw new Error('expected a ValidationError');
};

const dataPath = new URL('../../data/weekly-sales.json', import.meta.url);

describe.skipIf(!existsSync(dataPath))('validateSalesInput on real data', () => {
  const realData = () => JSON.parse(readFileSync(dataPath, 'utf8')) as unknown[];

  it('accepts the real data', () => {
    expect(validateSalesInput(realData())).toHaveLength(144);
  });

  it('rejects a missing week and names both dates', () => {
    const data = realData() as SalesPoint[];
    const [removed] = data.splice(70, 1);
    const before = data[69]!.timestamp.slice(0, 10);
    const after = data[70]!.timestamp.slice(0, 10);

    const error = validationError(data);

    expect(removed).toBeDefined();
    expect(error.message).toContain(before);
    expect(error.message).toContain(after);
    expect(error.message).toContain('got 14');
  });
});

describe('validateSalesInput', () => {
  it('sorts shuffled input without mutating it', () => {
    const sorted = weeks(12);
    const shuffled = [sorted[5]!, ...sorted.slice(6), ...sorted.slice(0, 5)].reverse();
    const copy = structuredClone(shuffled);

    expect(validateSalesInput(shuffled)).toEqual(sorted);
    expect(shuffled).toEqual(copy);
  });

  it('drops unknown fields', () => {
    const input = weeks(12).map((p) => ({ ...p, extra: true }));

    expect(validateSalesInput(input)[0]).toEqual(weeks(12)[0]);
  });

  it.each([{}, 'abc', null])('rejects non-array %o', (body) => {
    validationError(body);
  });

  it.each([0, 5])('rejects %i points (below minimum)', (n) => {
    validationError(weeks(n));
  });

  it('rejects a negative value with the point path', () => {
    const input = weeks(12);
    input[5]!.value = -5;

    expect(validationError(input).details).toContainEqual(
      expect.objectContaining({ path: '5.value' }),
    );
  });

  it('rejects a string value', () => {
    const input: unknown[] = weeks(12);
    input[3] = { ...weeks(12)[3], value: '123' };

    expect(validationError(input).details[0]!.path).toBe('3.value');
  });

  it('rejects a missing timestamp', () => {
    const input: unknown[] = weeks(12);
    input[2] = { value: 1 };

    expect(validationError(input).details[0]!.path).toBe('2.timestamp');
  });

  it.each(['2021-13-45T00:00:00.000Z', 'yesterday'])('rejects invalid date %s', (timestamp) => {
    const input = weeks(12);
    input[0]!.timestamp = timestamp;

    expect(validationError(input).details[0]!.path).toBe('0.timestamp');
  });

  it('rejects a duplicate date and names it', () => {
    const input = weeks(12);
    input.push({ ...input[4]! });

    const error = validationError(input);

    expect(error.message).toContain('Duplicate');
    expect(error.message).toContain(input[4]!.timestamp.slice(0, 10));
  });

  it('rejects a missing week and names both dates', () => {
    const input = weeks(13);
    input.splice(6, 1);

    const error = validationError(input);

    expect(error.message).toBe(
      'Expected 7 days between 2020-02-10 and 2020-02-24, got 14 (missing week?)',
    );
    expect(error.status).toBe(400);
  });
});
