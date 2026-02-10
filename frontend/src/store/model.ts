import { create } from "zustand";

interface ModelConfig {
  adstock_type: "geometric" | "weibull";
  saturation_type: "logistic" | "hill";
  mode: "quick" | "full";
  yearly_seasonality: number;
}

interface ModelState {
  config: ModelConfig;
  activeRunId: string | null;
  setConfig: (config: Partial<ModelConfig>) => void;
  setActiveRun: (id: string | null) => void;
  reset: () => void;
}

const defaultConfig: ModelConfig = {
  adstock_type: "geometric",
  saturation_type: "logistic",
  mode: "quick",
  yearly_seasonality: 2,
};

export const useModelStore = create<ModelState>()((set) => ({
  config: defaultConfig,
  activeRunId: null,
  setConfig: (partial) =>
    set((state) => ({ config: { ...state.config, ...partial } })),
  setActiveRun: (id) => set({ activeRunId: id }),
  reset: () => set({ config: defaultConfig, activeRunId: null }),
}));
