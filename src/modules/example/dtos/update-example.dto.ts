import { z } from 'zod';
import { updateExampleSchema } from '../schemas/update-example.schema';

export type UpdateExampleDto = z.infer<typeof updateExampleSchema>;
