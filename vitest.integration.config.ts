import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Integration tests run against a real PostgreSQL (TEST_DATABASE_URL), never mocks: `npm run test:integration`.
// They live next to the code as `*.integration.spec.ts` and are excluded from `npm run test:run`.
export default defineConfig({
  test: {
    environment : 'node',
    globals     : true,
    clearMocks  : true,
    include     : ['src/**/*.integration.spec.ts'],
    // Applies the migrations once, before every spec file
    globalSetup : ['./src/test/integration/global-setup.ts'],
    setupFiles  : [
      './src/config/zod-openapi.ts',
      './src/test/setup.ts',
      './src/test/integration/setup.ts',
    ],
    // The specs share one database: they run one file at a time
    fileParallelism : false,
    testTimeout     : 30_000,
    hookTimeout     : 60_000,
  },
  resolve: {
    alias: {
      '@modules': resolve(__dirname, 'src/modules'),
      '@services': resolve(__dirname, 'src/services'),
      '@shared': resolve(__dirname, 'src/shared'),
      '@config': resolve(__dirname, 'src/config'),
      '@docs': resolve(__dirname, 'src/docs'),
    },
  },
});
