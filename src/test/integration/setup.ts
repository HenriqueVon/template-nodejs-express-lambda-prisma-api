import { testDatabaseUrl } from './test-database';

// Runs in every worker before the specs import the application: src/config/env.ts must read the test
// database, and a wrong database name stops the run here
process.env.DATABASE_URL = testDatabaseUrl();
