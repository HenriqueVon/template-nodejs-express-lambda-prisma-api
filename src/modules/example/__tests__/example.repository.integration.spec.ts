import { describe, it, expect, beforeEach, afterAll, vi, type MockInstance } from 'vitest';
import { prisma } from '@services/database/prisma/prisma.client';
import { closeDatabase, resetDatabase } from '../../../test/integration/database';
import { ExampleRepository } from '../repositories/example.repository';
import { ConflictError, NotFoundError } from '@shared/errors/app-error';
import { requestContext } from '@shared/logging/request-context';

// Runs the real repository against PostgreSQL (see vitest.integration.config.ts). What the mocks of the
// unit specs cannot show: constraints, column limits, ordering and pagination, and the Prisma errors
// that prismaCall translates.
describe('ExampleRepository (PostgreSQL)', () => {
  const sut = new ExampleRepository();
  let warn: MockInstance<typeof console.warn>;

  beforeEach(async () => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await resetDatabase();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  describe('create and find', () => {
    it('should store a record with a generated id and timestamps', async () => {
      const created = await sut.create({ name: 'First', description: 'Text' });

      expect(created.id).toMatch(/^c[a-z0-9]{20,}$/);
      expect(created).toMatchObject({ name: 'First', description: 'Text' });
      expect(created.createdAt).toBeInstanceOf(Date);
      expect(created.updatedAt).toBeInstanceOf(Date);
      expect(await sut.findById(created.id)).toEqual(created);
    });

    it('should store a missing description as null', async () => {
      const created = await sut.create({ name: 'No description' });

      expect(created.description).toBeNull();
    });

    it('should find a record by its unique name, and return null when there is none', async () => {
      const created = await sut.create({ name: 'Findable' });

      expect(await sut.findByName('Findable')).toEqual(created);
      expect(await sut.findByName('Missing')).toBeNull();
      expect(await sut.findById('ckl8p2x1a0000x8kq3b0c9a1z')).toBeNull();
    });
  });

  describe('constraints', () => {
    it('should translate the unique constraint on the name into a ConflictError', async () => {
      await sut.create({ name: 'Unique' });

      await expect(sut.create({ name: 'Unique' })).rejects.toBeInstanceOf(ConflictError);
    });

    it('should log the model and the constraint of a unique violation, with the id of the request, never the values', async () => {
      await sut.create({ name: 'Secret value' });

      // The error comes from the real database through the pg adapter: this is the shape prismaCall must read
      await expect(
        requestContext.run({ requestId: 'req-from-test' }, () => sut.create({ name: 'Secret value' }))
      ).rejects.toBeInstanceOf(ConflictError);

      const lines = warn.mock.calls.map(([line]) => JSON.parse(line as string));
      expect(lines).toEqual([
        expect.objectContaining({ event: 'unique_constraint_violation', requestId: 'req-from-test', model: 'Example', constraint: 'examples_name_key' }),
      ]);
      expect(JSON.stringify(lines)).not.toContain('Secret value');
    });

    it('should refuse a name longer than the column (VarChar(100)), which the Zod schema also limits', async () => {
      await expect(sut.create({ name: 'x'.repeat(101) })).rejects.toThrow();
      await expect(sut.create({ name: 'x'.repeat(100) })).resolves.toMatchObject({ name: 'x'.repeat(100) });
    });

    it('should refuse a description longer than the column (VarChar(255))', async () => {
      await expect(sut.create({ name: 'Long', description: 'x'.repeat(256) })).rejects.toThrow();
    });
  });

  describe('findMany', () => {
    // Same createdAt for all of them: only the id tie-breaker keeps the order, and so the pages, stable
    async function seedFive() {
      const createdAt = new Date('2026-01-01T00:00:00.000Z');
      await prisma.example.createMany({
        data: ['ex-1', 'ex-2', 'ex-3', 'ex-4', 'ex-5'].map((id) => ({ id, name: `Name ${id}`, createdAt, updatedAt: createdAt })),
      });
    }

    it('should list the newest first by default, with the id as tie-breaker, and count them all', async () => {
      await seedFive();

      const { items, total } = await sut.findMany();

      expect(total).toBe(5);
      expect(items.map((item) => item.id)).toEqual(['ex-5', 'ex-4', 'ex-3', 'ex-2', 'ex-1']);
    });

    it('should paginate without repeating or skipping a record', async () => {
      await seedFive();

      const pages = await Promise.all([0, 2, 4].map((offset) => sut.findMany({}, { limit: 2, offset })));

      expect(pages.map((page) => page.total)).toEqual([5, 5, 5]);
      expect(pages.flatMap((page) => page.items.map((item) => item.id))).toEqual(['ex-5', 'ex-4', 'ex-3', 'ex-2', 'ex-1']);
    });

    it('should order by the requested field in the requested direction', async () => {
      await seedFive();

      const ascending = await sut.findMany({}, { orderBy: 'name', orderDirection: 'asc' });
      const descending = await sut.findMany({}, { orderBy: 'name', orderDirection: 'desc' });

      expect(ascending.items.map((item) => item.name)).toEqual(['Name ex-1', 'Name ex-2', 'Name ex-3', 'Name ex-4', 'Name ex-5']);
      expect(descending.items[0].name).toBe('Name ex-5');
    });

    it('should never return more than 100 records, whatever the limit', async () => {
      await prisma.example.createMany({
        data: Array.from({ length: 105 }, (_, index) => ({ id: `bulk-${index}`, name: `Bulk ${index}`, updatedAt: new Date() })),
      });

      const { items, total } = await sut.findMany({}, { limit: 1000 });

      expect(items).toHaveLength(100);
      expect(total).toBe(105);
    });

    it('should return an empty page with a total of zero when there are no records', async () => {
      expect(await sut.findMany()).toEqual({ items: [], total: 0 });
    });
  });

  describe('update', () => {
    it('should change the given fields and move updatedAt forward, keeping createdAt', async () => {
      const created = await sut.create({ name: 'Before', description: 'Old' });
      await new Promise((resolve) => setTimeout(resolve, 10));

      const updated = await sut.update(created.id, { description: 'New' });

      expect(updated).toMatchObject({ id: created.id, name: 'Before', description: 'New' });
      expect(updated.createdAt).toEqual(created.createdAt);
      expect(updated.updatedAt.getTime()).toBeGreaterThan(created.updatedAt.getTime());
    });

    it('should clear the description when it is set to null', async () => {
      const created = await sut.create({ name: 'With text', description: 'Text' });

      expect((await sut.update(created.id, { description: null })).description).toBeNull();
    });

    it('should translate a record that does not exist (P2025) into a NotFoundError', async () => {
      await expect(sut.update('ckl8p2x1a0000x8kq3b0c9a1z', { name: 'Nobody' })).rejects.toBeInstanceOf(NotFoundError);
    });

    it('should translate a name that belongs to another record into a ConflictError', async () => {
      await sut.create({ name: 'Taken' });
      const other = await sut.create({ name: 'Other' });

      await expect(sut.update(other.id, { name: 'Taken' })).rejects.toBeInstanceOf(ConflictError);
    });
  });

  describe('delete', () => {
    it('should remove the record', async () => {
      const created = await sut.create({ name: 'To delete' });

      await sut.delete(created.id);

      expect(await sut.findById(created.id)).toBeNull();
    });

    it('should translate a record that does not exist into a NotFoundError', async () => {
      await expect(sut.delete('ckl8p2x1a0000x8kq3b0c9a1z')).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});
