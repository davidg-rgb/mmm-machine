import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import BudgetOptimizer from "../components/results/BudgetOptimizer";

// Mock react-plotly.js
vi.mock("react-plotly.js", () => ({
  default: () => <div data-testid="plotly-chart" />,
}));

// Mock API
const mockOptimize = vi.fn();
vi.mock("../services/api", () => ({
  optimizeBudget: (...args: unknown[]) => mockOptimize(...args),
}));

// Mock clipboard
const mockCopyToClipboard = vi.fn().mockResolvedValue(true);
vi.mock("../lib/export", () => ({
  copyToClipboard: (...args: unknown[]) => mockCopyToClipboard(...args),
}));

// Mock toast
vi.mock("react-hot-toast", () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const defaultProps = {
  runId: "run_001",
  channelNames: ["Google", "Facebook", "TV"],
  currentSpend: { Google: 2500, Facebook: 1800, TV: 5000 },
};

const mockResult = {
  allocations: { Google: 4000, Facebook: 2000, TV: 3300 },
  predicted_contributions: { Google: 4200, Facebook: 2100, TV: 1500 },
  total_predicted_contribution: 7800,
  current_allocations: { Google: 2500, Facebook: 1800, TV: 5000 },
  current_contributions: { Google: 3400, Facebook: 1850, TV: 1700 },
  total_current_contribution: 6950,
  improvement_pct: 12.2,
};

describe("BudgetOptimizer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOptimize.mockResolvedValue(mockResult);
  });

  it("renders slider with correct range (50%-200% of current spend)", () => {
    render(<BudgetOptimizer {...defaultProps} />);
    const slider = screen.getByRole("slider");
    // Total current spend = 2500 + 1800 + 5000 = 9300
    expect(slider).toHaveAttribute("min", "4650"); // 50%
    expect(slider).toHaveAttribute("max", "18600"); // 200%
  });

  it("renders budget input with initial value matching total current spend", () => {
    render(<BudgetOptimizer {...defaultProps} />);
    const input = screen.getByLabelText("Total Weekly Budget");
    expect(input).toHaveValue(9300);
  });

  it("constraint editor toggles open/closed", () => {
    render(<BudgetOptimizer {...defaultProps} />);
    const toggle = screen.getByText("Channel Constraints");
    // Initially closed - no min/max inputs visible
    expect(screen.queryByText("Set min/max spend per channel")).not.toBeInTheDocument();

    fireEvent.click(toggle);
    expect(screen.getByText("Set min/max spend per channel")).toBeInTheDocument();

    fireEvent.click(toggle);
    expect(screen.queryByText("Set min/max spend per channel")).not.toBeInTheDocument();
  });

  it("passes min constraints to API call", async () => {
    render(<BudgetOptimizer {...defaultProps} />);

    // Open constraints
    fireEvent.click(screen.getByText("Channel Constraints"));

    // Set min for Google
    const minInputs = screen.getAllByPlaceholderText("0");
    fireEvent.change(minInputs[0]!, { target: { value: "1000" } });

    // Click optimize
    fireEvent.click(screen.getByText("Optimize"));

    await waitFor(() => {
      expect(mockOptimize).toHaveBeenCalledWith(
        "run_001",
        9300,
        { Google: 1000 },
        undefined,
      );
    });
  });

  it("shows validation error when min > max", () => {
    render(<BudgetOptimizer {...defaultProps} />);
    fireEvent.click(screen.getByText("Channel Constraints"));

    const minInputs = screen.getAllByPlaceholderText("0");
    const maxInputs = screen.getAllByPlaceholderText("No limit");

    // Set min > max for Google
    fireEvent.change(minInputs[0]!, { target: { value: "5000" } });
    fireEvent.change(maxInputs[0]!, { target: { value: "2000" } });

    expect(screen.getByText("Min cannot exceed max")).toBeInTheDocument();
  });

  it("save scenario adds to list and is disabled at 3", async () => {
    render(<BudgetOptimizer {...defaultProps} />);
    fireEvent.click(screen.getByText("Optimize"));

    await waitFor(() => {
      expect(screen.getByText(/Save Scenario/)).toBeInTheDocument();
    });

    // Save 3 scenarios
    for (let i = 0; i < 3; i++) {
      fireEvent.click(screen.getByText(/Save Scenario/));
    }

    const saveBtn = screen.getByText(/Save Scenario/).closest("button")!;
    expect(saveBtn).toBeDisabled();
  });

  it("copy button calls clipboard API with tab-separated data", async () => {
    render(<BudgetOptimizer {...defaultProps} />);
    fireEvent.click(screen.getByText("Optimize"));

    await waitFor(() => {
      expect(screen.getByText("Copy Table")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Copy Table"));

    await waitFor(() => {
      expect(mockCopyToClipboard).toHaveBeenCalledTimes(1);
      const text = mockCopyToClipboard.mock.calls[0]![0] as string;
      expect(text).toContain("Channel\t");
      expect(text).toContain("Google\t");
    });
  });

  it("chart mode toggle switches button states", async () => {
    render(<BudgetOptimizer {...defaultProps} />);
    fireEvent.click(screen.getByText("Optimize"));

    await waitFor(() => {
      expect(screen.getByText("Budget Allocation")).toBeInTheDocument();
    });

    const contribBtn = screen.getByText("Predicted Contribution");
    fireEvent.click(contribBtn);

    // After clicking, contribution button should be active (bg-brand-600)
    expect(contribBtn.className).toContain("bg-brand-600");
  });
});
