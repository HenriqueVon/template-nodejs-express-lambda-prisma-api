# 0006. OpenAPI written by hand and checked by tests

- **Status:** Accepted
- **Date:** 2026-11-23

## Context

The API contract is what other teams and clients depend on, and documentation that drifts from the code is worse than none. Documentation generated from decorators or annotations can still be wrong about what the runtime does (the status codes, the error bodies, the examples).

## Decision

Keep the OpenAPI document **in code, written by hand** with `zod-to-openapi`, reusing the Zod schemas that validate the requests, and make the **tests fail when it drifts**:

- every Express route is documented, and only those routes;
- each operation documents the success status its method uses, the global errors, `400`, `404` where there is an `{id}`, and `409` where a unique constraint or foreign key can fail;
- every documented example runs through the real route, validation, controller and use case (with a mocked repository) and must produce the documented status and body;
- the error bodies match what the middlewares produce, and each response schema has the fields and JSON types of its Prisma model.

## Alternatives considered

- **Generate the document from the routes** (decorators, `tsoa`, NestJS Swagger). Less to write, but the generated document describes what was annotated, not necessarily what runs, and it adds annotations to the code.
- **Contract first** (write the OpenAPI file, generate server stubs and validators). The strongest guarantee and the right choice for public APIs with many consumers, but it brings a code generation step and a second source of truth to keep in order.
- **No documentation.** Not an option for an API with consumers.

## Consequences

- The contract is checked on every pull request, and the examples in Swagger are guaranteed to be accepted by the API.
- There is some duplication (a Zod schema and a path definition for each operation) and the specs assume the five CRUD operations of a module. A route outside that shape needs its own checks ([DEVELOPMENT.md §5](../DEVELOPMENT.md#5-how-to-add-or-change-an-endpoint)).
- The route listing helper depends on Express 4 router internals ([ADR 0001](0001-express-instead-of-nestjs.md)).
