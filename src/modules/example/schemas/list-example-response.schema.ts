import { paginatedResponseSchema } from '@shared/schemas/paginated-response.schema';
import { exampleSchema } from './example.schema';

export const listExampleResponseSchema =
  paginatedResponseSchema(exampleSchema).openapi('ListExampleResponse');
