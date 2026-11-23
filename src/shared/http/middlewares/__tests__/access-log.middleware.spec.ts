import request from 'supertest';
import express from 'express';
import { describe, it, expect, vi, beforeEach, type MockInstance } from 'vitest';
import { accessLogMiddleware } from '../access-log.middleware';
import { requestIdMiddleware } from '../request-id.middleware';

describe('accessLogMiddleware', () => {
  let info: MockInstance<typeof console.info>;

  const lines = () => info.mock.calls.map(([line]) => JSON.parse(line as string));

  beforeEach(() => {
    info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
  });

  const app = express();
  app.use(requestIdMiddleware);
  app.use(accessLogMiddleware);
  app.get('/ok', (_req, res) => res.json({ ok: true }));
  app.post('/created', (_req, res) => res.status(201).send());

  it('should write one line when the response finishes, with the request id, method, path, status and duration', async () => {
    const res = await request(app).get('/ok');

    expect(lines()).toHaveLength(1);
    expect(lines()[0]).toMatchObject({
      level     : 'info',
      event     : 'http_request',
      requestId : res.headers['x-request-id'],
      method    : 'GET',
      path      : '/ok',
      status    : 200,
    });
    expect(typeof lines()[0].durationMs).toBe('number');
    expect(lines()[0].durationMs).toBeGreaterThanOrEqual(0);
  });

  it('should log the status the response really used', async () => {
    await request(app).post('/created');
    await request(app).get('/missing');

    expect(lines().map((line) => [line.method, line.path, line.status])).toEqual([
      ['POST', '/created', 201],
      ['GET', '/missing', 404],
    ]);
  });

  it('should not write the query string, which can carry secrets', async () => {
    await request(app).get('/ok?token=super-secret&page=2');

    expect(lines()[0].path).toBe('/ok');
    expect(JSON.stringify(lines())).not.toContain('super-secret');
  });
});
