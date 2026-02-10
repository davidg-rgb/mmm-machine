import { describe, it, expect, beforeEach } from "vitest";
import { useDatasetStore } from "../store/dataset";

describe("useDatasetStore", () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useDatasetStore.setState({
      currentDatasetId: null,
      columnMapping: null,
    });
  });

  it("starts with null dataset and mapping", () => {
    const state = useDatasetStore.getState();
    expect(state.currentDatasetId).toBeNull();
    expect(state.columnMapping).toBeNull();
  });

  it("setCurrentDataset stores dataset ID", () => {
    useDatasetStore.getState().setCurrentDataset("dataset-123");

    const state = useDatasetStore.getState();
    expect(state.currentDatasetId).toBe("dataset-123");
  });

  it("setColumnMapping stores mapping object", () => {
    const mapping = {
      date_column: "date",
      target_column: "sales",
      media_columns: {
        col1: { channel_name: "TV", spend_type: "impression" },
        col2: { channel_name: "Radio", spend_type: "spend" },
      },
      control_columns: ["holiday", "promo"],
    };

    useDatasetStore.getState().setColumnMapping(mapping);

    const state = useDatasetStore.getState();
    expect(state.columnMapping).toEqual(mapping);
  });

  it("setColumnMapping can update existing mapping", () => {
    const mapping1 = {
      date_column: "date",
      target_column: "sales",
      media_columns: {},
      control_columns: [],
    };

    const mapping2 = {
      date_column: "timestamp",
      target_column: "revenue",
      media_columns: {
        tv: { channel_name: "TV", spend_type: "spend" },
      },
      control_columns: ["season"],
    };

    useDatasetStore.getState().setColumnMapping(mapping1);
    useDatasetStore.getState().setColumnMapping(mapping2);

    const state = useDatasetStore.getState();
    expect(state.columnMapping).toEqual(mapping2);
  });

  it("reset clears both dataset ID and mapping", () => {
    const mapping = {
      date_column: "date",
      target_column: "sales",
      media_columns: {
        col1: { channel_name: "TV", spend_type: "impression" },
      },
      control_columns: ["holiday"],
    };

    useDatasetStore.getState().setCurrentDataset("dataset-456");
    useDatasetStore.getState().setColumnMapping(mapping);

    // Verify state is set
    let state = useDatasetStore.getState();
    expect(state.currentDatasetId).toBe("dataset-456");
    expect(state.columnMapping).toEqual(mapping);

    // Reset
    useDatasetStore.getState().reset();

    state = useDatasetStore.getState();
    expect(state.currentDatasetId).toBeNull();
    expect(state.columnMapping).toBeNull();
  });

  it("handles empty media and control columns", () => {
    const mapping = {
      date_column: "date",
      target_column: "sales",
      media_columns: {},
      control_columns: [],
    };

    useDatasetStore.getState().setColumnMapping(mapping);

    const state = useDatasetStore.getState();
    expect(state.columnMapping?.media_columns).toEqual({});
    expect(state.columnMapping?.control_columns).toEqual([]);
  });

  it("can set dataset ID and mapping independently", () => {
    useDatasetStore.getState().setCurrentDataset("ds-1");

    let state = useDatasetStore.getState();
    expect(state.currentDatasetId).toBe("ds-1");
    expect(state.columnMapping).toBeNull();

    const mapping = {
      date_column: "d",
      target_column: "t",
      media_columns: {},
      control_columns: [],
    };

    useDatasetStore.getState().setColumnMapping(mapping);

    state = useDatasetStore.getState();
    expect(state.currentDatasetId).toBe("ds-1");
    expect(state.columnMapping).toEqual(mapping);
  });
});
