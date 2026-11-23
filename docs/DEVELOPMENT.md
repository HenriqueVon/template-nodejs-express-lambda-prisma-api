# My Service API Development Guide

How to work in this repository using the patterns the code already follows. It complements [ARCHITECTURE.md](ARCHITECTURE.md), which describes *what* the architecture is, and [CONVENTIONS.md](CONVENTIONS.md), which lists the rules.

---

## 1. Getting Started

### Local requirements

| Requirement | Notes |
|---|---|
| **Node.js 24** | `.nvmrc`, CI (`node-version: 24`) and the Lambda runtime (`nodejs24.x`) agree. |
| **npm** | `package-lock.json` is committed and CI installs with `npm ci`. |
| **PostgreSQL** | `docker compose up -d` starts a local PostgreSQL 17 (`docker-compose.yml`) with the three databases that `.env.example` points to: the application database, the shadow database of `prisma migrate dev` and the `_test` database of the integration tests. The port is bound to `127.0.0.1`. If port 5432 is taken on your machine, set `DB_PORT` in `.env` and use the same port in the three URLs. Any other PostgreSQL works too (create the shadow and test databases yourself). `docker compose down` stops it and keeps the data; `docker compose down -v` also deletes the data. The extra databases are created only when the data volume is created: for a volume that already exists, run the `CREATE DATABASE` statements of `docker/initdb/01-shadow-database.sql` with `docker compose exec db psql -U user -d my_service_api`. |

### Install and configure

```bash
npm install
```

Create `.env` from [`.env.example`](../.env.example) and set `API_KEY` to a long random value. `.env` is git-ignored; `.env.example` is committed.

| Variable | Read by | Required? | Notes |
|---|---|---|---|
| `NODE_ENV` | `config/env.ts`, `serverless.yml` | optional (default `development`) | `development` enables Prisma query logging. `production` disables `/docs`. |
| `PORT` | `config/env.ts` | optional (default `3000`) | Used by `npm run dev`. |
| `API_KEY` | `config/env.ts` | **required**, at least 16 characters | Clients send it as `x-api-key`. Use a long random value; the app does not start with a shorter one. |
| `DATABASE_URL` | `config/env.ts`, `prisma.config.ts` | **required** | App startup fails without it. |
| `SHADOW_DATABASE_URL` | `prisma.config.ts` | used by the Prisma CLI | Needed by `prisma migrate dev`. Not read by the app. |
| `TEST_DATABASE_URL` | `src/test/integration/` | used by `npm run test:integration` | A database whose name ends with `_test`: the tests empty every table, and refuse any other name. Not read by the app. |
| `DB_POOL_MAX` | `config/env.ts`, `serverless.yml` | optional (default `2`, 1 to 20) | Connections the database pool of one process may open. On Lambda every container has its own pool: read [SERVERLESS.md](SERVERLESS.md#database-connections) before raising it. |
| `DOCS_ENABLED` | `config/env.ts` | optional (default `false`) | `true` serves Swagger UI at `/docs` (only when `NODE_ENV !== 'production'`). It is not passed to the Lambda. |
| `DB_PORT` | `docker-compose.yml` | optional (default `5432`) | Host port of the Docker database. Not read by the app. |

`config/env.ts` validates every variable with Zod when the app loads. An invalid value stops the start with one message that lists all the problems (never the values). An empty value counts as not set. `config/env.ts` and `prisma.config.ts` import `dotenv/config`, so `.env` is loaded automatically.

### Prisma and the database

```bash
npm run prisma:generate
```

```bash
npm run prisma:migrate:dev
```

`prisma generate` is required before type checking and tests too: the code imports model types from `@prisma/client`. CI runs it first.

### Run locally

**Express server (day-to-day work)**

```bash
npm run dev
```

Runs `tsc --noEmit --watch` and `tsx watch src/local.ts` together: live type errors and restart on change. Listens on `PORT`. This is the only way to get Swagger UI.

**Serverless Offline (Lambda emulation)**

```bash
npm run offline
```

Runs `serverless offline` with [`src/handler.ts`](../src/handler.ts) on port 3000. It does not serve `/docs`.

VS Code users have a launch configuration, **"Debug (tsx watch local.ts)"**, in [`.vscode/launch.json`](../.vscode/launch.json).

All API endpoints are under `/v1/api/...` and need the header `x-api-key: <API_KEY>`. `GET /health` is public.

---

## 2. Common Commands

| Task | Command | Notes |
|---|---|---|
| Install | `npm install` (CI: `npm ci`) | |
| Start / stop the local database | `docker compose up -d` / `docker compose down` | See [§1](#1-getting-started). |
| Run locally | `npm run dev` | Express with watch and type check. |
| Export the OpenAPI document | `npm run docs:openapi -- <file>` | Writes the document as JSON (default `openapi.json`, git-ignored), for API clients or Postman. |
| Run as Lambda | `npm run offline` | |
| Lint / fix | `npm run lint` / `npm run lint:fix` | CI runs `lint`. |
| Type check | `npm run check:ts` | CI runs it. |
| Tests, one run | `npm run test:run` | The unit suite, no database. What the `validate` job runs. |
| Integration tests | `npm run test:integration` | Repositories and the whole API on PostgreSQL. Needs `docker compose up -d` and `TEST_DATABASE_URL`. What the `integration` job runs. |
| Tests, filtered | `npm run test:run -- <path-or-pattern>` | Example: `npm run test:run -- src/modules/example`. `-t "<name>"` filters by test name. |
| Tests, watch | `npm run test` / `npm run test:watch` | `npm run test` starts watch mode in an interactive terminal: do not use it in scripts. |
| Generate Prisma client | `npm run prisma:generate` | After install and after every `schema.prisma` change. |
| Create/apply dev migration | `npm run prisma:migrate:dev -- --name <name>` | See [§6](#6-changing-the-database). Writes to your database. |
| Apply migrations (deploy mode) | `npm run prisma:migrate:prod` | `prisma migrate deploy`; the pipeline runs it. |
| Prisma Studio | `npm run prisma:studio` | |
| Deploy / logs / remove | `npm run deploy:<stage>` / `logs:<stage>` / `remove:<stage>` | Need AWS credentials. Normally the pipeline deploys; `remove` is destructive. |

There is no `build` script (bundling happens inside `serverless deploy`), no coverage tool and no seed script.

---

## 3. Repository Structure

```
.
├── CLAUDE.md  README.md  docs/          documentation (docs/adr/ holds the decision records)
├── .github/workflows/deploy.yml         validate + integration → migrate → deploy
├── .github/dependabot.yml               weekly dependency updates, grouped
├── docker-compose.yml  docker/initdb/   local PostgreSQL and its shadow database
├── serverless.yml                       Lambda, HTTP API, esbuild
├── prisma.config.ts                     Prisma CLI: schema, migrations, URLs
├── eslint.config.mjs  tsconfig.json
├── vitest.config.ts  vitest.integration.config.ts    unit and integration test configuration
└── src/
    ├── app.ts  handler.ts  local.ts  routes.ts
    ├── config/        env.ts (validated with Zod), zod-openapi.ts
    ├── shared/        container, errors, http (adapter + middlewares), logging, dtos, schemas, security, types
    ├── services/database/prisma/        client, schema.prisma, migrations/
    ├── docs/openapi/  registry, responses, tags, modules, document, export, openapi.routes, __tests__/
    ├── modules/       one folder per resource (see example/)
    └── test/          setup.ts, integration/ (global setup, database helpers)
```

---

## 4. How to Add a New Module

`src/modules/example` is the reference. Replace `<m>` (kebab-case), `<Module>` (PascalCase), `<module>` (camelCase) and `<MODULE>` (UPPER_SNAKE) as in [CONVENTIONS.md §3](CONVENTIONS.md#3-naming-conventions).

1. **Copy the folder.** Copy `src/modules/example` to `src/modules/<m>` and rename the files and identifiers (`example` → `<m>`, `Example` → `<Module>`, `EXAMPLE` → `<MODULE>`, `/examples` → the plural path).
2. **Model and migration.** Add the model to `schema.prisma`, then follow [§6](#6-changing-the-database) to create the migration and regenerate the client.
3. **Schemas and DTOs.** Set the fields, limits and the sortable fields of `list-<m>-query.schema.ts` in `schemas/`; write the response schema (`<m>.schema.ts`) from the Prisma model. DTOs follow the schemas.
4. **Repository.** Keep the five operations; add one finder per single-column unique key and set the filterable fields of `findMany`.
5. **Use cases.** Put the business rules in the use cases (normalization, unique pre-checks with `ConflictError`).
6. **Central registrations** (four files; forgetting one is the most common mistake):
   - `src/shared/container/index.ts`: `container.registerSingleton<I<Module>Repository>(<MODULE>_REPOSITORY, <Module>Repository);`
   - `src/routes.ts`: `router.use(`${basePath}/<plural-path>`, <module>Route);` (a more specific path before its prefix)
   - `src/docs/openapi/modules.ts`: `import '@modules/<m>/<m>.openapi';`
   - `src/docs/openapi/tags.ts`: the tag, matching the `tags` of the operations.
7. **OpenAPI file.** Update paths, examples and responses in `<m>.openapi.ts`; add the module to the `modules` table in `openapi-contract.spec.ts`.
8. **Tests.** Adjust the use case specs and the route spec, and the two integration specs (`<m>.repository.integration.spec.ts`, `<m>.api.integration.spec.ts`): the repository against PostgreSQL, and the API flow through HTTP.
9. **Verify.** `npm run lint`, `npm run check:ts`, `npm run test:run` and `npm run test:integration` ([CONVENTIONS.md §18](CONVENTIONS.md#18-pull-request--definition-of-done)).

To remove the example from a project that kept it, delete `src/modules/example` (its integration specs go with it), its registrations (the four of step 6 and the entries in `openapi-contract.spec.ts`) and the `Example` model, then run `npm run prisma:generate`. Delete its migration folder if the table was never deployed; otherwise add a new migration that drops the table.

---

## 5. How to Add or Change an Endpoint

1. Add or change the Zod schema (`schemas/`) and the DTO.
2. Add the route in `<m>.routes.ts`: `validateRequest({ ... })` then `controllerAdapter(<Module>Controller, '<method>')`.
3. Add the method to the controller (status in the controller) and, for new behavior, a use case exported from `usecases/index.ts` and injected into the controller.
4. Add the repository method to the interface and the implementation (writes inside `prismaCall`).
5. Update `<m>.openapi.ts`: path, request, success response, `400`, `404` when there is an `{id}`, `409` when it can conflict, `...globalErrorResponses`.
6. Add tests, then run the checks.

The OpenAPI specs assume the five CRUD operations per module (a `POST` answers 201, a `DELETE` 204). A route outside that shape, for example `POST /orders/{id}/cancel` answering 200, needs the specs adapted: add an exception for its success status in `openapi-document.spec.ts`, and cover its `409` responses and its example in the module's own specs. They already check it against the Express routes and the global error responses.

---

## 6. Changing the Database

1. Edit `src/services/database/prisma/schema.prisma` (rules: [CONVENTIONS.md §16](CONVENTIONS.md#16-database-prisma-and-environment-variables)).
2. Create the migration. This writes to the database in `DATABASE_URL` and its shadow database, so confirm the target first:
   ```bash
   npm run prisma:migrate:dev -- --name add_column_status_to_table_examples
   ```
3. Open the generated `migration.sql` and wrap it in `BEGIN;` … `COMMIT;`. Never edit a migration that is already committed: create a new one.
4. `npm run prisma:generate`.
5. Update the response schema, the entity example in `<m>.openapi.ts`, the create/update schemas and the tests. `openapi-document.spec.ts` fails when the response schema and the Prisma model differ.
6. Keep the migration compatible with the code that is still deployed: the pipeline applies it before the new code goes out ([below](#changing-the-schema-without-breaking-the-running-version)).
7. Check the effect on existing data and constraints; when a new constraint could fail on current rows, write a diagnostic query and share it before applying.
8. Run `npm run test:integration`. It applies every migration to an empty database and fails if the result differs from `schema.prisma` (a forgotten migration or a hand-edited SQL that does not match), then runs the repository and API specs on it. It does not see **your existing data**: a constraint that could fail on current rows still needs the diagnostic query of step 7.

### Changing the schema without breaking the running version

The pipeline applies the migration first and deploys the new code afterwards, so for a moment the **old code runs on the new schema**, and if the deploy fails or is rolled back it keeps running there. A change is safe only if the old code still works on the new schema. Split a breaking change into steps, each its own release (*expand → migrate → contract*):

| Release | Schema | Code |
|---|---|---|
| 1. Expand | Add the new column (nullable or with a default), table or index; keep the old one | Write both; keep reading the old one |
| 2. Migrate | Backfill the existing rows with a migration or a script | Read the new one |
| 3. Contract | Drop the old column, table or constraint, in a later release, once no deployed version uses it | Stop writing the old one before this release |

Examples: to rename a column, add the new one, copy, switch the code, drop the old one in a later release; to make a column `NOT NULL`, first make every writer fill it, backfill, and only then add the constraint. A migration that drops or renames something in the same release that stops using it breaks the old code during the deploy and cannot be rolled back with the application.

### Rolling back

- **The application.** The pipeline deploys what is on the branch, so revert the change (`git revert -m 1 <merge commit>` for a merge commit) and merge the revert: the pipeline redeploys the previous code. For an emergency, `npx serverless deploy list --stage <stage>` lists the deployments that the prune plugin keeps (the last three) and `npx serverless rollback --timestamp <timestamp> --stage <stage>` redeploys one; it needs AWS credentials and skips the pipeline, so revert the commit as well or the next push deploys the bad version again.
- **The database.** Migrations only go forward. Undo a change with a **new migration** that reverses it. Because each migration runs inside `BEGIN;` … `COMMIT;`, a failure leaves nothing applied, but Prisma records the migration as failed and refuses the next `migrate deploy`: fix the SQL, then follow the Prisma guidance for a failed migration (`prisma migrate resolve --rolled-back <name>`) before redeploying.
- **Why the steps above matter.** An application rollback is safe only when the previous version still works on the current schema, which is exactly what *expand → migrate → contract* keeps true.

---

## 7. Adding an Environment Variable

1. Declare it in the Zod schema of `src/config/env.ts` with its type, its range and, if it is optional, a `.default(...)`; expose it in the object `parseEnv` returns. A required variable gets `{ error: 'is required' }`; never cast a string to a type without validating it.
2. Add it to `.env.example`.
3. If the Lambda reads it: add it to `provider.environment` in `serverless.yml`. A **required** variable also goes in the `env:` of **both** deploy steps in `.github/workflows/deploy.yml`, with the GitHub secret (or variable) created in the `dev` and `prd` environments. An **optional** one with a default can be written `${env:NAME, "default"}` in `serverless.yml` and needs the deploy steps only to be overridden.
4. Add a test for the new rule in `src/config/__tests__/env.spec.ts`. If it is `required`, also add a test value to `src/test/setup.ts`, or every spec that imports `config/env.ts` fails at load time.
5. Document it in the table in [§1](#1-getting-started).

---

## 8. OpenAPI / Swagger

- Set `DOCS_ENABLED=true` and run `npm run dev`: Swagger UI is at `http://localhost:<PORT>/docs` and the JSON at `/docs/openapi.json`. Neither is available in the Lambda.
- Everything is written by hand in `<m>.openapi.ts`; the specs in `src/docs/openapi/__tests__/` keep it honest:
  - `openapi-document.spec.ts`: documented operations = Express routes; success status per method; global error responses; `400`/`404`/`409` rules; tags, `$ref`s and unused components; response schemas = Prisma models.
  - `openapi-contract.spec.ts`: every documented example runs through the real pipeline.
  - `openapi-errors.spec.ts`: error bodies match their schemas.
- Run them after any contract change: `npm run test:run -- src/docs`.
- An example in the document must be accepted by the real use case: the contract spec sends it through with a repository mock that finds only the example's own id.

---

## 9. Error Handling

Throw the class that matches the situation ([ARCHITECTURE.md §9](ARCHITECTURE.md#9-error-handling)); never build an error response in a use case or controller. To add an error type:

1. Add the subclass to `src/shared/errors/app-error.ts`.
2. Add its `code` to `appErrorResponseSchema` (`src/shared/schemas/error-response.schema.ts`).
3. If the status is new, add a response in `src/docs/openapi/responses.ts` and reference it from the operations that can return it.
4. Add it to the list in `openapi-errors.spec.ts`.

---

## 10. Testing

Two suites, both Vitest with Supertest:

| Suite | Command | Needs | Covers |
|---|---|---|---|
| **Unit** | `npm run test:run` | nothing | Use cases (mocked repository), routes (mocked controller), middlewares, logger, environment validation, `safeCompare`, `prismaCall`, and the OpenAPI specs. Seconds, runs anywhere. |
| **Integration** | `npm run test:integration` | PostgreSQL (`docker compose up -d`) and `TEST_DATABASE_URL` | The repository and the whole API on a real database: constraints, column limits, ordering and pagination, concurrent writes, the Prisma errors that `prismaCall` translates, and that the migrations produce exactly `schema.prisma`. About twenty seconds, most of it applying the migrations. |

How the integration suite works:

- `src/test/integration/global-setup.ts` runs once: it applies the migrations to `TEST_DATABASE_URL` and compares the result with `schema.prisma`.
- **Safety.** The database name must end with `_test` or the run stops: every spec starts with `resetDatabase()`, which empties every table. Never point `TEST_DATABASE_URL` at a database that holds data you want.
- The specs share the database, so they run one file at a time; write each test to start from an empty database and not to depend on another.
- In CI, the `integration` job runs them against a PostgreSQL service container, and a failure stops the migrations and the deploy.

Patterns to follow: `src/modules/example/__tests__/` (the `*.integration.spec.ts` files too) and [CONVENTIONS.md §14](CONVENTIONS.md#14-tests). The unit specs set `DATABASE_URL` and `API_KEY` test values in `src/test/setup.ts`, so they never read your `.env`.

The tests do not cover your existing data, the performance of a query, or the behavior under many Lambda containers at once ([SERVERLESS.md](SERVERLESS.md)).

---

## 11. Deployment

The workflow `.github/workflows/deploy.yml` runs on pull requests and pushes to `develop` and `main`, and on demand.

| Job | When | What |
|---|---|---|
| `validate` | always | `npm ci`, `prisma generate`, lint, type check, `npm run test:run` |
| `integration` | always | `npm run test:integration` against a PostgreSQL service container |
| `migrate-dev` → `deploy-dev` | push to `develop`, after `validate` and `integration` | `prisma migrate deploy`, then `serverless deploy --stage dev` |
| `migrate-prod` → `deploy-prod` | push to `main`, after `validate` and `integration` | the same for `--stage prod` |

Set up once per project, in GitHub → Settings → Environments (`dev` and `prd`):

| Kind | Name | Value |
|---|---|---|
| Variable | `AWS_ROLE_ARN` | ARN of the IAM role the workflow assumes through GitHub OIDC (`id-token: write`) |
| Variable | `AWS_REGION` | `sa-east-1`, matching `provider.region` |
| Secret | `DATABASE_URL` | Connection string the Lambda uses (a pooled endpoint is fine) |
| Secret | `DIRECT_DATABASE_URL` | Direct connection string for `prisma migrate deploy`: a pooler such as PgBouncer can break the schema engine. Without a pooler, use the same value as `DATABASE_URL`. |
| Secret | `API_KEY` | The value clients send as `x-api-key` |

The first deploy of a stage needs the S3 bucket named in `provider.deploymentBucket` (`<service>-deployments-<stage>`). If Serverless reports that it does not exist, create it once per stage (private, with encryption).

A push to `develop` or `main` deploys. Merge only what you want released.

### Protecting production

A migration or a deploy that reaches `prd` by an accidental merge is hard to undo, so add these protections in GitHub (they are repository settings, not code):

- **Required reviewers on the `prd` environment** (Settings → Environments → `prd`). Both `migrate-prod` and `deploy-prod` use the environment, so each waits for an approval: someone sees the migration and approves it, and approves the deploy. Add a wait timer if you want a pause between them.
- **A branch protection rule on `main`** that requires pull requests and the checks `validate` and `integration` to pass.
- **Branch `develop` as staging.** Everything reaches `dev` first; `main` receives only what was already running there.
- Read the migration of the pull request before approving it: a `DROP`, a `RENAME` or a new `NOT NULL` in the same release that changes the code breaks the rolling version ([§6](#6-changing-the-database)).

---

## 12. Development Workflow

1. Work on `develop` (or a branch created for the task) and keep each change focused.
2. Before asking for review: lint, type check and both test suites pass (`npm run test:run` and `npm run test:integration`), and the diff contains only intended files.
3. Commit messages follow conventional commits: `<type>: <summary>`, a blank line and a body.
4. Open a pull request using the template in `.github/pull_request_template.md`. CI runs `validate` on it.
5. Migrations reach each environment through the pipeline when the change is merged into `develop` or `main`.

---

## 13. Definition of Done

[CONVENTIONS.md §18](CONVENTIONS.md#18-pull-request--definition-of-done).

---

## 14. Common Pitfalls

1. **Forgetting a central registration.** A module needs entries in `shared/container/index.ts`, `routes.ts`, `docs/openapi/modules.ts` and `docs/openapi/tags.ts`. `openapi-document.spec.ts` fails if `routes.ts`, `modules.ts` and `tags.ts` disagree; the unit suite does not check `shared/container/index.ts`, because the contract spec registers its own repository mocks. A missing registration is caught by the integration spec of the API, which uses the real container; without it, it shows up at runtime as a tsyringe resolution error.
2. **Route mount order.** A router mounted under a prefix of another path captures it through `/:id`. Mount the more specific path first.
3. **Assuming OpenAPI is derived from the code.** Paths, examples and response schemas are hand-written. The specs catch most drift, but not response nullability, and they assume the five CRUD operations per module.
4. **Assuming the request container gives request-scoped dependencies.** It does not; nothing is registered with a scoped lifecycle.
5. **Expecting use cases to detect missing records on update/delete.** They do not check existence; the 404 comes from `prismaCall` translating Prisma `P2025`. A use case that needs the record before writing must fetch it itself.
6. **Prisma `undefined` filters.** Passing `undefined` in a `findMany` filter removes that condition instead of matching null. Check the complete key.
7. **Skipping `prisma generate`.** Type check and tests fail without a generated client, and it must be regenerated after every schema change.
8. **Using `npm run test` in a script expecting it to exit.** It starts watch mode in an interactive terminal; use `npm run test:run`.
9. **Pushing to `develop` or `main` deploys.** The workflow deploys after validation.
10. **New env vars missing in deployment.** See [§7](#7-adding-an-environment-variable): the Lambda only receives what `serverless.yml` lists.
11. **Ignoring the value returned by `openApiRegistry.register()`.** Passing the original schema to `registerPath` inlines it and leaves an unused component; `openapi-document.spec.ts` fails on unused components.
12. **OpenAPI examples that break a business rule.** The contract spec sends each documented example through the real use cases; an example that a use case rejects fails the spec with that error.
13. **Line endings.** The repository uses LF (`.gitattributes`). `sed -i` or an editor on Windows can rewrite a file's endings and show a whole-file diff; check with `git ls-files --eol <file>`.
14. **A migration that works only on the data you have.** The integration tests apply the migrations to an empty database: they prove the SQL runs and matches the schema, not that it works on your rows. Apply new migrations to a development database with realistic data before the pull request.
15. **`serverless.yml` warns about `nodejs24.x`.** Serverless 3 does not know the runtime in its configuration schema and prints a validation warning; the deploy works. It is tracked as a known item of the template.
16. **An `API_KEY` shorter than 16 characters.** The app refuses to start, and so do the integration tests and any script that loads `config/env.ts`. `.env.example` ships a long placeholder; replace it with a random value.
17. **`test:integration` fails with a missing `TEST_DATABASE_URL`, or refuses the database.** Copy the variable from `.env.example`, start the database (`docker compose up -d`), and make sure the name ends with `_test`. A Docker volume created before the `_test` database existed lacks it: create it as described in [§1](#1-getting-started).
18. **Port 5432 already in use.** Set `DB_PORT` in `.env` and use the same port in `DATABASE_URL`, `SHADOW_DATABASE_URL` and `TEST_DATABASE_URL`.
19. **Logging with `console`, or logging request data.** Use `logger`, which adds the request id, and never log a header, a body, a key or a connection string ([CONVENTIONS.md §15](CONVENTIONS.md#15-imports-and-formatting)).
20. **Losing the request id in a new place.** The request context starts after the body parser; code that runs before it, or in an event listener, gets no id from it and must receive `requestId` explicitly (as `accessLogMiddleware` and `errorHandler` do).
21. **Too many database connections on Lambda.** Each container opens up to `DB_POOL_MAX` connections: see [SERVERLESS.md](SERVERLESS.md#database-connections).
22. **A 429 that the application never produced.** API Gateway throttles the whole API (`serverless.yml`) before the Lambda runs, so there is no log line of the application for it, only the gateway metrics.
23. **A lockfile that works on your machine but fails `npm ci` on the CI.** The CI runs on Linux. A lockfile generated on Windows or macOS, especially with `npm install --package-lock-only`, can leave out optional dependencies of other platforms, and `npm ci` then stops with `Missing: <package> from lock file`. After you change a dependency, regenerate the lockfile on Linux with the Node of the CI and check `npm ci` there before the push: `docker run --rm -v "${PWD}:/app" -w /app node:24-slim sh -c "npm install --package-lock-only && npm ci"` (PowerShell; use `$(pwd)` in a POSIX shell). The Dependabot pull requests do not have this problem: they run on Linux.

---

## 15. Quick Reference

```
npm run dev                 local server (Swagger UI with DOCS_ENABLED=true)
npm run lint                0 errors, no new warnings
npm run check:ts            tsc --noEmit
npm run test:run            unit suite, once, no database
npm run test:integration    repositories and API on PostgreSQL (docker compose up -d)
npm run prisma:generate     after every schema change
npm run prisma:migrate:dev -- --name <name>
```

| I want to… | Go to |
|---|---|
| Add a resource | [§4](#4-how-to-add-a-new-module) |
| Change the database | [§6](#6-changing-the-database) |
| Add a configuration value | [§7](#7-adding-an-environment-variable) |
| Understand a failing OpenAPI spec | [§8](#8-openapi--swagger) |
| Set up deployment | [§11](#11-deployment) |
| Make a risky migration safely | [§6](#changing-the-schema-without-breaking-the-running-version) |
| Understand the limits of Lambda | [SERVERLESS.md](SERVERLESS.md) |
