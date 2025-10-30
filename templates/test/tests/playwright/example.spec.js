/**
 * Playwright E2E Test Example
 *
 * E2E tests verify the complete user flow through the browser
 * These tests require a running web server on PLAYWRIGHT_PORT
 */

import { test, expect } from '@playwright/test';

// Basic example - customize for your application
test.describe('Example E2E Tests', () => {
    test('should load the homepage', async ({ page }) => {
        // Navigate to homepage
        await page.goto('/');

        // Check page title
        await expect(page).toHaveTitle(/Home|Welcome/i);
    });

    test('should interact with a button', async ({ page }) => {
        await page.goto('/');

        // Example: Click a button
        // await page.click('button.submit');

        // Example: Fill a form
        // await page.fill('input[name="email"]', 'test@example.com');

        // Example: Check for text
        // await expect(page.locator('h1')).toContainText('Welcome');
    });

    test('should handle navigation', async ({ page }) => {
        await page.goto('/');

        // Example: Navigate to another page
        // await page.click('a[href="/about"]');
        // await expect(page).toHaveURL(/.*about/);
    });
});

// API testing example
test.describe('API Tests', () => {
    test('should make API requests', async ({ request }) => {
        // Example: GET request
        const response = await request.get('/api/health');

        // Verify response
        // expect(response.ok()).toBeTruthy();
        // const data = await response.json();
        // expect(data.status).toBe('ok');
    });
});
