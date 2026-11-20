import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { Prisma } from '@prisma/client';
import routes from '../../../routes';
import { createOpenApiDocument } from '../document';
import { openApiTags } from '../tags';
import {
  listExpressRoutes,
  listDocumentedOperations,
  forEachOperation,
} from './helpers';

const document = createOpenApiDocument() as any;

const SUCCESS_STATUS_BY_METHOD: Record<string, string> = {
  get    : '200',
  post   : '201',
  patch  : '200',
  delete : '204',
};

describe('OpenAPI document', () => {
  describe('routes', () => {
    it('should document every Express route, and only those routes', () => {
      expect(listDocumentedOperations(document)).toEqual(listExpressRoutes(routes));
    });

    it('should document the success status used by the controllers for each method', () => {
      forEachOperation(document, (name, operation, _path, method) => {
        const successStatuses = Object.keys(operation.responses).filter((status) => status.startsWith('2'));

        expect(successStatuses, name).toEqual([SUCCESS_STATUS_BY_METHOD[method]]);
      });
    });
  });

  describe('security', () => {
    it('should require the API key globally and add no per-operation security', () => {
      expect(document.security).toEqual([{ ApiKeyAuth: [] }]);

      forEachOperation(document, (name, operation) => {
        expect(operation.security, name).toBeUndefined();
      });
    });

    it('should define the security scheme used by the global middleware', () => {
      expect(document.components.securitySchemes).toEqual({
        ApiKeyAuth: { type: 'apiKey', in: 'header', name: 'x-api-key' },
      });
    });
  });

  describe('error responses', () => {
    it('should document the global 401, 403, 413 and 500 responses on every operation', () => {
      forEachOperation(document, (name, operation) => {
        expect(operation.responses['401'], name).toEqual({ $ref: '#/components/responses/Unauthorized' });
        expect(operation.responses['403'], name).toEqual({ $ref: '#/components/responses/Forbidden' });
        expect(operation.responses['413'], name).toEqual({ $ref: '#/components/responses/PayloadTooLarge' });
        expect(operation.responses['500'], name).toEqual({ $ref: '#/components/responses/InternalError' });
      });
    });

    it('should document 400 on every operation and 404 on every operation with an id', () => {
      forEachOperation(document, (name, operation, path) => {
        expect(operation.responses['400'], name).toBeDefined();

        if (path.includes('{id}')) {
          expect(operation.responses['404'], name).toEqual({ $ref: '#/components/responses/NotFound' });
        } else {
          expect(operation.responses['404'], name).toBeUndefined();
        }
      });
    });

    it('should document 409 on every operation that can violate a unique constraint or a foreign key', () => {
      // A relation field `<name>` backed by a scalar `<name>Id` means the model holds a foreign key
      const holders = new Set<string>();
      const referenced = new Set<string>();

      // The runtime DMMF of Prisma 7 does not describe unique constraints, so they are read from the schema file
      const schemaSource = readFileSync(
        resolve(__dirname, '../../../services/database/prisma/schema.prisma'),
        'utf8'
      );
      const unique = new Set(
        [...schemaSource.matchAll(/^model\s+(\w+)\s*\{([^}]*)\}/gm)]
          .filter(([, , body]) => /@unique|@@unique/.test(body))
          .map(([, name]) => name)
      );

      for (const model of Prisma.dmmf.datamodel.models) {
        const scalars = new Set(model.fields.filter((field) => field.kind === 'scalar').map((field) => field.name));

        for (const relation of model.fields.filter((field) => field.kind === 'object')) {
          if (scalars.has(`${relation.name}Id`)) {
            holders.add(model.name);
            referenced.add(relation.type);
          }
        }
      }

      forEachOperation(document, (name, operation, path, method) => {
        // The record of a path is the one of its /{id} operation: `/things` and `/things/{id}/cancel` -> `/things/{id}`
        const itemPath = path.includes('{id}') ? path.replace(/(\/\{id\}).*$/, '$1') : `${path}/{id}`;
        const itemOperation = document.paths[itemPath]?.get;

        // Not a CRUD resource: the specs of that module must cover its 409 responses
        if (!itemOperation) return;

        const model = itemOperation.responses['200'].content['application/json'].schema.$ref.split('/').pop();

        const writesConstrainedFields = (method === 'post' || method === 'patch') && (holders.has(model) || unique.has(model));
        const deletesReferencedRecord = method === 'delete' && referenced.has(model);

        if (writesConstrainedFields || deletesReferencedRecord) {
          expect(operation.responses['409'], `${name} (${model})`).toEqual({ $ref: '#/components/responses/Conflict' });
        }
      });
    });

    it('should reference shared response components for every error response', () => {
      forEachOperation(document, (name, operation) => {
        for (const [status, response] of Object.entries<any>(operation.responses)) {
          if (status.startsWith('2')) continue;

          expect(response.$ref, `${name} ${status}`).toMatch(/^#\/components\/responses\//);
        }
      });
    });
  });

  describe('integrity', () => {
    it('should resolve every $ref and leave no component unused', () => {
      // A document without operations references nothing, so every component would look unused
      if (Object.keys(document.paths).length === 0) return;

      const serialized = JSON.stringify(document);
      const references = new Set(
        [...serialized.matchAll(/"#\/components\/(schemas|responses)\/([A-Za-z]+)"/g)].map((m) => `${m[1]}/${m[2]}`)
      );

      const components = [
        ...Object.keys(document.components.schemas).map((name) => `schemas/${name}`),
        ...Object.keys(document.components.responses).map((name) => `responses/${name}`),
      ];

      expect([...references].filter((ref) => !components.includes(ref))).toEqual([]);
      expect(components.filter((component) => !references.has(component))).toEqual([]);
    });

    it('should have unique operationIds', () => {
      const operationIds: string[] = [];
      forEachOperation(document, (_name, operation) => operationIds.push(operation.operationId));

      expect(new Set(operationIds).size).toBe(operationIds.length);
    });

    it('should declare every path parameter', () => {
      forEachOperation(document, (name, operation, path) => {
        const pathParams = [...path.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
        const declared = (operation.parameters ?? [])
          .filter((parameter: any) => parameter.in === 'path')
          .map((parameter: any) => parameter.name);

        expect(declared, name).toEqual(pathParams);
      });
    });

    it('should only use declared tags, and use every declared tag', () => {
      const declared = openApiTags.map((tag) => tag.name);
      const used = new Set<string>();
      forEachOperation(document, (_name, operation) => operation.tags.forEach((tag: string) => used.add(tag)));

      expect([...used].sort()).toEqual([...declared].sort());
    });
  });

  // A project without models has no response schema to compare (an empty suite would fail the run)
  describe.skipIf(Prisma.dmmf.datamodel.models.length === 0)('response schemas', () => {
    const SCALAR_TYPES: Record<string, (property: any) => boolean> = {
      String   : (property) => property.type === 'string' && property.format === undefined,
      Boolean  : (property) => property.type === 'boolean',
      Int      : (property) => property.type === 'integer',
      Float    : (property) => property.type === 'number',
      DateTime : (property) => property.type === 'string' && property.format === 'date-time',
      Decimal  : (property) => property.type === 'string' && property.pattern !== undefined,
    };

    // The nullability of a column is not compared: an optional column is documented with `.nullable()`
    it.each(Prisma.dmmf.datamodel.models.map((model) => [model.name, model]))(
      'should document %s with the fields and JSON types of the Prisma model',
      (name, model) => {
        const schema = document.components.schemas[name];
        const fields = model.fields.filter((field) => field.kind === 'scalar' || field.kind === 'enum');

        expect(schema, `${name} response schema`).toBeDefined();
        expect(Object.keys(schema.properties).sort()).toEqual(fields.map((field) => field.name).sort());

        for (const field of fields) {
          const property = schema.properties[field.name];
          const matches = field.kind === 'enum'
            ? Array.isArray(property.enum)
            : SCALAR_TYPES[field.type]?.(property);

          expect(matches, `${name}.${field.name} (${field.type})`).toBe(true);
        }
      }
    );
  });
});
