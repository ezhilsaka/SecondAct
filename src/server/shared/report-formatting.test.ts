import { describe, expect, it } from "vitest";

import {
  formatReportCount,
  formatReportCurrency,
  formatReportPercentage,
  formatReportRatio,
  formatReportValue
} from "./report-formatting";

describe("report-formatting", () => {
  it("formats currency with currency code, grouping, two decimals, and leading negative sign", () => {
    expect(formatReportCurrency("1196.15374975", "USD")).toBe("USD 1,196.15");
    expect(formatReportCurrency("-1196.15374975", "USD")).toBe("-USD 1,196.15");
  });

  it("formats percentages without a positive sign unless requested", () => {
    expect(formatReportPercentage("37.40171975")).toBe("37.4%");
    expect(formatReportPercentage("37.40171975", { showPositiveSign: true })).toBe("+37.4%");
    expect(formatReportPercentage("-27.2222", { showPositiveSign: true })).toBe("-27.22%");
  });

  it("formats ratios without a generic x suffix", () => {
    expect(formatReportRatio("0.64694640")).toBe("0.65");
  });

  it("formats counts as whole numbers", () => {
    expect(formatReportCount("2.00000000")).toBe("2");
  });

  it("returns N/A for unavailable numeric values", () => {
    expect(formatReportValue(null, "currency", { currency: "CAD" })).toBe("N/A");
    expect(formatReportValue(undefined, "percentage")).toBe("N/A");
  });
});
