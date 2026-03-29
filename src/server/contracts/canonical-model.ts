import { z } from "zod";

import { CONTRACT_SCHEMA_VERSIONS } from "@/server/shared/constants";
import {
  assetClassSchema,
  dataQualityFlagSchema,
  decimalStringSchema,
  isoTimestampStringSchema,
  nonEmptyStringSchema,
  nullableDecimalStringSchema,
  nullableNonEmptyStringSchema,
  supportedCurrencySchema,
  uuidSchema
} from "@/server/shared/types";

/**
 * Deterministic portfolio totals derived from normalized holdings plus market data.
 */
export const canonicalPortfolioTotalsSchema = z.object({
  totalCostBasis: nullableDecimalStringSchema,
  totalMarketValue: nullableDecimalStringSchema,
  totalUnrealizedPnL: nullableDecimalStringSchema,
  totalUnrealizedPnLPercent: nullableDecimalStringSchema,
  holdingCount: z.number().int().nonnegative()
});

/**
 * Canonical per-holding snapshot consumed by the analysis engine.
 */
export const canonicalHoldingSnapshotSchema = z.object({
  holdingId: uuidSchema,
  ticker: nonEmptyStringSchema,
  securityName: nullableNonEmptyStringSchema,
  assetClass: assetClassSchema,
  securityCurrency: supportedCurrencySchema,
  reportingCurrency: supportedCurrencySchema,
  quantity: decimalStringSchema,
  averageCostPerUnit: decimalStringSchema,
  currentPricePerUnit: nullableDecimalStringSchema,
  fxRateToReportingCurrency: nullableDecimalStringSchema,
  costBasisAmount: nullableDecimalStringSchema,
  marketValueAmount: nullableDecimalStringSchema,
  unrealizedPnLAmount: nullableDecimalStringSchema,
  unrealizedPnLPercent: nullableDecimalStringSchema,
  portfolioWeightPercent: nullableDecimalStringSchema,
  marketDataAsOf: isoTimestampStringSchema.nullable(),
  exchange: nullableNonEmptyStringSchema.optional(),
  sector: nullableNonEmptyStringSchema.optional(),
  industry: nullableNonEmptyStringSchema.optional(),
  country: nullableNonEmptyStringSchema.optional(),
  dataQualityFlags: z.array(dataQualityFlagSchema).default([])
});

/**
 * Source-of-truth snapshot passed from orchestration into deterministic analysis.
 */
export const canonicalPortfolioSnapshotSchema = z.object({
  schemaVersion: z.literal(CONTRACT_SCHEMA_VERSIONS.canonicalModel),
  generatedAt: isoTimestampStringSchema,
  runId: uuidSchema,
  userId: uuidSchema,
  portfolioId: uuidSchema,
  portfolioName: nonEmptyStringSchema,
  portfolioDescription: nullableNonEmptyStringSchema,
  baseCurrency: supportedCurrencySchema,
  holdings: z.array(canonicalHoldingSnapshotSchema),
  portfolioTotals: canonicalPortfolioTotalsSchema,
  dataQualityFlags: z.array(dataQualityFlagSchema).default([])
});

export type CanonicalPortfolioTotals = z.infer<typeof canonicalPortfolioTotalsSchema>;
export type CanonicalHoldingSnapshot = z.infer<typeof canonicalHoldingSnapshotSchema>;
export type CanonicalPortfolioSnapshot = z.infer<typeof canonicalPortfolioSnapshotSchema>;
