import { create } from "zustand";

interface ColumnMapping {
  date_column: string;
  target_column: string;
  media_columns: Record<string, { channel_name: string; spend_type: string }>;
  control_columns: string[];
}

interface DatasetState {
  currentDatasetId: string | null;
  columnMapping: ColumnMapping | null;
  setCurrentDataset: (id: string) => void;
  setColumnMapping: (mapping: ColumnMapping) => void;
  reset: () => void;
}

export const useDatasetStore = create<DatasetState>()((set) => ({
  currentDatasetId: null,
  columnMapping: null,
  setCurrentDataset: (id) => set({ currentDatasetId: id }),
  setColumnMapping: (mapping) => set({ columnMapping: mapping }),
  reset: () => set({ currentDatasetId: null, columnMapping: null }),
}));
