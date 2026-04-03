import {
  Prisma,
  type AssetClassType,
  type SupportedCurrency as PrismaSupportedCurrency
} from "@prisma/client";

import {
  canonicalPortfolioSnapshotSchema,
  type CanonicalPortfolioSnapshot,
  type GetMarketDataResult,
  type MarketSecuritySnapshot
} from "@/server/contracts";
import { CONTRACT_SCHEMA_VERSIONS } from "@/server/shared/constants";

type SourceHolding = {
  id: string;
  ticker: string;
  securityName: string | null;
  assetClass: AssetClassType;
  securityCurrency: PrismaSupportedCurrency;
  quantity: Prisma.Decimal;
  averageCost: Prisma.Decimal;
};

export type BuildCanonicalSnapshotInput = {
  reportRunId: string;
  userId: string;
  portfolioId: string;
  portfolioName: string;
  portfolioDescription: string | null;
  portfolioBaseCurrency: PrismaSupportedCurrency;
  reportingCurrency: PrismaSupportedCurrency;
  generatedAt: Date;
  holdings: SourceHolding[];
  marketData: GetMarketDataResult;
};

export type BuildCanonicalSnapshotResult = {
  snapshot: CanonicalPortfolioSnapshot;
  valuationAsOf: string | null;
  hasPricedHoldings: boolean;
};

const DECIMAL_SCALE = 8;
const QUANTITY_SCALE = 10;
const ONE = new Prisma.Decimal("1");
const ZERO = new Prisma.Decimal("0");
const HUNDRED = new Prisma.Decimal("100");

function toIsoString(value: Date): string {
  return value.toISOString();
}

function toDecimalString(value: Prisma.Decimal, scale = DECIMAL_SCALE): string {
  return value.toFixed(scale);
}

function appendFlag(flags: string[], flag: string) {
  if (!flags.includes(flag)) {
    flags.push(flag);
  }
}

function dedupeFlags(flags: string[]): string[] {
  return [...new Set(flags)];
}

function latestIsoTimestamp(current: string | null, candidate: string | null): string | null {
  if (!candidate) {
    return current;
  }

  if (!current) {
    return candidate;
  }

  return new Date(candidate).getTime() > new Date(current).getTime() ? candidate : current;
}

function findSecuritySnapshot(
  marketDataByTicker: Map<string, MarketSecuritySnapshot>,
  ticker: string
): MarketSecuritySnapshot | null {
  return marketDataByTicker.get(ticker) ?? null;
}

export function buildCanonicalSnapshot(
  input: BuildCanonicalSnapshotInput
): BuildCanonicalSnapshotResult {
  const generatedAt = toIsoString(input.generatedAt);
  const marketDataByTicker = new Map(
    input.marketData.securities.map((security) => [security.ticker, security] as const)
  );

  const rawHoldingSnapshots = input.holdings.map((holding) => {
    const security = findSecuritySnapshot(marketDataByTicker, holding.ticker);
    const dataQualityFlags = [...(security?.dataQualityFlags ?? [])];

    if (!security) {
      appendFlag(dataQualityFlags, "market_data_missing");
    }

    if (security && security.securityCurrency !== holding.securityCurrency) {
      appendFlag(dataQualityFlags, "security_currency_mismatch_with_provider");
    }

    const reportingCurrency = input.reportingCurrency;
    const securityCurrency = security?.securityCurrency ?? holding.securityCurrency;
    const fxRate =
      security?.fxRateToReportingCurrency ??
      (securityCurrency === reportingCurrency ? toDecimalString(ONE) : null);
    const currentPrice = security?.currentPrice ?? null;

    const quantity = new Prisma.Decimal(holding.quantity);
    const averageCost = new Prisma.Decimal(holding.averageCost);
    const costBasisAmount = quantity.mul(averageCost);

    let marketValueAmount: Prisma.Decimal | null = null;
    let unrealizedPnLAmount: Prisma.Decimal | null = null;
    let unrealizedPnLPercent: Prisma.Decimal | null = null;

    if (currentPrice && fxRate) {
      marketValueAmount = quantity
        .mul(new Prisma.Decimal(currentPrice))
        .mul(new Prisma.Decimal(fxRate));
      unrealizedPnLAmount = marketValueAmount.minus(costBasisAmount);

      if (!costBasisAmount.isZero()) {
        unrealizedPnLPercent = unrealizedPnLAmount.div(costBasisAmount).mul(HUNDRED);
      } else {
        appendFlag(dataQualityFlags, "zero_cost_basis");
      }
    } else {
      appendFlag(dataQualityFlags, "market_value_unavailable");
    }

    return {
      holdingId: holding.id,
      ticker: holding.ticker,
      securityName: security?.securityName ?? holding.securityName ?? null,
      assetClass: holding.assetClass,
      securityCurrency,
      reportingCurrency,
      quantity,
      averageCostPerUnit: averageCost,
      currentPricePerUnit: currentPrice,
      fxRateToReportingCurrency: fxRate,
      costBasisAmount,
      marketValueAmount,
      unrealizedPnLAmount,
      unrealizedPnLPercent,
      marketDataAsOf: security?.quoteTimestamp ?? null,
      exchange: security?.exchange ?? undefined,
      sector: security?.sector ?? undefined,
      industry: security?.industry ?? undefined,
      country: security?.country ?? undefined,
      dataQualityFlags: dedupeFlags(dataQualityFlags)
    };
  });

  const totalCostBasis = rawHoldingSnapshots.reduce(
    (sum, holding) => sum.plus(holding.costBasisAmount),
    ZERO
  );
  const pricedHoldings = rawHoldingSnapshots.filter(
    (holding) => holding.marketValueAmount !== null
  );
  const hasPricedHoldings = pricedHoldings.length > 0;
  const hasPartialMarketData = pricedHoldings.length !== rawHoldingSnapshots.length;
  const totalMarketValue = hasPricedHoldings
    ? pricedHoldings.reduce((sum, holding) => sum.plus(holding.marketValueAmount ?? ZERO), ZERO)
    : null;
  const hasCompleteMarketData = rawHoldingSnapshots.length > 0 && !hasPartialMarketData;
  const totalUnrealizedPnL =
    hasCompleteMarketData && totalMarketValue ? totalMarketValue.minus(totalCostBasis) : null;
  const totalUnrealizedPnLPercent =
    hasCompleteMarketData && totalMarketValue && !totalCostBasis.isZero()
      ? (totalUnrealizedPnL?.div(totalCostBasis).mul(HUNDRED) ?? null)
      : null;

  let valuationAsOf: string | null = null;
  const snapshotFlags = rawHoldingSnapshots.flatMap((holding) => holding.dataQualityFlags);

  if (hasPartialMarketData) {
    appendFlag(snapshotFlags, "contains_partial_market_data");
  }

  if (!hasPricedHoldings) {
    appendFlag(snapshotFlags, "no_priced_holdings");
  }

  if (input.portfolioBaseCurrency !== input.reportingCurrency) {
    appendFlag(snapshotFlags, "reporting_currency_differs_from_portfolio_base_currency");
  }

  if (input.marketData.reportingCurrency !== input.reportingCurrency) {
    appendFlag(snapshotFlags, "reporting_currency_mismatch_with_adapter");
  }

  const holdings = rawHoldingSnapshots.map((holding) => {
    valuationAsOf = latestIsoTimestamp(valuationAsOf, holding.marketDataAsOf);

    const portfolioWeightPercent =
      hasCompleteMarketData &&
      totalMarketValue &&
      !totalMarketValue.isZero() &&
      holding.marketValueAmount
        ? holding.marketValueAmount.div(totalMarketValue).mul(HUNDRED)
        : null;

    return {
      holdingId: holding.holdingId,
      ticker: holding.ticker,
      securityName: holding.securityName,
      assetClass: holding.assetClass,
      securityCurrency: holding.securityCurrency,
      reportingCurrency: holding.reportingCurrency,
      quantity: holding.quantity.toFixed(QUANTITY_SCALE),
      averageCostPerUnit: toDecimalString(holding.averageCostPerUnit),
      currentPricePerUnit: holding.currentPricePerUnit,
      fxRateToReportingCurrency: holding.fxRateToReportingCurrency,
      costBasisAmount: toDecimalString(holding.costBasisAmount),
      marketValueAmount: holding.marketValueAmount
        ? toDecimalString(holding.marketValueAmount)
        : null,
      unrealizedPnLAmount: holding.unrealizedPnLAmount
        ? toDecimalString(holding.unrealizedPnLAmount)
        : null,
      unrealizedPnLPercent: holding.unrealizedPnLPercent
        ? toDecimalString(holding.unrealizedPnLPercent)
        : null,
      portfolioWeightPercent: portfolioWeightPercent
        ? toDecimalString(portfolioWeightPercent)
        : null,
      marketDataAsOf: holding.marketDataAsOf,
      exchange: holding.exchange,
      sector: holding.sector,
      industry: holding.industry,
      country: holding.country,
      dataQualityFlags: holding.dataQualityFlags
    };
  });

  const snapshot = canonicalPortfolioSnapshotSchema.parse({
    schemaVersion: CONTRACT_SCHEMA_VERSIONS.canonicalModel,
    generatedAt,
    runId: input.reportRunId,
    userId: input.userId,
    portfolioId: input.portfolioId,
    portfolioName: input.portfolioName,
    portfolioDescription: input.portfolioDescription,
    baseCurrency: input.reportingCurrency,
    holdings,
    portfolioTotals: {
      totalCostBasis: toDecimalString(totalCostBasis),
      totalMarketValue: totalMarketValue ? toDecimalString(totalMarketValue) : null,
      totalUnrealizedPnL: totalUnrealizedPnL ? toDecimalString(totalUnrealizedPnL) : null,
      totalUnrealizedPnLPercent: totalUnrealizedPnLPercent
        ? toDecimalString(totalUnrealizedPnLPercent)
        : null,
      holdingCount: input.holdings.length
    },
    dataQualityFlags: dedupeFlags(snapshotFlags)
  });

  return {
    snapshot,
    valuationAsOf,
    hasPricedHoldings
  };
}
