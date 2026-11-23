# Template: nodejs-express-lambda-prisma-api

Base for REST APIs that run on AWS Lambda: **Node.js 24 · TypeScript · Express 4 · Zod · tsyringe · Prisma 7 (PostgreSQL) · Vitest · Serverless Framework**.

It was extracted from two services of the same author, one business API and one identity service, which share the same structure, and it keeps what both have in common. This file is for people who **use or evolve the template**. `npm run init` deletes it, so it never reaches a project.

## Create a project

Two ways to get a copy: on GitHub, **Use this template** on the template repository (it copies the files without history); or copy this folder by hand. Then:

1. Copy this folder to the new repository location (do not copy `node_modules` or `.git`). Skip this step when you used **Use this template**.
2. In the copy, run:

   ```bash
   npm run init -- --name orders-api
   ```

   | Option | Effect |
   |---|---|
   | `--name <name>` | Required. kebab-case, at most 38 characters (AWS role and bucket name limits). Replaces the package name, the Serverless service, the deployment bucket and role names, the health payload and the database names in `.env.example`. |
   | `--title "<Title>"` | Title used in the OpenAPI document. Default: derived from the name (`orders-api` → `Orders API`). |
   | `--remove-example` | Deletes the reference `example` module, its migration and every registration of it. |

   `init` also creates `.env` from `.env.example` with a random `API_KEY` (the key is never printed), removes this file and the `init` script, and deletes itself. It needs no `npm install` first.
3. Follow the "Next steps" it prints: `docker compose up -d` (or set `DATABASE_URL` and `SHADOW_DATABASE_URL` for your own PostgreSQL), `npm install`, `npm run prisma:generate`, `npm run prisma:migrate:dev`, `npm run dev`.
4. Edit the one-line description in `README.md`, fill `docs/DOMAIN.md`, then `git init` and make the first commit.
5. Create the `develop` branch: `CLAUDE.md` and the workflow assume `develop` and `main`, and **Use this template** copies only the default branch.
6. Before the first deploy, create the `dev` and `prd` environments in GitHub (variables and secrets: [docs/DEVELOPMENT.md §11](docs/DEVELOPMENT.md#11-deployment)).

## What is included

| Area | Content |
|---|---|
| Runtime | Express app wrapped by `serverless-http` (`handler.ts`), local server with Swagger UI (`local.ts`), `serverless.yml` (HTTP API, `nodejs24.x`, esbuild bundle, `sa-east-1`) |
| Request pipeline | request id (API Gateway id on Lambda, `x-request-id` header) → JSON access log → body parser → DI child container and request context → `/health` (public) → API key → routes → error handler |
| Configuration | `config/env.ts` validates every variable with Zod and stops the start with one clear message; a small, configurable database pool (`DB_POOL_MAX`) for Lambda |
| Observability | `logger` writes one JSON line per event with the request id (carried by an `AsyncLocalStorage` to code that has no `req`); the id is returned in `x-request-id` |
| Layers | route → `validateRequest` (Zod) → controller → use case → repository → Prisma, with the rules in [docs/CONVENTIONS.md](docs/CONVENTIONS.md) |
| Errors | `AppError` subclasses, `prismaCall` (Prisma `P2002`/`P2003`/`P2025` → 409/409/404), body parser errors → 400/413 |
| OpenAPI | zod-to-openapi registry, shared error responses, Swagger UI on the local server only |
| Tests | Vitest. **Unit suite** (use cases, routes, middlewares, logger, environment, OpenAPI specs that compare the document with the Express routes, the Prisma model, the error bodies and the real pipeline) and an **integration suite** on PostgreSQL (repositories and the whole API; it applies the migrations and fails if they differ from `schema.prisma`; it refuses a database whose name does not end with `_test`) |
| Database | Prisma 7 with the `pg` adapter, one migration for the example module, and `docker-compose.yml` with a local PostgreSQL (and the shadow database) that matches `.env.example` |
| CI/CD | `validate` + `integration` (PostgreSQL service container) → `migrate` → `deploy` per environment (GitHub Actions + AWS OIDC role), a global API Gateway throttle, and Dependabot (weekly, grouped; major upgrades of Express and Serverless are ignored on purpose) |
| OpenAPI export | `npm run docs:openapi` writes the document as JSON |
| Docs and AI | `CLAUDE.md` and `docs/` with architecture, conventions, development guide, a domain skeleton, six decision records (`docs/adr/`), the trade-offs of running on Lambda (`docs/SERVERLESS.md`) and the limits of the API key (`docs/SECURITY.md`) |
| Example | `src/modules/example`: a complete CRUD with tests and OpenAPI, to copy when adding a module |

## Only in the template repository

These files describe or showcase the template, so `npm run init` deletes them and a project never inherits them:

| File | Purpose | One-time setup on GitHub |
|---|---|---|
| `TEMPLATE.md`, `CHANGELOG.md`, `SECURITY.md` | The guide, the release history and the security policy of the template | Settings → Security → enable **Private vulnerability reporting** (the policy points to it) |
| `.github/workflows/docs.yml`, `.github/pages/` | Publishes the OpenAPI document as a static Swagger UI page (GitHub Pages) | Settings → Pages → Source: **GitHub Actions** |
| `.github/workflows/codeql.yml` | CodeQL code scanning, free on public repositories only (private ones need GitHub Advanced Security) | none (it runs on push and weekly) |
| `.github/workflows/template-init.yml` | Tests the template **as a generator**: it runs `npm run init` on a copy, in both modes (with and without the example), checks that no name, marker or template-only file is left, and runs `npm ci`, lint, type check and both test suites on the generated project (the integration tests on a PostgreSQL service container) | none |

The block of `README.md` between `<!-- @template:only:start -->` and `<!-- @template:only:end -->` (the showcase) goes away too. The Pages site loads Swagger UI from `unpkg.com` at a pinned version; bump `swagger-ui-dist` in `.github/pages/index.html` when you update it.

To release: add the changes under `[Unreleased]` in `CHANGELOG.md`, move them to a new version, then create the GitHub release with the tag `vX.Y.Z`.

## Decisions behind the template

These were chosen when the template was created. Change them in the template, not in each project.

1. **Reference module.** A complete `example` CRUD is included and can be removed with `--remove-example`. A living module keeps the documented pattern executable and tested.
2. **Customization.** A dependency-free `init` script, not a manual find/replace and not a generator CLI.
3. **Authentication.** Only the static `x-api-key` check. Projects that sit behind an identity service add a bearer-token middleware themselves.
4. **`/health` is public.** In the business API it required the API key and a bearer token, which breaks load balancer and uptime checks. In the identity service it was already public.
5. **Migrations use `DIRECT_DATABASE_URL`** (from the identity service): a connection pooler such as PgBouncer can break the Prisma schema engine. A project without a pooler sets both secrets to the same value.
6. **Env access** goes through `config/env.ts` everywhere, including `prisma.client.ts` (the business API read `process.env` there). The file validates the variables with a Zod schema, so a wrong value fails at start. Test values for the required variables live in `src/test/setup.ts`.
7. **Logs are JSON lines written with `console`**, not a logging library. It costs no dependency and no cold start, and CloudWatch can filter by field. Pino or AWS Lambda Powertools are reasonable upgrades when a project needs sampling, child loggers or tracing; `logger` is the only place to change.
8. **The database pool is small by default** (`DB_POOL_MAX=2`) and API Gateway throttles the API (50 requests per second, burst 100). Both are starting points for a Lambda that shares a database with other containers; [docs/SERVERLESS.md](docs/SERVERLESS.md) explains the arithmetic. Change them per project.
9. **Integration tests use the same PostgreSQL as development** (Docker Compose locally, a service container in CI), not Testcontainers: no extra dependency and no access to the Docker socket from the tests, at the price of a database that must be started first. The unit suite stays free of any database.
10. **Two things the mocks did not show.** The first integration run found that, with the pg adapter of Prisma 7, a unique violation reports the constraint name (`meta.driverAdapterError.cause.constraint.index`), not the columns that the inherited code looked for, so `prismaCall` logged an incomplete line; it now reads both shapes. And `safeCompare`, inherited from both services, returned early when the lengths differed; it now compares SHA-256 hashes.

## What was left out on purpose

- Everything domain-specific: the financial modules of the business API, the identity-service modules (users, sessions, social login, MFA), jobs and scripts.
- Bearer-token authentication and the `UpstreamAuthError`/`TooManyRequestsError` types. Add them with the feature that needs them.
- Bulk delete/pay endpoints and their `Resources*Error` types (they exist in the business API only).
- The repository `exists()` method, which every repository of the business API declares and none uses.
- A logging library, JWT or RBAC, per-caller rate limits, CORS and security headers. They are extensions for a project that needs them; [docs/SECURITY.md](docs/SECURITY.md) lists what the template does not give.
- Collapsing the per-request DI child container. It is unused today (nothing is request-scoped) and documented as such in [ADR 0005](docs/adr/0005-tsyringe-for-dependency-injection.md); removing it is a small simplification for a project that is sure it will never need one.

## Differences from the source repositories (fixed while extracting)

| Source issue | In the template |
|---|---|
| The npm package `crypto` in `dependencies` (a deprecated stub; Node has `crypto` built in) | Removed |
| `typescript-eslint` in `dependencies`, plus redundant `@typescript-eslint/*` packages | Only `typescript-eslint`, in `devDependencies` |
| `eslint.config.mjs` imports `globals` and `@eslint/js`, which were not declared | Declared in `devDependencies` |
| CI ran `npm run test` (watch mode) | CI runs `npm run test:run` |
| `findMany` without a total order in four repositories of the business API | Ordered by `createdAt` (or the requested field) plus `id` |
| Coerced `limit`/`offset` documented as `number \| null` | `.openapi({ type: 'integer', ... })` |
| Mixed CRLF/LF line endings | `.gitattributes` forces LF |
| A stray `undefined/temp` folder and personal-project README text in the business API | Not carried over |
| `tsconfig.json` with `moduleResolution: "Node"` and `baseUrl`, which TypeScript 6 reports as errors (removed in 7) | `module: "preserve"` and relative `paths`; checked on TypeScript 5.9.3 and 6.0.3. Adding `ignoreDeprecations` instead is not enough: TypeScript 6 also checks `import 'dotenv/config'`, which the old resolution cannot find |

## Known items inherited from the source repositories

- **Serverless Framework v3** is end of life. `serverless package` prints `provider.runtime must be equal to one of the allowed values` for `nodejs24.x` (a validation warning only: both source repositories deploy this way), and its dependency tree brings deprecated packages (`aws-sdk` v2, old `glob`). Upgrading to v4 changes licensing and login rules, so it is a decision to take on its own.
- **Express 4** is kept to match both repositories. `openapi/__tests__/helpers.ts` reads Express 4 router internals to list the routes; moving to Express 5 means rewriting that helper.
- Prisma `provider = "prisma-client-js"` (the 7.x default generator) with `@prisma/client` imports, as in both repositories.

## Evolve the template

- On GitHub the repository is marked as a **template repository** (Settings → General). The migrate and deploy jobs of `deploy.yml` skip it through `!github.event.repository.is_template`, so only `validate` runs there. This guard was not run on GitHub yet: check the first push to the template repository.
- Keep it **runnable**, and keep what it **generates** runnable: the `Test the init script` workflow does this on every push and pull request (it runs `init` in both modes and the checks of the generated project). To reproduce it locally, copy the folder somewhere else, run `npm run init -- --name x-api` (and again with `--remove-example`), then `npm ci`, `npm run prisma:generate`, `npm run lint`, `npm run check:ts` and `npm run test:run`; do it on Linux, like the CI (see the note about the lockfile below).
- When you add a file that only makes sense in the template, add it to `TEMPLATE_ONLY` in `scripts/init.mjs` **and** to the list of the workflow above, or a project will inherit it and the workflow will fail.
- Marker comments let `init` customize files. `// @template:example:start` … `// @template:example:end` wrap every line that registers the example module (and `<!-- @template:only:start/end -->` wraps text that only the template needs). When you add a registration of the example somewhere, wrap it in these markers.
- Placeholders are real values: `my-service-api`, `My Service API` and `my_service_api`. Do not use them for anything else, because `init` replaces every occurrence.
- Improvements found in a project (a better middleware, a convention) are ported to the template by hand, with the checks above. Projects do not sync automatically from the template.
- `package-lock.json` is committed so that `npm ci` works in the first CI run. Regenerate it **on Linux** when you change a dependency (a lockfile made on Windows can lack optional packages of other platforms and break `npm ci` on the CI): see [docs/DEVELOPMENT.md §14](docs/DEVELOPMENT.md#14-common-pitfalls), pitfall 23. Dependabot runs on Linux, so its pull requests are safe.
