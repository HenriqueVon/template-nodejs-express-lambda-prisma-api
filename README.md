<!-- @template:only:start -->
# template-nodejs-express-lambda-prisma-api

[![CI](https://github.com/HenriqueVon/template-nodejs-express-lambda-prisma-api/actions/workflows/deploy.yml/badge.svg)](https://github.com/HenriqueVon/template-nodejs-express-lambda-prisma-api/actions/workflows/deploy.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

A production-minded starting point for REST APIs on **AWS Lambda**: Node.js 24, TypeScript, Express, Zod, tsyringe and Prisma 7 on PostgreSQL. Create a project, run one command, and start with a layered architecture, a tested OpenAPI document, CI/CD and written conventions already in place.

[**Use this template**](https://github.com/HenriqueVon/template-nodejs-express-lambda-prisma-api/generate)

## Why it is useful

- **A clear flow in every module.** route → Zod validation → controller → use case → repository → Prisma. Each layer has one job and the rules are written down in [docs/CONVENTIONS.md](docs/CONVENTIONS.md).
- **Documentation that cannot drift.** The OpenAPI document is checked by tests against the Express routes, the Prisma model, the error bodies and the real request pipeline. A change to a route without its docs fails the build.
- **One command to start.** `npm run init -- --name orders-api` renames the service everywhere, creates the `.env` with a random API key and can remove the example module.
- **A reference module.** `src/modules/example` is a complete CRUD with use case, route and contract tests, to copy when adding a resource.
- **Deploy pipeline included.** GitHub Actions run lint, type check and tests, apply the Prisma migrations and deploy to AWS with the Serverless Framework, per environment, through an OIDC role.
- **Ready for AI-assisted work.** `CLAUDE.md` and `docs/` give an assistant, or a new teammate, the architecture, the conventions and the checks to run.

## Use it

1. Click **Use this template** (or copy this folder).
2. Run `npm run init -- --name orders-api` (add `--remove-example` to start without the example module).
3. Run `npm install`, `npm run prisma:generate` and `npm run dev`.

Every option, the decisions behind the template and how to evolve it are in [TEMPLATE.md](TEMPLATE.md).

## What is inside

```
src/
├── app.ts  handler.ts  local.ts  routes.ts     Express app, Lambda handler, local server
├── config/                                      typed environment variables
├── shared/                                      errors, middlewares, DI container, shared schemas
├── services/database/prisma/                    schema and migrations
├── docs/openapi/                                OpenAPI registry, document and its tests
└── modules/example/                             reference CRUD: routes, use cases, repository, tests
```

| Concern | Choice |
|---|---|
| Runtime | Node.js 24, AWS Lambda behind an HTTP API, bundled with esbuild |
| Web | Express 4 through `serverless-http` |
| Validation and docs | Zod 4 and `zod-to-openapi`, Swagger UI on the local server |
| Dependency injection | tsyringe |
| Data | Prisma 7 with the `pg` adapter, PostgreSQL |
| Tests | Vitest and Supertest |
| CI/CD | GitHub Actions and the Serverless Framework |

---

*Below is the README every new project starts with; `npm run init` replaces everything above this line.*

<!-- @template:only:end -->
# My Service API

> One sentence about what this service does. Replace this line.

REST API running on AWS Lambda. The business concepts are described in [docs/DOMAIN.md](docs/DOMAIN.md).

**Stack:** TypeScript · Express 4 · Zod · tsyringe · Prisma 7 (PostgreSQL) · Vitest · AWS Lambda (Serverless Framework).

## Quick Start

Requirements: Node.js 24 (see `.nvmrc`), npm and a PostgreSQL database.

```bash
npm install
```

Create `.env` from [`.env.example`](.env.example) (set `API_KEY`, `DATABASE_URL` and `SHADOW_DATABASE_URL`). Then:

```bash
npm run prisma:generate
```

```bash
npm run prisma:migrate:dev
```

```bash
npm run dev
```

The API listens on `http://localhost:<PORT>/v1/api`. `GET /health` is public; every other request needs the header `x-api-key: <API_KEY>`.

Set `DOCS_ENABLED=true` to serve Swagger UI at `http://localhost:<PORT>/docs`. Docs are served by the local server only.

Full setup, commands, migrations and workflow: [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

## Checks

```bash
npm run lint
```

```bash
npm run check:ts
```

```bash
npm run test:run
```

CI runs the same checks on pull requests to `develop`/`main` and before every deploy.

## Deployment

A push to `develop` deploys the `dev` stage; a push to `main` deploys `prod` (GitHub Actions + Serverless). Pending database migrations are applied by the pipeline to the target stage before the deploy. The required GitHub environments, variables and secrets are listed in [docs/DEVELOPMENT.md §11](docs/DEVELOPMENT.md#11-deployment).

## Documentation

| Document | Purpose |
|---|---|
| [CLAUDE.md](CLAUDE.md) | How an AI assistant operates in this repository. |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | How the system is built today. |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | Setup, commands, step-by-step guides and pitfalls. |
| [docs/CONVENTIONS.md](docs/CONVENTIONS.md) | The rules new code follows. |
| [docs/DOMAIN.md](docs/DOMAIN.md) | Business concepts and rules. |

## License

[MIT](LICENSE)
