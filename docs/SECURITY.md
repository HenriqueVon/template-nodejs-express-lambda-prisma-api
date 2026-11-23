# Security

What the template protects, what it deliberately does not, and what a project must add before it handles real data. It is written for the people who run a service built from the template.

## What is in place

| Control | Where | What it gives |
|---|---|---|
| API key on every route but `/health` | `api-key.middleware.ts`, mounted before the routes | Only a caller that knows the key reaches the API. `401` without the header, `403` with a wrong key. |
| Comparison that does not leak the key | `safe-compare.ts` | The key is compared by SHA-256 hash with `crypto.timingSafeEqual`, so neither its content nor its length can be learned from the response time. |
| Key strength | `config/env.ts` | The application does not start with an `API_KEY` shorter than 16 characters. `npm run init` generates 64 hexadecimal characters. |
| Input validation | `validateRequest` + strict Zod schemas | Unknown fields and invalid values are refused with `400` before any code runs. |
| Body size limit | `express.json()` | Bodies above 100 KB are refused with `413`. |
| Request limit | `serverless.yml` (API Gateway throttle) | A global ceiling of requests per second; above it AWS answers `429` before the Lambda runs. |
| No secrets in logs | `shared/logging/logger.ts` and its tests | The logger writes only what the code passes to it; headers, bodies and keys are never passed. The tests assert that the key does not appear. |
| Secrets outside the code | `.env` (git-ignored), GitHub environment secrets | Nothing sensitive is committed; the pipeline reads secrets from the environment. |
| Short-lived cloud credentials | OIDC role in the deploy workflow | No AWS access keys are stored in GitHub. |
| Static analysis and dependency updates | CodeQL and Dependabot (on the template repository; Dependabot also in projects) | Vulnerable code patterns and outdated dependencies are reported. |

## Limits of the API key

A single static key is enough for **service-to-service** calls from a few trusted callers, and nothing more. Know what it cannot do:

- **No identity.** The API cannot tell who called, only that the caller knew the key. There is no user, no per-caller permission and no audit of who did what. Add authentication of users (for example a bearer token validated by an identity service) before exposing user data; see the decision note in [ARCHITECTURE.md §10](ARCHITECTURE.md#10-security-boundary).
- **One key for everyone.** Giving the same key to several callers means revoking one revokes all. Use a different deployment, or an extension that accepts several keys, if callers must be independent.
- **No automatic rotation or expiry.** The key lives until someone changes it ([rotation](#rotating-the-api-key)).
- **It must stay secret.** Anything that runs in a browser or a mobile app can be read by its user, so **a front end must never hold the key**: call the API from a backend.
- **No browser support.** The template sets no CORS headers and no security headers (such as those of `helmet`), because it targets server-to-server use. A browser calling the API directly needs both, and a different authentication.
- **No rate limit per caller.** The throttle is global ([SERVERLESS.md](SERVERLESS.md#concurrency-and-throttling)); one caller can use the whole budget.
- **A leaked key is a full compromise** of the API until it is rotated.

## Rotating the API key

The application accepts exactly one key, so a rotation has a short window in which callers that have not changed yet get `403`. To rotate:

1. Generate a new key (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`).
2. Update the `API_KEY` secret in the GitHub environment (`dev` or `prd`) and run the deploy workflow, which redeploys the function with the new value.
3. Update every caller at the same moment, and watch the `http_request` lines with `status` 403 until they stop.

If the window is not acceptable, extend `api-key.middleware.ts` and `config/env.ts` to accept a second key during the rotation, remove the old one in the next release, and add a test for each case. That is a change to a security control: treat it as a decision.

## What a project must add before it handles real data

- Per-user authentication and authorization, if the API serves user data.
- A **least-privilege database user** for the application (read and write on its tables only) distinct from the user that runs migrations (`DIRECT_DATABASE_URL`, which needs schema rights).
- TLS to the database, and the database outside the public internet where possible.
- A retention policy for logs: they hold paths, status codes and error messages, and can hold identifiers inside messages.
- Alarms on `4xx`/`5xx`, throttles and authentication failures, and someone who reads them.
- A decision about backups and about how a rollback of a bad migration is done ([DEVELOPMENT.md §6](DEVELOPMENT.md#6-changing-the-database)).
