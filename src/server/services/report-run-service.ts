import type { PrismaClient } from "@prisma/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import { quickAddJob } from "graphile-worker";

import { prisma } from "@/db/prisma/client";
import { serverEnv } from "@/server/config";
import type { ServerEnv } from "@/server/config";
import { supabaseAdmin } from "@/server/providers/supabase-storage-client";
import { uuidSchema } from "@/server/shared/types";

// ---------------------------------------------------------------------------
// Error classes
// ---------------------------------------------------------------------------

export class PortfolioNotFoundError extends Error {
  override name = "PortfolioNotFoundError";
}

export class ReportRunNotFoundError extends Error {
  override name = "ReportRunNotFoundError";
}

export class ArtifactNotFoundError extends Error {
  override name = "ArtifactNotFoundError";
}

export class SignedUrlError extends Error {
  override name = "SignedUrlError";
}

// ---------------------------------------------------------------------------
// Repository interface + Prisma implementation
// ---------------------------------------------------------------------------

export type CreateReportRunInput = {
  userId: string;
  portfolioId: string;
  reportingCurrency: "USD" | "CAD";
};

export type ReportRunRow = {
  id: string;
  userId: string;
  portfolioId: string;
  status: string;
  paymentStatus: string;
  reportingCurrency: string;
  errorCode: string | null;
  requestedAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  failedAt: Date | null;
};

export type ArtifactRow = {
  storageBucket: string;
  storagePath: string;
};

export interface ReportRunRepository {
  verifyPortfolioOwnership(userId: string, portfolioId: string): Promise<boolean>;
  createReportRun(input: CreateReportRunInput): Promise<{ id: string }>;
  deleteReportRun(runId: string): Promise<void>;
  getReportRunByIdAndUser(runId: string, userId: string): Promise<ReportRunRow | null>;
  getArtifactForCompletedRun(runId: string, userId: string): Promise<ArtifactRow | null>;
}

export class PrismaReportRunRepository implements ReportRunRepository {
  constructor(private readonly prismaClient: PrismaClient = prisma) {}

  async verifyPortfolioOwnership(userId: string, portfolioId: string): Promise<boolean> {
    const portfolio = await this.prismaClient.portfolio.findFirst({
      where: { id: portfolioId, userId, archivedAt: null },
      select: { id: true }
    });
    return portfolio !== null;
  }

  async createReportRun(input: CreateReportRunInput): Promise<{ id: string }> {
    const run = await this.prismaClient.reportRun.create({
      data: {
        userId: input.userId,
        portfolioId: input.portfolioId,
        reportingCurrency: input.reportingCurrency,
        status: "QUEUED",
        paymentStatus: "NOT_REQUIRED"
      },
      select: { id: true }
    });
    return run;
  }

  async getReportRunByIdAndUser(runId: string, userId: string): Promise<ReportRunRow | null> {
    return this.prismaClient.reportRun.findFirst({
      where: { id: runId, userId },
      select: {
        id: true,
        userId: true,
        portfolioId: true,
        status: true,
        paymentStatus: true,
        reportingCurrency: true,
        errorCode: true,
        requestedAt: true,
        startedAt: true,
        completedAt: true,
        failedAt: true
      }
    });
  }

  async deleteReportRun(runId: string): Promise<void> {
    await this.prismaClient.reportRun.delete({ where: { id: runId } });
  }

  async getArtifactForCompletedRun(runId: string, userId: string): Promise<ArtifactRow | null> {
    return this.prismaClient.reportArtifact.findFirst({
      where: {
        reportRunId: runId,
        userId,
        artifactType: "PDF_REPORT"
      },
      select: {
        storageBucket: true,
        storagePath: true
      }
    });
  }
}

// ---------------------------------------------------------------------------
// Storage signer interface
// ---------------------------------------------------------------------------

export interface StorageSigner {
  createSignedUrl(
    bucket: string,
    path: string,
    expiresInSeconds: number
  ): Promise<{ signedUrl: string }>;
}

export class SupabaseStorageSigner implements StorageSigner {
  constructor(private readonly client: SupabaseClient = supabaseAdmin) {}

  async createSignedUrl(
    bucket: string,
    path: string,
    expiresInSeconds: number
  ): Promise<{ signedUrl: string }> {
    const { data, error } = await this.client.storage
      .from(bucket)
      .createSignedUrl(path, expiresInSeconds);

    if (error || !data?.signedUrl) {
      throw new SignedUrlError(
        `Failed to create signed URL for ${bucket}/${path}: ${error?.message ?? "No URL returned"}`
      );
    }

    return { signedUrl: data.signedUrl };
  }
}

// ---------------------------------------------------------------------------
// Job enqueue interface
// ---------------------------------------------------------------------------

export interface JobEnqueuer {
  enqueue(
    identifier: string,
    payload: Record<string, unknown>,
    options?: { jobKey?: string; maxAttempts?: number }
  ): Promise<void>;
}

export class GraphileJobEnqueuer implements JobEnqueuer {
  constructor(
    private readonly connectionString: string = serverEnv.DATABASE_URL,
    private readonly schema: string = serverEnv.GRAPHILE_WORKER_SCHEMA
  ) {}

  async enqueue(
    identifier: string,
    payload: Record<string, unknown>,
    options?: { jobKey?: string; maxAttempts?: number }
  ): Promise<void> {
    await quickAddJob(
      { connectionString: this.connectionString, schema: this.schema },
      identifier,
      payload,
      options
    );
  }
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export type ReportRunServiceDependencies = {
  repository?: ReportRunRepository;
  storageSigner?: StorageSigner;
  jobEnqueuer?: JobEnqueuer;
  logger?: Pick<typeof console, "info" | "error">;
  env?: Pick<
    ServerEnv,
    | "PAYMENT_GATE_ENABLED"
    | "REPORT_RUN_TASK_IDENTIFIER"
    | "SUPABASE_REPORTS_BUCKET"
    | "SIGNED_URL_EXPIRY_SECONDS"
  >;
};

export type CreateReportRunResult = {
  runId: string;
  status: string;
};

export type ReportRunStatusResult = {
  runId: string;
  portfolioId: string;
  status: string;
  paymentStatus: string;
  reportingCurrency: string;
  errorCode: string | null;
  requestedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  failedAt: string | null;
};

export type PdfSignedUrlResult = {
  signedUrl: string;
  expiresInSeconds: number;
};

export class ReportRunService {
  private readonly repository: ReportRunRepository;
  private readonly storageSigner: StorageSigner;
  private readonly jobEnqueuer: JobEnqueuer;
  private readonly logger: Pick<typeof console, "info" | "error">;
  private readonly env: Pick<
    ServerEnv,
    | "PAYMENT_GATE_ENABLED"
    | "REPORT_RUN_TASK_IDENTIFIER"
    | "SUPABASE_REPORTS_BUCKET"
    | "SIGNED_URL_EXPIRY_SECONDS"
  >;

  constructor(dependencies: ReportRunServiceDependencies = {}) {
    this.repository = dependencies.repository ?? new PrismaReportRunRepository();
    this.storageSigner = dependencies.storageSigner ?? new SupabaseStorageSigner();
    this.jobEnqueuer = dependencies.jobEnqueuer ?? new GraphileJobEnqueuer();
    this.logger = dependencies.logger ?? console;
    this.env = dependencies.env ?? serverEnv;
  }

  async createAndEnqueue(input: CreateReportRunInput): Promise<CreateReportRunResult> {
    const userId = uuidSchema.parse(input.userId);
    const portfolioId = uuidSchema.parse(input.portfolioId);

    // 1. Verify the user owns this portfolio
    const ownsPortfolio = await this.repository.verifyPortfolioOwnership(userId, portfolioId);
    if (!ownsPortfolio) {
      throw new PortfolioNotFoundError("Portfolio not found.");
    }

    // 2. Create the report run in QUEUED status (payment gate is off)
    const run = await this.repository.createReportRun({
      userId,
      portfolioId,
      reportingCurrency: input.reportingCurrency
    });
    this.logger.info("Report run created.", {
      event: "report_run.created",
      runId: run.id,
      userId,
      portfolioId,
      status: "QUEUED",
      paymentStatus: "NOT_REQUIRED",
      reportingCurrency: input.reportingCurrency
    });

    // 3. Enqueue the worker job; delete the run if enqueue fails
    const jobKey = `report-run:${run.id}`;
    const maxAttempts = 1;
    this.logger.info("Report run enqueue started.", {
      event: "report_run.enqueue_started",
      runId: run.id,
      userId,
      portfolioId,
      taskIdentifier: this.env.REPORT_RUN_TASK_IDENTIFIER,
      jobKey,
      maxAttempts
    });

    try {
      await this.jobEnqueuer.enqueue(
        this.env.REPORT_RUN_TASK_IDENTIFIER,
        {
          reportRunId: run.id
        },
        {
          jobKey,
          maxAttempts
        }
      );
      this.logger.info("Report run enqueued.", {
        event: "report_run.enqueued",
        runId: run.id,
        userId,
        portfolioId,
        taskIdentifier: this.env.REPORT_RUN_TASK_IDENTIFIER,
        jobKey,
        maxAttempts
      });
    } catch (enqueueError) {
      const errorMessage =
        enqueueError instanceof Error ? enqueueError.message : "Unknown enqueue error";
      this.logger.error("Report run enqueue failed.", {
        event: "report_run.enqueue_failed",
        runId: run.id,
        userId,
        portfolioId,
        taskIdentifier: this.env.REPORT_RUN_TASK_IDENTIFIER,
        jobKey,
        maxAttempts,
        errorMessage
      });

      try {
        await this.repository.deleteReportRun(run.id);
        this.logger.info("Report run enqueue cleanup completed.", {
          event: "report_run.enqueue_cleanup_completed",
          runId: run.id,
          userId,
          portfolioId
        });
      } catch {
        this.logger.error("Report run enqueue cleanup failed.", {
          event: "report_run.enqueue_cleanup_failed",
          runId: run.id,
          userId,
          portfolioId,
          originalError: errorMessage
        });
        // Best-effort cleanup — preserve the original enqueue error
      }
      throw enqueueError;
    }

    return { runId: run.id, status: "QUEUED" };
  }

  async getStatus(runId: string, userId: string): Promise<ReportRunStatusResult> {
    const validatedRunId = uuidSchema.parse(runId);
    const validatedUserId = uuidSchema.parse(userId);

    const run = await this.repository.getReportRunByIdAndUser(validatedRunId, validatedUserId);
    if (!run) {
      throw new ReportRunNotFoundError("Report run not found.");
    }

    return {
      runId: run.id,
      portfolioId: run.portfolioId,
      status: run.status,
      paymentStatus: run.paymentStatus,
      reportingCurrency: run.reportingCurrency,
      errorCode: run.errorCode,
      requestedAt: run.requestedAt.toISOString(),
      startedAt: run.startedAt?.toISOString() ?? null,
      completedAt: run.completedAt?.toISOString() ?? null,
      failedAt: run.failedAt?.toISOString() ?? null
    };
  }

  async getPdfSignedUrl(runId: string, userId: string): Promise<PdfSignedUrlResult> {
    const validatedRunId = uuidSchema.parse(runId);
    const validatedUserId = uuidSchema.parse(userId);

    // 1. Verify run exists, belongs to user, and is COMPLETED
    const run = await this.repository.getReportRunByIdAndUser(validatedRunId, validatedUserId);
    if (!run) {
      throw new ReportRunNotFoundError("Report run not found.");
    }

    if (run.status !== "COMPLETED") {
      throw new ArtifactNotFoundError("PDF artifact is not available.");
    }

    // 2. Find the artifact
    const artifact = await this.repository.getArtifactForCompletedRun(
      validatedRunId,
      validatedUserId
    );
    if (!artifact) {
      throw new ArtifactNotFoundError("PDF artifact is not available.");
    }

    // 3. Generate signed URL
    const expiresInSeconds = this.env.SIGNED_URL_EXPIRY_SECONDS;
    const { signedUrl } = await this.storageSigner.createSignedUrl(
      artifact.storageBucket,
      artifact.storagePath,
      expiresInSeconds
    );

    return { signedUrl, expiresInSeconds };
  }
}
