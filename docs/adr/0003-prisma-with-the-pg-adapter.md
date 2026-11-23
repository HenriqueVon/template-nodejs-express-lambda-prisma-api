# 0003. Prisma 7 with the `pg` driver adapter

- **Status:** Accepted
- **Date:** 2026-11-23

## Context

The services use PostgreSQL and want typed queries, a schema that is the single source of truth, and migrations that the pipeline can apply. The code runs in Lambda, where every container opens its own connections and the size of the package matters.

## Decision

Use **Prisma** as the ORM and migration tool, with **`@prisma/adapter-pg`**: the queries go through the `pg` driver and its pool, which the application configures (`DB_POOL_MAX`). The schema is `schema.prisma`; migrations are committed SQL and are applied by `prisma migrate deploy` in the pipeline.

## Alternatives considered

- **Drizzle or Kysely.** Closer to SQL and lighter. Prisma was kept for its migrations, its generated types for every model and the speed of writing CRUD.
- **TypeORM.** Decorator-based entities and an active-record style, which fit the layered design less well than a client behind a repository interface.
- **Plain `pg`.** Maximum control, but every type, mapping and migration is written by hand.

## Consequences

- Types follow the schema, and a schema change without its migration is caught by the integration tests (they compare the migrated database with `schema.prisma`).
- Prisma errors carry their own codes. `prismaCall` translates the ones with an HTTP meaning (`P2002`, `P2003`, `P2025`) and is the only place that knows them. The shape of those errors depends on the driver and the version: the pg adapter of Prisma 7 reports the violated constraint as `meta.driverAdapterError.cause.constraint.index`, not as the columns, which the unit tests with mocks had not shown and the integration tests did.
- The pool is per process, so in Lambda the connections multiply with the containers: see [SERVERLESS.md](../SERVERLESS.md#database-connections).
- The migration tool needs a direct connection, not a pooler (`DIRECT_DATABASE_URL`), and the client must be generated (`prisma generate`) before type checking and tests.
