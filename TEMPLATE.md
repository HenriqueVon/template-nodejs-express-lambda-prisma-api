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
3. Follow the "Next steps" it prints: `npm install`, set `DATABASE_URL` and `SHADOW_DATABASE_URL`, `npm run prisma:generate`, `npm run prisma:migrate:dev`, `npm run dev`.
4. Edit the one-line description in `README.md`, fill `docs/DOMAIN.md`, then `git init` and make the first commit.
5. Create the `develop` branch: `CLAUDE.md` and the workflow assume `develop` and `main`, and **Use this template** copies only the default branch.
6. Before the first deploy, create the `dev` and `prd` environments in GitHub (variables and secrets: [docs/DEVELOPMENT.md §11](docs/DEVELOPMENT.md#11-deployment)).

## What is included

| Area | Content |
|---|---|
| Runtime | Express app wrapped by `serverless-http` (`handler.ts`), local server with Swagger UI (`local.ts`), `serverless.yml` (HTTP API, `nodejs24.x`, esbuild bundle, `sa-east-1`) |
| Request pipeline | `/health` (public) → API key → routes → error handler. One DI child container per request |
| Layers | route → `validateRequest` (Zod) → controller → use case → repository → Prisma, with the rules in [docs/CONVENTIONS.md](docs/CONVENTIONS.md) |
| Errors | `AppError` subclasses, `prismaCall` (Prisma `P2002`/`P2003`/`P2025` → 409/409/404), body parser errors → 400/413 |
| OpenAPI | zod-to-openapi registry, shared error responses, Swagger UI on the local server only |
| Tests | Vitest. Use case specs, route specs and OpenAPI specs that compare the document with the Express routes, the Prisma model, the error bodies and the real pipeline |
| Database | Prisma 7 with the `pg` adapter, one migration for the example module |
| CI/CD | `validate` → `migrate` → `deploy` per environment (GitHub Actions + AWS OIDC role) |
| Docs and AI | `CLAUDE.md` and `docs/` with architecture, conventions, development guide and a domain skeleton |
| Example | `src/modules/example`: a complete CRUD with tests and OpenAPI, to copy when adding a module |

## Decisions behind the template

These were chosen when the template was created. Change them in the template, not in each project.

1. **Reference module.** A complete `example` CRUD is included and can be removed with `--remove-example`. A living module keeps the documented pattern executable and tested.
2. **Customization.** A dependency-free `init` script, not a manual find/replace and not a generator CLI.
3. **Authentication.** Only the static `x-api-key` check. Projects that sit behind an identity service add a bearer-token middleware themselves.
4. **`/health` is public.** In the business API it required the API key and a bearer token, which breaks load balancer and uptime checks. In the identity service it was already public.
5. **Migrations use `DIRECT_DATABASE_URL`** (from the identity service): a connection pooler such as PgBouncer can break the Prisma schema engine. A project without a pooler sets both secrets to the same value.
6. **Env access** goes through `config/env.ts` everywhere, including `prisma.client.ts` (the business API read `process.env` there). Test values for the required variables live in `src/test/setup.ts`.

## What was left out on purpose

- Everything domain-specific: the financial modules of the business API, the identity-service modules (users, sessions, social login, MFA), jobs and scripts.
- Bearer-token authentication and the `UpstreamAuthError`/`TooManyRequestsError` types. Add them with the feature that needs them.
- Bulk delete/pay endpoints and their `Resources*Error` types (they exist in the business API only).
- The repository `exists()` method, which every repository of the business API declares and none uses.

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

## Known items inherited from the source repositories

- **Serverless Framework v3** is end of life. `serverless package` prints `provider.runtime must be equal to one of the allowed values` for `nodejs24.x` (a validation warning only: both source repositories deploy this way), and its dependency tree brings deprecated packages (`aws-sdk` v2, old `glob`). Upgrading to v4 changes licensing and login rules, so it is a decision to take on its own.
- **Express 4** is kept to match both repositories. `openapi/__tests__/helpers.ts` reads Express 4 router internals to list the routes; moving to Express 5 means rewriting that helper.
- Prisma `provider = "prisma-client-js"` (the 7.x default generator) with `@prisma/client` imports, as in both repositories.

## Evolve the template

- On GitHub the repository is marked as a **template repository** (Settings → General). The migrate and deploy jobs of `deploy.yml` skip it through `!github.event.repository.is_template`, so only `validate` runs there. This guard was not run on GitHub yet: check the first push to the template repository.
- Keep it **runnable**: after every change, copy the folder somewhere else and run `npm install`, `npm run prisma:generate`, `npm run lint`, `npm run check:ts` and `npm run test:run`. Do it again after `npm run init -- --name x-api --remove-example`.
- Marker comments let `init` customize files. `// @template:example:start` … `// @template:example:end` wrap every line that registers the example module (and `<!-- @template:only:start/end -->` wraps text that only the template needs). When you add a registration of the example somewhere, wrap it in these markers.
- Placeholders are real values: `my-service-api`, `My Service API` and `my_service_api`. Do not use them for anything else, because `init` replaces every occurrence.
- Improvements found in a project (a better middleware, a convention) are ported to the template by hand, with the checks above. Projects do not sync automatically from the template.
- `package-lock.json` is committed so that `npm ci` works in the first CI run. Regenerate it with `npm install` when you change a dependency.
