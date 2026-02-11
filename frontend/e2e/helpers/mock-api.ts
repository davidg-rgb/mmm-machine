import { Page } from '@playwright/test';

// Create JWT-format tokens so the app's checkTokenExpiry() doesn't logout
function createMockJWT(payload: object): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64');
  return `${header}.${body}.mock-signature`;
}

const MOCK_ACCESS_TOKEN = createMockJWT({
  sub: 'usr_test_001',
  exp: Math.floor(Date.now() / 1000) + 86400, // 24h from now
});

const MOCK_REFRESH_TOKEN = createMockJWT({
  sub: 'usr_test_001',
  exp: Math.floor(Date.now() / 1000) + 604800, // 7 days from now
});

// Shared mock data
const MOCK_USER = {
  id: 'usr_test_001',
  email: 'test@example.com',
  full_name: 'Test User',
  role: 'admin' as const,
  workspace_id: 'ws_test_001',
  created_at: '2025-01-01T00:00:00Z',
};

const MOCK_TOKENS = {
  access_token: MOCK_ACCESS_TOKEN,
  refresh_token: MOCK_REFRESH_TOKEN,
  token_type: 'bearer',
  expires_in: 900,
};

const MOCK_DATASET = {
  id: 'ds_test_001',
  workspace_id: 'ws_test_001',
  filename: 'test-data.csv',
  row_count: 104,
  date_range_start: '2023-01-01',
  date_range_end: '2024-12-29',
  frequency: 'weekly',
  column_mapping: null as any,
  validation_report: null as any,
  status: 'validated' as const,
  created_at: '2025-01-15T00:00:00Z',
};

const MOCK_UPLOAD_RESPONSE = {
  dataset_id: 'ds_test_001',
  filename: 'test-data.csv',
  row_count: 104,
  columns: [
    { name: 'date', dtype: 'datetime64', null_count: 0, sample_values: ['2023-01-01', '2023-01-08'] },
    { name: 'revenue', dtype: 'float64', null_count: 0, sample_values: ['15230.50', '16100.75'] },
    { name: 'google_spend', dtype: 'float64', null_count: 0, sample_values: ['2500.00', '2750.00'] },
    { name: 'facebook_spend', dtype: 'float64', null_count: 0, sample_values: ['1800.00', '1950.00'] },
    { name: 'tv_spend', dtype: 'float64', null_count: 0, sample_values: ['5000.00', '5200.00'] },
    { name: 'promo_index', dtype: 'float64', null_count: 0, sample_values: ['1.0', '1.2'] },
  ],
  preview_rows: [
    { date: '2023-01-01', revenue: 15230.50, google_spend: 2500.00, facebook_spend: 1800.00, tv_spend: 5000.00, promo_index: 1.0 },
    { date: '2023-01-08', revenue: 16100.75, google_spend: 2750.00, facebook_spend: 1950.00, tv_spend: 5200.00, promo_index: 1.2 },
    { date: '2023-01-15', revenue: 14800.25, google_spend: 2300.00, facebook_spend: 1700.00, tv_spend: 4800.00, promo_index: 0.9 },
  ],
  auto_mapping: {
    date_column: 'date',
    target_column: 'revenue',
    media_columns: {
      google_spend: { channel_name: 'Google', spend_type: 'spend' },
      facebook_spend: { channel_name: 'Facebook', spend_type: 'spend' },
      tv_spend: { channel_name: 'TV', spend_type: 'spend' },
    },
    control_columns: ['promo_index'],
  },
};

const MOCK_VALIDATION_REPORT = {
  is_valid: true,
  errors: [],
  warnings: [
    { code: 'W001', message: 'Some weeks show zero spend for Google', column: 'google_spend' },
  ],
  suggestions: [
    { code: 'S001', message: 'Consider adding more control variables for better model fit', column: null },
  ],
  data_summary: {
    row_count: 104,
    date_range_start: '2023-01-01',
    date_range_end: '2024-12-29',
    frequency: 'weekly',
    media_channel_count: 3,
    control_variable_count: 1,
    total_media_spend: 528000,
    avg_target_value: 15500,
  },
};

// Import mock results from fixture
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const mockResults = JSON.parse(
  readFileSync(join(__dirname, '..', 'fixtures', 'mock-results.json'), 'utf-8')
);

const MOCK_MODEL_RUN = {
  id: 'run_test_001',
  workspace_id: 'ws_test_001',
  dataset_id: 'ds_test_001',
  name: 'Quick Analysis Jan 2025',
  status: 'completed' as const,
  progress: 100,
  config: {
    dataset_id: 'ds_test_001',
    name: 'Quick Analysis Jan 2025',
    adstock_type: 'geometric' as const,
    saturation_type: 'logistic' as const,
    n_samples: 500,
    n_chains: 2,
    target_accept: 0.9,
    yearly_seasonality: 2,
    mode: 'quick' as const,
  },
  results: mockResults,
  error_message: null,
  started_at: '2025-01-15T10:00:00Z',
  completed_at: '2025-01-15T10:03:00Z',
  created_at: '2025-01-15T10:00:00Z',
};

export async function mockAuth(page: Page) {
  // POST /api/auth/register
  await page.route('**/api/auth/register', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: MOCK_USER,
        ...MOCK_TOKENS,
      }),
    });
  });

  // POST /api/auth/login
  await page.route('**/api/auth/login', async (route) => {
    const body = route.request().postDataJSON();
    if (body?.password === 'WrongPassword123') {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'Invalid credentials' }),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: MOCK_USER,
          ...MOCK_TOKENS,
        }),
      });
    }
  });

  // GET /api/auth/me
  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_USER),
    });
  });

  // POST /api/auth/refresh
  await page.route('**/api/auth/refresh', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_TOKENS),
    });
  });
}

export async function mockUpload(page: Page) {
  // POST /api/datasets/upload
  await page.route('**/api/datasets/upload', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_UPLOAD_RESPONSE),
    });
  });

  // GET /api/datasets
  await page.route('**/api/datasets', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([MOCK_DATASET]),
      });
    } else {
      await route.continue();
    }
  });

  // GET /api/datasets/:id
  await page.route('**/api/datasets/ds_*', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_DATASET),
      });
    } else {
      await route.continue();
    }
  });

  // PUT /api/datasets/:id/mapping
  await page.route('**/api/datasets/*/mapping', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ...MOCK_DATASET, column_mapping: MOCK_UPLOAD_RESPONSE.auto_mapping }),
    });
  });

  // POST /api/datasets/:id/validate
  await page.route('**/api/datasets/*/validate', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_VALIDATION_REPORT),
    });
  });
}

export async function mockModelRuns(page: Page) {
  // POST /api/models/run (create new run)
  await page.route('**/api/models/run', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...MOCK_MODEL_RUN,
          status: 'queued',
          progress: 0,
          results: null,
          completed_at: null,
        }),
      });
    } else {
      await route.continue();
    }
  });

  // GET /api/models (list) - must be registered before more specific routes
  await page.route('**/api/models', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([MOCK_MODEL_RUN]),
      });
    } else {
      await route.continue();
    }
  });

  // GET /api/models/:id/results
  await page.route('**/api/models/*/results', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockResults),
    });
  });

  // GET /api/models/:id/progress (SSE)
  await page.route('**/api/models/*/progress*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: '',
    });
  });

  // GET /api/models/:id/summary
  await page.route('**/api/models/*/summary', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ summary: mockResults.summary_text }),
    });
  });

  // POST /api/models/:id/optimize
  await page.route('**/api/models/*/optimize', async (route) => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON();
      const totalBudget = body?.total_budget ?? 9300;
      const channels = ['Google', 'Facebook', 'TV'];
      const weights = [0.5, 0.3, 0.2];
      const allocations: Record<string, number> = {};
      const predicted: Record<string, number> = {};
      const currentAlloc: Record<string, number> = { Google: 2500, Facebook: 1800, TV: 5000 };
      const currentContrib: Record<string, number> = { Google: 3400, Facebook: 1850, TV: 1700 };
      channels.forEach((ch, i) => {
        allocations[ch] = Math.round(totalBudget * weights[i]);
        predicted[ch] = Math.round(currentContrib[ch] * (1 + (allocations[ch] - currentAlloc[ch]) / currentAlloc[ch] * 0.5));
      });
      const totalPred = Object.values(predicted).reduce((a, b) => a + b, 0);
      const totalCurr = Object.values(currentContrib).reduce((a, b) => a + b, 0);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          allocations,
          predicted_contributions: predicted,
          total_predicted_contribution: totalPred,
          current_allocations: currentAlloc,
          current_contributions: currentContrib,
          total_current_contribution: totalCurr,
          improvement_pct: ((totalPred - totalCurr) / totalCurr) * 100,
        }),
      });
    } else {
      await route.continue();
    }
  });

  // GET /api/models/:id (single run) - registered last, matched after more specific routes
  await page.route('**/api/models/run_*', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_MODEL_RUN),
      });
    } else if (route.request().method() === 'DELETE') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    } else {
      await route.continue();
    }
  });
}

export { MOCK_USER, MOCK_TOKENS, MOCK_DATASET, MOCK_UPLOAD_RESPONSE, MOCK_VALIDATION_REPORT, MOCK_MODEL_RUN };
