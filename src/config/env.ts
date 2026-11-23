import 'dotenv/config';
import { z } from 'zod';

// Every variable the application reads, validated once at load time. A missing or invalid value stops the
// start with one message that lists all the problems (never the values, which can be secrets).
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production'], { error: 'must be development, test or production' }).default('development'),

  PORT: z.coerce.number({ error: 'must be a number' }).int().min(1).max(65535).default(3000),

  DATABASE_URL: z.string({ error: 'is required' }).min(1, 'is required'),

  // Connections that the pool of one Lambda container may open. A container handles one request at a time,
  // so a small number is enough; many containers running together multiply it. See docs/SERVERLESS.md.
  DB_POOL_MAX: z.coerce.number({ error: 'must be a number' }).int().min(1).max(20).default(2),

  API_KEY: z.string({ error: 'is required' }).min(16, 'must have at least 16 characters'),

  DOCS_ENABLED: z.enum(['true', 'false'], { error: 'must be true or false' }).default('false').transform((value) => value === 'true'),
});

// An empty value counts as not set, so `PORT=` in a .env file falls back to the default
export function parseEnv(source: NodeJS.ProcessEnv) {
  const present = Object.fromEntries(
    Object.entries(source).filter(([, value]) => value !== undefined && value !== '')
  );

  const result = envSchema.safeParse(present);

  if (!result.success) {
    const problems = result.error.issues.map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`);
    throw new Error(`Invalid environment variables:\n${problems.join('\n')}`);
  }

  const values = result.data;

  return {
    nodeEnv     : values.NODE_ENV,
    app         : { port: values.PORT },
    databaseUrl : values.DATABASE_URL,
    dbPoolMax   : values.DB_POOL_MAX,
    apiKey      : values.API_KEY,
    docsEnabled : values.DOCS_ENABLED,
  } as const;
}

export const env = parseEnv(process.env);
