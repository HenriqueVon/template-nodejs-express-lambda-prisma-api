import { Prisma } from '@prisma/client';
import { ConflictError, NotFoundError } from '../../errors/app-error';

function extractUniqueFields(err: any): string[] | undefined {
  // Prisma Adapter format
  const fields = err?.meta?.driverAdapterError?.cause?.constraint?.fields;
  if (Array.isArray(fields) && fields.length) return fields;

  const target = err?.meta?.target;
  if (Array.isArray(target) && target.length) return target;

  if (typeof target === 'string' && target) return [target];

  return undefined;
}

// Wraps a database write and translates the Prisma errors that have an HTTP meaning
export async function prismaCall<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      // Unique constraint violation
      if (err.code === 'P2002') {
        const model = (err.meta as any)?.modelName;
        const fields = extractUniqueFields(err);

        const suffix =
          model && fields?.length
            ? ` (${model}.${fields.join(', ')})`
            : model
              ? ` (${model})`
              : '';
        console.error(`Unique constraint violation${suffix}`);
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
