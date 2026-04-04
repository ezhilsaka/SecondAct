import { Prisma, type PrismaClient, type ReportRunStatus } from "@prisma/client";
import { ZodError } from "zod";

import { prisma } from "@/db/prisma/client";
import {
  canonicalPortfolioSnapshotSchema,
  type AnalysisOutput,
  type CanonicalPortfolioSnapshot
} from "@/server/contracts";

import { buildAnalysisOutput } from "./build-analysis-output";

type ReportRunWithCanonicalSnapshot = Prisma.ReportRunGetPayload<{
  select: {
    id: true;
    status: true;
    canonicalSnapshot: true;
    analysisOutput: true;
  };
}>;

export class AnalysisReportRunNotFoundError extends Error {
  override name = "AnalysisReportRunNotFoundError";
}

export class AnalysisInputError extends Error {
  override name = "AnalysisInputError";
}

export type PersistAnalysisOutputInput = {
  reportRunId: string;
  analysisOutput: AnalysisOutput;
};

export interface AnalysisEngineRepository {
  getReportRunWithCanonicalSnapshot(
    reportRunId: string
  ): Promise<ReportRunWithCanonicalSnapshot | null>;
  persistAnalysisOutput(input: PersistAnalysisOutputInput): Promise<void>;
}

export class PrismaAnalysisEngineRepository implements AnalysisEngineRepository {
  constructor(private readonly prismaClient: PrismaClient = prisma) {}

  async getReportRunWithCanonicalSnapshot(reportRunId: string) {
    // This repository is currently used by internal worker-style flows. If a
    // user-facing route reuses it later, ownership must be enforced before the
    // repository is called.
    return this.prismaClient.reportRun.findUnique({
      where: {
        id: reportRunId
      },
      select: {
        id: true,
        status: true,
        canonicalSnapshot: true,
        analysisOutput: true
      }
    });
  }

  async persistAnalysisOutput(input: PersistAnalysisOutputInput) {
    const analysisOutputJson = JSON.parse(
      JSON.stringify(input.analysisOutput)
    ) as Prisma.InputJsonValue;

    await this.prismaClient.reportRun.update({
      where: {
        id: input.reportRunId
      },
      data: {
        analysisOutput: analysisOutputJson
      }
    });
  }
}

export type AnalysisEngineServiceDependencies = {
  repository?: AnalysisEngineRepository;
  now?: () => Date;
};

export type AnalysisEngineBuildResult = {
  analysisOutput: AnalysisOutput;
  status: ReportRunStatus;
};

function parseCanonicalSnapshot(input: Prisma.JsonValue | null): CanonicalPortfolioSnapshot {
  if (!input) {
    throw new AnalysisInputError(
      "Cannot build analysis output because the report run does not have a persisted canonical snapshot yet."
    );
  }

  try {
    return canonicalPortfolioSnapshotSchema.parse(input);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new AnalysisInputError(
        "Cannot build analysis output because the persisted canonical snapshot is invalid."
      );
    }

    throw error;
  }
}

export class AnalysisEngineService {
  private readonly repository: AnalysisEngineRepository;
  private readonly now: () => Date;

  constructor(dependencies: AnalysisEngineServiceDependencies = {}) {
    this.repository = dependencies.repository ?? new PrismaAnalysisEngineRepository();
    this.now = dependencies.now ?? (() => new Date());
  }

  async buildForReportRun(reportRunId: string): Promise<AnalysisEngineBuildResult> {
    const reportRun = await this.repository.getReportRunWithCanonicalSnapshot(reportRunId);

    if (!reportRun) {
      throw new AnalysisReportRunNotFoundError(`Report run ${reportRunId} was not found.`);
    }

    const canonicalSnapshot = parseCanonicalSnapshot(reportRun.canonicalSnapshot);
    const { analysisOutput } = buildAnalysisOutput({
      canonicalSnapshot,
      generatedAt: this.now()
    });

    await this.repository.persistAnalysisOutput({
      reportRunId: reportRun.id,
      analysisOutput
    });

    return {
      analysisOutput,
      status: reportRun.status
    };
  }
}
