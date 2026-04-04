import { describe, expect, it, vi } from "vitest";

import type { CanonicalPortfolioSnapshot } from "@/server/contracts";

import {
  AnalysisEngineService,
  AnalysisInputError,
  AnalysisReportRunNotFoundError,
  type AnalysisEngineRepository
} from "./analysis-engine-service";

type ReportRunRecord = NonNullable<
  Awaited<ReturnType<AnalysisEngineRepository["getReportRunWithCanonicalSnapshot"]>>
>;

function buildCanonicalSnapshot(): CanonicalPortfolioSnapshot {
  return {
    schemaVersion: "canonical-model.v1",
    generatedAt: "2026-04-03T18:00:00.000Z",
    runId: "22222222-2222-4222-8222-222222222222",
    userId: "11111111-1111-4111-8111-111111111111",
    portfolioId: "33333333-3333-4333-8333-333333333333",
    portfolioName: "Phase 1 Demo Portfolio",
    portfolioDescription: "Seed portfolio for analysis validation.",
    baseCurrency: "USD",
    holdings: [
      {
        holdingId: "44444444-4444-4444-8444-444444444444",
        ticker: "AAPL",
        securityName: "Apple Inc.",
        assetClass: "EQUITY",
        securityCurrency: "USD",
        reportingCurrency: "USD",
        quantity: "10.0000000000",
        averageCostPerUnit: "180.00000000",
        currentPricePerUnit: "214.12000000",
        fxRateToReportingCurrency: "1.00000000",
        costBasisAmount: "1800.00000000",
        marketValueAmount: "2141.20000000",
        unrealizedPnLAmount: "341.20000000",
        unrealizedPnLPercent: "18.95555556",
        portfolioWeightPercent: "62.80401814",
        marketDataAsOf: "2026-04-03T15:28:00.000Z",
        dataQualityFlags: []
      },
      {
        holdingId: "55555555-5555-4555-8555-555555555555",
        ticker: "SHOP.TO",
        securityName: "Shopify Inc.",
        assetClass: "EQUITY",
        securityCurrency: "CAD",
        reportingCurrency: "USD",
        quantity: "15.0000000000",
        averageCostPerUnit: "90.00000000",
        currentPricePerUnit: "117.42000000",
        fxRateToReportingCurrency: "0.72000000",
        costBasisAmount: "1350.00000000",
        marketValueAmount: "1268.13600000",
        unrealizedPnLAmount: "-81.86400000",
        unrealizedPnLPercent: "-6.06400000",
        portfolioWeightPercent: "37.19598186",
        marketDataAsOf: "2026-04-03T15:27:00.000Z",
        dataQualityFlags: ["currency_inferred_from_symbol"]
      }
    ],
    portfolioTotals: {
      totalCostBasis: "3150.00000000",
      totalMarketValue: "3409.33600000",
      totalUnrealizedPnL: "259.33600000",
      totalUnrealizedPnLPercent: "8.23288889",
      holdingCount: 2
    },
    dataQualityFlags: ["currency_inferred_from_symbol"]
  };
}

function buildReportRunRecord(): ReportRunRecord {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    status: "QUEUED",
    canonicalSnapshot: buildCanonicalSnapshot(),
    analysisOutput: null
  };
}

describe("AnalysisEngineService", () => {
  it("builds analysis output from a persisted canonical snapshot and saves it", async () => {
    const reportRun = buildReportRunRecord();
    const repository: AnalysisEngineRepository = {
      getReportRunWithCanonicalSnapshot: vi.fn().mockResolvedValue(reportRun),
      persistAnalysisOutput: vi.fn().mockResolvedValue(undefined)
    };
    const service = new AnalysisEngineService({
      repository,
      now: () => new Date("2026-04-03T18:30:00.000Z")
    });

    const result = await service.buildForReportRun(reportRun.id);

    expect(repository.persistAnalysisOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        reportRunId: reportRun.id,
        analysisOutput: expect.objectContaining({
          schemaVersion: "analysis.v1",
          runId: reportRun.id
        })
      })
    );
    expect(result.analysisOutput.summary.totalMarketValue).toBe("3409.33600000");
    expect(result.analysisOutput.sections).toHaveLength(6);
    expect(result.status).toBe("QUEUED");
  });

  it("fails when the report run does not exist", async () => {
    const repository: AnalysisEngineRepository = {
      getReportRunWithCanonicalSnapshot: vi.fn().mockResolvedValue(null),
      persistAnalysisOutput: vi.fn().mockResolvedValue(undefined)
    };
    const service = new AnalysisEngineService({ repository });

    await expect(service.buildForReportRun("missing-run-id")).rejects.toBeInstanceOf(
      AnalysisReportRunNotFoundError
    );
    expect(repository.persistAnalysisOutput).not.toHaveBeenCalled();
  });

  it("fails when the report run has no canonical snapshot yet", async () => {
    const reportRun = buildReportRunRecord();
    reportRun.canonicalSnapshot = null;
    const repository: AnalysisEngineRepository = {
      getReportRunWithCanonicalSnapshot: vi.fn().mockResolvedValue(reportRun),
      persistAnalysisOutput: vi.fn().mockResolvedValue(undefined)
    };
    const service = new AnalysisEngineService({ repository });

    await expect(service.buildForReportRun(reportRun.id)).rejects.toBeInstanceOf(
      AnalysisInputError
    );
    expect(repository.persistAnalysisOutput).not.toHaveBeenCalled();
  });

  it("fails when the persisted canonical snapshot is invalid", async () => {
    const reportRun = buildReportRunRecord();
    reportRun.canonicalSnapshot = {
      schemaVersion: "canonical-model.v1",
      runId: reportRun.id
    };
    const repository: AnalysisEngineRepository = {
      getReportRunWithCanonicalSnapshot: vi.fn().mockResolvedValue(reportRun),
      persistAnalysisOutput: vi.fn().mockResolvedValue(undefined)
    };
    const service = new AnalysisEngineService({ repository });

    await expect(service.buildForReportRun(reportRun.id)).rejects.toBeInstanceOf(
      AnalysisInputError
    );
    expect(repository.persistAnalysisOutput).not.toHaveBeenCalled();
  });
});
