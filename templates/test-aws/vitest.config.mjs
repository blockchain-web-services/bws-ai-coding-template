/**
 * Vitest Configuration
 *
 * Main test configuration that ensures all tests use LocalStack credentials
 */

import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  test: {
    // Use setup file to configure environment
    setupFiles: ['./vitest.setup.mjs'],

    // Test environment
    environment: 'node',

    // Global timeout
    testTimeout: 90000,
    hookTimeout: 90000,

    // Coverage settings
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'helpers/**',
        '**/*.config.*',
        '**/*.spec.*',
        '**/*.test.*'
      ]
    },

    // Reporters
    reporters: ['default'],

    // Globals
    globals: true,

    // Pool options for parallel execution
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true // Run tests in single fork to preserve state
      }
    },

    // Retry configuration
    retry: 0, // No automatic retries

    // File patterns
    include: [
      'tests/**/*.test.mjs'
    ],
    exclude: [
      'node_modules/**',
      'helpers/**',
      '**/*.disabled.*',
      '**/*.skip.*',
      'tests/**/*.spec.mjs' // Playwright spec files
    ],

    // Server dependencies configuration
    deps: {
      external: [/@aws-sdk\//]
    }
  },

  // Resolve aliases for cleaner imports
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../src'),
      '@test': path.resolve(__dirname),
      '@helpers': path.resolve(__dirname, 'helpers')
    }
  },

  // ESBuild options for faster transpilation
  esbuild: {
    target: 'node20',
    format: 'esm'
  }
});
