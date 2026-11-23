# 0001. Express with an explicit module structure, not NestJS

- **Status:** Accepted
- **Date:** 2026-11-23

## Context

The API runs on AWS Lambda, where the size of the bundle and the work done when the code loads add to the cold start. The team needs a structure that stays the same from one service to the next, and validation, dependency injection and documentation that a new developer can read in the code.

## Decision

Use **Express 4** (wrapped by `serverless-http`) and put the structure in the code and in the rules instead of in a framework: modules ([ADR 0002](0002-modules-with-use-cases-and-repositories.md)), Zod at the HTTP edge, tsyringe for injection ([ADR 0005](0005-tsyringe-for-dependency-injection.md)), and documented conventions that the tests enforce where they can.

## Alternatives considered

- **NestJS.** It gives modules, injection, validation pipes and guards out of the box, but it is a larger framework to load on every cold start, it ties the code to its decorators and module system, and most of its structure would duplicate what `docs/CONVENTIONS.md` already states. It is the better choice for a large team that wants the framework to impose the structure.
- **Fastify.** Lighter and faster than Express, with a good Lambda adapter. Express was kept for the size of its ecosystem and because the two services the template came from already used it; the application code is not tied to it, so a move stays possible.
- **Hono.** Very small and built for runtimes like Lambda, but newer, with a smaller body of examples and middleware to draw on.

## Consequences

- The bundle stays small and the code is plain Express, which most backend developers already know.
- The structure is held up by conventions and tests, not by the framework: a module that ignores them still compiles. That is why the rules are written down and the OpenAPI specs fail when the code drifts.
- Express 4 is the older line. `src/docs/openapi/__tests__/helpers.ts` reads its router internals to list the routes, so moving to Express 5 means rewriting that helper. The Dependabot configuration ignores the major version on purpose.
