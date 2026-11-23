import { Prisma } from '@prisma/client';
import { ConflictError, NotFoundError } from '../../errors/app-error';
import { logger } from '../../logging/logger';

// What the error says about the violated unique constraint. With the pg adapter of Prisma 7 the constraint is
// `{ index: '<name>' }` (checked against a real PostgreSQL by the integration tests); other drivers and
// versions use `{ fields: [...] }` or `meta.target`, so those are read too. Values are never read.
function uniqueViolationDetails(err: Prisma.PrismaClientKnownRequestError) {
  const meta = err.meta as any;
  const constraint = meta?.driverAdapterError?.cause?.constraint;
  const target = meta?.target;

  const fields = Array.isArray(constraint?.fields) ? constraint.fields : Array.isArray(target) ? target : undefined;
  const index = constraint?.index ?? (typeof target === 'string' ? target : undefined);

  return {
    model      : meta?.modelName,
    constraint : index,
    fields     : fields?.length ? fields : undefined,
  };
}

// Wraps a database write and translates the Prisma errors that have an HTTP meaning
export async function prismaCall<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      // Unique constraint violation
      if (err.code === 'P2002') {
        // Which constraint conflicted, never the values
        logger.warn('unique_constraint_violation', uniqueViolationDetails(err));
        throw new ConflictError();
      }

      // Record to update/delete does not exist
      if (err.code === 'P2025') {
        throw new NotFoundError();
      }

      // Foreign key violation
      if (err.code === 'P2003') {
        throw new ConflictError('Operation conflicts with related records');
      }
    }

    throw err;
  }
}
