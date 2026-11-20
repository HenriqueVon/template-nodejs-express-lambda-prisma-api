import { openApiRegistry } from '@docs/openapi/registry';
import { globalErrorResponses, responseRef } from '@docs/openapi/responses';
import { idParamsSchema } from '@shared/schemas/id.schema';
import {
  createExampleSchema,
  updateExampleSchema,
  listExampleQuerySchema,
  exampleSchema,
  listExampleResponseSchema,
} from './schemas';

const createExampleInput = openApiRegistry.register(
  'CreateExampleInput',
  createExampleSchema
);

// minProperties documents the "at least one field" refine rule
const updateExampleInput = openApiRegistry.register(
  'UpdateExampleInput',
  updateExampleSchema.openapi({ minProperties: 1 })
);

const exampleInputExample = {
  name        : 'First example',
  description : 'A record used to show the pattern of a module',
};

const exampleExample = {
  id          : 'cm1234567890abcdefghijkl',
  name        : 'First example',
  description : 'A record used to show the pattern of a module',
  createdAt   : '2026-01-01T00:00:00.000Z',
  updatedAt   : '2026-01-01T00:00:00.000Z',
};

openApiRegistry.registerPath({
  method      : 'get',
  path        : '/examples',
  tags        : ['Examples'],
  summary     : 'List',
  operationId : 'listExample',
  request     : {
    query: listExampleQuerySchema,
  },
  responses: {
    200: {
      description : 'Example list returned successfully',
      content     : {
        'application/json': {
          schema  : listExampleResponseSchema,
          example : { items: [exampleExample], total: 1 },
        },
      },
    },
    400: responseRef('ValidationError'),
    ...globalErrorResponses,
  },
});

openApiRegistry.registerPath({
  method      : 'post',
  path        : '/examples',
  tags        : ['Examples'],
  summary     : 'Create',
  operationId : 'createExample',
  request     : {
    body: {
      required : true,
      content  : {
        'application/json': {
          schema  : createExampleInput,
          example : exampleInputExample,
        },
      },
    },
  },
  responses: {
    201: {
      description : 'Example created successfully',
      content     : {
        'application/json': {
          schema  : exampleSchema,
          example : exampleExample,
        },
      },
    },
    400 : responseRef('ValidationError'),
    409 : responseRef('Conflict'),
    ...globalErrorResponses,
  },
});

openApiRegistry.registerPath({
  method      : 'get',
  path        : '/examples/{id}',
  tags        : ['Examples'],
  summary     : 'Get by id',
  operationId : 'getExampleById',
  request     : {
    params: idParamsSchema,
  },
  responses: {
    200: {
      description : 'Example returned successfully',
      content     : {
        'application/json': {
          schema  : exampleSchema,
          example : exampleExample,
        },
      },
    },
    400 : responseRef('ValidationError'),
    404 : responseRef('NotFound'),
    ...globalErrorResponses,
  },
});

openApiRegistry.registerPath({
  method      : 'patch',
  path        : '/examples/{id}',
  tags        : ['Examples'],
  summary     : 'Update',
  operationId : 'updateExample',
  request     : {
    params : idParamsSchema,
    body   : {
      required : true,
      content  : {
        'application/json': {
          schema  : updateExampleInput,
          example : exampleInputExample,
        },
      },
    },
  },
  responses: {
    200: {
      description : 'Example updated successfully',
      content     : {
        'application/json': {
          schema  : exampleSchema,
          example : exampleExample,
        },
      },
    },
    400 : responseRef('ValidationError'),
    404 : responseRef('NotFound'),
    409 : responseRef('Conflict'),
    ...globalErrorResponses,
  },
});

openApiRegistry.registerPath({
  method      : 'delete',
  path        : '/examples/{id}',
  tags        : ['Examples'],
  summary     : 'Delete by id',
  operationId : 'deleteExample',
  request     : {
    params: idParamsSchema,
  },
  responses: {
    204: {
      description: 'Example deleted successfully',
    },
    400 : responseRef('ValidationError'),
    404 : responseRef('NotFound'),
    ...globalErrorResponses,
  },
});
