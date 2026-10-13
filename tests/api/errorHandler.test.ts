import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { errorHandler, notFoundHandler } from '../../src/api/errorHandler.js';
import { HttpError, ValidationError } from '../../src/api/errors.js';

const createTestApp = () => {
  const app = express();
  app.use(express.json({ limit: '1kb' }));

  app.get('/validation', () => {
    throw new ValidationError('Invalid sales data', [{ path: '5.value', message: 'Too small' }]);
  });
  app.get('/not-found', () => {
    throw new HttpError(404, 'No prediction yet');
  });
  app.get('/crash', () => {
    throw new Error('db password is hunter2');
  });
  app.get('/async-crash', async () => {
    await Promise.resolve();
    throw new Error('async failure');
  });
  app.post('/echo', (req, res) => {
    res.json(req.body);
  });

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
};

const app = createTestApp();

afterEach(() => {
  vi.restoreAllMocks();
});

describe('errorHandler', () => {
  it('returns 400 with details for ValidationError', async () => {
    const res = await request(app).get('/validation');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: 'Invalid sales data',
      details: [{ path: '5.value', message: 'Too small' }],
    });
  });

  it('uses the status of an HttpError', async () => {
    const res = await request(app).get('/not-found');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'No prediction yet' });
  });

  it('hides unknown errors behind a generic 500 and logs them', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await request(app).get('/crash');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Internal Server Error' });
    expect(res.text).not.toContain('hunter2');
    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'db password is hunter2' }),
    );
  });

  it('catches errors thrown in async handlers', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await request(app).get('/async-crash');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Internal Server Error' });
  });

  it('returns 400 for malformed JSON', async () => {
    const res = await request(app)
      .post('/echo')
      .set('Content-Type', 'application/json')
      .send('{"a":');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid JSON body' });
  });

  it('returns 413 when the body exceeds the limit', async () => {
    const res = await request(app)
      .post('/echo')
      .send({ data: 'x'.repeat(2048) });

    expect(res.status).toBe(413);
    expect(res.body).toEqual({ error: 'Payload too large' });
  });

  it('passes other body parser 4xx errors through with a generic message', async () => {
    const res = await request(app)
      .post('/echo')
      .set('Content-Type', 'application/json; charset=koi8-r')
      .send('{}');

    expect(res.status).toBe(415);
    expect(res.body).toEqual({ error: 'Unsupported Media Type' });
  });
});

describe('notFoundHandler', () => {
  it('returns JSON 404 for unknown routes', async () => {
    const res = await request(app).get('/nope');

    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body).toEqual({ error: 'Not Found' });
  });
});
