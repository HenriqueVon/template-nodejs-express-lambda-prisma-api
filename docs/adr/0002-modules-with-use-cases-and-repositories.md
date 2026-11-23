# 0002. Modules made of route, controller, use case and repository

- **Status:** Accepted
- **Date:** 2026-11-23

## Context

Business rules should be testable without HTTP and without a database, the code that talks to the database should be in one place, and a developer should find the same files in the same folders in every resource. Over-engineering is also a risk: the services are CRUD-heavy, and a design with many layers would cost more than it returns.

## Decision

Every resource is a **module** under `src/modules/<name>/` with a route, a controller, one use case per operation, a repository interface with its implementation, Zod schemas and DTOs. The flow is route → `validateRequest` → controller → use case → repository → Prisma. The controller sets the status and holds no rules; the use case holds the rules and never imports Prisma; only the repository touches the database; **modules never import each other**.

## Alternatives considered

- **Controllers that call Prisma directly.** Fewest files, but the rules end up tied to Express and to the database, so testing them needs both.
- **One service class per module.** It collects unrelated operations and grows; one use case per operation keeps each rule small and its test next to it.
- **DDD, hexagonal or CQRS.** Rejected for now (`docs/CONVENTIONS.md`, "Design and Readability"): they add concepts the services do not yet need, and a pattern added without a demonstrated problem is a cost for every developer who reads the code.

## Consequences

- Use cases are tested with a hand-written repository mock, in milliseconds; the repository is tested against a real database ([integration tests](../DEVELOPMENT.md#10-testing)).
- A CRUD module has about twenty files. That is ceremony for a trivial resource, so the template ships the `example` module to copy and the steps to do it ([DEVELOPMENT.md §4](../DEVELOPMENT.md#4-how-to-add-a-new-module)).
- Because modules are isolated, a rule that spans two modules has no obvious home. It needs an explicit decision (a new ADR), not an import.
