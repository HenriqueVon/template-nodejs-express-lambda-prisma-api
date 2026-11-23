import { execSync } from 'node:child_process';
import { testDatabaseUrl } from './test-database';

function run(command: string, env: NodeJS.ProcessEnv): string {
  return execSync(command, { env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

// Runs once before the integration specs: applies the committed migrations to the test database, then
// checks that they produce exactly the schema of schema.prisma. A change to schema.prisma without its
// migration (or a migration that does not match the schema) fails here, before any test.
export default function setup() {
  const env = { ...process.env, DATABASE_URL: testDatabaseUrl() };

  try {
    run('npx prisma migrate deploy', env);
  } catch (error) {
    throw new Error(`Could not apply the migrations to the test database:\n${(error as { stderr?: string }).stderr ?? error}`);
  }

  try {
    run(
      'npx prisma migrate diff --from-config-datasource --to-schema src/services/database/prisma/schema.prisma --exit-code',
      env
    );
  } catch (error) {
    const output = (error as { stdout?: string }).stdout ?? '';
    throw new Error(
      'The database built by the migrations differs from schema.prisma. Create a migration for the change ' +
      `(npm run prisma:migrate:dev -- --name <name>).\n${output}`
    );
  }
}
