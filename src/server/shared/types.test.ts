import { describe, expect, it } from "vitest";

import {
  decimalStringSchema,
  isoTimestampStringSchema,
  nonEmptyStringSchema,
  supportedCurrencySchema
} from "@/server/shared/types";

describe("nonEmptyStringSchema", () => {
  it("trims surrounding whitespace", () => {
    expect(nonEmptyStringSchema.parse("  Second Act  ")).toBe("Second Act");
  });

  it("rejects blank values", () => {
    expect(() => nonEmptyStringSchema.parse("   ")).toThrow();
  });
});

describe("isoTimestampStringSchema", () => {
  it("accepts ISO 8601 timestamps with timezone information", () => {
    expect(isoTimestampStringSchema.parse("2026-03-29T14:00:00.000Z")).toBe(
      "2026-03-29T14:00:00.000Z"
    );
    expect(isoTimestampStringSchema.parse("2026-03-29T14:00:00+00:00")).toBe(
      "2026-03-29T14:00:00+00:00"
    );
  });

  it("rejects non-ISO date strings", () => {
    expect(() => isoTimestampStringSchema.parse("03/29/2026 14:00:00")).toThrow(/ISO 8601/);
    expect(() => isoTimestampStringSchema.parse("2026-03-29 14:00:00")).toThrow(/ISO 8601/);
  });
});

describe("decimalStringSchema", () => {
  it("accepts signed decimal strings", () => {
    expect(decimalStringSchema.parse("0")).toBe("0");
    expect(decimalStringSchema.parse("-10.25")).toBe("-10.25");
    expect(decimalStringSchema.parse("100.0001")).toBe("100.0001");
  });

  it("rejects malformed decimal strings", () => {
    expect(() => decimalStringSchema.parse("01")).toThrow(/decimal string/);
    expect(() => decimalStringSchema.parse("1,000")).toThrow(/decimal string/);
    expect(() => decimalStringSchema.parse("1.")).toThrow(/decimal string/);
  });
});

describe("supportedCurrencySchema", () => {
  it("accepts only supported currencies", () => {
    expect(supportedCurrencySchema.parse("USD")).toBe("USD");
    expect(supportedCurrencySchema.parse("CAD")).toBe("CAD");
    expect(() => supportedCurrencySchema.parse("EUR")).toThrow();
  });
});
