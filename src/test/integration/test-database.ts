import 'dotenv/config';

// The integration tests delete every row of every table, so they must never reach a database that holds
// anything else: the database name has to end with `_test` (docker-compose.yml creates `my_service_api_test`).
export function testDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;

  if (!url) {
    throw new Error(
      'TEST_DATABASE_URL is not set. Start the local database with `docker compose up -d` and copy ' +
      'TEST_DATABASE_URL from .env.example into .env.'
    );
  }

  const databaseName = new URL(url).pathname.replace(/^\//, '');

  if (!databaseName.endsWith('_test')) {
    throw new Error(
      `Refusing to run the integration tests: the database "${databaseName}" does not end with "_test". ` +
      'The tests delete every row of the tables.'
    );
  }

  return url;
}
