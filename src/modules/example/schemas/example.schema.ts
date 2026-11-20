import { z } from 'zod';
import { dateTimeString } from '@shared/schemas/output.schema';

// Response shape: the Prisma `Example` model as serialized to JSON
export const exampleSchema = z.object({
  id          : z.string(),
  name        : z.string(),
  description : z.string().nullable(),
  createdAt   : dateTimeString,
  updatedAt   : dateTimeString,
}).openapi('Example');
