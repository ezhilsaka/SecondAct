import { describe, expect, it, vi } from "vitest";

import { buildContractFixturePayloads } from "@/server/contracts/fixtures";
import type { NarrativeProvider } from "@/server/providers/narrative-provider";
import { NARRATIVE_EXPLAINER_PROMPT_VERSION } from "@/server/shared/constants";

import {
  NarrativeEngineService,
  NarrativeInputError,
  NarrativeReportRunNotFoundError,
  type NarrativeEngineRepository
} from "./narrative-engine-service";

type ReportRunRecord = NonNullable<
  Awaited<ReturnType<NarrativeEngineRepository["getReportRunWithInputs"]>>
>;

function buildReportRunRecord(): ReportRunRecord {
  const { canonicalSnapshot, analysisOutput } = buildContractFixturePayloads();

  return {
    id: canonicalSnapshot.runId,
    userId: canonicalSnapshot.userId,
    portfolioId: canonicalSnapshot.portfolioId,
    reportingCurrency: "USD",
    status: "QUEUED",
    promptVersion: null,
    marketDataProvider: "yfinance",
    valuationAsOf: new Date("2026-03-28T20:00:00.000Z"),
    canonicalSnapshot,
    analysisOutput
  };
}

describe("NarrativeEngineService", () => {
  it("loads persisted inputs, generates narrative output, and saves it", async () => {
    const reportRun = buildReportRunRecord();
    const { narrativeOutput } = buildContractFixturePayloads();
    const repository: NarrativeEngineRepository = {
      getReportRunWithInputs: vi.fn().mockResolvedValue(reportRun),
      persistNarrativeOutput: vi.fn().mockResolvedValue(undefined)
    };
    const narrativeProvider: NarrativeProvider = {
      providerName: "openai-compatible",
      generateNarrative: vi.fn().mockResolvedValue(narrativeOutput)
    };
    const service = new NarrativeEngineService({
      repository,
      narrativeProvider,
      now: () => new Date("2026-04-06T12:30:00.000Z")
    });

    const result = await service.buildForReportRun(reportRun.id);

    expect(narrativeProvider.generateNarrative).toHaveBeenCalledWith(
      expect.objectContaining({
        schemaVersion: "narrative.v1",
        context: expect.objectContaining({
          runId: reportRun.id,
          promptVersion: NARRATIVE_EXPLAINER_PROMPT_VERSION
        })
      })
    );
    expect(repository.persistNarrativeOutput).toHaveBeenCalledWith({
      reportRunId: reportRun.id,
      narrativeOutput,
      promptVersion: NARRATIVE_EXPLAINER_PROMPT_VERSION
    });
    expect(result.narrativeOutput.sections).toHaveLength(narrativeOutput.sections.length);
    expect(result.status).toBe("QUEUED");
  });

  it("fails when the report run does not exist", async () => {
    const repository: NarrativeEngineRepository = {
      getReportRunWithInputs: vi.fn().mockResolvedValue(null),
      persistNarrativeOutput: vi.fn().mockResolvedValue(undefined)
    };
    const narrativeProvider: NarrativeProvider = {
      providerName: "openai-compatible",
      generateNarrative: vi.fn()
    };
    const service = new NarrativeEngineService({ repository, narrativeProvider });

    await expect(service.buildForReportRun("missing-run-id")).rejects.toBeInstanceOf(
      NarrativeReportRunNotFoundError
    );
    expect(narrativeProvider.generateNarrative).not.toHaveBeenCalled();
  });

  it("fails when the report run does not have a persisted canonical snapshot", async () => {
    const reportRun = buildReportRunRecord();
    reportRun.canonicalSnapshot = null;
    const repository: NarrativeEngineRepository = {
      getReportRunWithInputs: vi.fn().mockResolvedValue(reportRun),
      persistNarrativeOutput: vi.fn().mockResolvedValue(undefined)
    };
    const narrativeProvider: NarrativeProvider = {
      providerName: "openai-compatible",
      generateNarrative: vi.fn()
    };
    const service = new NarrativeEngineService({ repository, narrativeProvider });

    await expect(service.buildForReportRun(reportRun.id)).rejects.toBeInstanceOf(
      NarrativeInputError
    );
    expect(narrativeProvider.generateNarrative).not.toHaveBeenCalled();
  });

  it("fails when the report run does not have a persisted analysis output", async () => {
    const reportRun = buildReportRunRecord();
    reportRun.analysisOutput = null;
    const repository: NarrativeEngineRepository = {
      getReportRunWithInputs: vi.fn().mockResolvedValue(reportRun),
      persistNarrativeOutput: vi.fn().mockResolvedValue(undefined)
    };
    const narrativeProvider: NarrativeProvider = {
      providerName: "openai-compatible",
      generateNarrative: vi.fn()
    };
    const service = new NarrativeEngineService({ repository, narrativeProvider });

    await expect(service.buildForReportRun(reportRun.id)).rejects.toBeInstanceOf(
      NarrativeInputError
    );
    expect(narrativeProvider.generateNarrative).not.toHaveBeenCalled();
  });

  it("fails when the report run is missing the market-data provider metadata", async () => {
    const reportRun = buildReportRunRecord();
    reportRun.marketDataProvider = null;
    const repository: NarrativeEngineRepository = {
      getReportRunWithInputs: vi.fn().mockResolvedValue(reportRun),
      persistNarrativeOutput: vi.fn().mockResolvedValue(undefined)
    };
    const narrativeProvider: NarrativeProvider = {
      providerName: "openai-compatible",
      generateNarrative: vi.fn()
    };
    const service = new NarrativeEngineService({ repository, narrativeProvider });

    await expect(service.buildForReportRun(reportRun.id)).rejects.toBeInstanceOf(
      NarrativeInputError
    );
    expect(narrativeProvider.generateNarrative).not.toHaveBeenCalled();
  });
});
