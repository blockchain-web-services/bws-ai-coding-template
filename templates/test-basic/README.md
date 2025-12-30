# Test Suite

This directory contains the test suite for {{PROJECT_NAME}}.

## Setup

Install test dependencies:

```bash
cd test
npm install
```

## Running Tests

```bash
# Run all tests
npm test

# Run tests in UI mode (interactive)
npm run test:ui

# Run tests in headed mode (see browser)
npm run test:headed

# Debug tests
npm run test:debug
```

## Test Structure

```
test/
├── tests/              # Test files
│   └── example.spec.js # Example test suite
├── playwright.config.js # Playwright configuration
└── package.json        # Test dependencies
```

## Writing Tests

Tests use [Playwright Test](https://playwright.dev/docs/intro) framework.

Example test:

```javascript
import { test, expect } from '@playwright/test';

test('my test', async ({ page }) => {
  await page.goto('https://example.com');
  await expect(page).toHaveTitle(/Example/);
});
```

## CI/CD

Tests run automatically on:
- Pull requests to master/main/staging
- Pushes to master/main/staging

See `.github/workflows/test.yml` for the CI configuration.

## Additional Resources

- [Playwright Documentation](https://playwright.dev/docs/intro)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [API Reference](https://playwright.dev/docs/api/class-test)
