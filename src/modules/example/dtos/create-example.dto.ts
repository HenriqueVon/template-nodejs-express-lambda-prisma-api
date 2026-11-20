import { z } from 'zod';
import { createExampleSchema } from '../schemas/create-example.schema';

export type CreateExampleDto = z.infer<typeof createExampleSchema>;
