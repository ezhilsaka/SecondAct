import { describe, expect, it, vi } from "vitest";

import {
  SecuritySearchAdapterProvider,
  SecuritySearchClientInputError,
  SecuritySearchContractError,
  SecuritySearchServiceAuthError,
  SecuritySearchServiceError,
  SecuritySearchServiceTimeoutError
} from "@/server/providers/security-search-adapter-provider";

const validSearchPayload = {
  schemaVersion: "security-search.v1",
  provider: "yfinance",
  requestedAt: "2026-06-16T20:00:00Z",
  results: [
    {
      symbol: "aapl",
      name: "Apple Inc.",
      exchange: "NASDAQ",
      region: "United States",
      currency: "USD",
      matchScore: "0.9300",
      provider: "yfinance"
    }
  ]
};

function createProvider(fetchImplementation: typeof fetch) {
  return new SecuritySearchAdapterProvider({
    serviceUrl: "http://127.0.0.1:8000",
    timeoutMs: 5000,
    internalApiSecret: "shared-secret",
    fetchImplementation
  });
}

describe("SecuritySearchAdapterProvider", () => {
  it("sends an authenticated search request and returns normalized results", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(validSearchPayload), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );
    const provider = createProvider(fetchMock);

    const result = await provider.searchSecurities({ query: " Apple  Inc " });

    expect(result).toEqual({
      results: [
        {
          symbol: "AAPL",
          name: "Apple Inc.",
          exchange: "NASDAQ",
          region: "United States",
          currency: "USD",
          matchScore: "0.9300",
          provider: "yfinance"
        }
      ]
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/market-data/search?query=Apple+Inc",
      expect.objectContaining({
        method: "GET",
        headers: {
          "X-Internal-Secret": "shared-secret"
        },
        redirect: "error"
      })
    );
  });

  it("rejects invalid input before making a network request", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    const provider = createProvider(fetchMock);

    await expect(provider.searchSecurities({ query: "A" })).rejects.toBeInstanceOf(
      SecuritySearchClientInputError
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps adapter auth failures to auth errors", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ detail: "Unauthorized" }), { status: 401 }));
    const provider = createProvider(fetchMock);

    await expect(provider.searchSecurities({ query: "Apple" })).rejects.toBeInstanceOf(
      SecuritySearchServiceAuthError
    );
  });

  it("maps abort-style failures to timeout errors", async () => {
    const abortError = new Error("The operation was aborted.");
    abortError.name = "AbortError";
    const fetchMock = vi.fn<typeof fetch>().mockRejectedValue(abortError);
    const provider = createProvider(fetchMock);

    await expect(provider.searchSecurities({ query: "Apple" })).rejects.toBeInstanceOf(
      SecuritySearchServiceTimeoutError
    );
  });

  it("throws a transport error for non-timeout fetch failures", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockRejectedValue(new Error("ECONNREFUSED"));
    const provider = createProvider(fetchMock);

    await expect(provider.searchSecurities({ query: "Apple" })).rejects.toBeInstanceOf(
      SecuritySearchServiceError
    );
  });

  it("raises a contract error when the adapter response shape is invalid", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ provider: "yfinance", results: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );
    const provider = createProvider(fetchMock);

    await expect(provider.searchSecurities({ query: "Apple" })).rejects.toBeInstanceOf(
      SecuritySearchContractError
    );
  });

  it("fails fast if the internal API secret is missing", () => {
    expect(
      () =>
        new SecuritySearchAdapterProvider({
          serviceUrl: "http://127.0.0.1:8000",
          timeoutMs: 5000,
          internalApiSecret: "   ",
          fetchImplementation: vi.fn<typeof fetch>()
        })
    ).toThrow(SecuritySearchServiceAuthError);
  });
});
