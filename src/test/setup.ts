import 'reflect-metadata';

// Values for the variables that src/config/env.ts requires at load time. Variables already set in the
// shell are kept; a local .env file never overrides them because dotenv does not override existing
// values, so the tests never read the developer's real .env.
process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test';
process.env.API_KEY ??= 'test-api-key';
