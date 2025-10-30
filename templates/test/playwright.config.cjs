/**
 * Playwright Configuration
 * For E2E browser testing
 */

const { defineConfig, devices } = require('@playwright/test');

// Load environment variables
require('dotenv').config();

const PLAYWRIGHT_PORT = process.env.PLAYWRIGHT_PORT || '8080';
const BASE_URL = `http://localhost:${PLAYWRIGHT_PORT}`;

module.exports = defineConfig({
  testDir: './tests/playwright',

  // Maximum time one test can run
  timeout: 30 * 1000,

  expect: {
    timeout: 5000
  },

  // Run tests in files in parallel
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Opt out of parallel tests on CI
  workers: process.env.CI ? 1 : undefined,

  // Reporter to use
  reporter: 'html',

  use: {
    // Base URL to use in actions like `await page.goto('/')`
    baseURL: BASE_URL,

    // Collect trace when retrying the failed test
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',
  },

  // Configure projects for major browsers
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Run your local dev server before starting the tests
  // Uncomment and customize if you need to start a server
  // webServer: {
  //   command: 'npm run server:start',
  //   url: BASE_URL,
  //   reuseExistingServer: !process.env.CI,
  // },
});
