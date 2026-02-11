import { test, expect } from '@playwright/test';
import { mockAuth, mockUpload, mockModelRuns } from './helpers/mock-api';
import { setAuthState } from './helpers/auth';

test.describe('Model Runs', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page);
    await mockUpload(page);
    await mockModelRuns(page);
    await setAuthState(page);
  });

  test('"New Run" button opens config modal', async ({ page }) => {
    await page.goto('/models');
    await expect(page.locator('h1')).toContainText('Model Runs');

    // New Run button should be enabled (validated dataset exists)
    const newRunBtn = page.locator('[data-testid="new-run-btn"]');
    await expect(newRunBtn).toBeEnabled();
    await newRunBtn.click();

    // Config modal should appear
    await expect(page.locator('text=Configure Model Run')).toBeVisible();
    await expect(page.locator('text=Run Name')).toBeVisible();
  });

  test('quick mode selected by default, can switch to Full', async ({ page }) => {
    await page.goto('/models');
    await page.click('[data-testid="new-run-btn"]');

    // Quick mode should be selected by default (check aria-pressed)
    const quickBtn = page.locator('button[aria-label*="quick mode"]');
    const fullBtn = page.locator('button[aria-label*="full mode"]');
    await expect(quickBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(fullBtn).toHaveAttribute('aria-pressed', 'false');

    // Switch to Full mode
    await fullBtn.click();
    await expect(fullBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(quickBtn).toHaveAttribute('aria-pressed', 'false');
  });

  test('"Start Model Run" creates run and shows in list', async ({ page }) => {
    await page.goto('/models');
    await page.click('[data-testid="new-run-btn"]');

    // Fill in name and start
    await page.fill('#run-name', 'E2E Test Run');
    await page.click('button:has-text("Start Model Run")');

    // Modal should close and run should appear in list
    await expect(page.locator('text=Configure Model Run')).not.toBeVisible();
    // The run list shows the mock model run
    await expect(page.locator('[data-testid="run-item-run_test_001"]')).toBeVisible();
  });

  test('completed run shows "Results" link', async ({ page }) => {
    await page.goto('/models');

    // Run list should show the completed mock run
    await expect(page.locator('[data-testid="run-item-run_test_001"]')).toBeVisible();

    // Results link should be visible for completed run
    const resultsLink = page.locator('[data-testid="results-link-run_test_001"]');
    await expect(resultsLink).toBeVisible();
    await expect(resultsLink).toContainText('Results');
  });

  test('click "Results" navigates to /results/:id', async ({ page }) => {
    await page.goto('/models');

    await page.click('[data-testid="results-link-run_test_001"]');
    await expect(page).toHaveURL('/results/run_test_001');
  });
});
