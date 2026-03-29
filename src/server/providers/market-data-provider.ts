import type { GetMarketDataInput, GetMarketDataResult } from "@/server/contracts";

/**
 * Swappable provider boundary for quote, security metadata, and FX enrichment.
 */
export interface MarketDataProvider {
  readonly providerName: string;
  getSecurities(input: GetMarketDataInput): Promise<GetMarketDataResult>;
}
