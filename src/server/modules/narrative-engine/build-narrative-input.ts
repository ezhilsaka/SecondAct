import type {
  AnalysisMetric,
  AnalysisOutput,
  CanonicalPortfolioSnapshot,
  GenerateNarrativeInput,
  NarrativeMetricInput
} from "@/server/contracts";
import { generateNarrativeInputSchema } from "@/server/contracts";
import { formatReportValue } from "@/server/shared/report-formatting";

type BuildNarrativeInputContext = {
  runId: string;
  portfolioId: string;
  reportingCurrency: "USD" | "CAD";
  valuationAsOf: string | null;
  marketDataProvider: string;
  promptVersion: string;
};

export type BuildNarrativeInputInput = {
  generatedAt: Date;
  canonicalSnapshot: CanonicalPortfolioSnapshot;
  analysisOutput: AnalysisOutput;
  context: BuildNarrativeInputContext;
};

function toIsoString(value: Date): string {
  return value.toISOString();
}

function inferFormattedValue(
  metric: AnalysisMetric,
  reportingCurrency: "USD" | "CAD"
): string | null | undefined {
  if (metric.displayValue && (metric.unit === "text" || metric.unit === undefined)) {
    return metric.displayValue;
  }

  if (metric.value === null || metric.value === undefined) {
    return null;
  }

  return formatReportValue(metric.value, metric.unit, { currency: reportingCurrency });
}

function inferValueType(metric: AnalysisMetric): NarrativeMetricInput["valueType"] {
  switch (metric.unit) {
    case "currency":
    case "percentage":
    case "count":
    case "ratio":
    case "text":
      return metric.unit;
    default:
      return "text";
  }
}

function inferDirectionHint(metricKey: string): string | undefined {
  const mapping: Record<string, string> = {
    "total-unrealized-pnl": "higher_can_be_better",
    "total-unrealized-pnl-percent": "higher_can_be_better",
    "largest-position-weight-percent": "very_high_can_be_risky",
    "top-3-concentration-percent": "very_high_can_be_risky",
    "top-5-concentration-percent": "very_high_can_be_risky",
    "herfindahl-index": "higher_can_be_more_concentrated",
    "equal-weight-drift-percent": "very_high_can_be_less_balanced",
    "portfolio-capital-at-risk-minus-20": "very_high_can_be_risky",
    "portfolio-drawdown-minus-20": "around_zero_is_better",
    "portfolio-drawdown-percent-minus-20": "around_zero_is_better",
    "largest-loss-share-minus-20": "very_high_can_be_risky",
    "win-loss-ratio": "higher_can_be_better",
    "average-gain-percent": "higher_can_be_better",
    "average-loss-percent": "less_negative_can_be_better",
    "portfolio-breakeven-return-from-today": "around_zero_is_better",
    "actual-portfolio-return-percent": "higher_can_be_better",
    "equal-weight-benchmark-return-percent": "higher_can_be_better",
    "active-return-vs-benchmark-percent": "higher_can_be_better"
  };

  return mapping[metricKey];
}

function inferInterpretationHint(metricKey: string): string | undefined {
  const mapping: Record<string, string> = {
    "total-unrealized-pnl":
      "This reflects paper profit or loss relative to what the investor originally put in.",
    "total-unrealized-pnl-percent":
      "This shows how far above or below cost basis the portfolio currently sits.",
    "largest-position-weight-percent":
      "Higher values usually mean one holding can move the whole portfolio more strongly.",
    "top-3-concentration-percent":
      "Higher values usually mean the portfolio relies heavily on a few positions.",
    "top-5-concentration-percent": "Higher values usually mean the portfolio is less diversified.",
    "herfindahl-index": "Higher values indicate more concentration and less diversification.",
    "effective-number-of-positions":
      "Lower values suggest the portfolio behaves like it owns fewer meaningful positions.",
    "equal-weight-drift-percent":
      "Higher values suggest the portfolio has drifted away from a balanced equal-weight shape.",
    "portfolio-capital-at-risk-minus-20":
      "This estimates how much value could be exposed in a broad market drop scenario.",
    "portfolio-drawdown-minus-20":
      "This shows the expected paper loss under a portfolio-wide shock scenario.",
    "portfolio-drawdown-percent-minus-20":
      "This shows the expected percentage loss under a broad portfolio shock.",
    "largest-loss-share-minus-20":
      "Higher values mean one position would drive a larger share of the total downside.",
    "win-loss-ratio": "This compares how many positions are currently ahead versus behind.",
    "average-gain-percent": "This shows how large the typical winning position is.",
    "average-loss-percent": "This shows how large the typical losing position is.",
    "portfolio-breakeven-return-from-today":
      "This shows how far the portfolio would need to move from today to get back to average cost.",
    "scenario-count": "This tells the investor how many stress cases were reviewed.",
    "position-stress-shock-percent":
      "This is the single-position stress assumption used in the scenario table.",
    "actual-portfolio-return-percent":
      "This is the portfolio's actual return using the current position sizes.",
    "equal-weight-benchmark-return-percent":
      "This is a simpler equal-weight internal benchmark using the same holdings.",
    "active-return-vs-benchmark-percent":
      "This shows whether the current weighting choices helped or hurt relative to equal weight."
  };

  return mapping[metricKey];
}

function buildMetricContext(metric: AnalysisMetric, sectionTitle: string) {
  return {
    section_title: sectionTitle
  };
}

function mapMetric(
  metric: AnalysisMetric,
  reportingCurrency: "USD" | "CAD",
  sectionDataQualityFlags: string[],
  sectionTitle: string
): NarrativeMetricInput {
  return {
    name: metric.key,
    displayName: metric.label,
    rawValue: metric.value,
    formattedValue: inferFormattedValue(metric, reportingCurrency),
    valueType: inferValueType(metric),
    directionHint: inferDirectionHint(metric.key),
    interpretationHint: inferInterpretationHint(metric.key),
    context: buildMetricContext(metric, sectionTitle),
    dataQualityFlags: sectionDataQualityFlags
  };
}

export function buildNarrativeInput(input: BuildNarrativeInputInput): GenerateNarrativeInput {
  return generateNarrativeInputSchema.parse({
    schemaVersion: "narrative.v1",
    generatedAt: toIsoString(input.generatedAt),
    context: input.context,
    portfolio: {
      name: input.canonicalSnapshot.portfolioName,
      reportingCurrency: input.context.reportingCurrency,
      totalValueFormatted: input.analysisOutput.summary.totalMarketValue
        ? formatReportValue(input.analysisOutput.summary.totalMarketValue, "currency", {
            currency: input.context.reportingCurrency
          })
        : null
    },
    sections: input.analysisOutput.sections.map((section) => ({
      sectionKey: section.sectionKey,
      sectionTitle: section.sectionTitle,
      sectionContext: {
        deterministic_summary: section.summary ?? null,
        findings: section.findings
      },
      metrics: section.metrics.map((metric) =>
        mapMetric(
          metric,
          input.context.reportingCurrency,
          section.dataQualityFlags,
          section.sectionTitle
        )
      )
    })),
    globalDataQualityFlags: input.analysisOutput.dataQualityFlags
  });
}
