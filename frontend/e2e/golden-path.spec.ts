import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { mockAuth, mockUpload, mockModelRuns } from './helpers/mock-api';

test.describe.serial('Golden Path: Register -> Upload -> Model -> Results', () => {
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();

    // Set up all mocks
    await mockAuth(page);
    await mockUpload(page);
    await mockModelRuns(page);

    // Mock empty lists initially (fresh account)
    await page.route('**/api/models', async (route) => {
      if (route.request().method() === 'GET' && !route.request().url().includes('/models/run')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
      } else {
        await route.continue();
      }
    });
    await page.route('**/api/datasets', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
      } else {
        await route.continue();
      }
    });
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('1. Register new user -> dashboard', async () => {
    await page.goto('/register');
    await expect(page.locator('h1')).toContainText('Create your account');

    await page.fill('#fullName', 'Golden Path User');
    await page.fill('#email', 'golden@example.com');
    await page.fill('#password', 'GoldenPass1');
    await page.fill('#workspaceName', 'Golden Workspace');
    await page.click('button:has-text("Create account")');

    await expect(page).toHaveURL('/');
    await expect(page.locator('h1')).toContainText('Welcome back');
  });

  test('2. Navigate to upload page', async () => {
    await page.click('a[href="/upload"]');
    await expect(page).toHaveURL('/upload');
    await expect(page.locator('h1')).toContainText('Upload Marketing Data');
  });

  test('3. Upload test CSV + continue', async () => {
    const csvContent = 'date,revenue,google_spend,facebook_spend,tv_spend,promo_index\n2023-01-01,15230,2500,1800,5000,1.0';
    const fileInput = page.locator('[data-testid="upload-dropzone"] input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test-data.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csvContent),
    });

    await expect(page.locator('[data-testid="file-preview"]')).toBeVisible();
    await page.click('[data-testid="upload-continue"]');
    await expect(page.locator('text=Step 2: Map Your Columns')).toBeVisible();
  });

  test('4. Confirm column mapping -> validate', async () => {
    // Auto-detected columns should be correct
    await expect(page.locator('text=1 date column')).toBeVisible();
    await expect(page.locator('text=1 target column')).toBeVisible();
    await expect(page.locator('text=3 media channels')).toBeVisible();

    await page.click('[data-testid="validate-data-btn"]');
    await expect(page.locator('text=Step 3: Review Validation')).toBeVisible();
  });

  test('5. Validation passes -> proceed to models', async () => {
    await expect(page.locator('[data-testid="validation-status"]')).toContainText('Data validation passed');

    // Before proceeding, update mocks so /models page has a validated dataset
    await page.unroute('**/api/datasets');
    await page.route('**/api/datasets', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([{
            id: 'ds_test_001',
            workspace_id: 'ws_test_001',
            filename: 'test-data.csv',
            row_count: 104,
            date_range_start: '2023-01-01',
            date_range_end: '2024-12-29',
            frequency: 'weekly',
            column_mapping: null,
            validation_report: null,
            status: 'validated',
            created_at: '2025-01-15T00:00:00Z',
          }]),
        });
      } else {
        await route.continue();
      }
    });

    await page.click('[data-testid="proceed-to-model"]');
    await expect(page).toHaveURL('/models');
  });

  test('6. Open config modal -> start quick run', async () => {
    await expect(page.locator('h1')).toContainText('Model Runs');

    // Update models mock to return completed run after creation
    await page.unroute('**/api/models');
    await mockModelRuns(page);

    await page.click('[data-testid="new-run-btn"]');
    await expect(page.locator('text=Configure Model Run')).toBeVisible();

    await page.fill('#run-name', 'Golden Path Run');
    await page.click('button:has-text("Start Model Run")');

    // Modal should close
    await expect(page.locator('text=Configure Model Run')).not.toBeVisible();
  });

  test('7. Run completes -> click Results', async () => {
    // The model run list should show our completed run
    await expect(page.locator('[data-testid="run-item-run_test_001"]')).toBeVisible();

    await page.click('[data-testid="results-link-run_test_001"]');
    await expect(page).toHaveURL('/results/run_test_001');
  });

  test('8. View Executive/Manager/Analyst tabs', async () => {
    // Executive view (default)
    await expect(page.locator('h1')).toContainText('Quick Analysis Jan 2025');
    await expect(page.getByRole('paragraph').filter({ hasText: /^Google$/ })).toBeVisible();

    // Switch to Manager
    await page.click('[data-testid="tab-manager"]');
    await expect(page.locator('text=Detailed ROAS comparison')).toBeVisible();

    // Switch to Analyst
    await page.click('[data-testid="tab-analyst"]');
    await expect(page.locator('text=Posterior distributions')).toBeVisible();

    // Back to Executive
    await page.click('[data-testid="tab-executive"]');
  });

  test('9. Open export dropdown', async () => {
    await page.click('[data-testid="export-btn"]');

    const dropdown = page.locator('[data-testid="export-dropdown"]');
    await expect(dropdown).toBeVisible();
    await expect(dropdown.locator('text=Channel Performance (CSV)')).toBeVisible();
    await expect(dropdown.locator('text=Weekly Decomposition (CSV)')).toBeVisible();
    await expect(dropdown.locator('text=Copy Summary')).toBeVisible();
    await expect(dropdown.locator('text=Raw Results (JSON)')).toBeVisible();
  });
});
