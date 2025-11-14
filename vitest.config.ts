import { defineConfig } from 'vitest/config';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

// Load default .env first
dotenv.config();

// Then overlay test-specific env file if it exists (without overriding existing vars)
if (fs.existsSync('.env.test')) {
  dotenv.config({ path: '.env.test', override: false });
}

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'dist/', '**/*.test.ts', '**/*.config.ts'],
    },
    testTimeout: 150000,
    hookTimeout: 30000,
    maxConcurrency: 5,
    pool: 'forks', // Use forks for better isolation between tests
  },
});
