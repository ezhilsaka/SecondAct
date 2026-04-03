import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { GetMarketDataResult } from "@/server/contracts";
import type { MarketDataProvider } from "@/server/providers/market-data-provider";

import {
  CanonicalModelService,
  CanonicalSnapshotInputError,
  CanonicalSnapshotUnusableError,
  ReportRunNotFoundError,
  type CanonicalModelRepository
} from "./canonical-model-service";

type ReportRunRecord = NonNullable<
  Awaited<ReturnType<CanonicalModelRepository["getReportRunWithPortfolio"]>>
>;

function buildReportRunRecord(): ReportRunRecord {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    userId: "11111111-1111-4111-8111-111111111111",
    portfolioId: "33333333-3333-4333-8333-333333333333",
    reportingCurrency: "USD",
    status: "QUEUED",
    paymentStatus: "NOT_REQUIRED",
    paymentProvider: null,
    paymentReferenceId: null,
    schemaVersion: null,
    promptVersion: null,
    marketDataProvider: null,
    narrativeProvider: null,
    narrativeModel: null,
    valuationAsOf: null,
    canonicalSnapshot: null,
    analysisOutput: null,
    narrativeOutput: null,
    errorCode: null,
    errorDetails: null,
    requestedAt: new Date("2026-04-03T15:20:00.000Z"),
    startedAt: null,
    completedAt: null,
    failedAt: null,
    createdAt: new Date("2026-04-03T15:20:00.000Z"),
    updatedAt: new Date("2026-04-03T15:20:00.000Z"),
    portfolio: {
      id: "33333333-3333-4333-8333-333333333333",
      userId: "11111111-1111-4111-8111-111111111111",
      name: "Phase 1 Demo Portfolio",
      description: "Seeded portfolio for report pipeline validation.",
      baseCurrency: "USD",
      sourceType: "MANUAL",
      archivedAt: null,
      createdAt: new Date("2026-04-03T15:00:00.000Z"),
      updatedAt: new Date("2026-04-03T15:00:00.000Z"),
      holdings: [
        {
          id: "44444444-4444-4444-8444-444444444444",
          userId: "11111111-1111-4111-8111-111111111111",
          portfolioId: "33333333-3333-4333-8333-333333333333",
          ticker: "AAPL",
          securityName: "Apple Inc.",
          assetClass: "EQUITY",
          securityCurrency: "USD",
          quantity: new Prisma.Decimal("10"),
          averageCost: new Prisma.Decimal("180"),
          notes: null,
          createdAt: new Date("2026-04-03T15:00:00.000Z"),
          updatedAt: new Date("2026-04-03T15:00:00.000Z")
        },
        {
          id: "55555555-5555-4555-8555-555555555555",
          userId: "11111111-1111-4111-8111-111111111111",
          portfolioId: "33333333-3333-4333-8333-333333333333",
          ticker: "SHOP.TO",
          securityName: "Shopify Inc.",
          assetClass: "EQUITY",
          securityCurrency: "CAD",
          quantity: new Prisma.Decimal("15"),
          averageCost: new Prisma.Decimal("90"),
          notes: null,
          createdAt: new Date("2026-04-03T15:00:00.000Z"),
          updatedAt: new Date("2026-04-03T15:00:00.000Z")
        }
      ]
    }
  };
}

function buildMarketDataResult(overrides: Partial<GetMarketDataResult> = {}): GetMarketDataResult {
  return {
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
    ],
    ...overrides
  };
}

describe("CanonicalModelService", () => {
  it("loads the report run, fetches market data, and persists the canonical snapshot", async () => {
    const reportRun = buildReportRunRecord();
    const repository: CanonicalModelRepository = {
      getReportRunWithPortfolio: vi.fn().mockResolvedValue(reportRun),
      persistCanonicalSnapshot: vi.fn().mockResolvedValue(undefined)
    };
    const marketDataProvider: MarketDataProvider = {
      providerName: "market-data-adapter",
      getSecurities: vi.fn().mockResolvedValue(buildMarketDataResult())
    };
    const service = new CanonicalModelService({
      repository,
      marketDataProvider,
      now: () => new Date("2026-04-03T15:30:00.000Z")
    });

    const result = await service.buildForReportRun(reportRun.id);

    expect(marketDataProvider.getSecurities).toHaveBeenCalledWith({
      tickers: ["AAPL", "SHOP.TO"],
      reportingCurrency: "USD"
    });
    expect(repository.persistCanonicalSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        reportRunId: reportRun.id,
        marketDataProvider: "yfinance",
        valuationAsOf: new Date("2026-04-03T15:28:00.000Z")
      })
    );
    expect(result.snapshot.schemaVersion).toBe("canonical-model.v1");
    expect(result.snapshot.portfolioTotals.totalMarketValue).toBe("3409.33600000");
    expect(result.status).toBe("QUEUED");
  });

  it("fails when the report run does not exist", async () => {
    const repository: CanonicalModelRepository = {
      getReportRunWithPortfolio: vi.fn().mockResolvedValue(null),
      persistCanonicalSnapshot: vi.fn().mockResolvedValue(undefined)
    };
    const marketDataProvider: MarketDataProvider = {
      providerName: "market-data-adapter",
      getSecurities: vi.fn()
    };
    const service = new CanonicalModelService({ repository, marketDataProvider });

    await expect(service.buildForReportRun("missing-run-id")).rejects.toBeInstanceOf(
      ReportRunNotFoundError
    );
    expect(marketDataProvider.getSecurities).not.toHaveBeenCalled();
  });

  it("fails fast when the portfolio has no holdings", async () => {
    const reportRun = buildReportRunRecord();
    reportRun.portfolio.holdings = [];
    const repository: CanonicalModelRepository = {
      getReportRunWithPortfolio: vi.fn().mockResolvedValue(reportRun),
      persistCanonicalSnapshot: vi.fn().mockResolvedValue(undefined)
    };
    const marketDataProvider: MarketDataProvider = {
      providerName: "market-data-adapter",
      getSecurities: vi.fn()
    };
    const service = new CanonicalModelService({ repository, marketDataProvider });

    await expect(service.buildForReportRun(reportRun.id)).rejects.toBeInstanceOf(
      CanonicalSnapshotInputError
    );
    expect(marketDataProvider.getSecurities).not.toHaveBeenCalled();
  });

  it("fails when no holdings can be priced after enrichment", async () => {
    const reportRun = buildReportRunRecord();
    const repository: CanonicalModelRepository = {
      getReportRunWithPortfolio: vi.fn().mockResolvedValue(reportRun),
      persistCanonicalSnapshot: vi.fn().mockResolvedValue(undefined)
    };
    const marketDataProvider: MarketDataProvider = {
      providerName: "market-data-adapter",
      getSecurities: vi.fn().mockResolvedValue(
        buildMarketDataResult({
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
        })
      )
    };
    const service = new CanonicalModelService({
      repository,
      marketDataProvider,
      now: () => new Date("2026-04-03T15:30:00.000Z")
    });

    await expect(service.buildForReportRun(reportRun.id)).rejects.toBeInstanceOf(
      CanonicalSnapshotUnusableError
    );
    expect(repository.persistCanonicalSnapshot).not.toHaveBeenCalled();
  });
});
