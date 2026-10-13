import { ValidationError } from './errors.js';

export interface CsvSalesRow {
  timestamp: string;
  value: number;
}

const fail = (path: string, message: string): never => {
  throw new ValidationError(message, [{ path, message }]);
};

/**
 * Parses `timestamp,value` CSV (columns in any order). Checks only the CSV structure;
 * semantic checks (dates, negative values, gaps) are left to validateSalesInput.
 * Quoted values containing commas are not supported.
 */
export const parseSalesCsv = (text: string): CsvSalesRow[] => {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((content, i) => ({ content, lineNo: i + 1 }))
    .filter(({ content }) => content.trim() !== '');

  const [header, ...rows] = lines;
  if (header === undefined) {
    return fail('header', 'CSV is empty, expected a header with timestamp and value columns');
  }

  const columns = header.content.split(',').map((name) => name.trim().toLowerCase());
  const timestampCol = columns.indexOf('timestamp');
  const valueCol = columns.indexOf('value');
  if (timestampCol === -1 || valueCol === -1) {
    fail('header', `CSV header must contain timestamp and value columns, got "${header.content}"`);
  }

  return rows.map(({ content, lineNo }) => {
    const cells = content.split(',');
    if (cells.length !== columns.length) {
      fail(
        `line ${lineNo}`,
        `Line ${lineNo}: expected ${columns.length} columns, got ${cells.length}`,
      );
    }

    const rawValue = cells[valueCol]!.trim();
    const value = Number(rawValue);
    // Number('') is 0, so empty cells must be rejected explicitly.
    if (rawValue === '' || !Number.isFinite(value)) {
      fail(`line ${lineNo}`, `Line ${lineNo}: value must be a number, got "${rawValue}"`);
    }

    return { timestamp: cells[timestampCol]!.trim(), value };
  });
};
