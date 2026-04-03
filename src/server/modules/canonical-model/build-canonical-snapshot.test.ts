import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

import type { GetMarketDataResult } from "@/server/contracts";

import { buildCanonicalSnapshot } from "./build-canonical-snapshot";

const generatedAt = new Date("2026-04-03T15:30:00.000Z");

function buildBaseInput(overrides: Partial<Parameters<typeof buildCanonicalSnapshot>[0]> = {}) {
  const marketData: GetMarketDataResult = {
    schemaVersion: "market-data.v1",
    provider: "yfinance",
    requestedAt: "2026-04-03T15:29:00.000Z",
    reportingCurrency: "USD",
    securities: [
      {
        ticker: "AAPL",
        securityName: "Apple Inc.",
        assetClass: "EQUITY",
        securityCurrency: "USD",
        reportingCurrency: "USD",
        currentPrice: "214.12000000",
        fxRateToReportingCurrency: "1.00000000",
        quoteTimestamp: "2026-04-03T15:28:00.000Z",
        dataQualityFlags: []
      },
      {
        ticker: "SHOP.TO",
        securityName: "Shopify Inc.",
        assetClass: "EQUITY",
        securityCurrency: "CAD",
        reportingCurrency: "USD",
        currentPrice: "117.42000000",
        fxRateToReportingCurrency: "0.72000000",
        quoteTimestamp: "2026-04-03T15:27:00.000Z",
        dataQualityFlags: ["currency_inferred_from_symbol"]
      }
    ]
  };

  return {
    reportRunId: "22222222-2222-4222-8222-222222222222",
    userId: "11111111-1111-4111-8111-111111111111",
    portfolioId: "33333333-3333-4333-8333-333333333333",
    portfolioName: "Phase 1 Demo Portfolio",
    portfolioDescription: "Seeded portfolio for report pipeline validation.",
    portfolioBaseCurrency: "USD" as const,
    reportingCurrency: "USD" as const,
    generatedAt,
    holdings: [
      {
        id: "44444444-4444-4444-8444-444444444444",
        ticker: "AAPL",
        securityName: "Apple Inc.",
        assetClass: "EQUITY" as const,
        securityCurrency: "USD" as const,
        quantity: new Prisma.Decimal("10"),
        averageCost: new Prisma.Decimal("180")
      },
      {
        id: "55555555-5555-4555-8555-555555555555",
        ticker: "SHOP.TO",
        securityName: "Shopify Inc.",
        assetClass: "EQUITY" as const,
        securityCurrency: "CAD" as const,
        quantity: new Prisma.Decimal("15"),
        averageCost: new Prisma.Decimal("90")
      }
    ],
    marketData,
    ...overrides
  };
}

describe("buildCanonicalSnapshot", () => {
  it("builds a validated canonical snapshot with deterministic totals", () => {
    const result = buildCanonicalSnapshot(buildBaseInput());

    expect(result.hasPricedHoldings).toBe(true);
    expect(result.valuationAsOf).toBe("2026-04-03T15:28:00.000Z");
    expect(result.snapshot.schemaVersion).toBe("canonical-model.v1");
    expect(result.snapshot.baseCurrency).toBe("USD");
    expect(result.snapshot.portfolioTotals).toEqual({
      totalCostBasis: "3150.00000000",
      totalMarketValue: "3409.33600000",
      totalUnrealizedPnL: "259.33600000",
      totalUnrealizedPnLPercent: "8.23288889",
      holdingCount: 2
    });
    expect(result.snapshot.holdings[0]?.portfolioWeightPercent).toBe("62.80401814");
    expect(result.snapshot.holdings[1]?.portfolioWeightPercent).toBe("37.19598186");
    expect(result.snapshot.holdings[1]?.dataQualityFlags).toEqual([
      "currency_inferred_from_symbol"
    ]);
    expect(result.snapshot.dataQualityFlags).toEqual(["currency_inferred_from_symbol"]);
  });

  it("preserves partial failures without failing the whole snapshot build", () => {
    const result = buildCanonicalSnapshot(
      buildBaseInput({
        marketData: {
          schemaVersion: "market-data.v1",
          provider: "yfinance",
          requestedAt: "2026-04-03T15:29:00.000Z",
          reportingCurrency: "USD",
          securities: [
            {
              ticker: "AAPL",
              securityName: "Apple Inc.",
              assetClass: "EQUITY",
              securityCurrency: "USD",
              reportingCurrency: "USD",
              currentPrice: "214.12000000",
              fxRateToReportingCurrency: "1.00000000",
              quoteTimestamp: "2026-04-03T15:28:00.000Z",
              dataQualityFlags: []
            },
            {
              ticker: "SHOP.TO",
              securityName: "Shopify Inc.",
              assetClass: "EQUITY",
              securityCurrency: "CAD",
              reportingCurrency: "USD",
              currentPrice: null,
              fxRateToReportingCurrency: "0.72000000",
              quoteTimestamp: "2026-04-03T15:27:00.000Z",
              dataQualityFlags: ["quote_not_found"]
            }
          ]
        }
      })
    );

    expect(result.hasPricedHoldings).toBe(true);
    expect(result.snapshot.portfolioTotals.totalCostBasis).toBe("3150.00000000");
    expect(result.snapshot.portfolioTotals.totalMarketValue).toBe("2141.20000000");
    expect(result.snapshot.portfolioTotals.totalUnrealizedPnL).toBeNull();
    expect(result.snapshot.portfolioTotals.totalUnrealizedPnLPercent).toBeNull();
    expect(result.snapshot.holdings[0]?.portfolioWeightPercent).toBeNull();
    expect(result.snapshot.holdings[1]?.marketValueAmount).toBeNull();
    expect(result.snapshot.holdings[1]?.dataQualityFlags).toEqual([
      "quote_not_found",
      "market_value_unavailable"
    ]);
    expect(result.snapshot.dataQualityFlags).toEqual([
      "quote_not_found",
      "market_value_unavailable",
      "contains_partial_market_data"
    ]);
  });

  it("marks the snapshot unusable when nothing is priced", () => {
    const result = buildCanonicalSnapshot(
      buildBaseInput({
        marketData: {
          schemaVersion: "market-data.v1",
          provider: "yfinance",
          requestedAt: "2026-04-03T15:29:00.000Z",
          reportingCurrency: "USD",
          securities: [
            {
              ticker: "AAPL",
              securityName: "Apple Inc.",
              assetClass: "EQUITY",
              securityCurrency: "USD",
              reportingCurrency: "USD",
              currentPrice: null,
              fxRateToReportingCurrency: "1.00000000",
              quoteTimestamp: "2026-04-03T15:28:00.000Z",
              dataQualityFlags: ["quote_not_found"]
            },
            {
              ticker: "SHOP.TO",
              securityName: "Shopify Inc.",
              assetClass: "EQUITY",
              securityCurrency: "CAD",
              reportingCurrency: "USD",
              currentPrice: null,
              fxRateToReportingCurrency: null,
              quoteTimestamp: "2026-04-03T15:27:00.000Z",
              dataQualityFlags: ["quote_not_found"]
            }
          ]
        }
      })
    );

    expect(result.hasPricedHoldings).toBe(false);
    expect(result.snapshot.portfolioTotals.totalMarketValue).toBeNull();
    expect(result.snapshot.dataQualityFlags).toContain("no_priced_holdings");
    expect(result.snapshot.dataQualityFlags).toContain("contains_partial_market_data");
  });
});
