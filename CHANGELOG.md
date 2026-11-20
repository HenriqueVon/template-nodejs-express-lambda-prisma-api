# Changelog

All notable changes to the template are recorded here, following [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Projects created from the template do not inherit this file (`npm run init` deletes it).

## [Unreleased]

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
