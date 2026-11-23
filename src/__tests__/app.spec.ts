import request from 'supertest';
import { beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { env } from '@config/env';
import { app } from '../app';

// The order of the global middlewares of app.ts: request id and access log, body parser, /health (public),
// then the API key protects the rest
describe('App', () => {
  let info: MockInstance<typeof console.info>;
  let warn: MockInstance<typeof console.warn>;

  const logged = (spy: MockInstance<typeof console.info>) => spy.mock.calls.map(([line]) => JSON.parse(line as string));

  beforeEach(() => {
    info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  it('should answer /health without an API key', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
  });

  it('should require the API key on the API routes', async () => {
    const response = await request(app).get('/v1/api/anything');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: 'Missing x-api-key header', code: 'UNAUTHORIZED' });
  });

  it('should refuse an invalid API key', async () => {
    const response = await request(app).get('/v1/api/anything').set('x-api-key', `${env.apiKey}-wrong`);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: 'Invalid API key', code: 'FORBIDDEN' });
  });

  it('should refuse a key that is a prefix of the real one, and one that is longer', async () => {
    const prefix = await request(app).get('/v1/api/anything').set('x-api-key', env.apiKey.slice(0, -1));
    const longer = await request(app).get('/v1/api/anything').set('x-api-key', `${env.apiKey}x`);

    expect(prefix.status).toBe(403);
    expect(longer.status).toBe(403);
  });

  it('should reach the routes with a valid API key', async () => {
    // No route matches: Express answers 404 itself, so the API key middleware let the request through
    const response = await request(app).get('/v1/api/anything').set('x-api-key', env.apiKey);

    expect(response.status).toBe(404);
  });

  describe('request id and logs', () => {
    it('should return the x-request-id header on every kind of response', async () => {
      const ok = await request(app).get('/health');
      const unauthorized = await request(app).get('/v1/api/anything');
      const malformed = await request(app)
        .post('/v1/api/anything')
        .set('x-api-key', env.apiKey)
        .set('Content-Type', 'application/json')
        .send('{bad json');

      expect(ok.headers['x-request-id']).toBeTruthy();
      expect(unauthorized.headers['x-request-id']).toBeTruthy();
      expect(malformed.status).toBe(400);
      expect(malformed.headers['x-request-id']).toBeTruthy();
    });

    it('should put the same request id on the access log line and on the error log line', async () => {
      const response = await request(app).get('/v1/api/anything');
      const requestId = response.headers['x-request-id'];

      expect(logged(warn)).toEqual([
        expect.objectContaining({ event: 'app_error', requestId, status: 401, code: 'UNAUTHORIZED', method: 'GET', path: '/v1/api/anything' }),
      ]);
      expect(logged(info)).toEqual([
        expect.objectContaining({ event: 'http_request', requestId, method: 'GET', path: '/v1/api/anything', status: 401 }),
      ]);
    });

    it('should keep the request id on the log line of a body the parser rejected', async () => {
      const response = await request(app)
        .post('/v1/api/anything')
        .set('x-api-key', env.apiKey)
        .set('Content-Type', 'application/json')
        .send('{bad json');

      expect(logged(warn)[0]).toMatchObject({ event: 'app_error', code: 'BAD_REQUEST', requestId: response.headers['x-request-id'] });
    });

    it('should never write the API key or a header value in the logs', async () => {
      await request(app).get('/v1/api/anything').set('x-api-key', `${env.apiKey}-wrong`).set('authorization', 'Bearer secret-token');

      const everything = JSON.stringify([...logged(info), ...logged(warn)]);
      expect(everything).not.toContain(env.apiKey);
      expect(everything).not.toContain('secret-token');
    });
  });
});
