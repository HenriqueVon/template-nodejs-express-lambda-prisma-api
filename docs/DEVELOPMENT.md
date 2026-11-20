# My Service API Development Guide

How to work in this repository using the patterns the code already follows. It complements [ARCHITECTURE.md](ARCHITECTURE.md), which describes *what* the architecture is, and [CONVENTIONS.md](CONVENTIONS.md), which lists the rules.

---

## 1. Getting Started

### Local requirements

| Requirement | Notes |
|---|---|
| **Node.js 24** | `.nvmrc`, CI (`node-version: 24`) and the Lambda runtime (`nodejs24.x`) agree. |
| **npm** | `package-lock.json` is committed and CI installs with `npm ci`. |
| **PostgreSQL** | `docker compose up -d` starts a local PostgreSQL 17 (`docker-compose.yml`) with the database and the shadow database that `.env.example` points to; the port is bound to `127.0.0.1`. If port 5432 is taken on your machine, set `DB_PORT` in `.env` and use the same port in `DATABASE_URL` and `SHADOW_DATABASE_URL`. Any other PostgreSQL works too: `prisma migrate dev` needs an empty shadow database (`SHADOW_DATABASE_URL`). `docker compose down` stops it and keeps the data; `docker compose down -v` also deletes the data. |

### Install and configure

```bash
npm install
```

Create `.env` from [`.env.example`](../.env.example) and set `API_KEY` to a long random value. `.env` is git-ignored; `.env.example` is committed.

| Variable | Read by | Required? | Notes |
|---|---|---|---|
| `NODE_ENV` | `config/env.ts`, `serverless.yml` | optional (default `development`) | `development` enables Prisma query logging. `production` disables `/docs`. |
| `PORT` | `config/env.ts` | optional (default `3000`) | Used by `npm run dev`. |
| `API_KEY` | `config/env.ts` | **required** | Clients send it as `x-api-key`. Use a long random value. |
| `DATABASE_URL` | `config/env.ts`, `prisma.config.ts` | **required** | App startup fails without it. |
| `SHADOW_DATABASE_URL` | `prisma.config.ts` | used by the Prisma CLI | Needed by `prisma migrate dev`. Not read by the app. |
| `DOCS_ENABLED` | `config/env.ts` | optional (default `'false'`) | `true` serves Swagger UI at `/docs` (only when `NODE_ENV !== 'production'`). It is not passed to the Lambda. |
| `DB_PORT` | `docker-compose.yml` | optional (default `5432`) | Host port of the Docker database. Not read by the app. |

`config/env.ts` and `prisma.config.ts` import `dotenv/config`, so `.env` is loaded automatically.

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
| Tests, one run | `npm run test:run` | What CI runs. |
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
├── CLAUDE.md  README.md  docs/          documentation
├── .github/workflows/deploy.yml         validate → migrate → deploy
├── .github/dependabot.yml               weekly dependency updates, grouped
├── docker-compose.yml  docker/initdb/   local PostgreSQL and its shadow database
├── serverless.yml                       Lambda, HTTP API, esbuild
├── prisma.config.ts                     Prisma CLI: schema, migrations, URLs
├── eslint.config.mjs  tsconfig.json  vitest.config.ts
└── src/
    ├── app.ts  handler.ts  local.ts  routes.ts
    ├── config/        env.ts, zod-openapi.ts
    ├── shared/        container, errors, http (adapter + middlewares), dtos, schemas, security, types
    ├── services/database/prisma/        client, schema.prisma, migrations/
    ├── docs/openapi/  registry, responses, tags, modules, document, openapi.routes, __tests__/
    ├── modules/       one folder per resource (see example/)
    └── test/setup.ts
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
8. **Tests.** Adjust the use case specs and the route spec.
9. **Verify.** `npm run lint`, `npm run check:ts`, `npm run test:run` ([CONVENTIONS.md §18](CONVENTIONS.md#18-pull-request--definition-of-done)).

To remove the example from a project that kept it, delete `src/modules/example`, its registrations (the four of step 6 and the entries in `openapi-contract.spec.ts`) and the `Example` model, then run `npm run prisma:generate`. Delete its migration folder if the table was never deployed; otherwise add a new migration that drops the table.

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
6. Keep the migration compatible with the code that is still deployed: the pipeline applies it before the new code goes out. Add a column before using it; stop using a column before dropping it, in two changes.
7. Check the effect on existing data and constraints; when a new constraint could fail on current rows, write a diagnostic query and share it before applying.

The test suite does not touch a database, so the SQL of a migration is verified only when it runs: apply it to a development database before opening the pull request.

---

## 7. Adding an Environment Variable

1. Declare it in `src/config/env.ts` with `required`, `optional` or `numberVar`.
2. Add it to `.env.example`.
3. If the Lambda reads it: add it to `provider.environment` in `serverless.yml` and to the `env:` of **both** deploy steps in `.github/workflows/deploy.yml`, and create the GitHub secret (or variable) in the `dev` and `prd` environments.
4. If it is `required`, add a test value to `src/test/setup.ts`, or every spec that imports `config/env.ts` fails at load time.
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

- Vitest with Supertest; the setup file `src/test/setup.ts` loads `reflect-metadata` and sets `DATABASE_URL` and `API_KEY` test values.
- Use case specs mock the repository by hand; route specs mock `controllerAdapter`; the OpenAPI contract spec mocks repositories through the DI container. No spec needs a database, so run them anywhere.
- Patterns to follow: `src/modules/example/__tests__/` and [CONVENTIONS.md §14](CONVENTIONS.md#14-tests).
- Behavior that only PostgreSQL can show (constraints, ordering, migrations) is not covered: say so in the pull request when a change depends on it.

---

## 11. Deployment

The workflow `.github/workflows/deploy.yml` runs on pull requests and pushes to `develop` and `main`, and on demand.

| Job | When | What |
|---|---|---|
| `validate` | always | `npm ci`, `prisma generate`, lint, type check, `npm run test:run` |
| `migrate-dev` → `deploy-dev` | push to `develop` | `prisma migrate deploy`, then `serverless deploy --stage dev` |
| `migrate-prod` → `deploy-prod` | push to `main` | the same for `--stage prod` |

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

---

## 12. Development Workflow

1. Work on `develop` (or a branch created for the task) and keep each change focused.
2. Before asking for review: lint, type check and the full test suite pass, and the diff contains only intended files.
3. Commit messages follow conventional commits: `<type>: <summary>`, a blank line and a body.
4. Open a pull request using the template in `.github/pull_request_template.md`. CI runs `validate` on it.
5. Migrations reach each environment through the pipeline when the change is merged into `develop` or `main`.

---

## 13. Definition of Done

[CONVENTIONS.md §18](CONVENTIONS.md#18-pull-request--definition-of-done).

---

## 14. Common Pitfalls

1. **Forgetting a central registration.** A module needs entries in `shared/container/index.ts`, `routes.ts`, `docs/openapi/modules.ts` and `docs/openapi/tags.ts`. `openapi-document.spec.ts` fails if `routes.ts`, `modules.ts` and `tags.ts` disagree; no test checks `shared/container/index.ts`, because the contract spec registers its own repository mocks. A missing registration shows up at runtime as a tsyringe resolution error.
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
14. **A migration that works only on the data you have.** The suite has no database: apply new migrations to a development database before the pull request.
15. **`serverless.yml` warns about `nodejs24.x`.** Serverless 3 does not know the runtime in its configuration schema and prints a validation warning; the deploy works. It is tracked as a known item of the template.

---

## 15. Quick Reference

```
npm run dev                 local server (Swagger UI with DOCS_ENABLED=true)
npm run lint                0 errors, no new warnings
npm run check:ts            tsc --noEmit
npm run test:run            full suite, once
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
