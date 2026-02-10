import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "@/services/api";
import toast from "react-hot-toast";
import type { ColumnMapping } from "@/types";

// Query keys
export const queryKeys = {
  me: ["me"] as const,
  datasets: ["datasets"] as const,
  dataset: (id: string) => ["dataset", id] as const,
  modelRuns: ["modelRuns"] as const,
  modelRun: (id: string) => ["modelRun", id] as const,
  modelResults: (id: string) => ["modelResults", id] as const,
};

// Auth
export function useMe() {
  return useQuery({ queryKey: queryKeys.me, queryFn: api.getMe });
}

// Datasets
export function useDatasets() {
  return useQuery({ queryKey: queryKeys.datasets, queryFn: api.listDatasets });
}

export function useDataset(id: string) {
  return useQuery({
    queryKey: queryKeys.dataset(id),
    queryFn: () => api.getDataset(id),
    enabled: !!id,
  });
}

export function useUploadDataset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.uploadDataset,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.datasets });
      toast.success("Dataset uploaded");
    },
    onError: () => toast.error("Upload failed"),
  });
}

export function useUpdateMapping(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (mapping: ColumnMapping) => api.updateMapping(id, mapping),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.dataset(id) });
    },
    onError: () => toast.error("Failed to save mapping"),
  });
}

export function useValidateDataset(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.validateDataset(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.dataset(id) });
      toast.success("Validation complete");
    },
    onError: () => toast.error("Validation failed"),
  });
}

// Model Runs
export function useModelRuns() {
  return useQuery({
    queryKey: queryKeys.modelRuns,
    queryFn: api.listModelRuns,
  });
}

export function useModelRun(id: string) {
  return useQuery({
    queryKey: queryKeys.modelRun(id),
    queryFn: () => api.getModelRun(id),
    enabled: !!id,
  });
}

export function useCreateModelRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createModelRun,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.modelRuns });
      toast.success("Model run started");
    },
    onError: () => toast.error("Failed to start model run"),
  });
}

export function useModelResults(id: string) {
  return useQuery({
    queryKey: queryKeys.modelResults(id),
    queryFn: () => api.getModelResults(id),
    enabled: !!id,
  });
}
