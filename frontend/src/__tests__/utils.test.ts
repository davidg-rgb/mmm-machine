import { describe, it, expect } from "vitest";
import { formatCurrency, formatPercent, getStatusBadgeVariant, cn } from "../lib/utils";

describe("formatCurrency", () => {
  it("formats zero correctly", () => {
    expect(formatCurrency(0)).toBe("$0");
  });

  it("formats thousands with comma separator", () => {
    expect(formatCurrency(1000)).toBe("$1,000");
  });

  it("formats millions with comma separators", () => {
    expect(formatCurrency(1000000)).toBe("$1,000,000");
  });

  it("formats negative values with minus sign", () => {
    expect(formatCurrency(-500)).toBe("-$500");
  });

  it("formats decimal values without fraction digits", () => {
    expect(formatCurrency(1234.56)).toBe("$1,235");
  });

  it("formats large negative values", () => {
    expect(formatCurrency(-1234567)).toBe("-$1,234,567");
  });
});

describe("formatPercent", () => {
  it("formats zero as 0.0%", () => {
    expect(formatPercent(0)).toBe("0.0%");
  });

  it("formats 0.5 as 50.0%", () => {
    expect(formatPercent(0.5)).toBe("50.0%");
  });

  it("formats 1.0 as 100.0%", () => {
    expect(formatPercent(1.0)).toBe("100.0%");
  });

  it("formats decimal values with one decimal place", () => {
    expect(formatPercent(0.123)).toBe("12.3%");
  });

  it("formats negative percentages", () => {
    expect(formatPercent(-0.25)).toBe("-25.0%");
  });

  it("formats values greater than 1", () => {
    expect(formatPercent(2.5)).toBe("250.0%");
  });

  it("rounds to one decimal place", () => {
    expect(formatPercent(0.12345)).toBe("12.3%");
  });
});

describe("getStatusBadgeVariant", () => {
  it("returns success for completed status", () => {
    expect(getStatusBadgeVariant("completed")).toBe("success");
  });

  it("returns brand for fitting status", () => {
    expect(getStatusBadgeVariant("fitting")).toBe("brand");
  });

  it("returns brand for preprocessing status", () => {
    expect(getStatusBadgeVariant("preprocessing")).toBe("brand");
  });

  it("returns brand for postprocessing status", () => {
    expect(getStatusBadgeVariant("postprocessing")).toBe("brand");
  });

  it("returns info for queued status", () => {
    expect(getStatusBadgeVariant("queued")).toBe("info");
  });

  it("returns error for failed status", () => {
    expect(getStatusBadgeVariant("failed")).toBe("error");
  });

  it("returns success for validated status", () => {
    expect(getStatusBadgeVariant("validated")).toBe("success");
  });

  it("returns info for uploaded status", () => {
    expect(getStatusBadgeVariant("uploaded")).toBe("info");
  });

  it("returns error for validation_error status", () => {
    expect(getStatusBadgeVariant("validation_error")).toBe("error");
  });

  it("returns default for unknown status", () => {
    expect(getStatusBadgeVariant("unknown_status")).toBe("default");
  });

  it("returns default for empty string", () => {
    expect(getStatusBadgeVariant("")).toBe("default");
  });
});

describe("cn (class name utility)", () => {
  it("merges class names", () => {
    const result = cn("foo", "bar");
    expect(result).toContain("foo");
    expect(result).toContain("bar");
  });

  it("handles conditional classes", () => {
    const result = cn("base", false && "hidden", "active");
    expect(result).toContain("base");
    expect(result).toContain("active");
    expect(result).not.toContain("hidden");
  });

  it("merges Tailwind classes correctly (handles conflicts)", () => {
    // twMerge should prioritize the last class when there's a conflict
    const result = cn("p-4", "p-8");
    expect(result).toBe("p-8");
  });

  it("handles empty input", () => {
    const result = cn();
    expect(result).toBe("");
  });

  it("handles null and undefined", () => {
    const result = cn("base", null, undefined, "end");
    expect(result).toContain("base");
    expect(result).toContain("end");
  });
});
