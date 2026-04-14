import { Prisma, type PrismaClient } from "@prisma/client";

import { prisma } from "@/db/prisma/client";
import type { RenderPdfResult } from "@/server/contracts";
import { CanonicalModelService } from "@/server/modules/canonical-model/canonical-model-service";
import { AnalysisEngineService } from "@/server/modules/analysis-engine/analysis-engine-service";
import { NarrativeEngineService } from "@/server/modules/narrative-engine/narrative-engine-service";
import { ArtifactStorageService } from "@/server/modules/artifact-storage/artifact-storage-service";
import { PlaywrightPdfRenderer } from "@/server/renderers/playwright-pdf-renderer";
import type { PdfRenderer } from "@/server/renderers/pdf-renderer";

import { buildReportDocument, type ReportRunForDocumentAssembly } from "./build-report-document";

// ---------------------------------------------------------------------------
// Error codes
// ---------------------------------------------------------------------------

export const ORCHESTRATOR_ERROR_CODES = {
  CANONICAL_FAILURE: "CANONICAL_FAILURE",
  ANALYSIS_FAILURE: "ANALYSIS_FAILURE",
  NARRATIVE_FAILURE: "NARRATIVE_FAILURE",
  RENDER_FAILURE: "RENDER_FAILURE",
  STORAGE_FAILURE: "STORAGE_FAILURE",
  ORCHESTRATION_FAILURE: "ORCHESTRATION_FAILURE"
} as const;

export type OrchestratorErrorCode =
  (typeof ORCHESTRATOR_ERROR_CODES)[keyof typeof ORCHESTRATOR_ERROR_CODES];

// ---------------------------------------------------------------------------
// Error classes
// ---------------------------------------------------------------------------

export class ReportRunNotQueuedError extends Error {
  override name = "ReportRunNotQueuedError";
}

export class OrchestratorReportRunNotFoundError extends Error {
  override name = "OrchestratorReportRunNotFoundError";
}

// ---------------------------------------------------------------------------
// Domain event types (Phase 1: structured logs only)
// ---------------------------------------------------------------------------

export type ReportCompletedEvent = {
  event: "report.completed";
  runId: string;
  userId: string;
  portfolioId: string;
  artifactId: string;
};

export type ReportFailedEvent = {
  event: "report.failed";
  runId: string;
  userId: string;
  errorCode: string;
  errorMessage: string;
};

// ---------------------------------------------------------------------------
// Repository interface
// ---------------------------------------------------------------------------

type ReportRunForStatusCheck = {
  id: string;
  userId: string;
  portfolioId: string;
  status: string;
};

export type FailRunInput = {
  reportRunId: string;
  errorCode: string;
  errorDetails: Prisma.InputJsonValue;
  failedAt: Date;
};

export interface OrchestratorRepository {
  getReportRunForProcessing(reportRunId: string): Promise<ReportRunForStatusCheck | null>;
  transitionToProcessing(reportRunId: string, startedAt: Date): Promise<void>;
  loadCompletedRunData(reportRunId: string): Promise<ReportRunForDocumentAssembly | null>;
  completeRunAndIncrementUsage(
    reportRunId: string,
    userId: string,
    completedAt: Date
  ): Promise<void>;
  failRun(input: FailRunInput): Promise<void>;
}

// ---------------------------------------------------------------------------
// Prisma repository implementation
// ---------------------------------------------------------------------------

export class PrismaOrchestratorRepository implements OrchestratorRepository {
  constructor(private readonly prismaClient: PrismaClient = prisma) {}

  async getReportRunForProcessing(reportRunId: string) {
    return this.prismaClient.reportRun.findUnique({
      where: { id: reportRunId },
      select: {
        id: true,
        userId: true,
        portfolioId: true,
        status: true
      }
    });
  }

  async transitionToProcessing(reportRunId: string, startedAt: Date) {
    await this.prismaClient.reportRun.update({
      where: { id: reportRunId },
      data: {
        status: "PROCESSING",
        startedAt
      }
    });
  }

  async loadCompletedRunData(reportRunId: string) {
    const run = await this.prismaClient.reportRun.findUnique({
      where: { id: reportRunId },
      select: {
        id: true,
        userId: true,
        portfolioId: true,
        reportingCurrency: true,
        requestedAt: true,
        marketDataProvider: true,
        narrativeProvider: true,
        narrativeModel: true,
        promptVersion: true,
        valuationAsOf: true,
        canonicalSnapshot: true,
        analysisOutput: true,
        narrativeOutput: true,
        portfolio: {
          select: {
            name: true,
            description: true,
            baseCurrency: true
          }
        }
      }
    });

    return run;
  }

  async completeRunAndIncrementUsage(reportRunId: string, userId: string, completedAt: Date) {
    await this.prismaClient.$transaction([
      this.prismaClient.reportRun.update({
        where: { id: reportRunId },
        data: {
          status: "COMPLETED",
          completedAt
        }
      }),
      this.prismaClient.userUsage.upsert({
        where: { userId },
        create: {
          userId,
          reportsGeneratedCount: 1,
          lastReportGeneratedAt: completedAt
        },
        update: {
          reportsGeneratedCount: { increment: 1 },
          lastReportGeneratedAt: completedAt
        }
      })
    ]);
  }

  async failRun(input: FailRunInput) {
    await this.prismaClient.reportRun.update({
      where: { id: input.reportRunId },
      data: {
        status: "FAILED",
        failedAt: input.failedAt,
        errorCode: input.errorCode,
        errorDetails: input.errorDetails
      }
    });
  }
}

// ---------------------------------------------------------------------------
// Pipeline stage interfaces (for DI in tests)
// ---------------------------------------------------------------------------

export interface CanonicalModelStage {
  buildForReportRun(reportRunId: string): Promise<unknown>;
}

export interface AnalysisEngineStage {
  buildForReportRun(reportRunId: string): Promise<unknown>;
}

export interface NarrativeEngineStage {
  buildForReportRun(reportRunId: string): Promise<unknown>;
}

export interface ArtifactStorageStage {
  storeForReportRun(input: {
    reportRunId: string;
    userId: string;
    renderResult: RenderPdfResult;
  }): Promise<{ artifactId: string; storageBucket: string; storagePath: string }>;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export type ReportRunOrchestratorDependencies = {
  repository?: OrchestratorRepository;
  canonicalModelService?: CanonicalModelStage;
  analysisEngineService?: AnalysisEngineStage;
  narrativeEngineService?: NarrativeEngineStage;
  pdfRenderer?: PdfRenderer;
  artifactStorageService?: ArtifactStorageStage;
  now?: () => Date;
  logger?: Pick<typeof console, "info" | "error">;
};

export type OrchestratorResult = {
  runId: string;
  status: "COMPLETED";
  artifactId: string;
};

export class ReportRunOrchestrator {
  private readonly repository: OrchestratorRepository;
  private readonly canonicalModelService: CanonicalModelStage;
  private readonly analysisEngineService: AnalysisEngineStage;
  private readonly narrativeEngineService: NarrativeEngineStage;
  private readonly pdfRenderer: PdfRenderer;
  private readonly artifactStorageService: ArtifactStorageStage;
  private readonly now: () => Date;
  private readonly logger: Pick<typeof console, "info" | "error">;

  constructor(dependencies: ReportRunOrchestratorDependencies = {}) {
    this.repository = dependencies.repository ?? new PrismaOrchestratorRepository();
    this.canonicalModelService = dependencies.canonicalModelService ?? new CanonicalModelService();
    this.analysisEngineService = dependencies.analysisEngineService ?? new AnalysisEngineService();
    this.narrativeEngineService =
      dependencies.narrativeEngineService ?? new NarrativeEngineService();
    this.pdfRenderer = dependencies.pdfRenderer ?? new PlaywrightPdfRenderer();
    this.artifactStorageService =
      dependencies.artifactStorageService ?? new ArtifactStorageService();
    this.now = dependencies.now ?? (() => new Date());
    this.logger = dependencies.logger ?? console;
  }

  async execute(reportRunId: string): Promise<OrchestratorResult> {
    // 1. Load and guard: only QUEUED runs may proceed
    const run = await this.repository.getReportRunForProcessing(reportRunId);

    if (!run) {
      throw new OrchestratorReportRunNotFoundError(`Report run ${reportRunId} was not found.`);
    }

    if (run.status !== "QUEUED") {
      throw new ReportRunNotQueuedError(
        `Report run ${reportRunId} has status "${run.status}" — expected "QUEUED".`
      );
    }

    // 2. Transition to PROCESSING
    await this.repository.transitionToProcessing(reportRunId, this.now());

    try {
      // 3. Run pipeline stages sequentially
      await this.runPipelineStage(
        () => this.canonicalModelService.buildForReportRun(reportRunId),
        ORCHESTRATOR_ERROR_CODES.CANONICAL_FAILURE,
        run
      );

      await this.runPipelineStage(
        () => this.analysisEngineService.buildForReportRun(reportRunId),
        ORCHESTRATOR_ERROR_CODES.ANALYSIS_FAILURE,
        run
      );

      await this.runPipelineStage(
        () => this.narrativeEngineService.buildForReportRun(reportRunId),
        ORCHESTRATOR_ERROR_CODES.NARRATIVE_FAILURE,
        run
      );

      // 4. Load the full run data and assemble the ReportDocument
      const completedRunData = await this.repository.loadCompletedRunData(reportRunId);

      if (!completedRunData) {
        throw Object.assign(
          new Error(`Report run ${reportRunId} not found after pipeline stages.`),
          { __errorCode: ORCHESTRATOR_ERROR_CODES.ORCHESTRATION_FAILURE }
        );
      }

      const reportDocument = buildReportDocument(completedRunData, this.now());

      // 5. Render PDF
      const renderResult = await this.runPipelineStage(
        () => this.pdfRenderer.render(reportDocument),
        ORCHESTRATOR_ERROR_CODES.RENDER_FAILURE,
        run
      );

      // 6. Upload artifact and create metadata
      const storeResult = await this.runPipelineStage(
        () =>
          this.artifactStorageService.storeForReportRun({
            reportRunId,
            userId: run.userId,
            renderResult
          }),
        ORCHESTRATOR_ERROR_CODES.STORAGE_FAILURE,
        run
      );

      // 7. Complete run + increment usage (atomic)
      await this.repository.completeRunAndIncrementUsage(reportRunId, run.userId, this.now());

      // 8. Emit domain event
      const completedEvent: ReportCompletedEvent = {
        event: "report.completed",
        runId: reportRunId,
        userId: run.userId,
        portfolioId: run.portfolioId,
        artifactId: storeResult.artifactId
      };
      this.logger.info("Domain event emitted.", completedEvent);

      return {
        runId: reportRunId,
        status: "COMPLETED",
        artifactId: storeResult.artifactId
      };
    } catch (error) {
      // If the error was already handled by runPipelineStage (which calls failRun),
      // it will have the __handled flag. Re-throw it so graphile-worker sees the failure.
      if (error instanceof PipelineStageError) {
        throw error;
      }

      // Unexpected error during orchestration (e.g., document assembly or completion)
      const errorCode = ORCHESTRATOR_ERROR_CODES.ORCHESTRATION_FAILURE;
      const errorMessage = error instanceof Error ? error.message : "Unknown orchestration error";

      await this.failRunSafe(reportRunId, run, errorCode, errorMessage);
      throw error;
    }
  }

  private async runPipelineStage<T>(
    stageFn: () => Promise<T>,
    errorCode: OrchestratorErrorCode,
    run: ReportRunForStatusCheck
  ): Promise<T> {
    try {
      return await stageFn();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown stage error";

      await this.failRunSafe(run.id, run, errorCode, errorMessage);

      throw new PipelineStageError(errorCode, errorMessage, {
        cause: error
      });
    }
  }

  private async failRunSafe(
    reportRunId: string,
    run: ReportRunForStatusCheck,
    errorCode: string,
    errorMessage: string
  ) {
    try {
      await this.repository.failRun({
        reportRunId,
        errorCode,
        errorDetails: { message: errorMessage } as Prisma.InputJsonValue,
        failedAt: this.now()
      });

      const failedEvent: ReportFailedEvent = {
        event: "report.failed",
        runId: reportRunId,
        userId: run.userId,
        errorCode,
        errorMessage
      };
      this.logger.error("Domain event emitted.", failedEvent);
    } catch (failError) {
      this.logger.error("Failed to persist failure status for report run.", {
        reportRunId,
        errorCode,
        originalError: errorMessage,
        failError: failError instanceof Error ? failError.message : "unknown"
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Internal error wrapper
// ---------------------------------------------------------------------------

class PipelineStageError extends Error {
  override name = "PipelineStageError";
  readonly errorCode: OrchestratorErrorCode;

  constructor(errorCode: OrchestratorErrorCode, message: string, options?: ErrorOptions) {
    super(`[${errorCode}] ${message}`, options);
    this.errorCode = errorCode;
  }
}
