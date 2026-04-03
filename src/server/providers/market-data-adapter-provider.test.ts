import { afterEach, describe, expect, it, vi } from "vitest";

import type { GetMarketDataResult } from "@/server/contracts";
import {
  MarketDataAdapterProvider,
  MarketDataClientInputError,
  MarketDataContractError,
  MarketDataServiceAuthError,
  MarketDataServiceError,
  MarketDataServiceTimeoutError
} from "@/server/providers/market-data-adapter-provider";

const validMarketDataPayload: GetMarketDataResult = {
  schemaVersion: "market-data.v1",
  provider: "yfinance",
  requestedAt: "2026-04-03T12:00:00Z",
  reportingCurrency: "USD",
  securities: [
    {
      ticker: "AAPL",
      securityName: "Apple Inc.",
      assetClass: "EQUITY",
      securityCurrency: "USD",
      reportingCurrency: "USD",
      currentPrice: "100.00000000",
      fxRateToReportingCurrency: "1.00000000",
      quoteTimestamp: "2026-04-03T12:00:00Z",
      dataQualityFlags: []
    },
    {
      ticker: "SHOP.TO",
      securityName: "Shopify Inc.",
      assetClass: "EQUITY",
      securityCurrency: "CAD",
      reportingCurrency: "USD",
      currentPrice: "120.00000000",
      fxRateToReportingCurrency: "0.72000000",
      quoteTimestamp: "2026-04-03T12:00:00Z",
      dataQualityFlags: ["currency_inferred_from_symbol"]
    }
  ]
};

function createProvider(fetchImplementation: typeof fetch) {
  return new MarketDataAdapterProvider({
    serviceUrl: "http://127.0.0.1:8000",
    timeoutMs: 5000,
    internalApiSecret: "shared-secret",
    fetchImplementation
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("MarketDataAdapterProvider", () => {
  it("sends the authenticated request and returns the validated response", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(validMarketDataPayload), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );
    const provider = createProvider(fetchMock);

    const result = await provider.getSecurities({
      tickers: ["  AAPL  ", "SHOP.TO"],
      reportingCurrency: "USD"
    });

    expect(result).toEqual(validMarketDataPayload);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/market-data/quotes",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "X-Internal-Secret": "shared-secret"
        }),
        body: JSON.stringify({
          tickers: ["AAPL", "SHOP.TO"],
          reportingCurrency: "USD"
        }),
        redirect: "error"
      })
    );
  });

  it("rejects invalid input before making a network request", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    const provider = createProvider(fetchMock);

    await expect(
      provider.getSecurities({
        tickers: [""],
        reportingCurrency: "USD"
      })
    ).rejects.toBeInstanceOf(MarketDataClientInputError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps adapter auth failures to a specific error", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ detail: "Unauthorized" }), { status: 401 }));
    const provider = createProvider(fetchMock);

    await expect(
      provider.getSecurities({
        tickers: ["AAPL"],
        reportingCurrency: "USD"
      })
    ).rejects.toBeInstanceOf(MarketDataServiceAuthError);
  });

  it("maps abort-style failures to a timeout error", async () => {
    const abortError = new Error("The operation was aborted.");
    abortError.name = "AbortError";

    const fetchMock = vi.fn<typeof fetch>().mockRejectedValue(abortError);
    const provider = createProvider(fetchMock);

    await expect(
      provider.getSecurities({
        tickers: ["AAPL"],
        reportingCurrency: "USD"
      })
    ).rejects.toBeInstanceOf(MarketDataServiceTimeoutError);
  });

  it("raises a contract error when the adapter response shape is invalid", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          provider: "yfinance",
          reportingCurrency: "USD",
          securities: []
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    const provider = createProvider(fetchMock);

    await expect(
      provider.getSecurities({
        tickers: ["AAPL"],
        reportingCurrency: "USD"
      })
    ).rejects.toBeInstanceOf(MarketDataContractError);
  });

  it("preserves partial-data flags returned by the adapter", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(validMarketDataPayload), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );
    const provider = createProvider(fetchMock);

    const result = await provider.getSecurities({
      tickers: ["AAPL", "SHOP.TO"],
      reportingCurrency: "USD"
    });

    expect(result.securities[1]?.dataQualityFlags).toEqual(["currency_inferred_from_symbol"]);
  });

  it("throws a transport error for non-timeout fetch failures", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error("connect ECONNREFUSED 127.0.0.1:8000"));
    const provider = createProvider(fetchMock);

    await expect(
      provider.getSecurities({
        tickers: ["AAPL"],
        reportingCurrency: "USD"
      })
    ).rejects.toBeInstanceOf(MarketDataServiceError);
  });

  it("fails fast if the internal API secret is missing", () => {
    expect(
      () =>
        new MarketDataAdapterProvider({
          serviceUrl: "http://127.0.0.1:8000",
          timeoutMs: 5000,
          internalApiSecret: "   ",
          fetchImplementation: vi.fn<typeof fetch>()
        })
    ).toThrow(MarketDataServiceAuthError);
  });
});
