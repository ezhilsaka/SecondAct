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
  supportedCurrencySchema
} from "@/server/shared/types";

/**
 * Market data request boundary shared by provider adapters.
 */
export const getMarketDataInputSchema = z.object({
  tickers: z.array(nonEmptyStringSchema).min(1),
  reportingCurrency: supportedCurrencySchema
});

/**
 * Provider-normalized market snapshot for a single security.
 */
export const marketSecuritySnapshotSchema = z.object({
  ticker: nonEmptyStringSchema,
  securityName: nullableNonEmptyStringSchema,
  assetClass: assetClassSchema,
  securityCurrency: supportedCurrencySchema,
  reportingCurrency: supportedCurrencySchema,
  currentPrice: nullableDecimalStringSchema,
  fxRateToReportingCurrency: nullableDecimalStringSchema,
  quoteTimestamp: isoTimestampStringSchema.nullable(),
  dataQualityFlags: z.array(dataQualityFlagSchema).default([]),
  exchange: nullableNonEmptyStringSchema.optional(),
  sector: nullableNonEmptyStringSchema.optional(),
  industry: nullableNonEmptyStringSchema.optional(),
  country: nullableNonEmptyStringSchema.optional(),
  marketCap: decimalStringSchema.nullable().optional(),
  previousClose: decimalStringSchema.nullable().optional()
});

/**
 * Provider response after normalizing external market data into the app contract.
 */
export const getMarketDataResultSchema = z.object({
  schemaVersion: z.literal(CONTRACT_SCHEMA_VERSIONS.marketData),
  provider: nonEmptyStringSchema,
  requestedAt: isoTimestampStringSchema,
  reportingCurrency: supportedCurrencySchema,
  securities: z.array(marketSecuritySnapshotSchema)
});

export type GetMarketDataInput = z.infer<typeof getMarketDataInputSchema>;
export type MarketSecuritySnapshot = z.infer<typeof marketSecuritySnapshotSchema>;
export type GetMarketDataResult = z.infer<typeof getMarketDataResultSchema>;
