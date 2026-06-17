import { describe, expect, it, vi } from "vitest";

import {
  SecuritySearchService,
  SecuritySearchUnavailableError
} from "@/server/services/security-search-service";
import type { SecuritySearchProvider } from "@/server/providers/security-search-provider";

function buildProvider(overrides: Partial<SecuritySearchProvider> = {}): SecuritySearchProvider {
  return {
    providerName: "stub-search",
    searchSecurities: vi.fn().mockResolvedValue({
      results: [
        {
          symbol: "AAPL",
          name: "Apple Inc.",
          exchange: "NASDAQ",
          region: "United States",
          currency: "USD",
          matchScore: "0.9500",
          provider: "stub-search"
        },
        {
          symbol: "SHOP.TO",
          name: "Shopify Inc.",
          exchange: "TSX",
          region: "Canada",
          currency: "CAD",
          matchScore: "0.9100",
          provider: "stub-search"
        }
      ]
    }),
    ...overrides
  };
}

describe("SecuritySearchService", () => {
  it("normalizes query input and limits results", async () => {
    const provider = buildProvider();
    const service = new SecuritySearchService({ provider, resultLimit: 1 });

    const result = await service.search({ query: "  Apple   Inc " });

    expect(provider.searchSecurities).toHaveBeenCalledWith({ query: "Apple Inc" });
    expect(result.results).toEqual([
      expect.objectContaining({
        symbol: "AAPL",
        provider: "stub-search"
      })
    ]);
  });

  it("rejects invalid queries before calling the provider", async () => {
    const provider = buildProvider();
    const service = new SecuritySearchService({ provider });

    await expect(service.search({ query: "A" })).rejects.toThrow(/at least 2/);
    expect(provider.searchSecurities).not.toHaveBeenCalled();
  });

  it("maps provider failures to a generic unavailable error", async () => {
    const provider = buildProvider({
      searchSecurities: vi.fn().mockRejectedValue(new Error("raw provider payload"))
    });
    const service = new SecuritySearchService({ provider });

    await expect(service.search({ query: "Apple" })).rejects.toThrow(
      SecuritySearchUnavailableError
    );
  });
});
