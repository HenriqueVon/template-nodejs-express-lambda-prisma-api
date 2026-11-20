import { describe, it, expect, beforeAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import { container } from 'tsyringe';
import { Prisma } from '@prisma/client';
import type { ZodType } from 'zod';
import routes from '../../../routes';
import { errorHandler, requestContainerMiddleware } from '@shared/http/middlewares';
import { createOpenApiDocument } from '../document';
import { API_BASE_PATH } from './helpers';

// @template:example:start
import { EXAMPLE_REPOSITORY } from '@modules/example/repositories/example.tokens';
import { exampleSchema, listExampleResponseSchema } from '@modules/example/schemas';
// @template:example:end

// Runs every documented operation through the real route → validation → controller → use case
// pipeline, with repositories replaced by mocks that return Prisma-like records (Decimal, Date).
// The response must use the documented success status and match the documented example and schema.

type ModuleContract = {
  model: string;
  token: string;
  path: string;
  entitySchema: ZodType;
  listSchema: ZodType;
};

// One entry per CRUD module. Add the entry of every new module here.
const modules: ModuleContract[] = [
  // @template:example:start
  { model: 'Example', token: EXAMPLE_REPOSITORY, path: '/examples', entitySchema: exampleSchema, listSchema: listExampleResponseSchema },
  // @template:example:end
];

const document = createOpenApiDocument() as any;

const app = express();
app.use(express.json());
app.use(requestContainerMiddleware);
app.use(routes);
app.use(errorHandler);

// Builds the record Prisma would return for the documented example (Decimal and Date instances)
function toPrismaRecord(model: string, example: Record<string, unknown>) {
  const fields = Prisma.dmmf.datamodel.models.find((m) => m.name === model)!.fields;

  return Object.fromEntries(Object.entries(example).map(([key, value]) => {
    const type = fields.find((field) => field.name === key)?.type;

    if (value !== null && type === 'Decimal') return [key, new Prisma.Decimal(value as string)];
    if (value !== null && type === 'DateTime') return [key, new Date(value as string)];
    return [key, value];
  }));
}

function repositoryMock(record: Record<string, unknown>) {
  return {
    create     : async () => record,
    // Any other id finds nothing
    findById   : async (id: string) => (id === record.id ? record : null),
    findByName : async () => null,
    findMany   : async () => ({ items: [record], total: 1 }),
    update     : async () => record,
    delete     : async () => undefined,
  };
}

function jsonExample(content: any) {
  return content?.['application/json']?.example;
}

describe('OpenAPI contract coverage', () => {
  it('should have a contract entry for every documented resource', () => {
    const documentedResources = Object.keys(document.paths)
      .filter((path) => path.endsWith('/{id}'))
      .map((path) => path.replace('/{id}', ''))
      .sort();

    expect(modules.map((module) => module.path).sort()).toEqual(documentedResources);
  });
});

describe.each(modules)('$model contract', ({ model, token, path, entitySchema, listSchema }) => {
  const itemPath = `${path}/{id}`;
  const entityExample = jsonExample(document.paths[itemPath].get.responses['200'].content);

  beforeAll(() => {
    container.register(token, { useValue: repositoryMock(toPrismaRecord(model, entityExample)) });
  });

  it.each([
    ['get', path, listSchema],
    ['post', path, entitySchema],
    ['get', itemPath, entitySchema],
    ['patch', itemPath, entitySchema],
    ['delete', itemPath, undefined],
  ] as const)('%s %s', async (method, operationPath, responseSchema) => {
    const operation = document.paths[operationPath][method];
    const [successStatus] = Object.keys(operation.responses).filter((status) => status.startsWith('2'));
    const url = `${API_BASE_PATH}${operationPath.replace('{id}', entityExample.id)}`;

    const res = await request(app)[method](url).send(jsonExample(operation.requestBody?.content));

    expect(res.status, JSON.stringify(res.body)).toBe(Number(successStatus));

    if (responseSchema) {
      expect(res.body).toEqual(jsonExample(operation.responses[successStatus].content));
      expect(responseSchema.safeParse(res.body).success).toBe(true);
    } else {
      expect(res.body).toEqual({});
    }
  });
});
