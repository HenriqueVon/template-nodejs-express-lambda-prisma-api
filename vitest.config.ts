import { configDefaults, defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  test: {
    environment : 'node',
    globals     : true,
    clearMocks  : true,
    // Integration specs need a database: they run with `npm run test:integration` (vitest.integration.config.ts)
    exclude     : [...configDefaults.exclude, '**/*.integration.spec.ts'],
    setupFiles: [
      './src/config/zod-openapi.ts',
      './src/test/setup.ts',
    ],
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
