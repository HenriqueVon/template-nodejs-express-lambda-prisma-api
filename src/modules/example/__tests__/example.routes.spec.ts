import request from 'supertest';
import express from 'express';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const controllerSpy = vi.fn();

vi.mock('@shared/http/controller.adapter', () => {
  return {
    controllerAdapter: () => {
      return async (req: any, res: any) => {
        controllerSpy(req);
        return res.status(200).json({ ok: true });
      };
    },
  };
});

import exampleRouter from '../example.routes';

describe('Example routes (validateRequest + wiring)', () => {
  let app: express.Express;

  const validCuid = 'ckl8p2x1a0000x8kq3b0c9a1z';

  beforeEach(() => {
    controllerSpy.mockClear();

    app = express();
    app.use(express.json());
    app.use('/examples', exampleRouter);
  });

  describe('GET /examples', () => {
    it('should return 400 when the limit is out of range', async () => {
      const res = await request(app).get('/examples').query({ limit: 101 });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Invalid query');
      expect(controllerSpy).not.toHaveBeenCalled();
    });

    it('should return 400 when orderBy is not a sortable field', async () => {
      const res = await request(app).get('/examples').query({ orderBy: 'description' });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Invalid query');
      expect(controllerSpy).not.toHaveBeenCalled();
    });

    it('should pass validation and call the controller on a valid query', async () => {
      const res = await request(app).get('/examples').query({ limit: 10, offset: 0, orderBy: 'name' });

      expect(res.status).toBe(200);
      expect(controllerSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('POST /examples', () => {
    it('should return 400 when the name is too short', async () => {
      const res = await request(app).post('/examples').send({ name: 'Ex' });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Invalid body');
      expect(res.body.issues.some((i: any) => i.path === 'name')).toBe(true);
      expect(controllerSpy).not.toHaveBeenCalled();
    });

    it('should return 400 when the name is missing', async () => {
      const res = await request(app).post('/examples').send({ description: 'Text' });

      expect(res.status).toBe(400);
      expect(res.body.issues.some((i: any) => i.path === 'name')).toBe(true);
      expect(controllerSpy).not.toHaveBeenCalled();
    });

    it('should return 400 when an unknown field is sent next to a valid body', async () => {
      const res = await request(app).post('/examples').send({ name: 'First', extra: 'nope' });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Invalid body');
      expect(controllerSpy).not.toHaveBeenCalled();
    });

    it('should pass validation and call the controller on a valid body', async () => {
      const res = await request(app).post('/examples').send({ name: 'First', description: 'Text' });

      expect(res.status).toBe(200);
      expect(controllerSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('GET /examples/:id', () => {
    it('should return 400 when the id is invalid', async () => {
      const res = await request(app).get('/examples/123');

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Invalid params');
      expect(controllerSpy).not.toHaveBeenCalled();
    });

    it('should pass validation and call the controller on a valid id', async () => {
      const res = await request(app).get(`/examples/${validCuid}`);

      expect(res.status).toBe(200);
      expect(controllerSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('PATCH /examples/:id', () => {
    it('should return 400 when the body is empty', async () => {
      const res = await request(app).patch(`/examples/${validCuid}`).send({});

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Invalid body');
      expect(res.body.issues.some((i: any) => i.path === '')).toBe(true);
      expect(controllerSpy).not.toHaveBeenCalled();
    });

    it('should return 400 when the id is invalid', async () => {
      const res = await request(app).patch('/examples/123').send({ name: 'Second' });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Invalid params');
      expect(
        res.body.issues.some((i: any) => i.path === 'id' && i.message === 'Invalid id')
      ).toBe(true);
      expect(controllerSpy).not.toHaveBeenCalled();
    });

    it('should pass validation and call the controller when updating only the description', async () => {
      const res = await request(app).patch(`/examples/${validCuid}`).send({ description: null });

      expect(res.status).toBe(200);
      expect(controllerSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('DELETE /examples/:id', () => {
    it('should return 400 when the id is invalid', async () => {
      const res = await request(app).delete('/examples/123');

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Invalid params');
      expect(controllerSpy).not.toHaveBeenCalled();
    });

    it('should pass validation and call the controller on a valid id', async () => {
      const res = await request(app).delete(`/examples/${validCuid}`);

      expect(res.status).toBe(200);
      expect(controllerSpy).toHaveBeenCalledTimes(1);
    });
  });
});
