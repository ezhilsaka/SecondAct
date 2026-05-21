import { describe, expect, it } from "vitest";

import { buildContractFixturePayloads } from "@/server/contracts/fixtures";
import { NARRATIVE_EXPLAINER_PROMPT_VERSION } from "@/server/shared/constants";

import { buildNarrativeInput } from "./build-narrative-input";

describe("buildNarrativeInput", () => {
  it("preserves section and metric order while attaching prompt-ready fields", () => {
    const { canonicalSnapshot, analysisOutput } = buildContractFixturePayloads();

    const result = buildNarrativeInput({
      generatedAt: new Date("2026-04-06T12:00:00.000Z"),
      canonicalSnapshot,
      analysisOutput,
      context: {
        runId: canonicalSnapshot.runId,
        portfolioId: canonicalSnapshot.portfolioId,
        reportingCurrency: "USD",
        valuationAsOf: "2026-03-28T20:00:00.000Z",
        marketDataProvider: "yfinance",
        promptVersion: NARRATIVE_EXPLAINER_PROMPT_VERSION
      }
    });

    expect(result.context.promptVersion).toBe(NARRATIVE_EXPLAINER_PROMPT_VERSION);
    expect(result.portfolio.totalValueFormatted).toBe("USD 3,409.34");
    expect(result.sections.map((section) => section.sectionKey)).toEqual(
      analysisOutput.sections.map((section) => section.sectionKey)
    );
    expect(result.sections[0]?.metrics.map((metric) => metric.name)).toEqual(
      analysisOutput.sections[0]?.metrics.map((metric) => metric.key)
    );
    expect(result.sections[0]?.metrics[0]?.formattedValue).toBe("USD 3,409.34");
    expect(result.sections[0]?.metrics[1]?.formattedValue).toBe("2");
  });

  it("uses centralized display formatting for prompt values", () => {
    const { canonicalSnapshot, analysisOutput } = buildContractFixturePayloads();
    analysisOutput.sections[0]!.metrics = [
      {
        key: "large-raw-currency",
        label: "Large raw currency",
        value: "1196.15374975",
        unit: "currency",
        displayValue: "1196.15374975"
      },
      {
        key: "raw-percentage",
        label: "Raw percentage",
        value: "37.40171975",
        unit: "percentage",
        displayValue: "37.40171975"
      },
      {
        key: "raw-ratio",
        label: "Raw ratio",
        value: "0.64694640",
        unit: "ratio",
        displayValue: "0.64694640"
      }
    ];

    const result = buildNarrativeInput({
      generatedAt: new Date("2026-04-06T12:00:00.000Z"),
      canonicalSnapshot,
      analysisOutput,
      context: {
        runId: canonicalSnapshot.runId,
        portfolioId: canonicalSnapshot.portfolioId,
        reportingCurrency: "USD",
        valuationAsOf: "2026-03-28T20:00:00.000Z",
        marketDataProvider: "yfinance",
        promptVersion: NARRATIVE_EXPLAINER_PROMPT_VERSION
      }
    });

    expect(result.sections[0]?.metrics.map((metric) => metric.formattedValue)).toEqual([
      "USD 1,196.15",
      "37.4%",
      "0.65"
    ]);
  });

  it("passes section and global data-quality flags through to the prompt payload", () => {
    const { canonicalSnapshot, analysisOutput } = buildContractFixturePayloads();

    const result = buildNarrativeInput({
      generatedAt: new Date("2026-04-06T12:00:00.000Z"),
      canonicalSnapshot,
      analysisOutput,
      context: {
        runId: canonicalSnapshot.runId,
        portfolioId: canonicalSnapshot.portfolioId,
        reportingCurrency: "USD",
        valuationAsOf: "2026-03-28T20:00:00.000Z",
        marketDataProvider: "yfinance",
        promptVersion: NARRATIVE_EXPLAINER_PROMPT_VERSION
      }
    });

    expect(result.globalDataQualityFlags).toEqual(analysisOutput.dataQualityFlags);
    expect(result.sections[1]?.metrics[0]?.dataQualityFlags).toEqual(["contains_delayed_quotes"]);
    expect(result.sections[1]?.sectionContext).toEqual({
      deterministic_summary: analysisOutput.sections[1]?.summary ?? null,
      findings: analysisOutput.sections[1]?.findings ?? []
    });
  });

  it("adds metric-specific interpretation hints for awkward wording cases", () => {
    const { canonicalSnapshot, analysisOutput } = buildContractFixturePayloads();
    analysisOutput.sections[0]!.metrics = [
      {
        key: "herfindahl-index",
        label: "Concentration score",
        value: "0.64694640",
        unit: "ratio"
      },
      {
        key: "effective-number-of-positions",
        label: "Effective number of positions",
        value: "1.54572311",
        unit: "ratio"
      },
      {
        key: "portfolio-breakeven-return-from-today",
        label: "Return needed to breakeven",
        value: "-27.22345678",
        unit: "percentage"
      },
      {
        key: "active-return-vs-benchmark-percent",
        label: "Difference vs equal weight",
        value: "1.78711111",
        unit: "percentage"
      }
    ];

    const result = buildNarrativeInput({
      generatedAt: new Date("2026-04-06T12:00:00.000Z"),
      canonicalSnapshot,
      analysisOutput,
      context: {
        runId: canonicalSnapshot.runId,
        portfolioId: canonicalSnapshot.portfolioId,
        reportingCurrency: "USD",
        valuationAsOf: "2026-03-28T20:00:00.000Z",
        marketDataProvider: "yfinance",
        promptVersion: NARRATIVE_EXPLAINER_PROMPT_VERSION
      }
    });

    const hints = result.sections[0]?.metrics.map((metric) => metric.interpretationHint);

    expect(hints?.[0]).toContain("concentration score");
    expect(hints?.[0]).toContain("not an x-multiple");
    expect(hints?.[1]).toContain("equally sized positions");
    expect(hints?.[2]).toContain("If negative");
    expect(hints?.[2]).toContain("could fall");
    expect(hints?.[3]).toContain("equal-weight version of the same holdings");
  });
});
