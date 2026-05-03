import { describe, expect, it } from "vitest";

import type { CanonicalPortfolioSnapshot } from "@/server/contracts";

import { buildAnalysisOutput } from "./build-analysis-output";

const generatedAt = new Date("2026-04-03T18:30:00.000Z");

function buildBaseSnapshot(): CanonicalPortfolioSnapshot {
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
        exchange: "NASDAQ",
        sector: "Technology",
        industry: "Consumer Electronics",
        country: "United States",
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
        exchange: "TSX",
        sector: "Technology",
        industry: "Software - Application",
        country: "Canada",
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

describe("buildAnalysisOutput", () => {
  it("builds deterministic analysis sections from a complete canonical snapshot", () => {
    const { analysisOutput } = buildAnalysisOutput({
      canonicalSnapshot: buildBaseSnapshot(),
      generatedAt
    });

    expect(analysisOutput.schemaVersion).toBe("analysis.v1");
    expect(analysisOutput.generatedAt).toBe("2026-04-03T18:30:00.000Z");
    expect(analysisOutput.summary).toEqual({
      totalMarketValue: "3409.33600000",
      totalCostBasis: "3150.00000000",
      totalUnrealizedPnL: "259.33600000",
      totalUnrealizedPnLPercent: "8.23288889",
      holdingCount: 2,
      gainersCount: 1,
      losersCount: 1,
      concentrationHhi: "0.53278858",
      largestPositionWeightPercent: "62.80401814"
    });
    expect(analysisOutput.sections.map((section) => section.sectionKey)).toEqual([
      "performance-pnl",
      "allocation-concentration",
      "risk-proxies",
      "portfolio-health-diagnostics",
      "scenario-stress-testing",
      "comparative-benchmark-lite"
    ]);

    const performanceSection = analysisOutput.sections[0];
    expect(performanceSection?.summary).toBe(
      "Portfolio return from cost basis is currently 8.23%."
    );
    expect(performanceSection?.findings).toEqual(
      expect.arrayContaining([
        "The portfolio's current paper P&L is USD 259.34.",
        "AAPL is the strongest paper winner at USD 341.20.",
        "SHOP.TO is the largest paper drag at -USD 81.86."
      ])
    );
    expect(performanceSection?.tables[0]?.rows[0]?.cells).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          columnKey: "returnContribution",
          value: "10.83174603"
        }),
        expect.objectContaining({
          columnKey: "costVsValueRatio",
          value: "1.18955556"
        })
      ])
    );
    expect(performanceSection?.tables[0]?.rows[1]?.cells).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          columnKey: "returnContribution",
          value: "-2.59885714"
        }),
        expect.objectContaining({
          columnKey: "costVsValueRatio",
          value: "0.93936000"
        })
      ])
    );

    const concentrationSection = analysisOutput.sections[1];
    expect(concentrationSection?.metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "top-3-concentration-percent",
          value: "100.00000000"
        }),
        expect.objectContaining({
          key: "effective-number-of-positions",
          value: "1.87691712"
        }),
        expect.objectContaining({
          key: "equal-weight-drift-percent",
          value: "12.80401814"
        })
      ])
    );

    const riskSection = analysisOutput.sections[2];
    expect(riskSection?.metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "portfolio-capital-at-risk-minus-20",
          value: "681.86720000"
        }),
        expect.objectContaining({
          key: "largest-loss-share-minus-20",
          value: "62.80401814"
        })
      ])
    );

    const healthSection = analysisOutput.sections[3];
    expect(healthSection?.metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "win-loss-ratio",
          value: "1.00000000"
        }),
        expect.objectContaining({
          key: "average-gain-percent",
          value: "18.95555556"
        }),
        expect.objectContaining({
          key: "average-loss-percent",
          value: "-6.06400000"
        }),
        expect.objectContaining({
          key: "portfolio-breakeven-return-from-today",
          value: "-7.60664247"
        })
      ])
    );

    const scenarioSection = analysisOutput.sections[4];
    expect(scenarioSection?.tables[0]?.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rowKey: "market-shock-minus-10",
          cells: expect.arrayContaining([
            expect.objectContaining({
              columnKey: "portfolioValue",
              value: "3068.40240000"
            }),
            expect.objectContaining({
              columnKey: "scenarioPnl",
              value: "-340.93360000"
            })
          ])
        }),
        expect.objectContaining({
          rowKey: "market-shock-minus-20",
          cells: expect.arrayContaining([
            expect.objectContaining({
              columnKey: "portfolioValue",
              value: "2727.46880000"
            }),
            expect.objectContaining({
              columnKey: "scenarioPnl",
              value: "-681.86720000"
            })
          ])
        })
      ])
    );

    const benchmarkSection = analysisOutput.sections[5];
    expect(benchmarkSection?.metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "equal-weight-benchmark-return-percent",
          value: "6.44577778"
        }),
        expect.objectContaining({
          key: "active-return-vs-benchmark-percent",
          value: "1.78711111"
        })
      ])
    );

    const reportText = analysisOutput.sections
      .flatMap((section) => [section.summary ?? "", ...section.findings])
      .join(" ");
    expect(reportText).not.toMatch(/-?\d+\.\d{3,}%?/);
    expect(analysisOutput.dataQualityFlags).toEqual(["currency_inferred_from_symbol"]);
  });

  it("nulls incomplete portfolio-level metrics while preserving safe partial analysis", () => {
    const snapshot = buildBaseSnapshot();
    snapshot.holdings[0] = {
      ...snapshot.holdings[0],
      portfolioWeightPercent: null
    };
    snapshot.holdings[1] = {
      ...snapshot.holdings[1],
      currentPricePerUnit: null,
      marketValueAmount: null,
      unrealizedPnLAmount: null,
      unrealizedPnLPercent: null,
      portfolioWeightPercent: null,
      dataQualityFlags: ["quote_not_found", "market_value_unavailable"]
    };
    snapshot.portfolioTotals = {
      totalCostBasis: "3150.00000000",
      totalMarketValue: "2141.20000000",
      totalUnrealizedPnL: null,
      totalUnrealizedPnLPercent: null,
      holdingCount: 2
    };
    snapshot.dataQualityFlags = [
      "quote_not_found",
      "market_value_unavailable",
      "contains_partial_market_data"
    ];

    const { analysisOutput } = buildAnalysisOutput({
      canonicalSnapshot: snapshot,
      generatedAt
    });

    expect(analysisOutput.summary.totalMarketValue).toBe("2141.20000000");
    expect(analysisOutput.summary.totalUnrealizedPnL).toBeNull();
    expect(analysisOutput.summary.concentrationHhi).toBeNull();
    expect(analysisOutput.summary.largestPositionWeightPercent).toBeNull();

    const riskSection = analysisOutput.sections.find(
      (section) => section.sectionKey === "risk-proxies"
    );
    expect(riskSection?.metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "portfolio-capital-at-risk-minus-20",
          value: null
        }),
        expect.objectContaining({
          key: "largest-loss-share-minus-20",
          value: null
        })
      ])
    );
    expect(riskSection?.dataQualityFlags).toContain("risk_proxy_metrics_incomplete");

    const benchmarkSection = analysisOutput.sections.find(
      (section) => section.sectionKey === "comparative-benchmark-lite"
    );
    expect(benchmarkSection?.metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "equal-weight-benchmark-return-percent",
          value: null
        }),
        expect.objectContaining({
          key: "active-return-vs-benchmark-percent",
          value: null
        })
      ])
    );

    expect(analysisOutput.dataQualityFlags).toEqual([
      "quote_not_found",
      "market_value_unavailable",
      "contains_partial_market_data",
      "concentration_metrics_incomplete",
      "risk_proxy_metrics_incomplete",
      "scenario_metrics_incomplete",
      "benchmark_metrics_incomplete"
    ]);
  });
});
