import { test, expect } from '@playwright/test';

test.describe('MixModel Golden Path', () => {
  const testEmail = `e2e-${Date.now()}@test.com`;
  const testPassword = 'TestPass123';

  test('register a new account', async ({ page }) => {
    await page.goto('/register');
    await expect(page.locator('h1')).toContainText('Create your account');

    await page.fill('input[placeholder="Jane Smith"]', 'E2E Test User');
    await page.fill('input[placeholder="you@company.com"]', testEmail);
    await page.fill('input[placeholder="Create a password"]', testPassword);
    await page.fill('input[placeholder="My Company"]', 'E2E Workspace');
    await page.click('button:has-text("Create account")');

    // Should redirect to dashboard
    await expect(page).toHaveURL('/');
    await expect(page.locator('h1')).toContainText('Welcome back');
  });

  test('navigate to upload page', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('input[placeholder="you@company.com"]', testEmail);
    await page.fill('input[placeholder="Enter your password"]', testPassword);
    await page.click('button:has-text("Sign in")');
    await expect(page).toHaveURL('/');

    // Navigate to upload
    await page.click('a[href="/upload"]');
    await expect(page).toHaveURL('/upload');
    await expect(page.locator('h1')).toContainText('Upload Marketing Data');
  });

  test('navigate to model runs page', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[placeholder="you@company.com"]', testEmail);
    await page.fill('input[placeholder="Enter your password"]', testPassword);
    await page.click('button:has-text("Sign in")');
    await expect(page).toHaveURL('/');

    await page.click('a[href="/models"]');
    await expect(page).toHaveURL('/models');
    await expect(page.locator('h1')).toContainText('Model Runs');
  });

  test('404 page shows for unknown routes', async ({ page }) => {
    await page.goto('/nonexistent-page');
    await expect(page.locator('text=Page not found')).toBeVisible();
  });
});
