# My Service API Conventions

## 1. Purpose

This document answers one question: **when I write new code in this repository, which rules must I follow?** It is a rule book. Most rules come from the code the template was extracted from and are enforced by tooling or tests; others record decisions, such as the design and readability principles in [Section 2](#2-general-principles).

| Document | Answers |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | How the system is built today, including known inconsistencies. |
| [DEVELOPMENT.md](DEVELOPMENT.md) | How to work in the repository: setup, commands, step-by-step guides. |
| **CONVENTIONS.md** | Which rules new code follows. |

New code follows these conventions. Deviating from a **MUST** or **SHOULD** requires an explicit justification in the pull request. Existing code that breaks a rule is listed in [Section 17](#17-code-that-should-not-be-copied); it is not a precedent.

| Level | Meaning |
|---|---|
| **MUST** | Required: a project invariant, enforced by tooling or tests, needed for correct behavior, or a consolidated architectural decision. |
| **SHOULD** | Strongly established convention; exceptions are possible but must be justified. |
| **AVOID** | Identified as an inconsistency, legacy, accidental behavior or known problem, or a pattern that must not be introduced without an explicit decision. Do not replicate or introduce it. |

---

## 2. General Principles

1. **Modules are isolated.** A module never imports another module; relations exist only in the database schema.
2. **HTTP stays at the edge.** Routes and controllers deal with Express; use cases receive plain data and never see `req`/`res`.
3. **Only repositories touch the database.** Use cases depend on repository interfaces, never on Prisma.
4. **Validate at the edge.** Every request input is validated with Zod by `validateRequest` before reaching a controller.
5. **Explicit dependencies.** Classes receive dependencies through constructor injection (tsyringe).
6. **Copy structure, not behavior.** Domain rules of one module are not templates for another.
7. **Runtime and documentation stay aligned.** The OpenAPI tests fail when they drift.
8. **Human readability comes first.** Code is written for developers to understand and maintain, not to minimize line count or maximize abstraction.
9. **Prefer established designs.** Use simple, conventional and proven solutions before introducing novel abstractions or additional architectural patterns.

### Design and Readability

**MUST**
- Write code for human readers. New code must be straightforward for another developer to read, understand and maintain without reverse-engineering clever abstractions. Prefer:
  - descriptive names that express intent;
  - explicit and predictable control flow;
  - small, cohesive units with clear responsibilities;
  - obvious data transformations;
  - visible dependencies;
  - conventional TypeScript, Express, Prisma and OOP idioms;
  - code whose normal execution path can be followed without unnecessary context.
- Do not trade clarity for cleverness. Avoid:
  - cleverness for its own sake;
  - dense expressions that save lines but reduce clarity;
  - hidden side effects;
  - unnecessary indirection;
  - deeply nested logic when it can be expressed more clearly;
  - abstractions that require navigating several files to understand a simple operation;
  - comments that explain what unnecessarily complicated code is doing instead of simplifying the code.

Code is read far more often than it is written. Optimize for the next human who has to understand it.

**SHOULD**
- Prefer established object-oriented principles and well-known design patterns when they solve the problem clearly. Favor composition over unnecessary inheritance, single clear responsibilities, explicit dependencies, dependency inversion when it provides a concrete benefit, and simple solutions that can evolve when requirements become clearer. OOP and SOLID are tools and heuristics for understandable code, not goals to maximize mechanically.
- Prefer explicit code over clever code. When two implementations are equally correct, prefer the one whose behavior is easier to infer by reading it. Fewer lines are not inherently better code.

**AVOID**
- Architectural sophistication without a concrete need. Do not introduce, without a demonstrated problem and an explicit architectural decision: DDD layers or tactical patterns, CQRS, Event Sourcing, Hexagonal Architecture, additional Clean Architecture layers, generic command/query buses, custom dependency-injection mechanisms, generic repository frameworks, speculative plugin systems, custom internal frameworks, or abstractions created only for hypothetical future requirements.

> Prefer boring, proven and readable code over clever, novel abstractions.
>
> Architecture exists to make the system easier to understand and change, not to maximize the number of architectural patterns used.

---

## 3. Naming Conventions

`<Module>` = PascalCase (`PaymentMethod`), `<module>` = camelCase (`paymentMethod`), `<m>` = kebab-case (`payment-method`), `<MODULE>` = UPPER_SNAKE (`PAYMENT_METHOD`).

| Level | Element | Convention | Example |
|---|---|---|---|
| MUST | Source files | kebab-case `<m>.<role>.ts`, role ∈ `routes`, `controller`, `openapi`, `schema`, `dto`, `usecase`, `repository`, `tokens` | `payment-method.routes.ts` |
| MUST | Use case files | `<operation>-<m>.usecase.ts`, operation ∈ `create`, `update`, `list`, `get-by-id`, `delete` | `get-by-id-payment-method.usecase.ts` |
| MUST | Repository interface | file `i<m>.repository.ts`, interface `I<Module>Repository` | `IPaymentMethodRepository` |
| MUST | Repository token | `export const <MODULE>_REPOSITORY = '<Module>Repository' as const;` in `<m>.tokens.ts` | `PAYMENT_METHOD_REPOSITORY` |
| MUST | Classes | `<Module>Controller`, `<Module>Repository`, `<Operation><Module>UseCase` | `GetByIdPaymentMethodUseCase` |
| MUST | Schemas | `create<Module>Schema`, `update<Module>Schema`, `list<Module>QuerySchema`, `<module>Schema` (response), `list<Module>ResponseSchema` | `listPaymentMethodQuerySchema` |
| MUST | DTO types | `Create<Module>Dto`, `Update<Module>Dto` | `CreatePaymentMethodDto` |
| MUST | Controller methods | `create`, `list`, `getById`, `update`, `delete` | `controllerAdapter(ExampleController, 'getById')` |
| MUST | Tables and columns | snake_case: tables plural via `@@map`, multi-word columns via `@map` | `@@map("payment_methods")`, `@map("created_at")` |
| SHOULD | Module directory | `src/modules/<m>/`; group related modules in a folder (`src/modules/<group>/<m>/`) only when there are several | `src/modules/example/` |
| SHOULD | Router variables | `const router = Router()` + `export default router`; imported in `routes.ts` as `<module>Route` | `exampleRoute` |
| SHOULD | Injected fields | `private readonly <operation><Module>UseCase`, `private readonly <module>Repository` | `private readonly exampleRepository` |
| SHOULD | Prisma models and enums | PascalCase singular models; PascalCase enums with UPPER_CASE values | `enum Status { ACTIVE INACTIVE }` |
| SHOULD | OpenAPI names | components `<Module>`, `List<Module>Response`, `Create<Module>Input`, `Update<Module>Input`; operationIds `list<Module>`, `create<Module>`, `get<Module>ById`, `update<Module>`, `delete<Module>`; tag = plural title | `getExampleById`, tag `Examples` |
| SHOULD | Test files and names | `__tests__/<m>.routes.spec.ts`, `__tests__/usecases/<operation>-<m>.usecase.spec.ts`; `describe('<ClassUnderTest>')`; `it('should …')`; SUT `sut`, repository mock `repo` | `describe('CreateExampleUseCase')` |
| SHOULD | Migrations | Prisma timestamp + snake_case description of the change | `create_table_examples`, `add_column_status_to_table_examples` |

---

## 4. File and Module Structure

Canonical module (details: [DEVELOPMENT.md §4](DEVELOPMENT.md#4-how-to-add-a-new-module)):

```
src/modules/<m>/
├── <m>.routes.ts  <m>.controller.ts  <m>.openapi.ts
├── dtos/          create-<m>.dto.ts  update-<m>.dto.ts  index.ts
├── schemas/       create-<m>.schema.ts  update-<m>.schema.ts  list-<m>-query.schema.ts
│                  <m>.schema.ts  list-<m>-response.schema.ts  index.ts
├── usecases/      create-  update-  list-  get-by-id-  delete-<m>.usecase.ts  index.ts
├── repositories/  i<m>.repository.ts  <m>.repository.ts  <m>.tokens.ts
└── __tests__/     <m>.routes.spec.ts  usecases/<operation>-<m>.usecase.spec.ts
```

**MUST**
- Put each resource in its own module folder with the files above.
- Provide `index.ts` barrels in `dtos/`, `schemas/` and `usecases/`; `repositories/` has no barrel.
- Never import another module: no `@modules/...` and no relative path leaving the module folder. A cross-module dependency requires an explicit architectural decision (none exists today).

---

## 5. Routes

**MUST**
- One Express `Router()` per module, exported as default.
- Compose every endpoint as `validateRequest({ params?, query?, body? })` followed by `controllerAdapter(<Module>Controller, '<method>')`, in that order, with nothing in between.
- Validate `:id` with the shared `idParamsSchema` (`@shared/schemas/id.schema`).
- Mount the router in `src/routes.ts` under `/v1/api/...`.
- Mount a more specific path before a path that is its prefix. If `/orders/items` is mounted after `/orders`, the `/:id` route of `/orders` captures `items`.
- Document every route in OpenAPI ([Section 13](#13-openapi)); `openapi-document.spec.ts` fails otherwise.

**SHOULD**
- Use plural kebab-case paths; nest sub-resources (`/orders/items`).
- For CRUD resources, expose `GET /`, `POST /`, `GET /:id`, `PATCH /:id`, `DELETE /:id`. Partial updates use `PATCH`; there is no `PUT`.
- Import `validateRequest` from `@shared/http/middlewares/validate.middleware` and `controllerAdapter` from `@shared/http/controller.adapter`.

**AVOID**
- Business logic, response shaping or `try/catch` in route files.
- Extra per-route middleware without a decision.

---

## 6. Controllers

**MUST**
- `@injectable()` class whose constructor injects only the module's use case classes, each with `@inject(<UseCaseClass>)`.
- Read input from `req.params`, `req.query` and `req.body`, which `validateRequest` has already replaced with parsed values.
- Set the status in the controller: `create` → `res.status(201).json(...)`; `list`, `getById`, `update` → `res.status(200).json(...)`; `delete` → `res.status(204).send()`. The OpenAPI tests check these codes.
- Return the use case result as is (Prisma record or `{ items, total }`); there are no response mappers.
- Let errors propagate: `controllerAdapter` forwards them to `errorHandler`.

**AVOID**
- Business rules, normalization, uniqueness checks or database access in a controller.
- Injecting repositories, Prisma or services into a controller.
- Catching errors or building error responses.
- Logging with `console` directly (see [Section 15](#15-imports-and-formatting) for `logger`).

---

## 7. Schemas and Validation

**MUST**
- Validate every input with a Zod schema passed to `validateRequest`.
- Create schemas end with `.strict()` (unknown keys → 400).
- Update schemas: every field `.optional()`, `.strict()`, and `.refine((data) => Object.keys(data).length > 0, { message: 'At least one field must be provided' })`.
- List-query schemas: `limit: z.coerce.number().int().min(1).max(100).optional()`, `offset: z.coerce.number().int().min(0).optional()`, `orderBy: z.enum([...sortable fields]).optional()`, `orderDirection: z.enum(['asc', 'desc']).optional()`, `.strict()`.
- Give each coerced number of a list query `.openapi({ type: 'integer', minimum, maximum })` with the limits of the schema. zod-to-openapi documents a schema that accepts `null` as nullable, and `z.coerce.number()` turns `null` into `0`, so without it `limit` and `offset` are documented as `number | null`. The `type` replaces the generated schema, so the limits must be repeated.
- Keep response schemas separate from input schemas ([Section 13](#13-openapi)).

**SHOULD**
- Use Prisma enums for enum fields: `z.enum(Status)`.
- Mirror column limits with explicit messages: `.max(100, 'Name must have at most 100 characters')` for `VarChar(100)`.
- Coerce only query parameters; body fields use `z.number()` / `z.boolean()`.
- Validate date-only inputs with `z.iso.date({ error: '<Field> must be a valid ISO date' })`.

**AVOID**
- Update schemas without `.strict()`: unknown keys would be silently stripped instead of rejected.
- Deriving response schemas from input schemas with `.extend(...)`.

Foreign-key ids in bodies are `z.string()`: their existence is enforced by the database, not checked before the write ([Section 12](#12-error-handling)).

---

## 8. DTOs

**MUST**
- Create/update DTOs are type aliases of the schema output, in `dtos/<operation>-<m>.dto.ts` and re-exported from `dtos/index.ts`: `export type CreateExampleDto = z.infer<typeof createExampleSchema>;`
- Do not hand-write an interface that duplicates a schema.

**SHOULD**
- Use the shared DTOs for lists: `ListParamsDto` (input) and `PaginatedResponseDto<T>` (output) from `src/shared/dtos/`.
- Use case inputs: `create` → `Create<Module>Dto`; `update` → `(id: string, Update<Module>Dto)`; `list` → `ListParamsDto`; `getById`/`delete` → `id: string`.

DTOs are coupled to the HTTP schemas by design ([ARCHITECTURE.md §5](ARCHITECTURE.md#5-dependency-direction)).

---

## 9. Use Cases

**MUST**
- One class per operation in `usecases/<operation>-<m>.usecase.ts`, exported from `usecases/index.ts`.
- `@injectable()`, a single public method `execute(...)`.
- Exactly one constructor dependency: the module repository, `@inject(<MODULE>_REPOSITORY) private readonly <module>Repository: I<Module>Repository`.
- `getById`: throw `NotFoundError` when the repository returns `null`, and declare the return type without `| null`.
- For each database unique constraint: pre-check in `create` and `update` and throw `ConflictError`; in `update`, ignore the record being updated (`existing.id !== id`).
- Throw `AppError` subclasses for expected failures ([Section 12](#12-error-handling)).

**AVOID**
- Importing the Prisma client or calling `prisma`.
- Importing Express types or receiving `req`/`res`.
- Calling controllers, other use cases, or another module's repository.
- Copying a domain rule from another module because the modules look similar.

**SHOULD**
- Normalize unique business values (`trim()`, and `toUpperCase()` when case must not matter) before the check, and persist the normalized value: check and store the same value.
- Single-column unique keys: use a dedicated finder (`findByName`). Composite keys: `findMany({ ...completeKey }, { limit: 1 })` with **every** key field defined; Prisma drops `undefined` filters, so an incomplete key silently widens the check.
- `update`: build `const data = { ...input }` and overwrite the normalized fields.
- `list`: `return this.<module>Repository.findMany({}, params);`.
- `update`/`delete`: rely on `prismaCall` for the 404 of a missing record (Prisma `P2025`); do not add an existence pre-check only to produce it.

---

## 10. Repositories

**MUST**
- Interface in `repositories/i<m>.repository.ts`; implementation `@injectable() export class <Module>Repository implements I<Module>Repository` in `repositories/<m>.repository.ts`; token in `repositories/<m>.tokens.ts`.
- Only repository implementations import `prisma` from `@services/database/prisma/prisma.client`.
- Wrap every write (`create`, `update`, `delete`) in `prismaCall`. It translates `P2002` and `P2003` → `ConflictError` and `P2025` → `NotFoundError`.
- Register the token in `src/shared/container/index.ts` ([Section 11](#11-dependency-injection)).
- Give `findMany` a total order: without `orderBy`, order by `createdAt` (by `id` in a model without timestamps), and after any other field add `id` as a tie-breaker. Without a total order PostgreSQL returns the rows in any order, so `offset` pages can repeat or skip records.

**SHOULD**
- Implement the standard contract: `create`, `findById`, `findMany(filters?, params?)`, `update`, `delete`, plus one finder per single-column unique key (`findByName`).
- Paginate `findMany` as the example does: `limit = Math.min(params.limit ?? 20, 100)`, `offset = params.offset ?? 0`, `Promise.all([findMany, count])`, return `{ items, total }`.
- Destructure the filterable fields explicitly from `filters: Partial<Entity>`.
- Return Prisma model types; `null` from finders; `void` from `delete`.
- Leave reads unwrapped (`prismaCall` only matters for writes).

**AVOID**
- An `exists(id)` method. It adds code no use case needs, and it must not be used to produce 404s (`prismaCall` does).

---

## 11. Dependency Injection

**MUST**
- Use constructor injection with `@inject(...)` on every parameter: use case classes in controllers, repository tokens in use cases.
- Mark controllers, use cases and repositories `@injectable()`.
- Register repositories in `src/shared/container/index.ts`: `container.registerSingleton<I<Module>Repository>(<MODULE>_REPOSITORY, <Module>Repository);`.
- Do not register controllers or use cases; tsyringe resolves them by class (transient) through `controllerAdapter`.

**AVOID**
- Relying on request-scoped instances. The per-request child container has no scoped registrations ([ARCHITECTURE.md §6](ARCHITECTURE.md#6-dependency-injection)).
- Instantiating dependencies with `new` inside handlers or middlewares: it bypasses DI.
- Resolving from the container in application code (service locator); only `controllerAdapter` does it.

---

## 12. Error Handling

**MUST**
- Throw `AppError` subclasses from `@shared/errors/app-error` for expected failures:
  - `BadRequestError` (400) for business-rule violations;
  - `NotFoundError` (404) when a requested record does not exist;
  - `ConflictError` (409) for unique-value conflicts and, via `prismaCall`, foreign-key violations;
  - `Unauthorized` (401) and `Forbidden` (403) are thrown by the authentication layer, not by use cases.
- Let errors propagate. Only `validateRequest` (Zod errors) and `errorHandler` (everything else) write error bodies.
- Leave request-shape validation to Zod; use cases validate business rules only.
- Leave referenced-id existence to the database. `prismaCall` translates the foreign-key violation (`P2003`) to `409 { message: 'Operation conflicts with related records', code: 'CONFLICT' }` for every operation; use cases do not load another module's records to check references.
- When adding an `AppError` subclass or a new `code`, update `appErrorResponseSchema` (`src/shared/schemas/error-response.schema.ts`), the responses in `src/docs/openapi/responses.ts` when a new status appears, and the list in `openapi-errors.spec.ts`.

**SHOULD**
- Give `ConflictError` a message naming the conflicting value, e.g. `'Example name already exists!'`.

**AVOID**
- `try/catch` in use cases or controllers to translate Prisma errors ad hoc.

**Body parser errors.** `errorHandler` translates malformed JSON to 400 `BAD_REQUEST` and a body above the limit to 413 `PAYLOAD_TOO_LARGE`. Do not handle them per module.

---

## 13. OpenAPI

Details and flow: [ARCHITECTURE.md §11](ARCHITECTURE.md#11-openapi-and-testing), [DEVELOPMENT.md §8](DEVELOPMENT.md#8-openapi--swagger).

**MUST**
- Update `<m>.openapi.ts` whenever a route, request schema, response shape or status code changes. Import new module files in `src/docs/openapi/modules.ts` and add the tag to `src/docs/openapi/tags.ts`.
- Register input schemas and use the returned value: `const createExampleInput = openApiRegistry.register('CreateExampleInput', createExampleSchema);`. The update input adds `.openapi({ minProperties: 1 })`.
- Write response schemas explicitly in `<m>.schema.ts`, following the Prisma model as serialized to JSON: `decimalString` for `Decimal`, `dateTimeString` for `DateTime`, `.nullable()` for optional columns, named with `.openapi('<Module>')`. The list response is `paginatedResponseSchema(<module>Schema).openapi('List<Module>Response')`.
- Document errors only with `responseRef(...)` and `...globalErrorResponses` from `src/docs/openapi/responses.ts`.
- Document only the status codes the runtime produces: the success code per method, `400` on every operation, `404` on operations with `{id}`, `409` on create/update of models with a unique constraint or foreign keys and on delete of models referenced by others, plus the global `401`/`403`/`413`/`500`. `openapi-document.spec.ts` enforces them.
- Keep security global in `document.ts`; do not add per-operation alternatives.
- Write entity examples in the JSON form the API returns: decimals as strings, dates as ISO date-time.
- Add new modules to the `modules` table in `src/docs/openapi/__tests__/openapi-contract.spec.ts`.
- Run `npm run test:run -- src/docs` after any contract change.

**SHOULD**
- Define one entity example and one input example per module and reuse them in all operations.
- Use summaries `List`, `Create`, `Get by id`, `Update`, `Delete by id`.

**AVOID**
- Generic error schemas, inline error response blocks, response schemas built with `.extend()` from input schemas, and registering a schema without using the returned value.

---

## 14. Tests

**MUST**
- Use Vitest; spec files are `*.spec.ts` inside `__tests__/` next to the code under test.
- Test use cases in isolation: instantiate with `new`, pass a hand-written repository mock; no DI container, Prisma or database.
- In route specs, mock `controllerAdapter` (`vi.mock('@shared/http/controller.adapter', ...)`) and test validation and routing only.
- Keep `npm run test:run` green, including the OpenAPI specs.
- Give every repository an integration spec, and every module an integration spec of its API flow: `<m>.repository.integration.spec.ts` and `<m>.api.integration.spec.ts` in the module's `__tests__/`, run with `npm run test:integration` against PostgreSQL. Use the integration spec for what a mock cannot show: constraints and column limits, ordering and pagination, concurrent writes, the Prisma errors that `prismaCall` translates and what is logged for them.
- Start each integration test from an empty database (`resetDatabase()` in `beforeEach`) and close the connection in `afterAll` (`closeDatabase()`). Never point them at a database whose name does not end with `_test`: the run refuses it.

**SHOULD**
- Name the use case spec after the class, `describe('CreateExampleUseCase')`, and every case `it('should …')`.
- Build mocks and the SUT in `beforeEach`: `repo = { findByName: vi.fn(), create: vi.fn() } as unknown as IExampleRepository; sut = new CreateExampleUseCase(repo);`, and set results with `mockResolvedValue`.
- Write one spec per use case and cover all five use cases of a module.
- Mount the router under the same path as `routes.ts` in route specs.
- Make each case able to fail: a request rejected for one rule is valid for every other rule (send an unknown field next to a valid body), and values that a bug could swap differ (each foreign key has its own value).
- When a call gains an optional argument, pass it in `toHaveBeenCalledWith` too (`undefined`). Vitest compares the number of arguments, so `fn(a, b, undefined)` does not match `toHaveBeenCalledWith(a, b)`.
- When dropping a field from a fixture by destructuring, add `// eslint-disable-next-line @typescript-eslint/no-unused-vars` so lint stays warning-free.

**AVOID**
- `import 'reflect-metadata'` in specs; `src/test/setup.ts` already loads it.
- Asserting known-wrong behavior as expected.
- Reading the developer's real `.env` in tests: `src/test/setup.ts` sets test values first, and `dotenv` does not override them.
- A conditional assertion (`if (x) expect(...)`): a test that passes without checking anything. Make the situation deterministic instead.
- Testing database behavior only with mocks: a mock repeats what you believe the database does.

---

## 15. Imports and Formatting

**MUST**
- No imports between modules ([Section 4](#4-file-and-module-structure)).
- Import the Zod OpenAPI extension first in entry points: `app.ts` starts with `import './config/zod-openapi';`, and `local.ts` imports `app` before any docs module.
- `npm run lint` with 0 errors and `npm run check:ts` passing; CI runs both on pull requests and before deploying. No new lint warnings.

**SHOULD**
- Inside a module, use relative imports (`./`, `../`). Outside the module, use the tsconfig aliases `@shared`, `@services`, `@docs`, `@config` (also defined in Vitest) and `@modules` (only outside `src/modules`).
- Import through barrels: `from './usecases'`, `from './schemas'`, `from '../dtos'` (not `./usecases/index`).
- Import Prisma model types and enums from `@prisma/client`.
- Run `npm run lint:fix` to apply alignment and other fixable rules.
- Log through `logger` from `@shared/logging/logger`: `logger.info('event_name', { field: value })`. It writes one JSON line and adds the request id from the request context. Name the event in `snake_case`, put the data in fields, and never log a header, a body, a token, a key or a connection string. Where there is no request context (a `finish` listener, code that runs before the context starts), pass `requestId` in the fields.

The tooling is the source of truth: [`eslint.config.mjs`](../eslint.config.mjs) and [`tsconfig.json`](../tsconfig.json). It requires 2-space indentation, single quotes, object keys aligned on the colon (`key-spacing`), no `console` methods other than `warn`, `error` and `info`, no unused variables (arguments prefixed with `_` are ignored), and TypeScript `strict` mode with decorators and decorator metadata enabled. Line endings are LF (`.gitattributes`).

---

## 16. Database, Prisma and Environment Variables

Workflows: [DEVELOPMENT.md §6](DEVELOPMENT.md#6-changing-the-database) and [§7](DEVELOPMENT.md#7-adding-an-environment-variable).

**MUST**
- Every schema change ships with a committed migration created by `npm run prisma:migrate:dev -- --name <name>`, followed by `npm run prisma:generate`.
- Never edit a migration folder that already exists; create a new one.
- A migration is compatible with the previous code, because the pipeline applies it before the new code is deployed: add before removing, and never rename or drop a column in the same change that stops using it.
- The SQL of a new migration is wrapped in `BEGIN;` / `COMMIT;`, so a failed run leaves nothing applied. Prisma does not roll back the statements that ran before an error.
- Every model has `id String @id @default(cuid())`, `createdAt DateTime @default(now()) @map("created_at")` and `updatedAt DateTime @updatedAt @map("updated_at")`.
- Tables use `@@map("<snake_plural>")`; multi-word fields use `@map("<snake_case>")`.
- Monetary values use `Decimal @db.Decimal(18, 2)`.
- Every unique constraint has a use case pre-check ([Section 9](#9-use-cases)).
- When fields change, update the response schema and the entity example; `openapi-document.spec.ts` compares them with the Prisma model.
- A change to `schema.prisma` without its migration fails `npm run test:integration` before any test (the migrated database must equal the schema): create the migration, do not silence the check.
- Read environment variables through `env` from `src/config/env.ts`, declared in its Zod schema with the type, the range and, for an optional variable, a default (`.default(...)`). An invalid value must stop the start with a clear message; never cast a string to a type without checking it.
- Add every variable to `.env.example`. If the Lambda needs it, add it to `provider.environment` in `serverless.yml`. A **required** variable also goes in both deploy jobs of `.github/workflows/deploy.yml`; an optional one with a default (like `DB_POOL_MAX`, `${env:DB_POOL_MAX, "2"}`) needs them only to be overridden.
- Add a test in `src/config/__tests__/env.spec.ts` for a new rule, and a test value in `src/test/setup.ts` for a new required variable.

**SHOULD**
- Foreign keys: `<relation>Id String @map("<relation>_id")` with `@@index([<relation>Id])`.
- Text columns: `@db.VarChar(n)`; names use 100.

**AVOID**
- `process.env` outside `config/env.ts` (and `prisma.config.ts`, which runs in the Prisma CLI).
- Declaring a variable `required` without wiring it for deployment (`serverless.yml`, the deploy jobs and the GitHub secrets).
- Raising `DB_POOL_MAX` without doing the arithmetic of [SERVERLESS.md](SERVERLESS.md#database-connections): on Lambda the database sees the containers times the pool.
- Composite unique constraints that include a nullable column and rely on the database alone: PostgreSQL treats `NULL`s as distinct, so such a constraint does not prevent duplicates where the column is `NULL`.

---

## 17. Code That Should Not Be Copied

Confirmed issues present in the committed code. Do not use them as references. None recorded yet.

| # | Pattern | Where | Why not | Instead |
|---|---|---|---|---|
| — | — | — | — | — |

Add a row when you find code that breaks a rule above, and mirror it in [ARCHITECTURE.md §12](ARCHITECTURE.md#12-known-architectural-inconsistencies).

---

## 18. Pull Request / Definition of Done

- [ ] Code follows this document; any deviation is justified in the PR.
- [ ] Code is straightforward for another human developer to read and maintain.
- [ ] No unnecessary abstraction, indirection or architectural pattern was introduced.
- [ ] Validation schemas updated (`.strict()`, refine, `idParamsSchema`).
- [ ] OpenAPI updated if the contract changed (paths, response schemas, examples, status codes).
- [ ] Tests added/updated (use case specs, route spec, OpenAPI contract table for new modules).
- [ ] `npm run lint` (0 errors, no new warnings), `npm run check:ts`, `npm run test:run` and `npm run test:integration` pass.
- [ ] Migration committed and `prisma generate` run when `schema.prisma` changed.
- [ ] Env vars wired in `env.ts`, `.env.example`, `serverless.yml` and CI when added.
- [ ] Central registrations done: `shared/container`, `routes.ts`, `docs/openapi/modules.ts`, `tags.ts`.
- [ ] Diff reviewed; no debug code; nothing from [Section 17](#17-code-that-should-not-be-copied) copied.

---

## 19. Quick Reference

```
route ─► validateRequest ─► controllerAdapter ─► Controller ─► UseCase.execute
                                                                  │ @inject(<MODULE>_REPOSITORY)
                                                                  ▼
                                    prisma ◄─ <Module>Repository ◄─ I<Module>Repository
```

| Concern | Convention |
|---|---|
| Readability | Human-readable, explicit and maintainable code first |
| Design | Prefer simple, established OOP/patterns; avoid speculative architecture |
| Module isolation | No imports between modules |
| Endpoint | `validateRequest(...)` → `controllerAdapter(Controller, 'method')` |
| `:id` | `idParamsSchema` (CUID) |
| Success status | create 201, list/get/update 200, delete 204 |
| Controller | Use cases only; no logic, no try/catch |
| Use case | `@injectable`, one `execute`, one repository via token |
| Expected errors | Throw `BadRequestError` / `NotFoundError` / `ConflictError` |
| Database access | Repository implementation only; writes wrapped in `prismaCall` |
| DI | `registerSingleton(TOKEN, Repository)` in `shared/container/index.ts` |
| Create / update schemas | `.strict()`; update + at-least-one-field refine |
| DTOs | `z.infer<typeof schema>` |
| Response schemas | Explicit, Prisma model as JSON, `.openapi('<Module>')` |
| OpenAPI errors | `responseRef(...)` + `...globalErrorResponses` |
| Env vars | `env` from `config/env.ts` + `.env.example` + serverless + CI |
| Done | lint, check:ts, test:run green |
