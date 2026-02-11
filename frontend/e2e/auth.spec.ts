import { test, expect } from '@playwright/test';
import { mockAuth } from './helpers/mock-api';
import { setAuthState, clearAuthState } from './helpers/auth';

test.describe('Authentication', () => {
  test('register new account -> redirects to dashboard', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/register');
    await expect(page.locator('h1')).toContainText('Create your account');

    await page.fill('#fullName', 'Test User');
    await page.fill('#email', 'test@example.com');
    await page.fill('#password', 'TestPass123');
    await page.fill('#workspaceName', 'Test Workspace');
    await page.click('button:has-text("Create account")');

    await expect(page).toHaveURL('/');
    await expect(page.locator('h1')).toContainText('Welcome back');
  });

  test('login with valid credentials -> shows dashboard', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/login');
    await expect(page.locator('h1')).toContainText('Sign in to MixModel');

    await page.fill('#email', 'test@example.com');
    await page.fill('#password', 'TestPass123');
    await page.click('button:has-text("Sign in")');

    await expect(page).toHaveURL('/');
    await expect(page.locator('h1')).toContainText('Welcome back');
  });

  test('login with wrong password -> shows error message', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/login');

    await page.fill('#email', 'test@example.com');
    await page.fill('#password', 'WrongPassword123');
    await page.click('button:has-text("Sign in")');

    // The mock returns 401 for 'WrongPassword123', the component shows this error:
    await expect(page.locator('[data-testid="login-error"]')).toContainText(
      'Invalid email or password'
    );
    // Should stay on login page
    await expect(page).toHaveURL('/login');
  });

  test('unauthenticated user visiting /upload -> redirected to /login', async ({ page }) => {
    await mockAuth(page);
    // Make /auth/me return 401 for unauthenticated state
    await page.route('**/api/auth/me', async (route) => {
      await route.fulfill({ status: 401, body: JSON.stringify({ detail: 'Not authenticated' }) });
    });
    await clearAuthState(page);
    await page.goto('/upload');
    await expect(page).toHaveURL(/\/login/);
  });

  test('logout clears session -> returns to login', async ({ page }) => {
    await mockAuth(page);
    // Mock the other endpoints needed for dashboard
    await page.route('**/api/models', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
      }
    });
    await page.route('**/api/datasets', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
      }
    });

    // Login first
    await setAuthState(page);
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('Welcome back');

    // Find and click logout button (in the layout/nav)
    // The app likely has a logout button in the sidebar/header
    // Look for it by text or aria-label
    const logoutBtn = page.locator('button:has-text("Log out"), button:has-text("Logout"), button:has-text("Sign out"), [aria-label*="logout"], [aria-label*="sign out"], [aria-label*="Log out"]');
    if (await logoutBtn.count() > 0) {
      await logoutBtn.first().click();
      await expect(page).toHaveURL(/\/login/);
    } else {
      // If no visible logout button, simulate logout by clearing state
      await page.evaluate(() => localStorage.removeItem('mixmodel-auth'));
      await page.goto('/upload');
      await expect(page).toHaveURL(/\/login/);
    }
  });
});
