import axios from "axios";
import { useAuthStore } from "../store/auth";
import type {
  TokenResponse,
  User,
  Dataset,
  ColumnMapping,
  ValidationReport,
  ModelRun,
  ModelResults,
  ModelRunConfig,
  ProgressEvent,
} from "../types";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
  headers: { "Content-Type": "application/json" },
});

// Attach auth token to every request
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 with token refresh
let isRefreshing = false;
let pendingRequests: Array<{
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}> = [];

function processQueue(error: unknown, token: string | null) {
  pendingRequests.forEach((p) => {
    if (token) p.resolve(token);
    else p.reject(error);
  });
  pendingRequests = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes("/auth/refresh") &&
      !originalRequest.url?.includes("/auth/login")
    ) {
      if (isRefreshing) {
        return new Promise<string>((resolve, reject) => {
          pendingRequests.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = useAuthStore.getState().refreshToken;
        if (!refreshToken) throw new Error("No refresh token");

        const { data } = await api.post("/auth/refresh", {
          refresh_token: refreshToken,
        });
        const { access_token, refresh_token: newRefresh, user } = data;
        useAuthStore.getState().setAuth(user, access_token, newRefresh);
        processQueue(null, access_token);
        originalRequest.headers.Authorization = `Bearer ${access_token}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        useAuthStore.getState().logout();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  },
);

// ---- Auth ----

export async function login(email: string, password: string): Promise<TokenResponse & { user: User }> {
  const { data } = await api.post("/auth/login", { email, password });
  return data;
}

export async function register(
  email: string,
  password: string,
  full_name: string,
  workspace_name?: string,
): Promise<TokenResponse & { user: User }> {
  const { data } = await api.post("/auth/register", {
    email,
    password,
    full_name,
    workspace_name,
  });
  return data;
}

export async function getMe(): Promise<User> {
  const { data } = await api.get("/auth/me");
  return data;
}

// ---- Datasets ----

interface UploadResponse {
  dataset_id: string;
  filename: string;
  row_count: number;
  columns: Array<{ name: string; dtype: string; null_count: number; sample_values: string[] }>;
  preview_rows: string[][];
  auto_mapping: ColumnMapping | null;
}

export async function uploadDataset(file: File): Promise<UploadResponse> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post("/datasets/upload", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function listDatasets(): Promise<Dataset[]> {
  const { data } = await api.get("/datasets");
  return data;
}

export async function getDataset(id: string): Promise<Dataset> {
  const { data } = await api.get(`/datasets/${id}`);
  return data;
}

export async function updateMapping(id: string, mapping: ColumnMapping): Promise<Dataset> {
  const { data } = await api.put(`/datasets/${id}/mapping`, {
    column_mapping: mapping,
  });
  return data;
}

export async function validateDataset(id: string): Promise<ValidationReport> {
  const { data } = await api.post(`/datasets/${id}/validate`);
  return data;
}

// ---- Model Runs ----

export async function createModelRun(config: ModelRunConfig): Promise<ModelRun> {
  const { data } = await api.post("/models/run", config);
  return data;
}

export async function listModelRuns(): Promise<ModelRun[]> {
  const { data } = await api.get("/models");
  return data;
}

export async function getModelRun(id: string): Promise<ModelRun> {
  const { data } = await api.get(`/models/${id}`);
  return data;
}

export async function getModelResults(id: string): Promise<ModelResults> {
  const { data } = await api.get(`/models/${id}/results`);
  return data;
}

export async function getModelSummary(id: string): Promise<{ summary: string }> {
  const { data } = await api.get(`/models/${id}/summary`);
  return data;
}

export async function deleteModelRun(id: string): Promise<void> {
  await api.delete(`/models/${id}`);
}

export async function deleteDataset(id: string): Promise<void> {
  await api.delete(`/datasets/${id}`);
}

// ---- Budget Optimizer ----

export async function optimizeBudget(
  runId: string,
  totalBudget: number,
  minPerChannel?: Record<string, number>,
  maxPerChannel?: Record<string, number>,
): Promise<any> {
  const { data } = await api.post(`/models/${runId}/optimize`, {
    total_budget: totalBudget,
    min_per_channel: minPerChannel,
    max_per_channel: maxPerChannel,
  });
  return data;
}

// ---- SSE Progress ----

export function subscribeToProgress(
  runId: string,
  onEvent: (event: ProgressEvent) => void,
): EventSource {
  const token = useAuthStore.getState().accessToken;
  const base = import.meta.env.VITE_API_URL || "/api";
  const es = new EventSource(`${base}/models/${runId}/progress?token=${token}`);
  es.addEventListener("progress", (e) => {
    onEvent(JSON.parse(e.data));
  });
  return es;
}

export default api;
