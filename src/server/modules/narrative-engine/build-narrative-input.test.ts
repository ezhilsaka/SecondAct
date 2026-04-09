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
});
