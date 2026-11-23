import request from 'supertest';
import express from 'express';
import { describe, it, expect } from 'vitest';
import { requestContainerMiddleware } from '../request-container.middleware';
import { requestIdMiddleware } from '../request-id.middleware';
import { getRequestId } from '@shared/logging/request-context';

// The order of app.ts: id, body parser, then the container and the request context
const app = express();
app.use(requestIdMiddleware);
app.use(express.json());
app.use(requestContainerMiddleware);
app.post('/echo', async (req, res) => {
  // Several awaits after the body was parsed: the context must survive all of them
  await new Promise((resolve) => setTimeout(resolve, 5));
  await Promise.resolve();
  res.json({ fromContext: getRequestId(), fromRequest: req.requestId, hasContainer: Boolean(req.container) });
});

describe('requestContainerMiddleware', () => {
  it('should give the request its own container', async () => {
    const res = await request(app).post('/echo').send({ name: 'x' });

    expect(res.body.hasContainer).toBe(true);
  });

  it('should make the request id available to code that has no `req`, after a body was parsed and after awaits', async () => {
    const res = await request(app).post('/echo').send({ name: 'with a body' });

    expect(res.body.fromContext).toBe(res.headers['x-request-id']);
    expect(res.body.fromContext).toBe(res.body.fromRequest);
  });

  it('should keep concurrent requests apart', async () => {
    const responses = await Promise.all(
      ['one', 'two', 'three', 'four'].map((id) => request(app).post('/echo').set('x-request-id', id).send({ id }))
    );

    responses.forEach((res, index) => {
      expect(res.body.fromContext).toBe(['one', 'two', 'three', 'four'][index]);
    });
  });
});
