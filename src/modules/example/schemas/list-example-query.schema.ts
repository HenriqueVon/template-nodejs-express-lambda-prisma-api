import { z } from 'zod';

// The coerced numbers are documented with an explicit OpenAPI type: without it, zod-to-openapi
// documents them as `number | null`, because z.coerce.number() turns null into 0.
export const listExampleQuerySchema = z.object({
  limit          : z.coerce.number().int().min(1).max(100).optional().openapi({ type: 'integer', minimum: 1, maximum: 100 }),
  offset         : z.coerce.number().int().min(0).optional().openapi({ type: 'integer', minimum: 0 }),
  orderBy        : z.enum(['id', 'name', 'createdAt']).optional(),
  orderDirection : z.enum(['asc', 'desc']).optional(),
}).strict();
