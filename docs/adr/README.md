# Architecture Decision Records

An ADR records **one decision, why it was taken, and what it costs**, so that the next developer can tell a deliberate choice from an accident, and can change it knowing what it was protecting. They are short on purpose.

These records describe the foundations of the template. They were written when the template was created, from two services that already used these choices. A project keeps them as its starting point, and **replaces** one with a new ADR when it decides differently (mark the old one `Superseded by NNNN`). Never edit an accepted decision to say something else: add a new record.

| # | Decision | Status |
|---|---|---|
| [0001](0001-express-instead-of-nestjs.md) | Express with an explicit module structure, not NestJS | Accepted |
| [0002](0002-modules-with-use-cases-and-repositories.md) | Modules made of route, controller, use case and repository | Accepted |
| [0003](0003-prisma-with-the-pg-adapter.md) | Prisma 7 with the `pg` driver adapter | Accepted |
| [0004](0004-lambda-with-the-serverless-framework.md) | One Lambda for the whole API, deployed with the Serverless Framework | Accepted |
| [0005](0005-tsyringe-for-dependency-injection.md) | tsyringe for dependency injection | Accepted |
| [0006](0006-openapi-written-by-hand-and-checked-by-tests.md) | OpenAPI written by hand and checked by tests | Accepted |

## Format

Copy this skeleton to `NNNN-short-title.md` (next number, kebab-case title) and add a row to the table above.

```markdown
# NNNN. Title of the decision

- **Status:** Proposed | Accepted | Superseded by NNNN
- **Date:** YYYY-MM-DD

## Context
The situation and the forces at play: what makes this a decision.

## Decision
What we do, in one or two sentences.

## Alternatives considered
Each option and why it was not chosen.

## Consequences
What gets easier, what gets harder, and what we accept.
```
