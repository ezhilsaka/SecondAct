import { Prisma, type PrismaClient, type ReportRunStatus } from "@prisma/client";
import { ZodError } from "zod";

import { prisma } from "@/db/prisma/client";
import {
  analysisOutputSchema,
  canonicalPortfolioSnapshotSchema,
  type AnalysisOutput,
  type CanonicalPortfolioSnapshot,
  type NarrativeOutput
} from "@/server/contracts";
import { createOpenAICompatibleNarrativeProvider } from "@/server/providers/openai-compatible-narrative-provider";
import type { NarrativeProvider } from "@/server/providers/narrative-provider";
import { NARRATIVE_EXPLAINER_PROMPT_VERSION } from "@/server/shared/constants";

import { buildNarrativeInput } from "./build-narrative-input";

type ReportRunWithNarrativeInputs = Prisma.ReportRunGetPayload<{
  select: {
    id: true;
    userId: true;
    portfolioId: true;
    reportingCurrency: true;
    status: true;
    promptVersion: true;
    marketDataProvider: true;
    valuationAsOf: true;
    canonicalSnapshot: true;
    analysisOutput: true;
  };
}>;

export class NarrativeReportRunNotFoundError extends Error {
  override name = "NarrativeReportRunNotFoundError";
}

export class NarrativeInputError extends Error {
  override name = "NarrativeInputError";
}

export type PersistNarrativeOutputInput = {
  reportRunId: string;
  narrativeOutput: NarrativeOutput;
  promptVersion: string;
};

export interface NarrativeEngineRepository {
  getReportRunWithInputs(reportRunId: string): Promise<ReportRunWithNarrativeInputs | null>;
  persistNarrativeOutput(input: PersistNarrativeOutputInput): Promise<void>;
}

export class PrismaNarrativeEngineRepository implements NarrativeEngineRepository {
  constructor(private readonly prismaClient: PrismaClient = prisma) {}

  async getReportRunWithInputs(reportRunId: string) {
    // This repository is currently used by internal worker-style flows. If a
    // user-facing route reuses it later, ownership must be enforced before the
    // repository is called.
    return this.prismaClient.reportRun.findUnique({
      where: {
        id: reportRunId
      },
      select: {
        id: true,
        userId: true,
        portfolioId: true,
        reportingCurrency: true,
        status: true,
        promptVersion: true,
        marketDataProvider: true,
        valuationAsOf: true,
        canonicalSnapshot: true,
        analysisOutput: true
      }
    });
  }

  async persistNarrativeOutput(input: PersistNarrativeOutputInput) {
    const narrativeOutputJson = JSON.parse(
      JSON.stringify(input.narrativeOutput)
    ) as Prisma.InputJsonValue;

    await this.prismaClient.reportRun.update({
      where: {
        id: input.reportRunId
      },
      data: {
        narrativeOutput: narrativeOutputJson,
        narrativeProvider: input.narrativeOutput.provider,
        narrativeModel: input.narrativeOutput.model,
        promptVersion: input.promptVersion
      }
    });
  }
}

export type NarrativeEngineServiceDependencies = {
  repository?: NarrativeEngineRepository;
  narrativeProvider?: NarrativeProvider;
  now?: () => Date;
};

export type NarrativeEngineBuildResult = {
  narrativeOutput: NarrativeOutput;
  status: ReportRunStatus;
};

function parseCanonicalSnapshot(input: Prisma.JsonValue | null): CanonicalPortfolioSnapshot {
  if (!input) {
    throw new NarrativeInputError(
      "Cannot build narrative output because the report run does not have a persisted canonical snapshot yet."
    );
  }

  try {
    return canonicalPortfolioSnapshotSchema.parse(input);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new NarrativeInputError(
        "Cannot build narrative output because the persisted canonical snapshot is invalid."
      );
    }

    throw error;
  }
}

function parseAnalysisOutput(input: Prisma.JsonValue | null): AnalysisOutput {
  if (!input) {
    throw new NarrativeInputError(
      "Cannot build narrative output because the report run does not have a persisted analysis output yet."
    );
  }

  try {
    return analysisOutputSchema.parse(input);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new NarrativeInputError(
        "Cannot build narrative output because the persisted analysis output is invalid."
      );
    }

    throw error;
  }
}

export class NarrativeEngineService {
  private readonly repository: NarrativeEngineRepository;
  private readonly narrativeProvider: NarrativeProvider;
  private readonly now: () => Date;

  constructor(dependencies: NarrativeEngineServiceDependencies = {}) {
    this.repository = dependencies.repository ?? new PrismaNarrativeEngineRepository();
    this.narrativeProvider =
      dependencies.narrativeProvider ?? createOpenAICompatibleNarrativeProvider();
    this.now = dependencies.now ?? (() => new Date());
  }

  async buildForReportRun(reportRunId: string): Promise<NarrativeEngineBuildResult> {
    const reportRun = await this.repository.getReportRunWithInputs(reportRunId);

    if (!reportRun) {
      throw new NarrativeReportRunNotFoundError(`Report run ${reportRunId} was not found.`);
    }

    if (!reportRun.marketDataProvider) {
      throw new NarrativeInputError(
        "Cannot build narrative output because the report run does not have a persisted market-data provider yet."
      );
    }

    const canonicalSnapshot = parseCanonicalSnapshot(reportRun.canonicalSnapshot);
    const analysisOutput = parseAnalysisOutput(reportRun.analysisOutput);
    const generatedAt = this.now();
    const narrativeInput = buildNarrativeInput({
      generatedAt,
      canonicalSnapshot,
      analysisOutput,
      context: {
        runId: reportRun.id,
        portfolioId: reportRun.portfolioId,
        reportingCurrency: reportRun.reportingCurrency,
        valuationAsOf: reportRun.valuationAsOf?.toISOString() ?? null,
        marketDataProvider: reportRun.marketDataProvider,
        promptVersion: NARRATIVE_EXPLAINER_PROMPT_VERSION
      }
    });
    const narrativeOutput = await this.narrativeProvider.generateNarrative(narrativeInput);

    await this.repository.persistNarrativeOutput({
      reportRunId: reportRun.id,
      narrativeOutput,
      promptVersion: NARRATIVE_EXPLAINER_PROMPT_VERSION
    });

    return {
      narrativeOutput,
      status: reportRun.status
    };
  }
}
