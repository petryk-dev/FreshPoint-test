import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseSalesCsv } from '../../src/api/csv.js';
import { ValidationError } from '../../src/api/errors.js';
import { validateSalesInput } from '../../src/api/validation.js';

const read = (name: string) => readFileSync(new URL(`../../data/${name}`, import.meta.url), 'utf8');

const csvError = (text: string): ValidationError => {
  try {
    parseSalesCsv(text);
  } catch (error) {
    expect(error).toBeInstanceOf(ValidationError);
    return error as ValidationError;
  }
  throw new Error('expected a ValidationError');
};

const expected = [
  { timestamp: '2021-01-04T00:00:00.000Z', value: 100 },
  { timestamp: '2021-01-11T00:00:00.000Z', value: 200 },
];

describe('parseSalesCsv', () => {
  it('matches the JSON data after validation', () => {
    const fromCsv = validateSalesInput(parseSalesCsv(read('predict.csv')));
    const fromJson = validateSalesInput(JSON.parse(read('weekly-sales.json')));

    expect(fromCsv).toHaveLength(144);
    expect(fromCsv).toEqual(fromJson);
  });

  it('handles Windows line endings and a trailing empty line', () => {
    const text =
      'timestamp,value\r\n2021-01-04T00:00:00.000Z,100\r\n2021-01-11T00:00:00.000Z,200\r\n';

    expect(parseSalesCsv(text)).toEqual(expected);
  });

  it('strips a BOM', () => {
    const text =
      '\uFEFFtimestamp,value\n2021-01-04T00:00:00.000Z,100\n2021-01-11T00:00:00.000Z,200';

    expect(parseSalesCsv(text)).toEqual(expected);
  });

  it('finds columns by name in any order and case', () => {
    const text = ' Value , TIMESTAMP\n100,2021-01-04T00:00:00.000Z\n200,2021-01-11T00:00:00.000Z';

    expect(parseSalesCsv(text)).toEqual(expected);
  });

  it.each(['date,amount\n2021-01-04T00:00:00.000Z,100', '', 'timestamp\n2021-01-04T00:00:00.000Z'])(
    'rejects a missing or wrong header: %j',
    (text) => {
      expect(csvError(text).details[0]!.path).toBe('header');
    },
  );

  it('rejects a row with the wrong number of columns and names the line', () => {
    const text = 'timestamp,value\n2021-01-04T00:00:00.000Z,100\n2021-01-11T00:00:00.000Z,200,x';

    expect(csvError(text).message).toContain('Line 3');
  });

  it.each(['', 'abc', '12abc', ' '])('rejects value %j instead of treating it as 0', (value) => {
    const text = `timestamp,value\n2021-01-04T00:00:00.000Z,${value}`;

    expect(csvError(text).message).toContain('Line 2');
  });

  it('counts skipped empty lines in line numbers', () => {
    const text = 'timestamp,value\n\n2021-01-04T00:00:00.000Z,abc';

    expect(csvError(text).message).toContain('Line 3');
  });
});
