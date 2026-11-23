import request from 'supertest';
import express from 'express';
import { describe, it, expect } from 'vitest';
import { requestIdMiddleware } from '../request-id.middleware';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function appWith(...before: express.RequestHandler[]) {
  const app = express();
  before.forEach((middleware) => app.use(middleware));
  app.use(requestIdMiddleware);
  app.get('/', (req, res) => res.json({ requestId: req.requestId }));
  return app;
}

describe('requestIdMiddleware', () => {
  it('should create an id for the request and return it in the x-request-id header', async () => {
    const res = await request(appWith()).get('/');

    expect(res.body.requestId).toMatch(UUID);
    expect(res.headers['x-request-id']).toBe(res.body.requestId);
  });

  it('should create a different id for each request', async () => {
    const app = appWith();
    const first = await request(app).get('/');
    const second = await request(app).get('/');

    expect(first.body.requestId).not.toBe(second.body.requestId);
  });

  it('should keep the id sent by the caller when it is a short, plain value', async () => {
    const res = await request(appWith()).get('/').set('x-request-id', 'caller-123.abc_DEF');

    expect(res.body.requestId).toBe('caller-123.abc_DEF');
    expect(res.headers['x-request-id']).toBe('caller-123.abc_DEF');
  });

  it.each([
    ['spaces and symbols', 'bad id; drop table'],
    ['a value that is too long', 'a'.repeat(101)],
    ['a JSON-looking value', '{"level":"error"}'],
  ])('should ignore a caller id with %s', async (_label, value) => {
    const res = await request(appWith()).get('/').set('x-request-id', value);

    expect(res.body.requestId).toMatch(UUID);
  });

  it('should prefer the API Gateway request id, which a caller cannot choose', async () => {
    const fromGateway: express.RequestHandler = (req, _res, next) => {
      req.apiGateway = { event: { requestContext: { requestId: 'GW-abc123=' } } };
      next();
    };

    const res = await request(appWith(fromGateway)).get('/').set('x-request-id', 'caller-id');

    expect(res.body.requestId).toBe('GW-abc123=');
    expect(res.headers['x-request-id']).toBe('GW-abc123=');
  });
});
