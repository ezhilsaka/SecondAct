import { describe, expect, it } from "vitest";

import {
  securitySearchAdapterResponseSchema,
  securitySearchQuerySchema,
  securitySearchResponseSchema
} from "@/server/contracts/security-search";

describe("security search contracts", () => {
  it("normalizes query whitespace", () => {
    expect(securitySearchQuerySchema.parse({ query: "  Apple   Inc  " })).toEqual({
      query: "Apple Inc"
    });
  });

  it("rejects short or unsafe queries", () => {
    expect(() => securitySearchQuerySchema.parse({ query: "A" })).toThrow(/at least 2/);
    expect(() => securitySearchQuerySchema.parse({ query: "AAPL/USD" })).toThrow(
      /can only contain/
    );
  });

  it("normalizes symbols and validates public response shape", () => {
    const parsed = securitySearchResponseSchema.parse({
      results: [
        {
          symbol: "shop.to",
          name: "Shopify Inc.",
          exchange: "TSX",
          region: "Canada",
          currency: "CAD",
          matchScore: "0.92",
          provider: "yfinance"
        }
      ]
    });

    expect(parsed.results[0]).toEqual({
      symbol: "SHOP.TO",
      name: "Shopify Inc.",
      exchange: "TSX",
      region: "Canada",
      currency: "CAD",
      matchScore: "0.92",
      provider: "yfinance"
    });
  });

  it("validates the internal adapter response contract", () => {
    const parsed = securitySearchAdapterResponseSchema.parse({
      schemaVersion: "security-search.v1",
      provider: "yfinance",
      requestedAt: "2026-06-16T20:00:00Z",
      results: [
        {
          symbol: "AAPL",
          name: "Apple Inc.",
          exchange: "NASDAQ",
          region: "United States",
          currency: "USD",
          provider: "yfinance"
        }
      ]
    });

    expect(parsed.results).toHaveLength(1);
  });
});
