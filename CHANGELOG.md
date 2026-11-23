# Changelog

All notable changes to the template are recorded here, following [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Projects created from the template do not inherit this file (`npm run init` deletes it).

## [Unreleased]

### Added

- Integration tests on a real PostgreSQL (`npm run test:integration`): the repository and the whole API of the example module, with a check that the migrations produce exactly `schema.prisma`. The run refuses a database whose name does not end with `_test`. CI runs them in an `integration` job (PostgreSQL service container) that must pass before the migrations and the deploy.
- Structured JSON logs through `logger`, an access log line per request, and a request id: the API Gateway id on Lambda, a valid `x-request-id` from the caller, or a UUID. It is returned in the `x-request-id` header and carried to code without `req` by an `AsyncLocalStorage`.
- `DB_POOL_MAX` (default 2) to limit the connections of each Lambda container, and a global API Gateway throttle (50 requests per second, burst 100) in `serverless.yml`.
- A workflow that tests the `init` script (template repository only): it runs `npm run init` on a copy in both modes and checks that no template text or template-only file is left in the generated project, then runs `npm ci`, lint, type check and both test suites on it.
- Documentation: six architecture decision records (`docs/adr/`), `docs/SERVERLESS.md` (cold starts, database connections, concurrency, limits, when not to use Lambda) and `docs/SECURITY.md` (limits of the API key, rotation, what to add before real data). The development guide gained the expand → migrate → contract strategy, how to roll back and how to protect `prd`.

### Changed

- `config/env.ts` validates every variable with a Zod schema and stops the start with one message that lists all the problems. `API_KEY` must have at least 16 characters, `NODE_ENV` must be a known value and `DOCS_ENABLED` is a boolean.
- `safeCompare` compares SHA-256 hashes, so it no longer returns early when the lengths differ and does not reveal the length of the key.
- `errorHandler` and `prismaCall` log through `logger` with the request id instead of plain `console` lines.
- The middlewares are ordered request id, access log, body parser, request context, so a request rejected by the body parser also has an id and a log line.
- `tsconfig.json` no longer uses `moduleResolution: "Node"` and `baseUrl`, both deprecated in TypeScript 6 and removed in 7: it sets `module: "preserve"` (which implies the `bundler` resolution that esbuild and tsx already use) and writes the path aliases relative to the file (`"@shared/*": ["./src/shared/*"]`). The type check, the lint, both test suites, `tsx`, the local server and the esbuild bundle give the same result on TypeScript 5.9.3 and 6.0.3, so a project can upgrade TypeScript without touching the configuration.
- ESLint and `@eslint/js` moved to version 10 (they must move together: `@eslint/js` 10 requires `eslint` 10 as a peer). Its new `preserve-caught-error` rule asks for the original error as the `cause` of one that is rethrown, which the integration setup now does.
- Dependency updates: `@asteasolutions/zod-to-openapi` 9 (type-only breaking change, not used by the code), `dotenv` 18, `esbuild` 0.28, `globals` 17 and `concurrently` 10. The major versions of Express, Serverless, TypeScript, `serverless-offline`, Vitest and `@types/node` are ignored on purpose.

### Fixed

- The log of a unique violation in `prismaCall` lacked the constraint: with the pg adapter of Prisma 7 the error carries the index name (`meta.driverAdapterError.cause.constraint.index`), not the columns. Both shapes are read now.

## [1.0.0] - 2026-11-20

First release.

### Added

- Express 4 API on AWS Lambda (`serverless-http`, Serverless Framework 3, esbuild) with a local server and Swagger UI.
- Layered module structure (route → Zod validation → controller → use case → repository → Prisma) with dependency injection through tsyringe, and a reference `example` CRUD module with tests.
- Prisma 7 on PostgreSQL with the `pg` adapter, `prismaCall` error translation and a first migration.
- Static `x-api-key` authentication, a public `/health` route and a shared error model (`AppError`, body parser errors).
- OpenAPI document written by hand and checked by tests against the Express routes, the Prisma model, the error bodies and the real request pipeline.
- `npm run init`, a dependency-free script that names a new project and can remove the example module.
- GitHub Actions pipeline (validate, migrate, deploy per environment through an AWS OIDC role).
- `docker-compose.yml` with a local PostgreSQL that matches `.env.example`.
- `npm run docs:openapi` to export the OpenAPI document, published as a static Swagger UI page on GitHub Pages.
- Dependabot, CodeQL and a security policy.
- `CLAUDE.md` and `docs/` with architecture, conventions, development guide and a domain skeleton.

[Unreleased]: https://github.com/HenriqueVon/template-nodejs-express-lambda-prisma-api/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/HenriqueVon/template-nodejs-express-lambda-prisma-api/releases/tag/v1.0.0
