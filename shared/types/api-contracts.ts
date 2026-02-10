// ============================================================
// MixModel SaaS — Shared API Contracts
// Single source of truth for all API types
// Backend Pydantic schemas MUST mirror these exactly
// ============================================================

// ---- Auth ----

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  full_name: string;
  workspace_name?: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: "bearer";
  expires_in: number;
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: "admin" | "member" | "viewer";
  workspace_id: string;
  created_at: string;
}

// ---- Workspace ----

export interface Workspace {
  id: string;
  name: string;
  created_at: string;
}

// ---- Dataset / Upload ----

export interface UploadResponse {
  dataset_id: string;
  filename: string;
  row_count: number;
  columns: ColumnInfo[];
  preview_rows: Record<string, unknown>[];
  auto_mapping: ColumnMapping | null;
}

export interface ColumnInfo {
  name: string;
  dtype: "numeric" | "date" | "string" | "boolean";
  null_count: number;
  sample_values: unknown[];
}

export interface ColumnMapping {
  date_column: string;
  target_column: string;
  media_columns: Record<string, MediaColumnConfig>;
  control_columns: string[];
}

export interface MediaColumnConfig {
  channel_name: string;
  spend_type: "spend" | "impressions" | "clicks" | "grp";
}

export interface ValidationReport {
  is_valid: boolean;
  errors: ValidationItem[];
  warnings: ValidationItem[];
  suggestions: ValidationItem[];
  data_summary: DataSummary;
}

export interface ValidationItem {
  code: string;
  message: string;
  column?: string;
  severity: "error" | "warning" | "suggestion";
}

export interface DataSummary {
  row_count: number;
  date_range_start: string;
  date_range_end: string;
  frequency: "daily" | "weekly" | "monthly";
  media_channel_count: number;
  control_variable_count: number;
  total_media_spend: number;
  avg_target_value: number;
}

export interface Dataset {
  id: string;
  workspace_id: string;
  filename: string;
  row_count: number;
  date_range_start: string;
  date_range_end: string;
  frequency: string;
  column_mapping: ColumnMapping | null;
  validation_report: ValidationReport | null;
  status: "pending" | "validated" | "error";
  created_at: string;
}

// ---- Model Run ----

export interface ModelRunConfig {
  dataset_id: string;
  name?: string;
  adstock_type: "geometric" | "weibull";
  saturation_type: "logistic" | "hill";
  n_samples: number;
  n_chains: number;
  target_accept: number;
  yearly_seasonality: boolean;
  mode: "quick" | "full";
}

export type ModelRunStatus =
  | "queued"
  | "preprocessing"
  | "fitting"
  | "postprocessing"
  | "completed"
  | "failed";

export interface ModelRun {
  id: string;
  workspace_id: string;
  dataset_id: string;
  name: string;
  status: ModelRunStatus;
  progress: number;
  config: ModelRunConfig;
  results: ModelResults | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

// ---- SSE Progress ----

export interface ProgressEvent {
  status: ModelRunStatus;
  progress: number;
  message: string;
  stage: "preprocessing" | "building" | "sampling" | "postprocessing" | "done" | "error";
  eta_seconds?: number;
}

// ---- Model Results ----

export interface ModelResults {
  diagnostics: ModelDiagnostics;
  base_sales: BaseSales;
  channel_results: ChannelResult[];
  decomposition_ts: DecompositionTimeSeries;
  summary_text: string;
  top_recommendation: string;
}

export interface ModelDiagnostics {
  r_squared: number;
  mape: number;
  r_hat_max: number;
  ess_min: number;
  divergences: number;
  convergence_status: "good" | "acceptable" | "poor";
}

export interface BaseSales {
  weekly_mean: number;
  share_of_total: number;
}

export interface ChannelResult {
  channel: string;
  contribution_share: number;
  weekly_contribution_mean: number;
  roas: CredibleInterval;
  adstock_params: AdstockParams;
  saturation_params: SaturationParams;
  saturation_pct: number;
  recommendation: string;
}

export interface CredibleInterval {
  mean: number;
  median: number;
  hdi_3: number;
  hdi_97: number;
}

export interface AdstockParams {
  type: "geometric" | "weibull";
  alpha?: number;          // geometric retention rate
  shape?: number;          // weibull shape
  scale?: number;          // weibull scale
  mean_lag_weeks: number;
}

export interface SaturationParams {
  type: "logistic" | "hill";
  lam?: number;            // logistic lambda
  k?: number;              // hill half-saturation
  s?: number;              // hill shape
}

export interface DecompositionTimeSeries {
  dates: string[];
  actual: number[];
  predicted: number[];
  predicted_hdi_lower: number[];
  predicted_hdi_upper: number[];
  base: number[];
  channels: Record<string, number[]>;
}

// ---- Response Curves (for charts) ----

export interface ResponseCurveData {
  channel: string;
  spend_levels: number[];
  predicted_contribution: number[];
  current_spend: number;
  current_contribution: number;
}

// ---- Budget Optimization (Phase 2) ----

export interface BudgetOptimizationRequest {
  model_run_id: string;
  total_budget: number;
  min_per_channel?: Record<string, number>;
  max_per_channel?: Record<string, number>;
}

export interface BudgetOptimizationResult {
  optimal_allocation: Record<string, number>;
  current_allocation: Record<string, number>;
  predicted_revenue_current: number;
  predicted_revenue_optimal: number;
  revenue_uplift_pct: number;
  per_channel_change: Record<string, ChannelBudgetChange>;
}

export interface ChannelBudgetChange {
  current: number;
  optimal: number;
  change_pct: number;
}

// ---- API Error ----

export interface ApiError {
  detail: string;
  code?: string;
  field?: string;
}

// ---- Pagination ----

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}
