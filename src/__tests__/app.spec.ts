import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from '@config/env';
import { app } from '../app';

// The order of the global middlewares of app.ts: /health is public, then the API key protects the rest
describe('App', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
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

  it('should reach the routes with a valid API key', async () => {
    // No route matches: Express answers 404 itself, so the API key middleware let the request through
    const response = await request(app).get('/v1/api/anything').set('x-api-key', env.apiKey);

    expect(response.status).toBe(404);
  });
});
