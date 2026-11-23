import { describe, it, expect } from 'vitest';
import { parseEnv } from '../env';

const valid = {
  DATABASE_URL : 'postgresql://user:password@localhost:5432/db',
  API_KEY      : 'a-long-enough-api-key',
};

describe('parseEnv', () => {
  it('should apply the defaults to the optional variables', () => {
    const env = parseEnv(valid);

    expect(env).toEqual({
      nodeEnv     : 'development',
      app         : { port: 3000 },
      databaseUrl : valid.DATABASE_URL,
      dbPoolMax   : 2,
      apiKey      : valid.API_KEY,
      docsEnabled : false,
    });
  });

  it('should convert the numbers and the boolean', () => {
    const env = parseEnv({ ...valid, NODE_ENV: 'production', PORT: '4000', DB_POOL_MAX: '5', DOCS_ENABLED: 'true' });

    expect(env.nodeEnv).toBe('production');
    expect(env.app.port).toBe(4000);
    expect(env.dbPoolMax).toBe(5);
    expect(env.docsEnabled).toBe(true);
  });

  it('should treat an empty value as not set', () => {
    const env = parseEnv({ ...valid, PORT: '', DOCS_ENABLED: '' });

    expect(env.app.port).toBe(3000);
    expect(env.docsEnabled).toBe(false);
  });

  it('should list every problem in one error', () => {
    expect(() => parseEnv({ NODE_ENV: 'staging', PORT: 'abc' })).toThrowError(
      /Invalid environment variables:[\s\S]*NODE_ENV[\s\S]*PORT[\s\S]*DATABASE_URL: is required[\s\S]*API_KEY: is required/
    );
  });

  it('should reject a NODE_ENV outside the known values', () => {
    expect(() => parseEnv({ ...valid, NODE_ENV: 'staging' })).toThrowError(/NODE_ENV: must be development, test or production/);
  });

  it('should reject a DOCS_ENABLED that is not true or false', () => {
    expect(() => parseEnv({ ...valid, DOCS_ENABLED: 'yes' })).toThrowError(/DOCS_ENABLED: must be true or false/);
  });

  it('should reject a port out of range and a pool size out of range', () => {
    expect(() => parseEnv({ ...valid, PORT: '70000' })).toThrowError(/PORT/);
    expect(() => parseEnv({ ...valid, DB_POOL_MAX: '0' })).toThrowError(/DB_POOL_MAX/);
    expect(() => parseEnv({ ...valid, DB_POOL_MAX: '50' })).toThrowError(/DB_POOL_MAX/);
  });

  it('should require an API key of at least 16 characters', () => {
    expect(() => parseEnv({ ...valid, API_KEY: 'change-me' })).toThrowError(/API_KEY: must have at least 16 characters/);
  });

  it('should never put the value of a variable in the error message', () => {
    const secret = 'short-secret';

    try {
      parseEnv({ ...valid, API_KEY: secret });
      expect.unreachable();
    } catch (error) {
      expect((error as Error).message).not.toContain(secret);
    }
  });
});
