import type {
  ModelRun,
  ModelResults,
  Dataset,
  ValidationReport,
  ColumnMapping,
  ChannelResult,
} from "@/types";

// ---- Mock Datasets ----

export const mockColumnMapping: ColumnMapping = {
  date_column: "date",
  target_column: "revenue",
  media_columns: {
    google_spend: { channel_name: "Google Ads", spend_type: "spend" },
    facebook_spend: { channel_name: "Facebook Ads", spend_type: "spend" },
    tv_spend: { channel_name: "TV", spend_type: "spend" },
    email_spend: { channel_name: "Email", spend_type: "spend" },
  },
  control_columns: ["promotions", "seasonality_index"],
};

export const mockValidationReport: ValidationReport = {
  is_valid: true,
  errors: [],
  warnings: [
    {
      code: "W001",
      message: "Column 'tv_spend' has 3 zero values which may affect model accuracy",
      column: "tv_spend",
      severity: "warning",
    },
  ],
  suggestions: [
    {
      code: "S001",
      message: "Consider adding holiday indicators as control variables for better accuracy",
      severity: "suggestion",
    },
    {
      code: "S002",
      message: "Weekly frequency detected. Ensure at least 52 weeks of data for reliable estimates",
      severity: "suggestion",
    },
  ],
  data_summary: {
    row_count: 104,
    date_range_start: "2023-01-02",
    date_range_end: "2024-12-30",
    frequency: "weekly",
    media_channel_count: 4,
    control_variable_count: 2,
    total_media_spend: 2450000,
    avg_target_value: 185000,
  },
};

export const mockDatasets: Dataset[] = [
  {
    id: "ds-001",
    workspace_id: "ws-001",
    filename: "marketing_data_2024.csv",
    row_count: 104,
    date_range_start: "2023-01-02",
    date_range_end: "2024-12-30",
    frequency: "weekly",
    column_mapping: mockColumnMapping,
    validation_report: mockValidationReport,
    status: "validated",
    created_at: "2025-01-15T10:30:00Z",
  },
  {
    id: "ds-002",
    workspace_id: "ws-001",
    filename: "q4_campaign_data.csv",
    row_count: 52,
    date_range_start: "2024-01-01",
    date_range_end: "2024-12-30",
    frequency: "weekly",
    column_mapping: null,
    validation_report: null,
    status: "pending",
    created_at: "2025-02-01T14:20:00Z",
  },
];

// ---- Mock Channel Results ----

const mockChannelResults: ChannelResult[] = [
  {
    channel: "Google Ads",
    contribution_share: 0.32,
    weekly_contribution_mean: 59200,
    roas: { mean: 4.2, median: 4.1, hdi_3: 3.1, hdi_97: 5.4 },
    adstock_params: { type: "geometric", alpha: 0.65, mean_lag_weeks: 1.8 },
    saturation_params: { type: "logistic", lam: 2.1, k: 0.0004 },
    saturation_pct: 0.72,
    recommendation: "Near optimal spend. Consider shifting 10% of budget to test diminishing returns.",
  },
  {
    channel: "Facebook Ads",
    contribution_share: 0.24,
    weekly_contribution_mean: 44400,
    roas: { mean: 3.1, median: 3.0, hdi_3: 2.2, hdi_97: 4.1 },
    adstock_params: { type: "geometric", alpha: 0.45, mean_lag_weeks: 0.9 },
    saturation_params: { type: "logistic", lam: 1.8, k: 0.0006 },
    saturation_pct: 0.58,
    recommendation: "Room to increase spend. Saturation at 58% suggests capacity for 15-20% budget increase.",
  },
  {
    channel: "TV",
    contribution_share: 0.28,
    weekly_contribution_mean: 51800,
    roas: { mean: 2.8, median: 2.7, hdi_3: 1.9, hdi_97: 3.8 },
    adstock_params: { type: "geometric", alpha: 0.82, mean_lag_weeks: 4.5 },
    saturation_params: { type: "logistic", lam: 1.5, k: 0.0002 },
    saturation_pct: 0.45,
    recommendation: "Strong carryover effect (4.5 week lag). Significant room to grow - only 45% saturated.",
  },
  {
    channel: "Email",
    contribution_share: 0.16,
    weekly_contribution_mean: 29600,
    roas: { mean: 8.5, median: 8.2, hdi_3: 6.1, hdi_97: 11.2 },
    adstock_params: { type: "geometric", alpha: 0.2, mean_lag_weeks: 0.3 },
    saturation_params: { type: "logistic", lam: 3.2, k: 0.001 },
    saturation_pct: 0.85,
    recommendation: "Highest ROAS but nearing saturation (85%). Maintain current levels.",
  },
];

// ---- Mock Time Series for Decomposition ----

function generateDates(start: string, weeks: number): string[] {
  const dates: string[] = [];
  const d = new Date(start);
  for (let i = 0; i < weeks; i++) {
    dates.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 7);
  }
  return dates;
}

function generateSeries(length: number, base: number, noise: number): number[] {
  return Array.from({ length }, (_, i) => {
    const seasonal = Math.sin((i / 52) * 2 * Math.PI) * base * 0.15;
    const trend = i * base * 0.001;
    const rand = (Math.random() - 0.5) * noise;
    return Math.round(base + seasonal + trend + rand);
  });
}

const tsLength = 104;
const tsDates = generateDates("2023-01-02", tsLength);
const tsBase = generateSeries(tsLength, 80000, 5000);
const tsGoogle = generateSeries(tsLength, 59200, 8000);
const tsFacebook = generateSeries(tsLength, 44400, 6000);
const tsTv = generateSeries(tsLength, 51800, 7000);
const tsEmail = generateSeries(tsLength, 29600, 3000);
const tsActual = tsBase.map(
  (b, i) => b + (tsGoogle[i] ?? 0) + (tsFacebook[i] ?? 0) + (tsTv[i] ?? 0) + (tsEmail[i] ?? 0),
);
const tsPredicted = tsActual.map(
  (v) => v + Math.round((Math.random() - 0.5) * 8000),
);

// ---- Mock Model Results ----

export const mockResults: ModelResults = {
  diagnostics: {
    r_squared: 0.94,
    mape: 0.052,
    r_hat_max: 1.02,
    ess_min: 842,
    divergences: 0,
    convergence_status: "good",
  },
  base_sales: {
    weekly_mean: 80000,
    share_of_total: 0.43,
  },
  channel_results: mockChannelResults,
  decomposition_ts: {
    dates: tsDates,
    actual: tsActual,
    predicted: tsPredicted,
    predicted_hdi_lower: tsPredicted.map((v) => v - 12000),
    predicted_hdi_upper: tsPredicted.map((v) => v + 12000),
    base: tsBase,
    channels: {
      "Google Ads": tsGoogle,
      "Facebook Ads": tsFacebook,
      TV: tsTv,
      Email: tsEmail,
    },
  },
  summary_text:
    "Your marketing mix model explains 94% of revenue variation (R-squared = 0.94). Google Ads drives the largest share at 32% of incremental revenue, while Email delivers the highest return at $8.50 per dollar spent. TV advertising shows the longest carryover effect at 4.5 weeks, suggesting sustained brand building. Facebook Ads has the most room for growth at only 58% saturation.",
  top_recommendation:
    "Increase Facebook Ads budget by 15-20% to capture unsaturated demand, while maintaining Email at current levels to preserve its exceptional ROAS.",
  response_curves: {
    "Google Ads": {
      spend_levels: [0, 5000, 10000, 15000, 20000, 25000, 30000, 35000, 40000],
      predicted_contribution: [0, 18000, 32000, 42000, 48000, 52000, 54500, 56000, 57000],
      current_spend: 20000,
      current_contribution: 48000,
    },
    "Facebook Ads": {
      spend_levels: [0, 3000, 6000, 9000, 12000, 15000, 18000, 21000, 24000],
      predicted_contribution: [0, 12000, 22000, 30000, 36000, 40000, 43000, 45000, 46500],
      current_spend: 12000,
      current_contribution: 36000,
    },
    TV: {
      spend_levels: [0, 5000, 10000, 15000, 20000, 25000, 30000, 35000, 40000],
      predicted_contribution: [0, 10000, 18000, 24000, 28500, 31500, 33500, 35000, 36000],
      current_spend: 15000,
      current_contribution: 24000,
    },
    Email: {
      spend_levels: [0, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000],
      predicted_contribution: [0, 8500, 15000, 20000, 23500, 26000, 27800, 29000, 29800],
      current_spend: 3500,
      current_contribution: 29600,
    },
  },
  adstock_decay_curves: {
    "Google Ads": {
      weeks: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
      decay_weights: [1.0, 0.7, 0.49, 0.34, 0.24, 0.17, 0.12, 0.08, 0.06, 0.04, 0.03, 0.02],
    },
    "Facebook Ads": {
      weeks: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
      decay_weights: [1.0, 0.5, 0.25, 0.13, 0.06, 0.03, 0.02, 0.01, 0.0, 0.0, 0.0, 0.0],
    },
    TV: {
      weeks: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
      decay_weights: [1.0, 0.85, 0.72, 0.61, 0.52, 0.44, 0.38, 0.32, 0.27, 0.23, 0.2, 0.17],
    },
    Email: {
      weeks: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
      decay_weights: [1.0, 0.3, 0.09, 0.03, 0.01, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
    },
  },
};

// ---- Mock Model Runs ----

export const mockModelRuns: ModelRun[] = [
  {
    id: "run-001",
    workspace_id: "ws-001",
    dataset_id: "ds-001",
    name: "Full Analysis Q4 2024",
    status: "completed",
    progress: 100,
    config: {
      dataset_id: "ds-001",
      name: "Full Analysis Q4 2024",
      adstock_type: "geometric",
      saturation_type: "logistic",
      n_samples: 2000,
      n_chains: 4,
      target_accept: 0.9,
      yearly_seasonality: true,
      mode: "full",
    },
    results: mockResults,
    error_message: null,
    started_at: "2025-01-15T11:00:00Z",
    completed_at: "2025-01-15T11:12:00Z",
    created_at: "2025-01-15T11:00:00Z",
  },
  {
    id: "run-002",
    workspace_id: "ws-001",
    dataset_id: "ds-001",
    name: "Quick Test Run",
    status: "completed",
    progress: 100,
    config: {
      dataset_id: "ds-001",
      name: "Quick Test Run",
      adstock_type: "geometric",
      saturation_type: "logistic",
      n_samples: 500,
      n_chains: 2,
      target_accept: 0.85,
      yearly_seasonality: true,
      mode: "quick",
    },
    results: mockResults,
    error_message: null,
    started_at: "2025-01-14T09:00:00Z",
    completed_at: "2025-01-14T09:03:00Z",
    created_at: "2025-01-14T09:00:00Z",
  },
  {
    id: "run-003",
    workspace_id: "ws-001",
    dataset_id: "ds-001",
    name: "Weibull Adstock Test",
    status: "fitting",
    progress: 65,
    config: {
      dataset_id: "ds-001",
      name: "Weibull Adstock Test",
      adstock_type: "weibull",
      saturation_type: "hill",
      n_samples: 2000,
      n_chains: 4,
      target_accept: 0.9,
      yearly_seasonality: true,
      mode: "full",
    },
    results: null,
    error_message: null,
    started_at: "2025-02-01T15:30:00Z",
    completed_at: null,
    created_at: "2025-02-01T15:30:00Z",
  },
  {
    id: "run-004",
    workspace_id: "ws-001",
    dataset_id: "ds-002",
    name: "Failed Run Example",
    status: "failed",
    progress: 30,
    config: {
      dataset_id: "ds-002",
      name: "Failed Run Example",
      adstock_type: "geometric",
      saturation_type: "logistic",
      n_samples: 2000,
      n_chains: 4,
      target_accept: 0.95,
      yearly_seasonality: false,
      mode: "full",
    },
    results: null,
    error_message: "Convergence failure: too many divergent transitions (128). Try lowering target_accept or increasing n_samples.",
    started_at: "2025-01-20T08:00:00Z",
    completed_at: "2025-01-20T08:05:00Z",
    created_at: "2025-01-20T08:00:00Z",
  },
];

// ---- Mock CSV Preview Data ----

export const mockCsvHeaders = [
  "date",
  "revenue",
  "google_spend",
  "facebook_spend",
  "tv_spend",
  "email_spend",
  "promotions",
  "seasonality_index",
];

export const mockCsvRows = [
  ["2023-01-02", "245000", "15200", "12400", "18500", "3200", "1", "0.82"],
  ["2023-01-09", "231000", "14800", "11900", "18500", "3100", "0", "0.78"],
  ["2023-01-16", "228000", "15500", "12200", "17000", "3300", "0", "0.75"],
  ["2023-01-23", "235000", "16100", "13100", "17000", "3400", "0", "0.77"],
  ["2023-01-30", "242000", "15900", "12800", "18500", "3200", "1", "0.80"],
  ["2023-02-06", "255000", "16500", "13500", "20000", "3500", "1", "0.85"],
  ["2023-02-13", "261000", "17200", "14200", "20000", "3600", "0", "0.88"],
  ["2023-02-20", "248000", "16800", "13800", "18500", "3400", "0", "0.83"],
  ["2023-02-27", "252000", "17000", "14000", "18500", "3500", "0", "0.84"],
  ["2023-03-06", "268000", "17500", "14500", "21000", "3700", "1", "0.90"],
];

// ---- Helpers ----

export function getStatusBadgeVariant(
  status: string,
): "success" | "warning" | "error" | "info" | "brand" | "default" {
  switch (status) {
    case "completed":
      return "success";
    case "fitting":
    case "preprocessing":
    case "postprocessing":
      return "brand";
    case "queued":
      return "info";
    case "failed":
      return "error";
    default:
      return "default";
  }
}
