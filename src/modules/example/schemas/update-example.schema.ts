import { z } from 'zod';

export const updateExampleSchema = z
  .object({
    name        : z.string().min(3, 'Name must have at least 3 characters').max(100, 'Name must have at most 100 characters').optional(),
    description : z.string().max(255, 'Description must have at most 255 characters').nullable().optional(),
  })
  .strict()
  .refine(
    (data) => Object.keys(data).length > 0,
    {
      message: 'At least one field must be provided',
    }
  );
