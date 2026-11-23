# Running on AWS Lambda: trade-offs

What changes when this API runs on Lambda instead of on a server, and what the template does about it. The decision to use Lambda is [ADR 0004](adr/0004-lambda-with-the-serverless-framework.md); this document is its consequences, written so that a project can check them against its own traffic. The numbers (limits and quotas) are the AWS defaults at the time of writing: confirm them in your account and in the AWS documentation before relying on them.

## How the app runs

- `src/handler.ts` wraps the Express app with `serverless-http`. API Gateway (an HTTP API) forwards every path to one function (`/` and `/{proxy+}` in `serverless.yml`).
- A Lambda **container** is reused for the next invocations while it is warm. Everything created when the code loads, the Express app, the DI container and the Prisma client with its connection pool, is created once per container and shared by the requests it serves one after another. A container handles **one request at a time**; more concurrent requests mean more containers.
- `src/local.ts` runs the same app as an ordinary Node.js server. The Swagger UI exists only there: the Lambda bundle does not contain it.

## Cold starts

A cold start happens when a request needs a container that does not exist yet: AWS starts it and the code loads before the request is served. What makes it longer, and what the template does:

| Factor | In the template |
|---|---|
| Size of the bundle | esbuild bundles and tree-shakes the code; the OpenAPI document, Swagger UI and tests are not in the Lambda. Keep dependencies few, and check the size of the package after adding one. |
| Work done at load | The Prisma client and the pool are created at load, but no connection is opened until the first query. Avoid I/O at the top level of a module. |
| Memory | Lambda gives CPU in proportion to memory, so more memory shortens the load and the requests. The template starts at 256 MB; measure before changing it. |

How to look at it: each invocation ends with a `REPORT` line in CloudWatch Logs, and a cold start adds `Init Duration`. To remove cold starts for latency-sensitive routes, use provisioned concurrency (you pay for the idle capacity), or move that route to a container ([below](#when-lambda-stops-being-the-right-choice)).

## Database connections

This is the limit that surprises teams first. The Prisma client of **each container** has its own `pg` pool, so the connections that the database sees are

```
containers running at once × DB_POOL_MAX
```

PostgreSQL has a `max_connections` that depends on the instance size. A burst of traffic starts many containers, and a pool of 10 each (the default of the `pg` library) can exhaust the database even when the load on the database is small. The symptoms are `too many clients already` errors and requests that time out waiting for a connection.

What the template does:

- `DB_POOL_MAX` defaults to **2**, set in `src/config/env.ts` and passed to the adapter in `prisma.client.ts`. A container serves one request at a time, so a small pool is enough (two lets the two queries of a list run together).
- The migrations use a separate direct connection (`DIRECT_DATABASE_URL`), so they never compete with the application pool.

What a project should add as it grows:

1. **Do the arithmetic.** Expected peak concurrency × `DB_POOL_MAX` must stay well below the database's `max_connections`.
2. **Cap the containers.** Set a *reserved concurrency* on the function: it is a ceiling on containers, and therefore on connections. The throttling of the API in `serverless.yml` ([below](#concurrency-and-throttling)) protects from bursts too.
3. **Put a pooler between Lambda and the database** when the arithmetic does not fit: RDS Proxy, PgBouncer, or the pooled endpoint of a managed PostgreSQL. Point `DATABASE_URL` at the pooler and keep `DIRECT_DATABASE_URL` pointing at the database. Check the Prisma documentation for the pooler mode you use, because some modes need specific settings.
4. **Alarm on it.** A CloudWatch alarm on the database's connection count tells you before the errors do.

## Concurrency and throttling

- AWS limits the concurrent executions of all functions in an account and region (1,000 by default; it can be raised). One busy API can use the whole quota and starve other functions, which is another reason to set a reserved concurrency.
- `serverless.yml` sets a throttle on the whole HTTP API (`ThrottlingRateLimit` 50 requests per second, `ThrottlingBurstLimit` 100). Above it, **API Gateway answers `429 Too Many Requests` before the Lambda runs**, so the request costs nothing and does not reach the database. That response is produced by AWS, not by the application, so it is not in the OpenAPI document and has no `requestId`. The numbers are a starting point: tune them to the real traffic.
- The limit is global, shared by every route and every caller. Per-caller limits need API Gateway usage plans (REST APIs, not HTTP APIs) or a limiter in the application.

## Limits that shape the API

| Limit | Value to design around |
|---|---|
| Time | The HTTP API gives up on the integration after 30 seconds. The function timeout is 15 s in `serverless.yml`, so a slow request ends with a logged Lambda timeout instead of an opaque gateway error. Long work belongs in a queue and a worker, not in a request. |
| Payload | A synchronous Lambda accepts and returns up to 6 MB, and the HTTP API passes up to 10 MB. Large uploads and downloads should use pre-signed S3 URLs. |
| Body size | `express.json()` accepts 100 KB by default and answers `413` above it. Raise it for a route that needs more, knowing the limit above. |
| Local files | Only `/tmp` is writable, and it belongs to the container: do not keep data there that must survive. |
| State | A container can be stopped at any moment and requests of one client reach different containers. Nothing that must be consistent may live in memory. Clients (database, HTTP) are fine as module-level singletons, because the container reuses them. |

## Observability

- Logs are JSON, one object per line, written with `console` to CloudWatch Logs. Each request writes an `http_request` line (method, path, status and duration) and, when it fails, an `app_error` or `unhandled_error` line. Every line carries the `requestId`.
- On Lambda the `requestId` is the **API Gateway request id**, the one AWS shows in its own logs and metrics, so the application logs and the AWS logs can be matched. Locally it is a UUID. A caller can send its own `x-request-id` (letters, digits, `.`, `_`, `-`, up to 100 characters) to follow a request across services; on Lambda the gateway id wins. The response always returns the header.
- Lambda's default log format puts a timestamp, the Lambda request id and the level before the text, so the JSON is not at the start of the line. CloudWatch Logs Insights can still search the text, and Lambda's JSON log format (advanced logging controls of the function) removes the prefix. Check the AWS documentation for your runtime and enable what suits your queries.
- Never log a header, a body, a token, a key or a connection string. The logger has no function to do it and the tests check that the API key is absent from the lines.

Retention is 14 days (`logRetentionInDays`). Add alarms on `5xx`, on throttles (`Throttles`), on duration and on the database connection count; the template does not create them because their thresholds depend on the service.

## When Lambda stops being the right choice

Lambda is a good fit for uneven, moderate traffic and for teams that do not want to operate servers. Consider a container (ECS Fargate or App Runner) when:

- the traffic is **steady and high**: you pay per request and per millisecond, and from some volume an always-on container costs less;
- you need **long-lived connections or streaming** (WebSockets, server-sent events, long polling) or work that runs for minutes;
- you need **predictable low latency** at the tail and do not want to pay for provisioned concurrency;
- the work needs **much memory or CPU** for a single request;
- the database cannot take many short-lived connections and you do not want to run a pooler.

The move is small because the Express app does not know where it runs: `src/local.ts` already starts it as a server. What changes is the deployment (a Dockerfile and the service definition) and the database connection settings (a long-lived process can use a larger `DB_POOL_MAX`).

## Before the first production deploy

- [ ] `DB_POOL_MAX` and the expected concurrency checked against the database's `max_connections`.
- [ ] Reserved concurrency set, or a pooler in front of the database.
- [ ] The two throttle numbers in `serverless.yml` tuned to the traffic.
- [ ] Alarms on `5xx`, throttles, duration and database connections.
- [ ] `prd` environment protected with required reviewers ([DEVELOPMENT.md §11](DEVELOPMENT.md#11-deployment)).
- [ ] A plan to rotate the API key ([SECURITY.md](SECURITY.md#rotating-the-api-key)).
