import { test, expect } from '@playwright/test';
import { mockAuth, mockUpload, mockModelRuns } from './helpers/mock-api';
import { setAuthState } from './helpers/auth';

test.describe('Results Viewing', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page);
    await mockUpload(page);
    await mockModelRuns(page);
    await setAuthState(page);
  });

  test('executive view renders channel contribution data', async ({ page }) => {
    await page.goto('/results/run_test_001');

    // Should show the run name
    await expect(page.locator('h1')).toContainText('Quick Analysis Jan 2025');

    // Executive tab should be active by default
    await expect(page.locator('[data-testid="tab-executive"]')).toBeVisible();

    // Should render channel data from mock results (use exact match to avoid strict mode)
    await expect(page.getByRole('paragraph').filter({ hasText: /^Google$/ })).toBeVisible();
    await expect(page.getByRole('paragraph').filter({ hasText: /^Facebook$/ })).toBeVisible();
    await expect(page.getByRole('paragraph').filter({ hasText: /^TV$/ })).toBeVisible();
  });

  test('tab switch to Manager view', async ({ page }) => {
    await page.goto('/results/run_test_001');

    // Click Manager tab
    await page.click('[data-testid="tab-manager"]');

    // Manager view should load (may show loading spinner first)
    await expect(page.locator('[data-testid="tab-manager"]')).toBeVisible();
    // The description text changes for manager view
    await expect(page.locator('text=Detailed ROAS comparison')).toBeVisible();
  });

  test('tab switch to Analyst view', async ({ page }) => {
    await page.goto('/results/run_test_001');

    // Click Analyst tab
    await page.click('[data-testid="tab-analyst"]');

    // Analyst view should load
    await expect(page.locator('[data-testid="tab-analyst"]')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Posterior Distributions' })).toBeVisible();
  });

  test('export dropdown shows 4 options', async ({ page }) => {
    await page.goto('/results/run_test_001');

    // Click export button
    await page.click('[data-testid="export-btn"]');

    // Export dropdown should appear with 4 options
    const dropdown = page.locator('[data-testid="export-dropdown"]');
    await expect(dropdown).toBeVisible();

    await expect(dropdown.locator('text=Channel Performance (CSV)')).toBeVisible();
    await expect(dropdown.locator('text=Weekly Decomposition (CSV)')).toBeVisible();
    await expect(dropdown.locator('text=Copy Summary')).toBeVisible();
    await expect(dropdown.locator('text=Raw Results (JSON)')).toBeVisible();
  });
});
