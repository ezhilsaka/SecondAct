import assert from "node:assert/strict";

import {
  CONTRACT_SCHEMA_VERSIONS,
  REPORT_DISCLAIMER_TEXT,
  REPORT_DISCLAIMER_VERSION
} from "@/server/shared/constants";
import {
  analysisOutputSchema,
  canonicalPortfolioSnapshotSchema,
  generateNarrativeInputSchema,
  getMarketDataInputSchema,
  getMarketDataResultSchema,
  narrativeOutputSchema,
  renderPdfResultSchema,
  reportDocumentSchema
} from "@/server/contracts";

const runId = "22222222-2222-4222-8222-222222222222";
const userId = "11111111-1111-4111-8111-111111111111";
const portfolioId = "33333333-3333-4333-8333-333333333333";
const holdingAId = "44444444-4444-4444-8444-444444444444";
const holdingBId = "55555555-5555-4555-8555-555555555555";
const now = "2026-03-29T14:00:00.000Z";
const valuationAsOf = "2026-03-28T20:00:00.000Z";

const taxonomySectionKeys = [
  "section-1",
  "section-2",
  "section-3",
  "section-4",
  "section-5",
  "section-6",
  "section-7"
] as const;

function main() {
  const marketDataInput = getMarketDataInputSchema.parse({
    tickers: ["AAPL", "SHOP.TO"],
    reportingCurrency: "USD"
  });

  const marketDataResult = getMarketDataResultSchema.parse({
    schemaVersion: CONTRACT_SCHEMA_VERSIONS.marketData,
    provider: "yfinance",
    requestedAt: now,
    reportingCurrency: "USD",
    securities: [
      {
        ticker: "AAPL",
        securityName: "Apple Inc.",
        assetClass: "EQUITY",
        securityCurrency: "USD",
        reportingCurrency: "USD",
        currentPrice: "214.12000000",
        fxRateToReportingCurrency: "1",
        quoteTimestamp: valuationAsOf,
        exchange: "NASDAQ",
        sector: "Technology",
        industry: "Consumer Electronics",
        country: "United States",
        marketCap: "3120000000000",
        previousClose: "213.50000000",
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
        quoteTimestamp: valuationAsOf,
        exchange: "TSX",
        sector: "Technology",
        industry: "Software - Application",
        country: "Canada",
        marketCap: "150000000000",
        previousClose: "116.01000000",
        dataQualityFlags: ["delayed_quote"]
      }
    ]
  });

  const canonicalSnapshot = canonicalPortfolioSnapshotSchema.parse({
    schemaVersion: CONTRACT_SCHEMA_VERSIONS.canonicalModel,
    generatedAt: now,
    runId,
    userId,
    portfolioId,
    portfolioName: "Phase 1 Demo Portfolio",
    portfolioDescription: "Seeded portfolio for report pipeline validation.",
    baseCurrency: "USD",
    holdings: [
      {
        holdingId: holdingAId,
        ticker: "AAPL",
        securityName: "Apple Inc.",
        assetClass: "EQUITY",
        securityCurrency: "USD",
        reportingCurrency: "USD",
        quantity: "10.0000000000",
        averageCostPerUnit: "180.00000000",
        currentPricePerUnit: "214.12000000",
        fxRateToReportingCurrency: "1",
        costBasisAmount: "1800.00000000",
        marketValueAmount: "2141.20000000",
        unrealizedPnLAmount: "341.20000000",
        unrealizedPnLPercent: "18.95555556",
        portfolioWeightPercent: "76.82487310",
        marketDataAsOf: valuationAsOf,
        exchange: "NASDAQ",
        sector: "Technology",
        industry: "Consumer Electronics",
        country: "United States",
        dataQualityFlags: []
      },
      {
        holdingId: holdingBId,
        ticker: "SHOP.TO",
        securityName: "Shopify Inc.",
        assetClass: "EQUITY",
        securityCurrency: "CAD",
        reportingCurrency: "USD",
        quantity: "15.0000000000",
        averageCostPerUnit: "90.00000000",
        currentPricePerUnit: "117.42000000",
        fxRateToReportingCurrency: "0.72000000",
        costBasisAmount: "972.00000000",
        marketValueAmount: "1268.13600000",
        unrealizedPnLAmount: "296.13600000",
        unrealizedPnLPercent: "30.46666667",
        portfolioWeightPercent: "45.05305159",
        marketDataAsOf: valuationAsOf,
        exchange: "TSX",
        sector: "Technology",
        industry: "Software - Application",
        country: "Canada",
        dataQualityFlags: ["delayed_quote"]
      }
    ],
    portfolioTotals: {
      totalCostBasis: "2772.00000000",
      totalMarketValue: "3409.33600000",
      totalUnrealizedPnL: "637.33600000",
      totalUnrealizedPnLPercent: "22.99264069",
      holdingCount: 2
    },
    dataQualityFlags: ["contains_delayed_quotes"]
  });

  const analysisOutput = analysisOutputSchema.parse({
    schemaVersion: CONTRACT_SCHEMA_VERSIONS.analysis,
    generatedAt: now,
    runId,
    summary: {
      totalMarketValue: canonicalSnapshot.portfolioTotals.totalMarketValue,
      totalCostBasis: canonicalSnapshot.portfolioTotals.totalCostBasis,
      totalUnrealizedPnL: canonicalSnapshot.portfolioTotals.totalUnrealizedPnL,
      totalUnrealizedPnLPercent: canonicalSnapshot.portfolioTotals.totalUnrealizedPnLPercent,
      holdingCount: canonicalSnapshot.portfolioTotals.holdingCount,
      gainersCount: 2,
      losersCount: 0,
      concentrationHhi: "0.79343290",
      largestPositionWeightPercent: "76.82487310"
    },
    sections: taxonomySectionKeys.map((sectionKey, index) => ({
      sectionKey,
      sectionTitle: `Section ${index + 1}`,
      order: index,
      summary: `Summary for ${sectionKey}`,
      metrics: [
        {
          key: `${sectionKey}-market-value`,
          label: "Market value",
          value: canonicalSnapshot.portfolioTotals.totalMarketValue,
          unit: "currency",
          displayValue: "$3,409.34",
          emphasis: "neutral"
        },
        {
          key: `${sectionKey}-holding-count`,
          label: "Holding count",
          value: canonicalSnapshot.portfolioTotals.holdingCount,
          unit: "count"
        }
      ],
      findings: [`Finding for ${sectionKey}`],
      tables: [
        {
          tableKey: `${sectionKey}-holdings`,
          title: `Supporting table ${index + 1}`,
          columns: [
            { key: "ticker", label: "Ticker", unit: "text" },
            { key: "marketValue", label: "Market Value", unit: "currency" }
          ],
          rows: canonicalSnapshot.holdings.map((holding) => ({
            rowKey: holding.holdingId,
            label: holding.ticker,
            cells: [
              { columnKey: "ticker", value: holding.ticker },
              {
                columnKey: "marketValue",
                value: holding.marketValueAmount,
                displayValue: holding.marketValueAmount
              }
            ]
          }))
        }
      ],
      dataQualityFlags: index === 1 ? ["contains_delayed_quotes"] : []
    })),
    methodologyNotes: ["All monetary values are normalized into the portfolio base currency."],
    dataQualityFlags: canonicalSnapshot.dataQualityFlags
  });

  const narrativeInput = generateNarrativeInputSchema.parse({
    schemaVersion: CONTRACT_SCHEMA_VERSIONS.narrative,
    generatedAt: now,
    context: {
      runId,
      userId,
      portfolioId,
      reportingCurrency: "USD",
      valuationAsOf,
      marketDataProvider: marketDataResult.provider,
      promptVersion: "prompt.v1"
    },
    canonicalSnapshot,
    analysis: analysisOutput
  });

  const narrativeOutput = narrativeOutputSchema.parse({
    schemaVersion: CONTRACT_SCHEMA_VERSIONS.narrative,
    generatedAt: now,
    provider: "openai-compatible",
    model: "local-mistral",
    executiveSummary:
      "The sample portfolio remains concentrated in two technology holdings but currently shows a positive unrealized gain.",
    sections: analysisOutput.sections.map((section) => ({
      sectionKey: section.sectionKey,
      sectionTitle: section.sectionTitle,
      body: `Narrative for ${section.sectionTitle}`,
      emphasis: section.sectionKey === "section-6" ? "cautionary" : "neutral"
    })),
    keyTakeaways: ["The portfolio is positive overall.", "Concentration remains elevated."],
    cautionaryNotes: ["Delayed quotes should be refreshed before final delivery."],
    dataQualityFlags: analysisOutput.dataQualityFlags
  });

  const reportDocument = reportDocumentSchema.parse({
    schemaVersion: CONTRACT_SCHEMA_VERSIONS.report,
    generatedAt: now,
    metadata: {
      runId,
      userId,
      portfolioId,
      requestedAt: now,
      generatedAt: now,
      valuationAsOf,
      reportingCurrency: "USD",
      marketDataProvider: marketDataResult.provider,
      narrativeProvider: narrativeOutput.provider,
      narrativeModel: narrativeOutput.model,
      canonicalSchemaVersion: canonicalSnapshot.schemaVersion,
      analysisSchemaVersion: analysisOutput.schemaVersion,
      narrativeSchemaVersion: narrativeOutput.schemaVersion,
      promptVersion: narrativeInput.context.promptVersion
    },
    portfolio: {
      name: canonicalSnapshot.portfolioName,
      description: canonicalSnapshot.portfolioDescription,
      reportingCurrency: canonicalSnapshot.baseCurrency
    },
    canonicalSnapshot,
    analysis: analysisOutput,
    narrative: narrativeOutput,
    compliance: {
      advisoryClassification: "NOT_INVESTMENT_ADVICE",
      disclaimerVersion: REPORT_DISCLAIMER_VERSION,
      disclaimerText: REPORT_DISCLAIMER_TEXT
    }
  });

  const renderPdfResult = renderPdfResultSchema.parse({
    filePath: "/tmp/report.pdf",
    mimeType: "application/pdf",
    byteSize: 128000,
    checksumSha256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
  });

  assert.equal(narrativeOutput.sections.length, analysisOutput.sections.length);
  assert.deepEqual(
    narrativeOutput.sections.map((section) => section.sectionKey),
    analysisOutput.sections.map((section) => section.sectionKey)
  );
  assert.equal(reportDocument.metadata.marketDataProvider, marketDataResult.provider);
  assert.equal(renderPdfResult.mimeType, "application/pdf");

  console.log(
    JSON.stringify(
      {
        ok: true,
        tickersValidated: marketDataInput.tickers.length,
        analysisSectionsValidated: analysisOutput.sections.length,
        narrativeSectionsValidated: narrativeOutput.sections.length,
        reportSchemaVersion: reportDocument.schemaVersion
      },
      null,
      2
    )
  );
}

main();
