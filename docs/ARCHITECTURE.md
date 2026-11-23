# My Service API Architecture

How the system is built today. It answers *what the architecture is*; [DEVELOPMENT.md](DEVELOPMENT.md) answers *how to work in it* and [CONVENTIONS.md](CONVENTIONS.md) lists *the rules new code follows*. When this document and the code disagree, the code wins: report the mismatch.

## 1. System Overview

A REST API that runs on AWS Lambda behind an API Gateway HTTP API.

| Concern | Choice |
|---|---|
| Language / runtime | TypeScript, Node.js 24 (`nodejs24.x` on Lambda) |
| HTTP | Express 4, wrapped by `serverless-http` |
| Validation | Zod 4 at the HTTP edge |
| Dependency injection | tsyringe (constructor injection, decorators) |
| Persistence | PostgreSQL through Prisma 7 with the `pg` driver adapter |
| API documentation | OpenAPI 3 generated with `@asteasolutions/zod-to-openapi`, Swagger UI on the local server only |
| Logging | One JSON object per line through `console`, with a request id (CloudWatch Logs on Lambda) |
| Tests | Vitest, Supertest; unit tests with mocks, integration tests on PostgreSQL |
| Packaging / deploy | Serverless Framework 3 + `serverless-esbuild`, GitHub Actions |

The reasons for these choices and what they cost are in [adr/](adr/README.md); what changes on Lambda is in [SERVERLESS.md](SERVERLESS.md).

Entry points:

| File | Purpose |
|---|---|
| `src/handler.ts` | Lambda handler: `serverless(app)` |
| `src/local.ts` | Local server (`npm run dev`): mounts `/docs` when enabled, then `app` |
| `src/app.ts` | Express composition, shared by both |
| `src/routes.ts` | Mounts every module router under `/v1/api` |

## 2. High-Level Architecture

```
HTTP request
   │
   ▼
requestIdMiddleware ─► accessLogMiddleware ─► express.json ─► requestContainerMiddleware ─► /health (public)
   │
   ▼
apiKeyMiddleware ─► routes (/v1/api/...) ─► errorHandler
                       │
                       ▼
   validateRequest ─► controllerAdapter ─► Controller ─► UseCase ─► Repository ─► Prisma ─► PostgreSQL
```

Each layer has one job:

| Layer | Responsibility | Knows about |
|---|---|---|
| Route | Wires a path and method to a validation schema and a controller method | Express, Zod schemas, the controller class |
| Controller | Reads the validated request, calls use cases, sets the HTTP status | Express `req`/`res`, use cases |
| Use case | One business operation; enforces business rules; throws `AppError` subclasses | Repository interface (by token), DTOs, errors |
| Repository | The only code that talks to the database | Prisma, DTOs |

## 3. Module Structure

Every resource is a self-contained module under `src/modules/<name>/`:

```
src/modules/<m>/
├── <m>.routes.ts  <m>.controller.ts  <m>.openapi.ts
├── dtos/          create-<m>.dto.ts  update-<m>.dto.ts  index.ts
├── schemas/       create-  update-  list-<m>-query-  <m>-  list-<m>-response-.schema.ts  index.ts
├── usecases/      create-  update-  list-  get-by-id-  delete-<m>.usecase.ts  index.ts
├── repositories/  i<m>.repository.ts  <m>.repository.ts  <m>.tokens.ts
└── __tests__/     <m>.routes.spec.ts  usecases/<operation>-<m>.usecase.spec.ts
```

`src/modules/example` is the reference implementation of this structure. Shared code lives in `src/shared/`:

| Folder | Content |
|---|---|
| `shared/container` | Repository registrations for tsyringe |
| `shared/database/prisma` | `prismaCall`, the translation of Prisma errors |
| `shared/dtos`, `shared/schemas` | List params, paginated response, `idParamsSchema`, error response schemas |
| `shared/errors` | `AppError` and its subclasses |
| `shared/http` | `controllerAdapter` and the middlewares |
| `shared/logging` | `logger` (JSON lines) and the request context that carries the request id |
| `shared/security` | `safeCompare` |
| `shared/types` | Express request type extensions |

## 4. Request Lifecycle

The order in `src/app.ts` is part of the contract:

1. `requestIdMiddleware` gives the request an id (the API Gateway request id on Lambda, a valid `x-request-id` sent by the caller, or a new UUID) and returns it in the `x-request-id` response header.
2. `accessLogMiddleware` writes one `http_request` line when the response finishes: method, path (no query string), status and duration.
3. `express.json()` parses the body. A malformed or oversized body raises an error that `errorHandler` turns into 400 or 413. Steps 1 and 2 come first so that these responses also have the id and a log line.
4. `requestContainerMiddleware` creates the child DI container and starts the request context, which carries the request id through every `await` (it starts after the body parser because the parser continues from a stream event that would drop the context).
5. `GET /health` answers without authentication.
6. `apiKeyMiddleware` requires `x-api-key` for everything after it: 401 when missing, 403 when different from `API_KEY`.
7. `routes` dispatches to the module router under `/v1/api`.
8. In the router, `validateRequest` parses params, query and body with Zod and replaces them with the parsed values (400 with the issues on failure).
9. `controllerAdapter` resolves the controller from the request container and calls the method; any error goes to `next`.
10. `errorHandler` logs the error and answers `AppError` with its status and `{ message, code }`, and anything else with 500 `{ message: 'Internal server error' }`.

## 5. Dependency Direction

```
routes ──► controller ──► use case ──► repository interface ◄── repository ──► Prisma
```

- A use case depends on the *interface* of its repository, injected by token; it never imports Prisma or Express.
- Only the repository implementation imports `prisma`.
- Modules do not import each other. Relations between records exist only in the database schema.
- DTOs are `z.infer` of the Zod schemas, so the HTTP schemas and the inner layers share their types by design.

## 6. Dependency Injection

- Repositories are registered once as singletons in `src/shared/container/index.ts`: `container.registerSingleton<I<Module>Repository>(<MODULE>_REPOSITORY, <Module>Repository)`.
- Controllers and use cases are `@injectable()` and are **not** registered: tsyringe resolves them by class, as new (transient) instances for each resolve.
- `controllerAdapter` resolves the controller from `req.container`, a child container created for each request. No registration uses a scoped lifecycle, so the child container does not make anything request-scoped: every request shares the repository singletons. Do not store request data in an injected class.

## 7. Data and Persistence

- One Prisma client (`src/services/database/prisma/prisma.client.ts`) built with `@prisma/adapter-pg`, `DATABASE_URL` and a pool of at most `DB_POOL_MAX` connections (default 2); in non-production it is cached on `global` so that watch mode reuses it. The pool belongs to the process, so on Lambda the connections the database sees are the containers times `DB_POOL_MAX`: see [SERVERLESS.md](SERVERLESS.md#database-connections).
- The schema is `src/services/database/prisma/schema.prisma`; migrations are in `migrations/` next to it. `prisma.config.ts` points the CLI at both.
- Every model has `id` (cuid), `createdAt` and `updatedAt`. Tables are plural snake_case through `@@map`.
- Repositories wrap writes in `prismaCall`, which translates `P2002` (unique) and `P2003` (foreign key) to `ConflictError` (409) and `P2025` (record not found) to `NotFoundError` (404). Use cases therefore do not check that a record exists before an update or delete.
- Lists are paginated with `limit` (default 20, at most 100) and `offset`, return `{ items, total }`, and have a total order (requested field, then `id`) so pages are stable.
- The database user of the Lambda is a runtime concern; migrations run from the pipeline with `DIRECT_DATABASE_URL` (see [DEVELOPMENT.md §11](DEVELOPMENT.md#11-deployment)).

## 8. Validation and DTOs

- `validateRequest({ params?, query?, body? })` is the only place that validates request input.
- Create schemas end with `.strict()`; update schemas make every field optional, add `.strict()` and require at least one field.
- List queries accept `limit`, `offset`, `orderBy` (a closed list of fields) and `orderDirection`.
- The path `:id` is validated by `idParamsSchema` (a cuid).
- Response schemas are written by hand, separate from the input schemas, and follow the Prisma model as serialized to JSON (dates as ISO strings, decimals as strings, optional columns as `.nullable()`).

## 9. Error Handling

| Class | Status | `code` |
|---|---|---|
| `BadRequestError` | 400 | `BAD_REQUEST` |
| `Unauthorized` | 401 | `UNAUTHORIZED` |
| `Forbidden` | 403 | `FORBIDDEN` |
| `NotFoundError` | 404 | `NOT_FOUND` |
| `ConflictError` | 409 | `CONFLICT` |
| `PayloadTooLargeError` | 413 | `PAYLOAD_TOO_LARGE` |
| any other error | 500 | none (`{ message: 'Internal server error' }`) |

Request validation failures are answered by `validateRequest` itself with 400 `{ message: 'Invalid params|query|body', errors, issues }`. Expected failures are thrown from use cases (and from `prismaCall`); nothing else writes error bodies. `AppError` constructors for 400, 401 and 403 accept a custom `code`.

### Logging and the request id

Everything that is logged goes through `logger` (`src/shared/logging/logger.ts`), which writes **one JSON object per line** with `console.info`, `console.warn` or `console.error`, so CloudWatch Logs and most log tools can filter by field. The lines the application writes:

| `event` | Level | Written by | Fields besides `time`, `level`, `event` and `requestId` |
|---|---|---|---|
| `http_request` | info | `accessLogMiddleware`, when the response finishes | `method`, `path` (no query string), `status`, `durationMs` |
| `app_error` | warn | `errorHandler`, for an `AppError` | `status`, `code`, `message`, `method`, `path` |
| `unhandled_error` | error | `errorHandler`, for anything else (the response is 500) | `method`, `path`, `errorName`, `errorMessage`, `stack` |
| `unique_constraint_violation` | warn | `prismaCall` | `model`, `constraint` (and `fields` when the driver gives them), never the values |

The **request id** is set by `requestIdMiddleware` ([§4](#4-request-lifecycle)) and returned in the `x-request-id` header. It reaches code that has no `req` through an `AsyncLocalStorage` (`request-context.ts`): `logger` reads it, so `prismaCall` logs the id of the request that failed without receiving it. Two places pass it explicitly, because the context is not started yet or not reachable there: the access log (a `finish` listener) and `errorHandler` (a body parser error happens before the context starts).

Rules: use `logger`, never `console` directly; log events and fields, not sentences; never log a header, a body, a token, a key or a connection string.

## 10. Security Boundary

- Authentication is a static API key: `x-api-key` compared with `API_KEY` using `safeCompare` (the SHA-256 of both sides through `crypto.timingSafeEqual`, so the length of the key is not revealed either). It identifies the calling application, not a user.
- `GET /health` is public. Everything under `/v1/api` is protected, because the API key middleware is mounted before the routes.
- The OpenAPI document declares the API key globally and no per-operation security; the OpenAPI tests fail if this stops matching the middleware chain.
- Secrets live in environment variables read and validated through `src/config/env.ts` (the application does not start with an `API_KEY` shorter than 16 characters); they reach the Lambda through `serverless.yml` and the deploy workflow.
- API Gateway throttles the whole API (`serverless.yml`) and answers `429` before the Lambda runs. That response is produced by AWS, so it is not in the OpenAPI document.
- Adding per-user authentication (for example validating a bearer token against an identity service) is a change to the middleware chain in `app.ts` and to the security section of the OpenAPI document. Treat it as an architectural decision.

What this boundary does **not** give (no identity, one key for all callers, no rotation, no CORS or security headers, no per-caller limit) and what to add before real data is in [SECURITY.md](SECURITY.md).

## 11. OpenAPI and Testing

### OpenAPI documentation

- `src/docs/openapi/registry.ts` holds the registry and the security scheme; `responses.ts` registers the shared error responses (`responseRef`, `globalErrorResponses`); `tags.ts` lists the tags; `modules.ts` imports every `<m>.openapi.ts`; `document.ts` builds the document.
- Each `<m>.openapi.ts` registers the module's input schemas and paths by hand. Nothing is derived from the Express routes.
- `src/local.ts` mounts the docs router on an outer server, before the API key middleware, and only when `NODE_ENV !== 'production'` and `DOCS_ENABLED=true`. The Lambda bundle never contains the docs.

### Testing architecture

| Kind | Where | What it proves |
|---|---|---|
| Use case spec | `modules/<m>/__tests__/usecases/` | Business rules, with a hand-written repository mock; no container, no database |
| Route spec | `modules/<m>/__tests__/<m>.routes.spec.ts` | Validation and wiring, with `controllerAdapter` mocked |
| App spec | `src/__tests__/app.spec.ts` | Order of the global middlewares, the request id and what the logs contain |
| Shared code specs | `shared/**/__tests__/`, `config/__tests__/` | Middlewares, logger and request context, `safeCompare`, `prismaCall`, environment validation |
| **Integration specs** | `modules/<m>/__tests__/*.integration.spec.ts` | The repository and the whole API against a real PostgreSQL: constraints, column limits, ordering, pagination, concurrent writes and the Prisma errors `prismaCall` translates |
| OpenAPI document spec | `docs/openapi/__tests__/openapi-document.spec.ts` | Documented routes = Express routes; status codes; global errors; unique/foreign-key 409s; tags and components; response schemas = Prisma model |
| OpenAPI contract spec | `docs/openapi/__tests__/openapi-contract.spec.ts` | Each documented example goes through the real route, validation, controller and use case with a mocked repository, and must match the documented status, example and schema |
| OpenAPI errors spec | `docs/openapi/__tests__/openapi-errors.spec.ts` | The documented error bodies match what the middlewares produce |

The **unit suite** (`npm run test:run`) never touches a database: repositories are mocked, so it runs anywhere in seconds. `src/test/setup.ts` loads `reflect-metadata` and sets test values for `DATABASE_URL` and `API_KEY`.

The **integration suite** (`npm run test:integration`, configured by `vitest.integration.config.ts`) covers what mocks cannot:

- Before the specs, `src/test/integration/global-setup.ts` applies the committed migrations to the test database and checks that they produce **exactly** the schema of `schema.prisma` (`prisma migrate diff --exit-code`): a schema change without its migration fails the run.
- The database is `TEST_DATABASE_URL`, and the run **refuses any name that does not end with `_test`**, because each spec empties every table first (`resetDatabase`). Locally it is the `my_service_api_test` database of `docker-compose.yml`; in CI it is a PostgreSQL service container of the `integration` job, which must pass before the migrations and the deploy.
- The specs run one file at a time, because they share the database.

The integration tests already found something the mocks could not: with the pg adapter of Prisma 7 a unique violation reports the constraint name, not the columns, so the first version of the log in `prismaCall` was missing them.

## 12. Known Architectural Inconsistencies

None recorded yet. Record here, with the file and the reason, anything in the code that breaks the rules of this document and must not be copied, and list it in [CONVENTIONS.md §17](CONVENTIONS.md#17-code-that-should-not-be-copied).

## 13. Adding a New Module — Architectural Checklist

- [ ] The module is a folder under `src/modules/` with the structure of [§3](#3-module-structure) and imports no other module.
- [ ] The use cases depend only on the repository interface and its token; only the repository imports `prisma`.
- [ ] Writes go through `prismaCall`; every unique column has a pre-check in `create` and `update`.
- [ ] The repository is registered in `src/shared/container/index.ts`.
- [ ] The router is mounted in `src/routes.ts` (a more specific path before its prefix).
- [ ] The OpenAPI file is imported in `src/docs/openapi/modules.ts` and the tag is in `tags.ts`.
- [ ] The module is added to the `modules` table of `openapi-contract.spec.ts`.
- [ ] The model, its migration and its response schema exist and match.
- [ ] The repository has an integration spec (constraints, ordering, errors) and the API has one for its flow.
- [ ] Lint, type check, the unit suite and the integration suite pass.

Step by step: [DEVELOPMENT.md §4](DEVELOPMENT.md#4-how-to-add-a-new-module).
