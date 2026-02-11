import { test, expect } from '@playwright/test';
import { mockAuth, mockUpload } from './helpers/mock-api';
import { setAuthState } from './helpers/auth';

test.describe('Data Upload Wizard', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page);
    await mockUpload(page);
    // Also mock model runs and datasets for any background queries
    await page.route('**/api/models', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
      } else {
        await route.continue();
      }
    });
    await setAuthState(page);
  });

  test('upload CSV file -> step advances to column mapping', async ({ page }) => {
    await page.goto('/upload');
    await expect(page.locator('h1')).toContainText('Upload Marketing Data');

    // Create a test CSV file and upload it
    const csvContent = 'date,revenue,google_spend,facebook_spend,tv_spend,promo_index\n2023-01-01,15230,2500,1800,5000,1.0';
    const buffer = Buffer.from(csvContent);

    // Upload via the file input inside the dropzone
    const fileInput = page.locator('[data-testid="upload-dropzone"] input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test-data.csv',
      mimeType: 'text/csv',
      buffer,
    });

    // File preview should appear
    await expect(page.locator('[data-testid="file-preview"]')).toBeVisible();
    await expect(page.locator('[data-testid="file-preview"]')).toContainText('test-data.csv');

    // Click continue
    await page.click('[data-testid="upload-continue"]');

    // Should advance to step 2 - column mapping
    await expect(page.locator('text=Step 2: Map Your Columns')).toBeVisible();
  });

  test('shows auto-detected column roles', async ({ page }) => {
    await page.goto('/upload');

    // Upload file
    const csvContent = 'date,revenue,google_spend,facebook_spend,tv_spend,promo_index\n2023-01-01,15230,2500,1800,5000,1.0';
    const fileInput = page.locator('[data-testid="upload-dropzone"] input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test-data.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csvContent),
    });
    await page.click('[data-testid="upload-continue"]');

    // Should show column mapping with auto-detected roles
    await expect(page.locator('text=Step 2: Map Your Columns')).toBeVisible();

    // Check that column rows exist
    await expect(page.locator('[data-testid="column-row-date"]')).toBeVisible();
    await expect(page.locator('[data-testid="column-row-revenue"]')).toBeVisible();
    await expect(page.locator('[data-testid="column-row-google_spend"]')).toBeVisible();

    // Check summary badges show correct detection
    await expect(page.locator('text=1 date column')).toBeVisible();
    await expect(page.locator('text=1 target column')).toBeVisible();
    await expect(page.locator('text=3 media channels')).toBeVisible();
  });

  test('column mapping validate button -> step advances to validation', async ({ page }) => {
    await page.goto('/upload');

    // Upload file
    const csvContent = 'date,revenue,google_spend,facebook_spend,tv_spend,promo_index\n2023-01-01,15230,2500,1800,5000,1.0';
    const fileInput = page.locator('[data-testid="upload-dropzone"] input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test-data.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csvContent),
    });
    await page.click('[data-testid="upload-continue"]');

    // Click Validate Data
    await expect(page.locator('[data-testid="validate-data-btn"]')).toBeEnabled();
    await page.click('[data-testid="validate-data-btn"]');

    // Should advance to step 3 - validation
    await expect(page.locator('text=Step 3: Review Validation')).toBeVisible();
  });

  test('validation success -> shows passed message and proceed button', async ({ page }) => {
    await page.goto('/upload');

    // Upload file
    const csvContent = 'date,revenue,google_spend,facebook_spend,tv_spend,promo_index\n2023-01-01,15230,2500,1800,5000,1.0';
    const fileInput = page.locator('[data-testid="upload-dropzone"] input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test-data.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csvContent),
    });
    await page.click('[data-testid="upload-continue"]');
    await page.click('[data-testid="validate-data-btn"]');

    // Validation passed
    await expect(page.locator('[data-testid="validation-status"]')).toContainText('Data validation passed');

    // Proceed button should be enabled
    await expect(page.locator('[data-testid="proceed-to-model"]')).toBeEnabled();
    await expect(page.locator('[data-testid="proceed-to-model"]')).toContainText('Proceed to Model Config');
  });

  test('full wizard: upload -> map -> validate -> navigates to /models', async ({ page }) => {
    await page.goto('/upload');

    // Step 1: Upload
    const csvContent = 'date,revenue,google_spend,facebook_spend,tv_spend,promo_index\n2023-01-01,15230,2500,1800,5000,1.0';
    const fileInput = page.locator('[data-testid="upload-dropzone"] input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test-data.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csvContent),
    });
    await page.click('[data-testid="upload-continue"]');

    // Step 2: Map columns (auto-detected, just validate)
    await expect(page.locator('text=Step 2: Map Your Columns')).toBeVisible();
    await page.click('[data-testid="validate-data-btn"]');

    // Step 3: Validate and proceed
    await expect(page.locator('[data-testid="validation-status"]')).toContainText('Data validation passed');
    await page.click('[data-testid="proceed-to-model"]');

    // Should navigate to /models
    await expect(page).toHaveURL('/models');
  });
});
