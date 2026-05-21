import { Prisma } from "@prisma/client";

import {
  analysisOutputSchema,
  type AnalysisMetric,
  type AnalysisOutput,
  type AnalysisSection,
  type CanonicalPortfolioSnapshot
} from "@/server/contracts";
import { CONTRACT_SCHEMA_VERSIONS } from "@/server/shared/constants";
import {
  formatReportCurrency,
  formatReportPercentage,
  formatReportRatio
} from "@/server/shared/report-formatting";

type AnalysisHolding = {
  holdingId: string;
  ticker: string;
  securityName: string | null;
  costBasisAmount: Prisma.Decimal | null;
  marketValueAmount: Prisma.Decimal | null;
  unrealizedPnLAmount: Prisma.Decimal | null;
  unrealizedPnLPercent: Prisma.Decimal | null;
  portfolioWeightPercent: Prisma.Decimal | null;
  averageCostPerUnit: Prisma.Decimal;
  currentPricePerUnit: Prisma.Decimal | null;
  returnContributionPercent: Prisma.Decimal | null;
  costVsValueRatio: Prisma.Decimal | null;
  equalWeightDriftPercentPoints: Prisma.Decimal | null;
  capitalAtRisk20Amount: Prisma.Decimal | null;
  lossShare20Percent: Prisma.Decimal | null;
  portfolioImpact20Percent: Prisma.Decimal | null;
  positionStress30LossAmount: Prisma.Decimal | null;
  positionStress30ImpactPercent: Prisma.Decimal | null;
  breakevenReturnFromTodayPercent: Prisma.Decimal | null;
  dataQualityFlags: string[];
};

export type BuildAnalysisOutputInput = {
  canonicalSnapshot: CanonicalPortfolioSnapshot;
  generatedAt: Date;
};

export type BuildAnalysisOutputResult = {
  analysisOutput: AnalysisOutput;
};

const ZERO = new Prisma.Decimal("0");
const ONE = new Prisma.Decimal("1");
const HUNDRED = new Prisma.Decimal("100");
const NEGATIVE_TWENTY_PERCENT = new Prisma.Decimal("-20");
const NEGATIVE_THIRTY_PERCENT = new Prisma.Decimal("-30");
const STRESS_SCENARIOS = [
  {
    key: "market-shock-minus-10",
    label: "Market shock -10%",
    shockPercent: new Prisma.Decimal("-10")
  },
  {
    key: "market-shock-minus-20",
    label: "Market shock -20%",
    shockPercent: new Prisma.Decimal("-20")
  }
] as const;

function toIsoString(value: Date): string {
  return value.toISOString();
}

function toDecimal(value: string | null | undefined): Prisma.Decimal | null {
  if (!value) {
    return null;
  }

  return new Prisma.Decimal(value);
}

function toDecimalString(value: Prisma.Decimal | null): string | null {
  if (!value) {
    return null;
  }

  return value.toFixed(8);
}

function toDisplayNumber(value: Prisma.Decimal | null): string | null {
  return value ? toDecimalString(value) : null;
}

function displayCurrency(value: Prisma.Decimal | null, currency: string): string {
  return formatReportCurrency(toDisplayNumber(value), currency);
}

function displayPercent(
  value: Prisma.Decimal | null,
  options: { showPositiveSign?: boolean } = {}
): string {
  return formatReportPercentage(toDisplayNumber(value), options);
}

function displayRatio(value: Prisma.Decimal | null): string {
  return formatReportRatio(toDisplayNumber(value));
}

function displayAbsoluteCurrency(value: Prisma.Decimal, currency: string): string {
  return displayCurrency(decimalAbs(value), currency);
}

function buildDrawdownFinding(value: Prisma.Decimal | null, currency: string): string {
  if (value === null) {
    return "Portfolio drawdown exposure cannot be estimated until total market value is available.";
  }

  if (value.isZero()) {
    return "The -20% shock does not change the modeled portfolio value.";
  }

  return `A uniform -20% market shock would reduce the portfolio by about ${displayAbsoluteCurrency(value, currency)}.`;
}

function buildEffectivePositionsFinding(value: Prisma.Decimal | null): string {
  if (value === null) {
    return "Effective position count is unavailable under the current data-quality state.";
  }

  return `Based on current weights, the portfolio behaves like about ${displayRatio(value)} equally sized positions.`;
}

function buildBreakevenFinding(value: Prisma.Decimal | null): string {
  if (value === null) {
    return "Portfolio breakeven distance from today's value is unavailable with the current market-value coverage.";
  }

  if (value.gt(ZERO)) {
    return `The portfolio is below total cost basis; it would need to gain ${displayPercent(value)} from today's value to get back to breakeven.`;
  }

  if (value.lt(ZERO)) {
    return `The portfolio is above total cost basis; it could fall ${displayPercent(decimalAbs(value))} before returning to breakeven.`;
  }

  return "The portfolio is roughly at total cost basis today.";
}

function buildScenarioPnlFinding(
  scenarioLabel: string,
  scenarioPnl: Prisma.Decimal | null,
  currency: string,
  fallback: string
): string {
  if (scenarioPnl === null) {
    return fallback;
  }

  if (scenarioPnl.lt(ZERO)) {
    return `${scenarioLabel} would reduce portfolio value by about ${displayAbsoluteCurrency(scenarioPnl, currency)}.`;
  }

  if (scenarioPnl.gt(ZERO)) {
    return `${scenarioLabel} would increase portfolio value by about ${displayCurrency(scenarioPnl, currency)}.`;
  }

  return `${scenarioLabel} would leave modeled portfolio value unchanged.`;
}

function buildActiveReturnFinding(value: Prisma.Decimal | null): string {
  if (value === null) {
    return "The equal-weight comparison cannot be computed until every holding has a valid return.";
  }

  if (value.gt(ZERO)) {
    return `The current position weights are ahead of the equal-weight version by ${displayPercent(value, { showPositiveSign: true })}.`;
  }

  if (value.lt(ZERO)) {
    return `The current position weights trail the equal-weight version by ${displayPercent(decimalAbs(value))}.`;
  }

  return "The current position weights are in line with the equal-weight version.";
}

function inferReportingCurrency(snapshot: CanonicalPortfolioSnapshot): string {
  return snapshot.holdings[0]?.reportingCurrency ?? snapshot.baseCurrency;
}

function decimalAbs(value: Prisma.Decimal): Prisma.Decimal {
  return value.isNegative() ? value.neg() : value;
}

function dedupeFlags(flags: string[]): string[] {
  return [...new Set(flags)];
}

function compareNullableDescending(
  left: Prisma.Decimal | null,
  right: Prisma.Decimal | null
): number {
  if (left === null && right === null) {
    return 0;
  }

  if (left === null) {
    return 1;
  }

  if (right === null) {
    return -1;
  }

  if (left.gt(right)) {
    return -1;
  }

  if (left.lt(right)) {
    return 1;
  }

  return 0;
}

function formatHoldingLabel(ticker: string, securityName: string | null): string {
  return securityName ? `${ticker} (${securityName})` : ticker;
}

function buildMetric(
  input: Omit<AnalysisMetric, "displayValue" | "emphasis"> &
    Pick<Partial<AnalysisMetric>, "displayValue" | "emphasis">
): AnalysisMetric {
  return {
    ...input
  };
}

function inferPnlEmphasis(value: Prisma.Decimal | null): AnalysisMetric["emphasis"] {
  if (!value) {
    return "neutral";
  }

  if (value.gt(ZERO)) {
    return "positive";
  }

  if (value.lt(ZERO)) {
    return "negative";
  }

  return "neutral";
}

function buildAnalysisHoldings(snapshot: CanonicalPortfolioSnapshot): AnalysisHolding[] {
  const totalCostBasis = toDecimal(snapshot.portfolioTotals.totalCostBasis);
  const totalMarketValue = toDecimal(snapshot.portfolioTotals.totalMarketValue);
  const equalWeightTargetPercent =
    snapshot.holdings.length > 0 ? HUNDRED.div(snapshot.holdings.length) : null;
  const totalLossAtRisk20 =
    totalMarketValue !== null
      ? totalMarketValue.mul(decimalAbs(NEGATIVE_TWENTY_PERCENT)).div(HUNDRED)
      : null;

  return snapshot.holdings.map((holding) => {
    const costBasisAmount = toDecimal(holding.costBasisAmount);
    const marketValueAmount = toDecimal(holding.marketValueAmount);
    const unrealizedPnLAmount = toDecimal(holding.unrealizedPnLAmount);
    const unrealizedPnLPercent = toDecimal(holding.unrealizedPnLPercent);
    const portfolioWeightPercent = toDecimal(holding.portfolioWeightPercent);
    const averageCostPerUnit = new Prisma.Decimal(holding.averageCostPerUnit);
    const currentPricePerUnit = toDecimal(holding.currentPricePerUnit);

    const returnContributionPercent =
      totalCostBasis && !totalCostBasis.isZero() && unrealizedPnLAmount
        ? unrealizedPnLAmount.div(totalCostBasis).mul(HUNDRED)
        : null;

    const costVsValueRatio =
      costBasisAmount && !costBasisAmount.isZero() && marketValueAmount
        ? marketValueAmount.div(costBasisAmount)
        : null;

    const equalWeightDriftPercentPoints =
      equalWeightTargetPercent && portfolioWeightPercent
        ? portfolioWeightPercent.minus(equalWeightTargetPercent)
        : null;

    const capitalAtRisk20Amount =
      marketValueAmount !== null
        ? marketValueAmount.mul(decimalAbs(NEGATIVE_TWENTY_PERCENT)).div(HUNDRED)
        : null;

    const lossShare20Percent =
      capitalAtRisk20Amount && totalLossAtRisk20 && !totalLossAtRisk20.isZero()
        ? capitalAtRisk20Amount.div(totalLossAtRisk20).mul(HUNDRED)
        : null;

    const portfolioImpact20Percent =
      portfolioWeightPercent !== null
        ? portfolioWeightPercent.mul(NEGATIVE_TWENTY_PERCENT).div(HUNDRED)
        : null;

    const positionStress30LossAmount =
      marketValueAmount !== null
        ? marketValueAmount.mul(decimalAbs(NEGATIVE_THIRTY_PERCENT)).div(HUNDRED)
        : null;

    const positionStress30ImpactPercent =
      portfolioWeightPercent !== null
        ? portfolioWeightPercent.mul(NEGATIVE_THIRTY_PERCENT).div(HUNDRED)
        : null;

    const breakevenReturnFromTodayPercent =
      currentPricePerUnit && !currentPricePerUnit.isZero()
        ? averageCostPerUnit.div(currentPricePerUnit).minus(ONE).mul(HUNDRED)
        : null;

    return {
      holdingId: holding.holdingId,
      ticker: holding.ticker,
      securityName: holding.securityName,
      costBasisAmount,
      marketValueAmount,
      unrealizedPnLAmount,
      unrealizedPnLPercent,
      portfolioWeightPercent,
      averageCostPerUnit,
      currentPricePerUnit,
      returnContributionPercent,
      costVsValueRatio,
      equalWeightDriftPercentPoints,
      capitalAtRisk20Amount,
      lossShare20Percent,
      portfolioImpact20Percent,
      positionStress30LossAmount,
      positionStress30ImpactPercent,
      breakevenReturnFromTodayPercent,
      dataQualityFlags: dedupeFlags(holding.dataQualityFlags)
    };
  });
}

function hasCompleteMarketCoverage(holdings: AnalysisHolding[]): boolean {
  return holdings.length > 0 && holdings.every((holding) => holding.marketValueAmount !== null);
}

function buildPerformanceSection(
  snapshot: CanonicalPortfolioSnapshot,
  holdings: AnalysisHolding[]
): AnalysisSection {
  const reportingCurrency = inferReportingCurrency(snapshot);
  const totalCostBasis = snapshot.portfolioTotals.totalCostBasis;
  const totalMarketValue = snapshot.portfolioTotals.totalMarketValue;
  const totalUnrealizedPnL = snapshot.portfolioTotals.totalUnrealizedPnL;
  const totalUnrealizedPnLPercent = snapshot.portfolioTotals.totalUnrealizedPnLPercent;
  const topWinner =
    [...holdings]
      .filter((holding) => holding.unrealizedPnLAmount && holding.unrealizedPnLAmount.gt(ZERO))
      .sort((left, right) =>
        compareNullableDescending(left.unrealizedPnLAmount, right.unrealizedPnLAmount)
      )[0] ?? null;
  const topLoser =
    [...holdings]
      .filter((holding) => holding.unrealizedPnLAmount && holding.unrealizedPnLAmount.lt(ZERO))
      .sort((left, right) =>
        compareNullableDescending(
          left.unrealizedPnLAmount ? decimalAbs(left.unrealizedPnLAmount) : null,
          right.unrealizedPnLAmount ? decimalAbs(right.unrealizedPnLAmount) : null
        )
      )[0] ?? null;

  const findings = [
    totalUnrealizedPnL
      ? `The portfolio's current paper P&L is ${formatReportCurrency(totalUnrealizedPnL, reportingCurrency)}.`
      : "Portfolio-level paper P&L is unavailable because market-value coverage is incomplete.",
    topWinner && topWinner.unrealizedPnLAmount
      ? `${topWinner.ticker} is the strongest paper winner at ${displayCurrency(topWinner.unrealizedPnLAmount, reportingCurrency)}.`
      : "There is no priced winning position to highlight yet.",
    topLoser && topLoser.unrealizedPnLAmount
      ? `${topLoser.ticker} is the largest paper drag at ${displayCurrency(topLoser.unrealizedPnLAmount, reportingCurrency)}.`
      : "There is no priced losing position to highlight right now."
  ];

  return {
    sectionKey: "performance-pnl",
    sectionTitle: "Performance & P&L Analysis",
    order: 1,
    summary: totalUnrealizedPnLPercent
      ? `Portfolio return from cost basis is currently ${formatReportPercentage(totalUnrealizedPnLPercent)}.`
      : "Portfolio-level return is only partially available because not every holding has a usable market value.",
    metrics: [
      buildMetric({
        key: "total-cost-basis",
        label: "Total cost basis",
        value: totalCostBasis,
        unit: "currency"
      }),
      buildMetric({
        key: "total-market-value",
        label: "Total market value",
        value: totalMarketValue,
        unit: "currency"
      }),
      buildMetric({
        key: "total-unrealized-pnl",
        label: "Total unrealized gain/loss",
        value: totalUnrealizedPnL,
        unit: "currency",
        emphasis: inferPnlEmphasis(toDecimal(totalUnrealizedPnL))
      }),
      buildMetric({
        key: "total-unrealized-pnl-percent",
        label: "Portfolio return from cost basis",
        value: totalUnrealizedPnLPercent,
        unit: "percentage",
        emphasis: inferPnlEmphasis(toDecimal(totalUnrealizedPnLPercent))
      })
    ],
    findings,
    tables: [
      {
        tableKey: "performance-by-holding",
        title: "Performance by holding",
        columns: [
          { key: "ticker", label: "Ticker", unit: "text" },
          { key: "costBasis", label: "Cost Basis", unit: "currency" },
          { key: "marketValue", label: "Market Value", unit: "currency" },
          { key: "unrealizedPnL", label: "Unrealized P&L", unit: "currency" },
          { key: "returnContribution", label: "Return Contribution", unit: "percentage" },
          { key: "costVsValueRatio", label: "Cost vs Value Ratio", unit: "ratio" }
        ],
        rows: holdings.map((holding) => ({
          rowKey: holding.holdingId,
          label: holding.ticker,
          cells: [
            {
              columnKey: "ticker",
              value: formatHoldingLabel(holding.ticker, holding.securityName)
            },
            { columnKey: "costBasis", value: toDecimalString(holding.costBasisAmount) },
            { columnKey: "marketValue", value: toDecimalString(holding.marketValueAmount) },
            { columnKey: "unrealizedPnL", value: toDecimalString(holding.unrealizedPnLAmount) },
            {
              columnKey: "returnContribution",
              value: toDecimalString(holding.returnContributionPercent)
            },
            { columnKey: "costVsValueRatio", value: toDecimalString(holding.costVsValueRatio) }
          ]
        }))
      }
    ],
    dataQualityFlags: dedupeFlags(holdings.flatMap((holding) => holding.dataQualityFlags))
  };
}

function buildConcentrationSection(holdings: AnalysisHolding[]): AnalysisSection {
  const weightedHoldings = holdings.filter((holding) => holding.portfolioWeightPercent !== null);
  const completeWeights = weightedHoldings.length === holdings.length && holdings.length > 0;
  const sortedByWeight = [...weightedHoldings].sort((left, right) =>
    compareNullableDescending(left.portfolioWeightPercent, right.portfolioWeightPercent)
  );
  const largestPositionWeightPercent = sortedByWeight[0]?.portfolioWeightPercent ?? null;
  const top3Concentration = completeWeights
    ? sortedByWeight
        .slice(0, 3)
        .reduce((sum, holding) => sum.plus(holding.portfolioWeightPercent ?? ZERO), ZERO)
    : null;
  const top5Concentration = completeWeights
    ? sortedByWeight
        .slice(0, 5)
        .reduce((sum, holding) => sum.plus(holding.portfolioWeightPercent ?? ZERO), ZERO)
    : null;
  const hhi = completeWeights
    ? sortedByWeight.reduce((sum, holding) => {
        const weightRatio = (holding.portfolioWeightPercent ?? ZERO).div(HUNDRED);
        return sum.plus(weightRatio.mul(weightRatio));
      }, ZERO)
    : null;
  const effectivePositions = hhi && !hhi.isZero() ? ONE.div(hhi) : null;
  const totalDriftPercent = completeWeights
    ? sortedByWeight
        .reduce((sum, holding) => {
          return sum.plus(decimalAbs(holding.equalWeightDriftPercentPoints ?? ZERO));
        }, ZERO)
        .div(new Prisma.Decimal("2"))
    : null;

  const findings = [
    largestPositionWeightPercent
      ? `The largest holding represents ${displayPercent(largestPositionWeightPercent)} of total market value.`
      : "Position-weight concentration is unavailable because not every holding has a usable market value.",
    top3Concentration
      ? `The top three holdings account for ${displayPercent(top3Concentration)} of the portfolio.`
      : "Top-holding concentration cannot be measured until all holdings have valid weights.",
    buildEffectivePositionsFinding(effectivePositions)
  ];

  return {
    sectionKey: "allocation-concentration",
    sectionTitle: "Allocation & Concentration Analysis",
    order: 2,
    summary: largestPositionWeightPercent
      ? `Current concentration is led by a ${displayPercent(largestPositionWeightPercent)} largest position.`
      : "Allocation concentration metrics are partially unavailable because portfolio weights are incomplete.",
    metrics: [
      buildMetric({
        key: "largest-position-weight-percent",
        label: "Largest position weight",
        value: toDecimalString(largestPositionWeightPercent),
        unit: "percentage"
      }),
      buildMetric({
        key: "top-3-concentration-percent",
        label: "Top-3 concentration",
        value: toDecimalString(top3Concentration),
        unit: "percentage"
      }),
      buildMetric({
        key: "top-5-concentration-percent",
        label: "Top-5 concentration",
        value: toDecimalString(top5Concentration),
        unit: "percentage"
      }),
      buildMetric({
        key: "herfindahl-index",
        label: "Herfindahl Index (HHI)",
        value: toDecimalString(hhi),
        unit: "ratio"
      }),
      buildMetric({
        key: "effective-number-of-positions",
        label: "Effective number of positions",
        value: toDecimalString(effectivePositions),
        unit: "ratio"
      }),
      buildMetric({
        key: "equal-weight-drift-percent",
        label: "Total drift vs equal-weight",
        value: toDecimalString(totalDriftPercent),
        unit: "percentage"
      })
    ],
    findings,
    tables: [
      {
        tableKey: "position-weights-and-drift",
        title: "Position weights and equal-weight drift",
        columns: [
          { key: "ticker", label: "Ticker", unit: "text" },
          { key: "weight", label: "Position Weight", unit: "percentage" },
          { key: "equalWeightTarget", label: "Equal Weight Target", unit: "percentage" },
          { key: "drift", label: "Drift", unit: "percentage" }
        ],
        rows: holdings.map((holding) => ({
          rowKey: holding.holdingId,
          label: holding.ticker,
          cells: [
            { columnKey: "ticker", value: holding.ticker },
            { columnKey: "weight", value: toDecimalString(holding.portfolioWeightPercent) },
            {
              columnKey: "equalWeightTarget",
              value: holdings.length > 0 ? toDecimalString(HUNDRED.div(holdings.length)) : null
            },
            { columnKey: "drift", value: toDecimalString(holding.equalWeightDriftPercentPoints) }
          ]
        }))
      }
    ],
    dataQualityFlags: completeWeights ? [] : ["concentration_metrics_incomplete"]
  };
}

function buildRiskSection(
  snapshot: CanonicalPortfolioSnapshot,
  holdings: AnalysisHolding[]
): AnalysisSection {
  const reportingCurrency = inferReportingCurrency(snapshot);
  const totalMarketValue = hasCompleteMarketCoverage(holdings)
    ? toDecimal(snapshot.portfolioTotals.totalMarketValue)
    : null;
  const portfolioDrawdownValue =
    totalMarketValue !== null ? totalMarketValue.mul(NEGATIVE_TWENTY_PERCENT).div(HUNDRED) : null;
  const largestCapitalAtRisk =
    [...holdings].sort((left, right) =>
      compareNullableDescending(left.capitalAtRisk20Amount, right.capitalAtRisk20Amount)
    )[0] ?? null;
  const largestLossShare =
    totalMarketValue !== null
      ? ([...holdings].sort((left, right) =>
          compareNullableDescending(left.lossShare20Percent, right.lossShare20Percent)
        )[0] ?? null)
      : null;

  const findings = [
    buildDrawdownFinding(portfolioDrawdownValue, reportingCurrency),
    largestCapitalAtRisk?.capitalAtRisk20Amount
      ? `${largestCapitalAtRisk.ticker} contributes the largest dollar downside under the -20% shock assumption.`
      : "No single-position downside leader can be identified yet.",
    largestLossShare?.lossShare20Percent
      ? `${largestLossShare.ticker} would account for ${displayPercent(largestLossShare.lossShare20Percent)} of modeled downside loss under the uniform shock.`
      : "Loss concentration cannot be calculated until all holdings have market values."
  ];

  return {
    sectionKey: "risk-proxies",
    sectionTitle: "Risk Proxies",
    order: 3,
    summary: portfolioDrawdownValue
      ? `Static downside exposure is modeled using a uniform -20% shock.`
      : "Risk-proxy metrics are partially unavailable because market-value coverage is incomplete.",
    metrics: [
      buildMetric({
        key: "portfolio-capital-at-risk-minus-20",
        label: "Portfolio capital at risk (-20% shock)",
        value: portfolioDrawdownValue ? toDecimalString(decimalAbs(portfolioDrawdownValue)) : null,
        unit: "currency"
      }),
      buildMetric({
        key: "portfolio-drawdown-minus-20",
        label: "Portfolio drawdown (-20% shock)",
        value: toDecimalString(portfolioDrawdownValue),
        unit: "currency",
        emphasis: "cautionary"
      }),
      buildMetric({
        key: "portfolio-drawdown-percent-minus-20",
        label: "Portfolio drawdown % (-20% shock)",
        value: totalMarketValue !== null ? toDecimalString(NEGATIVE_TWENTY_PERCENT) : null,
        unit: "percentage",
        emphasis: "cautionary"
      }),
      buildMetric({
        key: "largest-loss-share-minus-20",
        label: "Largest loss share (-20% shock)",
        value: toDecimalString(largestLossShare?.lossShare20Percent ?? null),
        unit: "percentage"
      })
    ],
    findings,
    tables: [
      {
        tableKey: "capital-at-risk-by-position",
        title: "Capital at risk by position (-20% shock)",
        columns: [
          { key: "ticker", label: "Ticker", unit: "text" },
          { key: "marketValue", label: "Market Value", unit: "currency" },
          { key: "capitalAtRisk", label: "Capital at Risk", unit: "currency" },
          { key: "lossShare", label: "Loss Share", unit: "percentage" },
          { key: "portfolioImpact", label: "Portfolio Impact", unit: "percentage" }
        ],
        rows: holdings.map((holding) => ({
          rowKey: holding.holdingId,
          label: holding.ticker,
          cells: [
            { columnKey: "ticker", value: holding.ticker },
            { columnKey: "marketValue", value: toDecimalString(holding.marketValueAmount) },
            { columnKey: "capitalAtRisk", value: toDecimalString(holding.capitalAtRisk20Amount) },
            { columnKey: "lossShare", value: toDecimalString(holding.lossShare20Percent) },
            {
              columnKey: "portfolioImpact",
              value: toDecimalString(holding.portfolioImpact20Percent)
            }
          ]
        }))
      }
    ],
    dataQualityFlags: totalMarketValue !== null ? [] : ["risk_proxy_metrics_incomplete"]
  };
}

function buildPortfolioHealthSection(
  snapshot: CanonicalPortfolioSnapshot,
  holdings: AnalysisHolding[]
): AnalysisSection {
  const winners = holdings.filter(
    (holding) => holding.unrealizedPnLAmount && holding.unrealizedPnLAmount.gt(ZERO)
  );
  const losers = holdings.filter(
    (holding) => holding.unrealizedPnLAmount && holding.unrealizedPnLAmount.lt(ZERO)
  );
  const winnersWithReturns = winners.filter((holding) => holding.unrealizedPnLPercent !== null);
  const losersWithReturns = losers.filter((holding) => holding.unrealizedPnLPercent !== null);
  const avgGainPercent =
    winnersWithReturns.length > 0
      ? winnersWithReturns
          .reduce((sum, holding) => sum.plus(holding.unrealizedPnLPercent ?? ZERO), ZERO)
          .div(winnersWithReturns.length)
      : null;
  const avgLossPercent =
    losersWithReturns.length > 0
      ? losersWithReturns
          .reduce((sum, holding) => sum.plus(holding.unrealizedPnLPercent ?? ZERO), ZERO)
          .div(losersWithReturns.length)
      : null;
  const winLossRatio =
    losers.length > 0 ? new Prisma.Decimal(winners.length).div(losers.length) : null;
  const totalCostBasis = toDecimal(snapshot.portfolioTotals.totalCostBasis);
  const totalMarketValue = hasCompleteMarketCoverage(holdings)
    ? toDecimal(snapshot.portfolioTotals.totalMarketValue)
    : null;
  const portfolioBreakevenReturnFromToday =
    totalCostBasis && totalMarketValue && !totalMarketValue.isZero()
      ? totalCostBasis.div(totalMarketValue).minus(ONE).mul(HUNDRED)
      : null;
  const topWinner =
    [...winners].sort((left, right) =>
      compareNullableDescending(left.unrealizedPnLPercent, right.unrealizedPnLPercent)
    )[0] ?? null;
  const topLoser =
    [...losers].sort((left, right) =>
      compareNullableDescending(
        left.unrealizedPnLPercent ? decimalAbs(left.unrealizedPnLPercent) : null,
        right.unrealizedPnLPercent ? decimalAbs(right.unrealizedPnLPercent) : null
      )
    )[0] ?? null;

  const findings = [
    `The portfolio currently has ${winners.length} winning holdings and ${losers.length} losing holdings.`,
    avgGainPercent !== null && avgLossPercent !== null
      ? `Average winning return is ${displayPercent(avgGainPercent)} versus ${displayPercent(avgLossPercent)} for average losing return.`
      : "Average winner-versus-loser comparison is incomplete because one side of the distribution is missing.",
    buildBreakevenFinding(portfolioBreakevenReturnFromToday)
  ];

  return {
    sectionKey: "portfolio-health-diagnostics",
    sectionTitle: "Portfolio Health & Diagnostics",
    order: 5,
    summary:
      topWinner && topLoser
        ? `${topWinner.ticker} is the strongest winner while ${topLoser.ticker} is the weakest loser by percentage return.`
        : "Portfolio health diagnostics are available, but some winner/loser comparisons are limited by the current mix of holdings.",
    metrics: [
      buildMetric({
        key: "win-loss-ratio",
        label: "Win/Loss ratio",
        value: toDecimalString(winLossRatio),
        unit: "ratio"
      }),
      buildMetric({
        key: "average-gain-percent",
        label: "Average gain",
        value: toDecimalString(avgGainPercent),
        unit: "percentage",
        emphasis: "positive"
      }),
      buildMetric({
        key: "average-loss-percent",
        label: "Average loss",
        value: toDecimalString(avgLossPercent),
        unit: "percentage",
        emphasis: "negative"
      }),
      buildMetric({
        key: "portfolio-breakeven-return-from-today",
        label: "Portfolio breakeven return from today",
        value: toDecimalString(portfolioBreakevenReturnFromToday),
        unit: "percentage"
      })
    ],
    findings,
    tables: [
      {
        tableKey: "winners-losers-and-breakeven",
        title: "Winners, losers, and breakeven levels",
        columns: [
          { key: "ticker", label: "Ticker", unit: "text" },
          { key: "status", label: "Status", unit: "text" },
          { key: "unrealizedPnLPercent", label: "Return %", unit: "percentage" },
          { key: "breakevenPrice", label: "Breakeven Price", unit: "currency" },
          { key: "currentPrice", label: "Current Price", unit: "currency" },
          { key: "returnToBreakeven", label: "Return to Breakeven", unit: "percentage" }
        ],
        rows: holdings.map((holding) => ({
          rowKey: holding.holdingId,
          label: holding.ticker,
          cells: [
            { columnKey: "ticker", value: holding.ticker },
            {
              columnKey: "status",
              value:
                holding.unrealizedPnLAmount === null
                  ? "unpriced"
                  : holding.unrealizedPnLAmount.gt(ZERO)
                    ? "winner"
                    : holding.unrealizedPnLAmount.lt(ZERO)
                      ? "loser"
                      : "flat"
            },
            {
              columnKey: "unrealizedPnLPercent",
              value: toDecimalString(holding.unrealizedPnLPercent)
            },
            {
              columnKey: "breakevenPrice",
              value: toDecimalString(holding.averageCostPerUnit)
            },
            {
              columnKey: "currentPrice",
              value: toDecimalString(holding.currentPricePerUnit)
            },
            {
              columnKey: "returnToBreakeven",
              value: toDecimalString(holding.breakevenReturnFromTodayPercent)
            }
          ]
        }))
      }
    ],
    dataQualityFlags: dedupeFlags(
      holdings
        .filter((holding) => holding.unrealizedPnLPercent === null)
        .flatMap((holding) => holding.dataQualityFlags)
    )
  };
}

function buildScenarioSection(
  snapshot: CanonicalPortfolioSnapshot,
  holdings: AnalysisHolding[]
): AnalysisSection {
  const reportingCurrency = inferReportingCurrency(snapshot);
  const totalMarketValue = hasCompleteMarketCoverage(holdings)
    ? toDecimal(snapshot.portfolioTotals.totalMarketValue)
    : null;

  const scenarioRows = STRESS_SCENARIOS.map((scenario) => {
    const scenarioPortfolioValue =
      totalMarketValue !== null
        ? totalMarketValue.mul(ONE.plus(scenario.shockPercent.div(HUNDRED)))
        : null;
    const scenarioPnl =
      totalMarketValue !== null && scenarioPortfolioValue !== null
        ? scenarioPortfolioValue.minus(totalMarketValue)
        : null;

    return {
      scenario,
      scenarioPortfolioValue,
      scenarioPnl
    };
  });

  const sortedPositionStress = [...holdings].sort((left, right) =>
    compareNullableDescending(
      left.positionStress30LossAmount ? decimalAbs(left.positionStress30LossAmount) : null,
      right.positionStress30LossAmount ? decimalAbs(right.positionStress30LossAmount) : null
    )
  );
  const topPositionStress = sortedPositionStress[0] ?? null;

  const findings = [
    buildScenarioPnlFinding(
      scenarioRows[0]!.scenario.label,
      scenarioRows[0]!.scenarioPnl,
      reportingCurrency,
      "Scenario portfolio values are unavailable because total market value is incomplete."
    ),
    buildScenarioPnlFinding(
      scenarioRows[1]!.scenario.label,
      scenarioRows[1]!.scenarioPnl,
      reportingCurrency,
      "Deeper downside scenario results are unavailable with the current data coverage."
    ),
    topPositionStress?.positionStress30LossAmount
      ? `${topPositionStress.ticker} has the largest single-name impact under a -30% position stress.`
      : "No position-level stress leader can be identified yet."
  ];

  return {
    sectionKey: "scenario-stress-testing",
    sectionTitle: "Scenario & Stress Testing",
    order: 6,
    summary:
      totalMarketValue !== null
        ? "Static downside scenarios are modeled from current market value without correlation or trading-response assumptions."
        : "Scenario analysis is partially unavailable because portfolio market value is incomplete.",
    metrics: [
      buildMetric({
        key: "scenario-count",
        label: "Scenario count",
        value: scenarioRows.length,
        unit: "count"
      }),
      buildMetric({
        key: "position-stress-shock-percent",
        label: "Position-level stress assumption",
        value: toDecimalString(NEGATIVE_THIRTY_PERCENT),
        unit: "percentage"
      })
    ],
    findings,
    tables: [
      {
        tableKey: "market-shock-scenarios",
        title: "Market shock scenarios",
        columns: [
          { key: "scenario", label: "Scenario", unit: "text" },
          { key: "shockPercent", label: "Shock %", unit: "percentage" },
          { key: "portfolioValue", label: "Scenario Portfolio Value", unit: "currency" },
          { key: "scenarioPnl", label: "Scenario P&L", unit: "currency" }
        ],
        rows: scenarioRows.map(({ scenario, scenarioPortfolioValue, scenarioPnl }) => ({
          rowKey: scenario.key,
          label: scenario.label,
          cells: [
            { columnKey: "scenario", value: scenario.label },
            { columnKey: "shockPercent", value: toDecimalString(scenario.shockPercent) },
            { columnKey: "portfolioValue", value: toDecimalString(scenarioPortfolioValue) },
            { columnKey: "scenarioPnl", value: toDecimalString(scenarioPnl) }
          ]
        }))
      },
      {
        tableKey: "position-level-stress",
        title: "Position-level stress (-30% single-name shock)",
        columns: [
          { key: "ticker", label: "Ticker", unit: "text" },
          { key: "stressLoss", label: "Stress Loss", unit: "currency" },
          { key: "portfolioImpact", label: "Portfolio Impact", unit: "percentage" }
        ],
        rows: sortedPositionStress.map((holding) => ({
          rowKey: holding.holdingId,
          label: holding.ticker,
          cells: [
            { columnKey: "ticker", value: holding.ticker },
            {
              columnKey: "stressLoss",
              value: toDecimalString(holding.positionStress30LossAmount)
            },
            {
              columnKey: "portfolioImpact",
              value: toDecimalString(holding.positionStress30ImpactPercent)
            }
          ]
        }))
      }
    ],
    dataQualityFlags: totalMarketValue !== null ? [] : ["scenario_metrics_incomplete"]
  };
}

function buildBenchmarkSection(
  snapshot: CanonicalPortfolioSnapshot,
  holdings: AnalysisHolding[]
): AnalysisSection {
  const actualPortfolioReturnPercent = toDecimal(
    snapshot.portfolioTotals.totalUnrealizedPnLPercent
  );
  const returnsAvailable = holdings.every((holding) => holding.unrealizedPnLPercent !== null);
  const equalWeightBenchmarkReturnPercent =
    returnsAvailable && holdings.length > 0
      ? holdings
          .reduce((sum, holding) => sum.plus(holding.unrealizedPnLPercent ?? ZERO), ZERO)
          .div(holdings.length)
      : null;
  const activeReturnPercent =
    actualPortfolioReturnPercent !== null && equalWeightBenchmarkReturnPercent !== null
      ? actualPortfolioReturnPercent.minus(equalWeightBenchmarkReturnPercent)
      : null;

  const findings = [
    actualPortfolioReturnPercent !== null
      ? `Actual portfolio return is ${displayPercent(actualPortfolioReturnPercent)} from cost basis.`
      : "Actual portfolio return is incomplete because total portfolio return is unavailable.",
    equalWeightBenchmarkReturnPercent !== null
      ? `The equal-weight version of the same holdings returned ${displayPercent(equalWeightBenchmarkReturnPercent)}.`
      : "Equal-weight benchmark return is unavailable because not every holding has a valid return.",
    buildActiveReturnFinding(activeReturnPercent)
  ];

  return {
    sectionKey: "comparative-benchmark-lite",
    sectionTitle: "Comparative & Benchmark-lite Analysis",
    order: 7,
    summary:
      activeReturnPercent !== null
        ? "The internal benchmark compares current portfolio return with an equal-weight version of the same holdings."
        : "Internal benchmark comparison is only available when every holding has a valid return.",
    metrics: [
      buildMetric({
        key: "actual-portfolio-return-percent",
        label: "Actual portfolio return",
        value: toDecimalString(actualPortfolioReturnPercent),
        unit: "percentage"
      }),
      buildMetric({
        key: "equal-weight-benchmark-return-percent",
        label: "Equal-weight internal benchmark return",
        value: toDecimalString(equalWeightBenchmarkReturnPercent),
        unit: "percentage"
      }),
      buildMetric({
        key: "active-return-vs-benchmark-percent",
        label: "Active return vs benchmark",
        value: toDecimalString(activeReturnPercent),
        unit: "percentage",
        emphasis: inferPnlEmphasis(activeReturnPercent)
      })
    ],
    findings,
    tables: [
      {
        tableKey: "equal-weight-benchmark-components",
        title: "Equal-weight internal benchmark",
        columns: [
          { key: "ticker", label: "Ticker", unit: "text" },
          { key: "positionReturn", label: "Position Return", unit: "percentage" },
          { key: "equalWeight", label: "Equal Weight", unit: "percentage" },
          { key: "equalWeightContribution", label: "Equal-Weight Contribution", unit: "percentage" }
        ],
        rows: holdings.map((holding) => {
          const equalWeightPercent = holdings.length > 0 ? HUNDRED.div(holdings.length) : null;
          const equalWeightContribution =
            holding.unrealizedPnLPercent !== null && equalWeightPercent !== null
              ? holding.unrealizedPnLPercent.mul(equalWeightPercent).div(HUNDRED)
              : null;

          return {
            rowKey: holding.holdingId,
            label: holding.ticker,
            cells: [
              { columnKey: "ticker", value: holding.ticker },
              {
                columnKey: "positionReturn",
                value: toDecimalString(holding.unrealizedPnLPercent)
              },
              {
                columnKey: "equalWeight",
                value: equalWeightPercent ? toDecimalString(equalWeightPercent) : null
              },
              {
                columnKey: "equalWeightContribution",
                value: toDecimalString(equalWeightContribution)
              }
            ]
          };
        })
      }
    ],
    dataQualityFlags:
      equalWeightBenchmarkReturnPercent !== null ? [] : ["benchmark_metrics_incomplete"]
  };
}

function buildMethodologyNotes(): string[] {
  return [
    "All monetary metrics are expressed in the report run reporting currency.",
    "Portfolio-level market-based metrics remain null when incomplete market data would make them misleading.",
    "The internal benchmark for Phase 1 is an equal-weight version of the current holdings set.",
    "Static stress tests apply instantaneous shocks and do not model taxes, slippage, or portfolio rebalancing."
  ];
}

export function buildAnalysisOutput(input: BuildAnalysisOutputInput): BuildAnalysisOutputResult {
  const snapshot = input.canonicalSnapshot;
  const holdings = buildAnalysisHoldings(snapshot);
  const gainersCount = holdings.filter(
    (holding) => holding.unrealizedPnLAmount && holding.unrealizedPnLAmount.gt(ZERO)
  ).length;
  const losersCount = holdings.filter(
    (holding) => holding.unrealizedPnLAmount && holding.unrealizedPnLAmount.lt(ZERO)
  ).length;
  const largestPositionWeightPercent = holdings.reduce<Prisma.Decimal | null>(
    (maxWeight, holding) => {
      if (holding.portfolioWeightPercent === null) {
        return maxWeight;
      }

      if (maxWeight === null || holding.portfolioWeightPercent.gt(maxWeight)) {
        return holding.portfolioWeightPercent;
      }

      return maxWeight;
    },
    null
  );
  const concentrationHhi =
    holdings.every((holding) => holding.portfolioWeightPercent !== null) && holdings.length > 0
      ? holdings.reduce((sum, holding) => {
          const weightRatio = (holding.portfolioWeightPercent ?? ZERO).div(HUNDRED);
          return sum.plus(weightRatio.mul(weightRatio));
        }, ZERO)
      : null;

  const sections: AnalysisSection[] = [
    buildPerformanceSection(snapshot, holdings),
    buildConcentrationSection(holdings),
    buildRiskSection(snapshot, holdings),
    buildPortfolioHealthSection(snapshot, holdings),
    buildScenarioSection(snapshot, holdings),
    buildBenchmarkSection(snapshot, holdings)
  ];

  const analysisOutput = analysisOutputSchema.parse({
    schemaVersion: CONTRACT_SCHEMA_VERSIONS.analysis,
    generatedAt: toIsoString(input.generatedAt),
    runId: snapshot.runId,
    summary: {
      totalMarketValue: snapshot.portfolioTotals.totalMarketValue,
      totalCostBasis: snapshot.portfolioTotals.totalCostBasis,
      totalUnrealizedPnL: snapshot.portfolioTotals.totalUnrealizedPnL,
      totalUnrealizedPnLPercent: snapshot.portfolioTotals.totalUnrealizedPnLPercent,
      holdingCount: snapshot.portfolioTotals.holdingCount,
      gainersCount,
      losersCount,
      concentrationHhi: toDecimalString(concentrationHhi),
      largestPositionWeightPercent: toDecimalString(largestPositionWeightPercent)
    },
    sections,
    methodologyNotes: buildMethodologyNotes(),
    dataQualityFlags: dedupeFlags([
      ...snapshot.dataQualityFlags,
      ...sections.flatMap((section) => section.dataQualityFlags)
    ])
  });

  return {
    analysisOutput
  };
}
