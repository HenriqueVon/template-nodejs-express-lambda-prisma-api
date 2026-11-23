import { describe, it, expect, vi, beforeEach, type MockInstance } from 'vitest';
import { Prisma } from '@prisma/client';
import { prismaCall } from '../prisma-call';
import { ConflictError, NotFoundError } from '../../../errors/app-error';
import { requestContext } from '../../../logging/request-context';

function prismaError(code: string, meta?: Record<string, unknown>) {
  return new Prisma.PrismaClientKnownRequestError('failure', { code, clientVersion: 'test', meta });
}

describe('prismaCall', () => {
  let warn: MockInstance<typeof console.warn>;

  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  it('should return the result of the call', async () => {
    await expect(prismaCall(async () => 42)).resolves.toBe(42);
  });

  describe('unique constraint violation (P2002)', () => {
    const logged = () => JSON.parse(warn.mock.calls[0][0] as string);
    const fail = (meta: Record<string, unknown>) =>
      requestContext.run({ requestId: 'req-9' }, () => prismaCall(() => Promise.reject(prismaError('P2002', meta))));

    it('should become a ConflictError', async () => {
      await expect(fail({ modelName: 'Example' })).rejects.toBeInstanceOf(ConflictError);
    });

    it('should log the model and the constraint name of the pg adapter of Prisma 7, with the request id', async () => {
      const meta = {
        modelName          : 'Example',
        driverAdapterError : { cause: { kind: 'UniqueConstraintViolation', constraint: { index: 'examples_name_key' }, table: 'examples' } },
      };

      await expect(fail(meta)).rejects.toBeInstanceOf(ConflictError);

      expect(logged()).toMatchObject({ level: 'warn', event: 'unique_constraint_violation', requestId: 'req-9', model: 'Example', constraint: 'examples_name_key' });
      expect(logged()).not.toHaveProperty('fields');
    });

    it('should also read the columns when the adapter gives them, or the Prisma `target`', async () => {
      await expect(fail({ modelName: 'Example', driverAdapterError: { cause: { constraint: { fields: ['name'] } } } })).rejects.toBeInstanceOf(ConflictError);
      expect(logged().fields).toEqual(['name']);

      warn.mockClear();

      await expect(fail({ modelName: 'Example', target: ['name', 'ledger_id'] })).rejects.toBeInstanceOf(ConflictError);
      expect(logged().fields).toEqual(['name', 'ledger_id']);

      warn.mockClear();

      await expect(fail({ modelName: 'Example', target: 'examples_name_key' })).rejects.toBeInstanceOf(ConflictError);
      expect(logged().constraint).toBe('examples_name_key');
    });

    it('should still translate an error with no meta at all', async () => {
      await expect(requestContext.run({ requestId: 'req-9' }, () => prismaCall(() => Promise.reject(prismaError('P2002'))))).rejects.toBeInstanceOf(ConflictError);
      expect(logged()).toMatchObject({ event: 'unique_constraint_violation' });
    });
  });

  it('should turn a missing record (P2025) into a NotFoundError', async () => {
    await expect(prismaCall(() => Promise.reject(prismaError('P2025')))).rejects.toBeInstanceOf(NotFoundError);
  });

  it('should turn a foreign key violation (P2003) into a ConflictError about related records', async () => {
    await expect(prismaCall(() => Promise.reject(prismaError('P2003')))).rejects.toMatchObject({
      statusCode : 409,
      message    : 'Operation conflicts with related records',
    });
  });

  it('should let every other error through untouched', async () => {
    const other = new Error('connection lost');

    await expect(prismaCall(() => Promise.reject(other))).rejects.toBe(other);
    await expect(prismaCall(() => Promise.reject(prismaError('P2002_OTHER')))).rejects.toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
  });
});
