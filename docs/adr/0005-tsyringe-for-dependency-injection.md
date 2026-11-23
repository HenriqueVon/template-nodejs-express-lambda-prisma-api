# 0005. tsyringe for dependency injection

- **Status:** Accepted
- **Date:** 2026-11-23

## Context

Use cases depend on repository interfaces, and controllers depend on use cases. Tests need to build them with fakes, and the application needs one place that decides which implementation is real.

## Decision

Use **tsyringe** with constructor injection. Repositories are registered once, as singletons, under a string token in `src/shared/container/index.ts`. Controllers and use cases are `@injectable()` classes resolved by class, and every constructor parameter carries an explicit `@inject(...)`.

## Alternatives considered

- **Manual wiring** (a file that calls `new` for each class). No decorators and no `reflect-metadata`, and the dependencies are as visible as they can be. It is a reasonable choice and the cheapest to understand, but the wiring file grows with every module and every operation.
- **InversifyJS or NestJS injection.** More features (scopes, modules) than the services use, and a heavier dependency.

## Consequences

- Decorators need `experimentalDecorators` and `emitDecoratorMetadata` in `tsconfig.json` and `import 'reflect-metadata'` first. esbuild, which bundles the Lambda and runs the tests, does not emit decorator metadata, so the types cannot be used to find a dependency: `@inject(...)` is required on **every** parameter.
- `controllerAdapter` resolves the controller from a per-request child container. Nothing is registered with a scoped lifecycle, so that container does not make anything request-scoped: every request shares the singletons. It is kept so that a future request-scoped dependency (the current user, for instance) has a place; if that need never comes, removing it is a small, safe simplification.
- A repository that is not registered fails only when a request resolves it. No test checks `src/shared/container/index.ts`: the integration tests that go through the real app are what catch a missing registration.
