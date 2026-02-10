import { describe, it, expect, beforeEach } from "vitest";
import { useModelStore } from "../store/model";

describe("useModelStore", () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useModelStore.setState({
      config: {
        adstock_type: "geometric",
        saturation_type: "logistic",
        mode: "quick",
        yearly_seasonality: true,
      },
      activeRunId: null,
    });
  });

  it("starts with default config", () => {
    const state = useModelStore.getState();
    expect(state.config).toEqual({
      adstock_type: "geometric",
      saturation_type: "logistic",
      mode: "quick",
      yearly_seasonality: true,
    });
    expect(state.activeRunId).toBeNull();
  });

  it("setConfig updates config partially", () => {
    useModelStore.getState().setConfig({ adstock_type: "weibull" });

    const state = useModelStore.getState();
    expect(state.config.adstock_type).toBe("weibull");
    expect(state.config.saturation_type).toBe("logistic"); // unchanged
    expect(state.config.mode).toBe("quick"); // unchanged
  });

  it("setConfig can update multiple fields", () => {
    useModelStore.getState().setConfig({
      saturation_type: "hill",
      mode: "full",
      yearly_seasonality: false,
    });

    const state = useModelStore.getState();
    expect(state.config.saturation_type).toBe("hill");
    expect(state.config.mode).toBe("full");
    expect(state.config.yearly_seasonality).toBe(false);
    expect(state.config.adstock_type).toBe("geometric"); // unchanged
  });

  it("setActiveRun stores run ID", () => {
    useModelStore.getState().setActiveRun("run-123");

    const state = useModelStore.getState();
    expect(state.activeRunId).toBe("run-123");
  });

  it("setActiveRun can clear run ID with null", () => {
    useModelStore.getState().setActiveRun("run-123");
    useModelStore.getState().setActiveRun(null);

    const state = useModelStore.getState();
    expect(state.activeRunId).toBeNull();
  });

  it("reset restores default config and clears active run", () => {
    // Modify state
    useModelStore.getState().setConfig({
      adstock_type: "weibull",
      saturation_type: "hill",
      mode: "full",
      yearly_seasonality: false,
    });
    useModelStore.getState().setActiveRun("run-456");

    // Reset
    useModelStore.getState().reset();

    const state = useModelStore.getState();
    expect(state.config).toEqual({
      adstock_type: "geometric",
      saturation_type: "logistic",
      mode: "quick",
      yearly_seasonality: true,
    });
    expect(state.activeRunId).toBeNull();
  });

  it("handles multiple config updates", () => {
    useModelStore.getState().setConfig({ mode: "full" });
    useModelStore.getState().setConfig({ adstock_type: "weibull" });
    useModelStore.getState().setConfig({ yearly_seasonality: false });

    const state = useModelStore.getState();
    expect(state.config.mode).toBe("full");
    expect(state.config.adstock_type).toBe("weibull");
    expect(state.config.yearly_seasonality).toBe(false);
  });
});
