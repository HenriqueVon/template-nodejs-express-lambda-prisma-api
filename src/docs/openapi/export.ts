// Writes the OpenAPI document to a file: `npm run docs:openapi [-- <file>]` (default: ./openapi.json).
// Useful to feed API clients, Postman or a documentation site. Needs the variables that
// src/config/env.ts requires (DATABASE_URL and API_KEY): any value works, the database is not used.
// The Zod OpenAPI extension must load before any schema module, so it is the first import.
import '../../config/zod-openapi';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createOpenApiDocument } from './document';

const output = resolve(process.argv[2] ?? 'openapi.json');

mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, `${JSON.stringify(createOpenApiDocument(), null, 2)}\n`);

console.info(`OpenAPI document written to ${output}`);
