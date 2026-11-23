# 0004. One Lambda for the whole API, deployed with the Serverless Framework

- **Status:** Accepted
- **Date:** 2026-11-23

## Context

The services have moderate and uneven traffic, a small team and no wish to operate servers. They run on AWS in one region, and the same API should also run as a plain Node.js server on a developer's machine.

## Decision

Run the **whole Express app in a single Lambda function** behind an API Gateway HTTP API, bundle it with esbuild and deploy it with the **Serverless Framework 3** from GitHub Actions, authenticating to AWS with an OIDC role instead of stored keys. `src/local.ts` runs the same app as a normal server.

## Alternatives considered

- **One function per route.** Smaller artifacts and per-route permissions and settings, at the cost of more configuration and a bootstrap repeated in every function. It pays off when routes have very different needs.
- **Containers (ECS Fargate or App Runner).** No cold starts and steady performance for sustained traffic, long connections and heavy work, but you pay for idle capacity and operate more infrastructure. See [SERVERLESS.md](../SERVERLESS.md#when-lambda-stops-being-the-right-choice).
- **AWS SAM, CDK or SST instead of the Serverless Framework.** Valid, and some are better maintained today. The Serverless Framework was kept because both services already used it and the configuration is short.
- **Serverless Framework 4.** The upgrade changes the licensing and login rules and is a decision of its own.

## Consequences

- One deployable unit, one set of logs and one cold start path to reason about, and the app is portable.
- Every route shares the memory, the timeout and the connection pool of the function; a heavy route cannot get its own settings without being split out.
- Serverless Framework 3 is end of life and its configuration schema does not know the `nodejs24.x` runtime (it only warns). Upgrading is a separate decision, and the Dependabot configuration ignores the major version until it is taken.
- The consequences of running on Lambda (cold starts, database connections, concurrency, limits) are in [SERVERLESS.md](../SERVERLESS.md).
