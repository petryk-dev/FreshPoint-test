import { STATUS_CODES } from 'node:http';
import type { ErrorRequestHandler, RequestHandler } from 'express';
import { HttpError } from './errors.js';

/** Errors thrown by express.json() / express.text() carry `type` and `status`. */
interface BodyParserError {
  type: string;
  status: number;
}

const isBodyParserError = (err: unknown): err is BodyParserError =>
  typeof err === 'object' &&
  err !== null &&
  typeof (err as BodyParserError).type === 'string' &&
  typeof (err as BodyParserError).status === 'number';

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: 'Not Found' });
};

/**
 * Converts errors into `{ error, details? }` JSON. Express recognizes error middleware by its
 * 4 parameters, so `_next` must stay even though it's only used when headers are already sent.
 */
export const errorHandler: ErrorRequestHandler = (err: unknown, _req, res, _next) => {
  if (res.headersSent) {
    _next(err);
    return;
  }

  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, details: err.details });
    return;
  }

  if (isBodyParserError(err)) {
    if (err.type === 'entity.parse.failed') {
      res.status(400).json({ error: 'Invalid JSON body' });
      return;
    }
    if (err.type === 'entity.too.large') {
      res.status(413).json({ error: 'Payload too large' });
      return;
    }
    if (err.status >= 400 && err.status < 500) {
      res.status(err.status).json({ error: STATUS_CODES[err.status] ?? 'Bad Request' });
      return;
    }
  }

  // Unknown errors may contain paths, internals or secrets: log them, don't send them.
  console.error(err);
  res.status(500).json({ error: 'Internal Server Error' });
};
