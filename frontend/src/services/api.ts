import axios from "axios";
import { useAuthStore } from "../store/auth";

const api = axios.create({
  baseURL: "/api",
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

export async function login(email: string, password: string) {
  const { data } = await api.post("/auth/login", { email, password });
  return data;
}

export async function register(
  email: string,
  password: string,
  full_name: string,
  workspace_name?: string,
) {
  const { data } = await api.post("/auth/register", {
    email,
    password,
    full_name,
    workspace_name,
  });
  return data;
}

export async function getMe() {
  const { data } = await api.get("/auth/me");
  return data;
}

// ---- Datasets ----

export async function uploadDataset(file: File) {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post("/datasets/upload", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function listDatasets() {
  const { data } = await api.get("/datasets");
  return data;
}

export async function getDataset(id: string) {
  const { data } = await api.get(`/datasets/${id}`);
  return data;
}

export async function updateMapping(id: string, mapping: unknown) {
  const { data } = await api.put(`/datasets/${id}/mapping`, {
    column_mapping: mapping,
  });
  return data;
}

export async function validateDataset(id: string) {
  const { data } = await api.post(`/datasets/${id}/validate`);
  return data;
}

// ---- Model Runs ----

export async function createModelRun(config: unknown) {
  const { data } = await api.post("/models/run", config);
  return data;
}

export async function listModelRuns() {
  const { data } = await api.get("/models");
  return data;
}

export async function getModelRun(id: string) {
  const { data } = await api.get(`/models/${id}`);
  return data;
}

export async function getModelResults(id: string) {
  const { data } = await api.get(`/models/${id}/results`);
  return data;
}

export async function getModelSummary(id: string) {
  const { data } = await api.get(`/models/${id}/summary`);
  return data;
}

// ---- SSE Progress ----

export function subscribeToProgress(
  runId: string,
  onEvent: (event: unknown) => void,
): EventSource {
  const token = useAuthStore.getState().accessToken;
  const es = new EventSource(`/api/models/${runId}/progress?token=${token}`);
  es.addEventListener("progress", (e) => {
    onEvent(JSON.parse(e.data));
  });
  return es;
}

export default api;
