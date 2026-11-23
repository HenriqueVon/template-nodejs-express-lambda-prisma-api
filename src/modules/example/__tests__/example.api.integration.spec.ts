import request from 'supertest';
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { env } from '@config/env';
import { closeDatabase, resetDatabase } from '../../../test/integration/database';
import { app } from '../../../app';

// The whole application (routes, validation, use cases, repository, Prisma) against PostgreSQL, through HTTP
describe('Examples API (PostgreSQL)', () => {
  const api = () => ({
    get    : (path = '') => request(app).get(`/v1/api/examples${path}`).set('x-api-key', env.apiKey),
    post   : (body: object, path = '') => request(app).post(`/v1/api/examples${path}`).set('x-api-key', env.apiKey).send(body),
    patch  : (path: string, body: object) => request(app).patch(`/v1/api/examples${path}`).set('x-api-key', env.apiKey).send(body),
    delete : (path: string) => request(app).delete(`/v1/api/examples${path}`).set('x-api-key', env.apiKey),
  });

  beforeEach(async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    await resetDatabase();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it('should create a record, trimming the name, and answer with exactly the documented fields', async () => {
    const res = await api().post({ name: '  First example ', description: 'A record' });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('First example');
    expect(Object.keys(res.body).sort()).toEqual(['createdAt', 'description', 'id', 'name', 'updatedAt']);
    expect(new Date(res.body.createdAt).toISOString()).toBe(res.body.createdAt);
  });

  it('should answer 409 for a name that already exists', async () => {
    await api().post({ name: 'First example' });

    const res = await api().post({ name: 'First example' });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CONFLICT');
    expect(res.headers['x-request-id']).toBeTruthy();
  });

  it('should create exactly one record when several requests create the same name at once', async () => {
    // The use case checks the name first, but two requests can both pass the check: the unique constraint
    // of the database is what keeps the data right, and prismaCall turns its error into the same 409
    const results = await Promise.all([
      api().post({ name: 'Raced' }),
      api().post({ name: 'Raced' }),
      api().post({ name: 'Raced' }),
    ]);

    const statuses = results.map((res) => res.status);
    expect(statuses.filter((status) => status === 201)).toHaveLength(1);
    expect(statuses.filter((status) => status === 409)).toHaveLength(2);
    expect((await api().get()).body.total).toBe(1);
  });

  it('should list, order and paginate', async () => {
    await api().post({ name: 'Bravo' });
    await new Promise((resolve) => setTimeout(resolve, 5));
    await api().post({ name: 'Alpha' });

    const newestFirst = await api().get();
    const byName = await api().get('?orderBy=name&orderDirection=asc');
    const page1 = await api().get('?limit=1&offset=0&orderBy=name');
    const page2 = await api().get('?limit=1&offset=1&orderBy=name');

    expect(newestFirst.body.total).toBe(2);
    expect(newestFirst.body.items.map((item: { name: string }) => item.name)).toEqual(['Alpha', 'Bravo']);
    expect(byName.body.items.map((item: { name: string }) => item.name)).toEqual(['Alpha', 'Bravo']);
    expect([page1.body.items[0].name, page2.body.items[0].name]).toEqual(['Alpha', 'Bravo']);
    expect(page1.body.total).toBe(2);
  });

  it('should get, update and delete by id', async () => {
    const { body: created } = await api().post({ name: 'Lifecycle', description: 'Text' });

    expect((await api().get(`/${created.id}`)).body).toEqual(created);

    const patched = await api().patch(`/${created.id}`, { description: null });
    expect(patched.status).toBe(200);
    expect(patched.body.description).toBeNull();

    expect((await api().delete(`/${created.id}`)).status).toBe(204);
    expect((await api().get(`/${created.id}`)).status).toBe(404);
    expect((await api().delete(`/${created.id}`)).status).toBe(404);
  });

  it('should answer 409 when a record is renamed to the name of another, and allow keeping its own name', async () => {
    const { body: first } = await api().post({ name: 'First' });
    await api().post({ name: 'Second' });

    expect((await api().patch(`/${first.id}`, { name: 'Second' })).status).toBe(409);
    expect((await api().patch(`/${first.id}`, { name: ' First ' })).status).toBe(200);
  });

  it('should answer 404 for a valid id that does not exist, and 400 for an invalid one', async () => {
    expect((await api().get('/ckl8p2x1a0000x8kq3b0c9a1z')).status).toBe(404);
    expect((await api().patch('/ckl8p2x1a0000x8kq3b0c9a1z', { name: 'Nobody' })).status).toBe(404);
    expect((await api().get('/123')).status).toBe(400);
  });

  it('should refuse the API without the key', async () => {
    expect((await request(app).get('/v1/api/examples')).status).toBe(401);
  });
});
