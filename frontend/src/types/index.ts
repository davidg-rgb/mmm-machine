// Re-export shared types for frontend usage
// These mirror the shared/types/api-contracts.ts

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: "admin" | "member" | "viewer";
  workspace_id: string;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface Dataset {
  id: string;
  workspace_id: string;
  filename: string;
  row_count: number | null;
  date_range_start: string | null;
  date_range_end: string | null;
  frequency: string;
  column_mapping: ColumnMapping | null;
  validation_report: ValidationReport | null;
  status: "uploaded" | "validated" | "validation_error";
  created_at: string;
}

export interface ColumnMapping {
  date_column: string;
  target_column: string;
  media_columns: Record<string, { channel_name: string; spend_type: string }>;
  control_columns: string[];
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
  frequency: string;
  media_channel_count: number;
  control_variable_count: number;
  total_media_spend: number;
  avg_target_value: number;
}

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

export type ModelRunStatus =
  | "queued"
  | "preprocessing"
  | "fitting"
  | "postprocessing"
  | "completed"
  | "failed";

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

export interface ModelResults {
  diagnostics: {
    r_squared: number;
    mape: number;
    r_hat_max: number;
    ess_min: number;
    divergences: number;
    convergence_status: "good" | "acceptable" | "poor";
  };
  base_sales: {
    weekly_mean: number;
    share_of_total: number;
  };
  channel_results: ChannelResult[];
  decomposition_ts: {
    dates: string[];
    actual: number[];
    predicted: number[];
    predicted_hdi_lower: number[];
    predicted_hdi_upper: number[];
    base: number[];
    channels: Record<string, number[]>;
  };
  summary_text: string;
  top_recommendation: string;
  response_curves: Record<string, ResponseCurve>;
  adstock_decay_curves: Record<string, AdstockDecayCurve>;
}

export interface ChannelResult {
  channel: string;
  contribution_share: number;
  weekly_contribution_mean: number;
  roas: { mean: number; median: number; hdi_3: number; hdi_97: number };
  adstock_params: {
    type: string;
    alpha?: number;
    shape?: number;
    scale?: number;
    mean_lag_weeks: number;
  };
  saturation_params: {
    type: string;
    lam?: number;
    k?: number;
    s?: number;
  };
  saturation_pct: number;
  recommendation: string;
}

export interface ResponseCurve {
  spend_levels: number[];
  predicted_contribution: number[];
  current_spend: number;
  current_contribution: number;
}

export interface AdstockDecayCurve {
  weeks: number[];
  decay_weights: number[];
}

export interface ProgressEvent {
  status: ModelRunStatus;
  progress: number;
  message: string;
  stage: string;
  eta_seconds?: number;
}
