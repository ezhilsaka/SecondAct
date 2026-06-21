import { describe, expect, it, vi } from "vitest";

import {
  ArtifactNotFoundError,
  type JobEnqueuer,
  PortfolioNotFoundError,
  ReportRunNotTerminalError,
  type ReportRunRepository,
  ReportRunNotFoundError,
  ReportRunService,
  ReportStorageDeleteError,
  SignedUrlError,
  type StorageDeleter,
  type StorageSigner
} from "@/server/services/report-run-service";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_USER_ID = "11111111-1111-4111-8111-111111111111";
const TEST_PORTFOLIO_ID = "22222222-2222-4222-8222-222222222222";
const TEST_RUN_ID = "33333333-3333-4333-8333-333333333333";

const BASE_ENV = {
  PAYMENT_GATE_ENABLED: false,
  REPORT_RUN_TASK_IDENTIFIER: "report.run.generate",
  SUPABASE_REPORTS_BUCKET: "reports",
  SIGNED_URL_EXPIRY_SECONDS: 300
};

function buildMockRepository(overrides: Partial<ReportRunRepository> = {}): ReportRunRepository {
  return {
    verifyPortfolioOwnership: vi.fn().mockResolvedValue(true),
    verifyPortfolioBelongsToUser: vi.fn().mockResolvedValue(true),
    createReportRun: vi.fn().mockResolvedValue({ id: TEST_RUN_ID }),
    deleteReportRun: vi.fn().mockResolvedValue(undefined),
    deleteReportRunForUser: vi.fn().mockResolvedValue(undefined),
    getReportRunByIdAndUser: vi.fn().mockResolvedValue(null),
    listReportRunsByUser: vi.fn().mockResolvedValue([]),
    findActiveReportRunForPortfolio: vi.fn().mockResolvedValue(null),
    getArtifactForCompletedRun: vi.fn().mockResolvedValue(null),
    ...overrides
  };
}

function buildMockJobEnqueuer(overrides: Partial<JobEnqueuer> = {}): JobEnqueuer {
  return {
    enqueue: vi.fn().mockResolvedValue(undefined),
    ...overrides
  };
}

function buildMockStorageSigner(overrides: Partial<StorageSigner> = {}): StorageSigner {
  return {
    createSignedUrl: vi.fn().mockResolvedValue({ signedUrl: "https://storage.example.com/signed" }),
    ...overrides
  };
}

function buildMockStorageDeleter(overrides: Partial<StorageDeleter> = {}): StorageDeleter {
  return {
    deleteObject: vi.fn().mockResolvedValue({ missing: false }),
    ...overrides
  };
}

function buildMockLogger() {
  return {
    info: vi.fn(),
    error: vi.fn()
  };
}

function buildRunRow(overrides: Record<string, unknown> = {}) {
  return {
    id: TEST_RUN_ID,
    userId: TEST_USER_ID,
    portfolioId: TEST_PORTFOLIO_ID,
    portfolioName: "Retirement Portfolio",
    status: "QUEUED",
    paymentStatus: "NOT_REQUIRED",
    reportingCurrency: "CAD",
    errorCode: null,
    requestedAt: new Date("2025-01-01T00:00:00Z"),
    startedAt: null,
    completedAt: null,
    failedAt: null,
    ...overrides
  };
}

// ---------------------------------------------------------------------------
// createAndEnqueue
// ---------------------------------------------------------------------------

describe("ReportRunService", () => {
  describe("createAndEnqueue", () => {
    it("creates a QUEUED run and enqueues a job", async () => {
      const repository = buildMockRepository();
      const jobEnqueuer = buildMockJobEnqueuer();
      const logger = buildMockLogger();

      const service = new ReportRunService({
        repository,
        jobEnqueuer,
        logger,
        env: BASE_ENV
      });

      const result = await service.createAndEnqueue({
        userId: TEST_USER_ID,
        portfolioId: TEST_PORTFOLIO_ID,
        reportingCurrency: "CAD"
      });

      expect(result).toEqual({ runId: TEST_RUN_ID, status: "QUEUED" });
      expect(repository.verifyPortfolioOwnership).toHaveBeenCalledWith(
        TEST_USER_ID,
        TEST_PORTFOLIO_ID
      );
      expect(repository.createReportRun).toHaveBeenCalledWith({
        userId: TEST_USER_ID,
        portfolioId: TEST_PORTFOLIO_ID,
        reportingCurrency: "CAD"
      });
      expect(jobEnqueuer.enqueue).toHaveBeenCalledWith(
        "report.run.generate",
        {
          reportRunId: TEST_RUN_ID
        },
        {
          jobKey: `report-run:${TEST_RUN_ID}`,
          maxAttempts: 1
        }
      );
      expect(logger.info).toHaveBeenCalledWith(
        "Report run created.",
        expect.objectContaining({
          event: "report_run.created",
          runId: TEST_RUN_ID,
          userId: TEST_USER_ID,
          portfolioId: TEST_PORTFOLIO_ID,
          status: "QUEUED",
          paymentStatus: "NOT_REQUIRED",
          reportingCurrency: "CAD"
        })
      );
      expect(logger.info).toHaveBeenCalledWith(
        "Report run enqueued.",
        expect.objectContaining({
          event: "report_run.enqueued",
          runId: TEST_RUN_ID,
          userId: TEST_USER_ID,
          portfolioId: TEST_PORTFOLIO_ID,
          taskIdentifier: "report.run.generate",
          jobKey: `report-run:${TEST_RUN_ID}`,
          maxAttempts: 1
        })
      );
    });

    it("throws PortfolioNotFoundError when portfolio is not owned by user", async () => {
      const repository = buildMockRepository({
        verifyPortfolioOwnership: vi.fn().mockResolvedValue(false)
      });

      const service = new ReportRunService({
        repository,
        jobEnqueuer: buildMockJobEnqueuer(),
        logger: buildMockLogger(),
        env: BASE_ENV
      });

      await expect(
        service.createAndEnqueue({
          userId: TEST_USER_ID,
          portfolioId: TEST_PORTFOLIO_ID,
          reportingCurrency: "CAD"
        })
      ).rejects.toThrow(PortfolioNotFoundError);

      expect(repository.createReportRun).not.toHaveBeenCalled();
    });

    it("rejects an invalid userId", async () => {
      const service = new ReportRunService({
        repository: buildMockRepository(),
        jobEnqueuer: buildMockJobEnqueuer(),
        logger: buildMockLogger(),
        env: BASE_ENV
      });

      await expect(
        service.createAndEnqueue({
          userId: "not-a-uuid",
          portfolioId: TEST_PORTFOLIO_ID,
          reportingCurrency: "CAD"
        })
      ).rejects.toThrow();
    });

    it("rejects an invalid portfolioId", async () => {
      const service = new ReportRunService({
        repository: buildMockRepository(),
        jobEnqueuer: buildMockJobEnqueuer(),
        logger: buildMockLogger(),
        env: BASE_ENV
      });

      await expect(
        service.createAndEnqueue({
          userId: TEST_USER_ID,
          portfolioId: "not-a-uuid",
          reportingCurrency: "CAD"
        })
      ).rejects.toThrow();
    });

    it("deletes the created run when enqueue fails", async () => {
      const repository = buildMockRepository();
      const enqueueError = new Error("connection refused");
      const jobEnqueuer = buildMockJobEnqueuer({
        enqueue: vi.fn().mockRejectedValue(enqueueError)
      });
      const logger = buildMockLogger();

      const service = new ReportRunService({
        repository,
        jobEnqueuer,
        logger,
        env: BASE_ENV
      });

      await expect(
        service.createAndEnqueue({
          userId: TEST_USER_ID,
          portfolioId: TEST_PORTFOLIO_ID,
          reportingCurrency: "CAD"
        })
      ).rejects.toThrow("connection refused");

      expect(repository.createReportRun).toHaveBeenCalled();
      expect(repository.deleteReportRun).toHaveBeenCalledWith(TEST_RUN_ID);
      expect(logger.error).toHaveBeenCalledWith(
        "Report run enqueue failed.",
        expect.objectContaining({
          event: "report_run.enqueue_failed",
          runId: TEST_RUN_ID,
          userId: TEST_USER_ID,
          portfolioId: TEST_PORTFOLIO_ID,
          errorMessage: "connection refused"
        })
      );
      expect(logger.info).toHaveBeenCalledWith(
        "Report run enqueue cleanup completed.",
        expect.objectContaining({
          event: "report_run.enqueue_cleanup_completed",
          runId: TEST_RUN_ID,
          userId: TEST_USER_ID,
          portfolioId: TEST_PORTFOLIO_ID
        })
      );
    });

    it("preserves the enqueue error when cleanup delete also fails", async () => {
      const repository = buildMockRepository({
        deleteReportRun: vi.fn().mockRejectedValue(new Error("delete failed"))
      });
      const jobEnqueuer = buildMockJobEnqueuer({
        enqueue: vi.fn().mockRejectedValue(new Error("connection refused"))
      });
      const logger = buildMockLogger();

      const service = new ReportRunService({
        repository,
        jobEnqueuer,
        logger,
        env: BASE_ENV
      });

      await expect(
        service.createAndEnqueue({
          userId: TEST_USER_ID,
          portfolioId: TEST_PORTFOLIO_ID,
          reportingCurrency: "CAD"
        })
      ).rejects.toThrow("connection refused");

      expect(repository.deleteReportRun).toHaveBeenCalledWith(TEST_RUN_ID);
      expect(logger.error).toHaveBeenCalledWith(
        "Report run enqueue cleanup failed.",
        expect.objectContaining({
          event: "report_run.enqueue_cleanup_failed",
          runId: TEST_RUN_ID,
          originalError: "connection refused"
        })
      );
    });
  });

  // ---------------------------------------------------------------------------
  // listReportRunsForUser
  // ---------------------------------------------------------------------------

  describe("listReportRunsForUser", () => {
    it("lists user-owned report runs with safe metadata", async () => {
      const run = buildRunRow({
        status: "COMPLETED",
        completedAt: new Date("2025-01-01T00:05:00Z")
      });
      const repository = buildMockRepository({
        listReportRunsByUser: vi.fn().mockResolvedValue([run])
      });
      const service = new ReportRunService({ repository, env: BASE_ENV });

      const result = await service.listReportRunsForUser(TEST_USER_ID);

      expect(repository.verifyPortfolioBelongsToUser).not.toHaveBeenCalled();
      expect(repository.listReportRunsByUser).toHaveBeenCalledWith(TEST_USER_ID, {
        portfolioId: undefined,
        limit: 20
      });
      expect(result).toEqual({
        reportRuns: [
          {
            runId: TEST_RUN_ID,
            portfolioId: TEST_PORTFOLIO_ID,
            portfolioName: "Retirement Portfolio",
            status: "COMPLETED",
            paymentStatus: "NOT_REQUIRED",
            reportingCurrency: "CAD",
            errorCode: null,
            requestedAt: "2025-01-01T00:00:00.000Z",
            startedAt: null,
            completedAt: "2025-01-01T00:05:00.000Z",
            failedAt: null
          }
        ]
      });
      expect(result.reportRuns[0]).not.toHaveProperty("canonicalSnapshot");
      expect(result.reportRuns[0]).not.toHaveProperty("analysisOutput");
      expect(result.reportRuns[0]).not.toHaveProperty("narrativeOutput");
      expect(result.reportRuns[0]).not.toHaveProperty("errorDetails");
    });

    it("lists runs for one owned portfolio", async () => {
      const run = buildRunRow();
      const repository = buildMockRepository({
        verifyPortfolioBelongsToUser: vi.fn().mockResolvedValue(true),
        listReportRunsByUser: vi.fn().mockResolvedValue([run])
      });
      const service = new ReportRunService({ repository, env: BASE_ENV });

      const result = await service.listReportRunsForUser(TEST_USER_ID, {
        portfolioId: TEST_PORTFOLIO_ID,
        limit: 10
      });

      expect(repository.verifyPortfolioBelongsToUser).toHaveBeenCalledWith(
        TEST_USER_ID,
        TEST_PORTFOLIO_ID
      );
      expect(repository.listReportRunsByUser).toHaveBeenCalledWith(TEST_USER_ID, {
        portfolioId: TEST_PORTFOLIO_ID,
        limit: 10
      });
      expect(result.reportRuns).toHaveLength(1);
      expect(result.reportRuns[0]?.portfolioId).toBe(TEST_PORTFOLIO_ID);
    });

    it("passes status and currency filters to the repository", async () => {
      const run = buildRunRow({
        status: "COMPLETED",
        reportingCurrency: "USD"
      });
      const repository = buildMockRepository({
        listReportRunsByUser: vi.fn().mockResolvedValue([run])
      });
      const service = new ReportRunService({ repository, env: BASE_ENV });

      await service.listReportRunsForUser(TEST_USER_ID, {
        status: "COMPLETED",
        reportingCurrency: "USD"
      });

      expect(repository.listReportRunsByUser).toHaveBeenCalledWith(TEST_USER_ID, {
        portfolioId: undefined,
        limit: 20,
        status: "COMPLETED",
        reportingCurrency: "USD"
      });
    });

    it("passes the active status filter to the repository", async () => {
      const repository = buildMockRepository();
      const service = new ReportRunService({ repository, env: BASE_ENV });

      await service.listReportRunsForUser(TEST_USER_ID, {
        status: "ACTIVE"
      });

      expect(repository.listReportRunsByUser).toHaveBeenCalledWith(TEST_USER_ID, {
        portfolioId: undefined,
        limit: 20,
        status: "ACTIVE",
        reportingCurrency: undefined
      });
    });

    it("rejects invalid list status and currency filters", async () => {
      const repository = buildMockRepository();
      const service = new ReportRunService({ repository, env: BASE_ENV });

      await expect(
        service.listReportRunsForUser(TEST_USER_ID, {
          status: "ARCHIVED" as "COMPLETED"
        })
      ).rejects.toThrow("Report run list status");

      await expect(
        service.listReportRunsForUser(TEST_USER_ID, {
          reportingCurrency: "EUR" as "USD"
        })
      ).rejects.toThrow("Report run list reporting currency");

      expect(repository.listReportRunsByUser).not.toHaveBeenCalled();
    });

    it("does not leak runs when portfolio filtering targets a not-owned portfolio", async () => {
      const repository = buildMockRepository({
        verifyPortfolioBelongsToUser: vi.fn().mockResolvedValue(false),
        listReportRunsByUser: vi.fn().mockResolvedValue([buildRunRow()])
      });
      const service = new ReportRunService({ repository, env: BASE_ENV });

      await expect(
        service.listReportRunsForUser(TEST_USER_ID, {
          portfolioId: TEST_PORTFOLIO_ID
        })
      ).rejects.toThrow(PortfolioNotFoundError);

      expect(repository.listReportRunsByUser).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // findActiveReportRunForPortfolio
  // ---------------------------------------------------------------------------

  describe("findActiveReportRunForPortfolio", () => {
    it("finds an active queued or processing report run for a portfolio", async () => {
      const run = buildRunRow({
        status: "PROCESSING",
        startedAt: new Date("2025-01-01T00:01:00Z")
      });
      const repository = buildMockRepository({
        findActiveReportRunForPortfolio: vi.fn().mockResolvedValue(run)
      });
      const service = new ReportRunService({ repository, env: BASE_ENV });

      const result = await service.findActiveReportRunForPortfolio(
        TEST_USER_ID,
        TEST_PORTFOLIO_ID
      );

      expect(repository.findActiveReportRunForPortfolio).toHaveBeenCalledWith(
        TEST_USER_ID,
        TEST_PORTFOLIO_ID
      );
      expect(result).toEqual(
        expect.objectContaining({
          runId: TEST_RUN_ID,
          portfolioId: TEST_PORTFOLIO_ID,
          status: "PROCESSING"
        })
      );
    });

    it("does not treat completed or failed runs as active", async () => {
      const repository = buildMockRepository({
        findActiveReportRunForPortfolio: vi
          .fn()
          .mockResolvedValueOnce(buildRunRow({ status: "COMPLETED" }))
          .mockResolvedValueOnce(buildRunRow({ status: "FAILED" }))
      });
      const service = new ReportRunService({ repository, env: BASE_ENV });

      await expect(
        service.findActiveReportRunForPortfolio(TEST_USER_ID, TEST_PORTFOLIO_ID)
      ).resolves.toBeNull();
      await expect(
        service.findActiveReportRunForPortfolio(TEST_USER_ID, TEST_PORTFOLIO_ID)
      ).resolves.toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // getStatus
  // ---------------------------------------------------------------------------

  describe("getStatus", () => {
    it("returns the run status for a valid run", async () => {
      const run = buildRunRow({
        status: "PROCESSING",
        startedAt: new Date("2025-01-01T00:01:00Z")
      });
      const repository = buildMockRepository({
        getReportRunByIdAndUser: vi.fn().mockResolvedValue(run)
      });

      const service = new ReportRunService({ repository, env: BASE_ENV });

      const result = await service.getStatus(TEST_RUN_ID, TEST_USER_ID);

      expect(result).toEqual({
        runId: TEST_RUN_ID,
        portfolioId: TEST_PORTFOLIO_ID,
        portfolioName: "Retirement Portfolio",
        status: "PROCESSING",
        paymentStatus: "NOT_REQUIRED",
        reportingCurrency: "CAD",
        errorCode: null,
        requestedAt: "2025-01-01T00:00:00.000Z",
        startedAt: "2025-01-01T00:01:00.000Z",
        completedAt: null,
        failedAt: null
      });
    });

    it("throws ReportRunNotFoundError when run does not exist", async () => {
      const repository = buildMockRepository({
        getReportRunByIdAndUser: vi.fn().mockResolvedValue(null)
      });

      const service = new ReportRunService({ repository, env: BASE_ENV });

      await expect(service.getStatus(TEST_RUN_ID, TEST_USER_ID)).rejects.toThrow(
        ReportRunNotFoundError
      );
    });

    it("rejects an invalid runId", async () => {
      const service = new ReportRunService({
        repository: buildMockRepository(),
        env: BASE_ENV
      });

      await expect(service.getStatus("not-a-uuid", TEST_USER_ID)).rejects.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // getPdfSignedUrl
  // ---------------------------------------------------------------------------

  describe("getPdfSignedUrl", () => {
    it("returns a signed URL for a completed run's PDF", async () => {
      const run = buildRunRow({
        status: "COMPLETED",
        completedAt: new Date("2025-01-01T01:00:00Z")
      });
      const artifact = {
        storageBucket: "reports",
        storagePath: `${TEST_USER_ID}/${TEST_RUN_ID}/report.pdf`
      };
      const repository = buildMockRepository({
        getReportRunByIdAndUser: vi.fn().mockResolvedValue(run),
        getArtifactForCompletedRun: vi.fn().mockResolvedValue(artifact)
      });
      const storageSigner = buildMockStorageSigner();

      const service = new ReportRunService({
        repository,
        storageSigner,
        env: BASE_ENV
      });

      const result = await service.getPdfSignedUrl(TEST_RUN_ID, TEST_USER_ID);

      expect(result).toEqual({
        signedUrl: "https://storage.example.com/signed",
        expiresInSeconds: 300
      });
      expect(storageSigner.createSignedUrl).toHaveBeenCalledWith(
        "reports",
        `${TEST_USER_ID}/${TEST_RUN_ID}/report.pdf`,
        300
      );
    });

    it("throws ReportRunNotFoundError when run does not exist", async () => {
      const repository = buildMockRepository({
        getReportRunByIdAndUser: vi.fn().mockResolvedValue(null)
      });

      const service = new ReportRunService({ repository, env: BASE_ENV });

      await expect(service.getPdfSignedUrl(TEST_RUN_ID, TEST_USER_ID)).rejects.toThrow(
        ReportRunNotFoundError
      );
    });

    it("throws ArtifactNotFoundError when run is not COMPLETED", async () => {
      const run = buildRunRow({ status: "PROCESSING" });
      const repository = buildMockRepository({
        getReportRunByIdAndUser: vi.fn().mockResolvedValue(run)
      });

      const service = new ReportRunService({ repository, env: BASE_ENV });

      await expect(service.getPdfSignedUrl(TEST_RUN_ID, TEST_USER_ID)).rejects.toThrow(
        ArtifactNotFoundError
      );
    });

    it("throws ArtifactNotFoundError when no PDF artifact exists", async () => {
      const run = buildRunRow({ status: "COMPLETED" });
      const repository = buildMockRepository({
        getReportRunByIdAndUser: vi.fn().mockResolvedValue(run),
        getArtifactForCompletedRun: vi.fn().mockResolvedValue(null)
      });

      const service = new ReportRunService({ repository, env: BASE_ENV });

      await expect(service.getPdfSignedUrl(TEST_RUN_ID, TEST_USER_ID)).rejects.toThrow(
        ArtifactNotFoundError
      );
    });

    it("throws SignedUrlError when storage signer fails", async () => {
      const run = buildRunRow({ status: "COMPLETED" });
      const artifact = {
        storageBucket: "reports",
        storagePath: `${TEST_USER_ID}/${TEST_RUN_ID}/report.pdf`
      };
      const repository = buildMockRepository({
        getReportRunByIdAndUser: vi.fn().mockResolvedValue(run),
        getArtifactForCompletedRun: vi.fn().mockResolvedValue(artifact)
      });
      const storageSigner = buildMockStorageSigner({
        createSignedUrl: vi.fn().mockRejectedValue(new SignedUrlError("Storage error"))
      });

      const service = new ReportRunService({
        repository,
        storageSigner,
        env: BASE_ENV
      });

      await expect(service.getPdfSignedUrl(TEST_RUN_ID, TEST_USER_ID)).rejects.toThrow(
        SignedUrlError
      );
    });
  });

  // ---------------------------------------------------------------------------
  // deleteTerminalReportRunForUser
  // ---------------------------------------------------------------------------

  describe("deleteTerminalReportRunForUser", () => {
    it("deletes a completed report storage object before deleting database metadata", async () => {
      const run = buildRunRow({
        status: "COMPLETED",
        completedAt: new Date("2025-01-01T01:00:00Z")
      });
      const artifact = {
        storageBucket: "reports",
        storagePath: `${TEST_USER_ID}/${TEST_RUN_ID}/report.pdf`
      };
      const repository = buildMockRepository({
        getReportRunByIdAndUser: vi.fn().mockResolvedValue(run),
        getArtifactForCompletedRun: vi.fn().mockResolvedValue(artifact)
      });
      const storageDeleter = buildMockStorageDeleter();
      const service = new ReportRunService({
        repository,
        storageDeleter,
        logger: buildMockLogger(),
        env: BASE_ENV
      });

      const result = await service.deleteTerminalReportRunForUser(TEST_RUN_ID, TEST_USER_ID);

      expect(result).toEqual({
        runId: TEST_RUN_ID,
        portfolioId: TEST_PORTFOLIO_ID,
        status: "COMPLETED",
        deletedStorageObject: true,
        storageObjectMissing: false
      });
      expect(storageDeleter.deleteObject).toHaveBeenCalledWith(
        "reports",
        `${TEST_USER_ID}/${TEST_RUN_ID}/report.pdf`
      );
      expect(repository.deleteReportRunForUser).toHaveBeenCalledWith(TEST_RUN_ID, TEST_USER_ID);
      expect(
        vi.mocked(storageDeleter.deleteObject).mock.invocationCallOrder[0]
      ).toBeLessThan(
        vi.mocked(repository.deleteReportRunForUser).mock.invocationCallOrder[0] ?? 0
      );
    });

    it("deletes a failed report without requiring a PDF artifact", async () => {
      const run = buildRunRow({
        status: "FAILED",
        failedAt: new Date("2025-01-01T01:00:00Z")
      });
      const repository = buildMockRepository({
        getReportRunByIdAndUser: vi.fn().mockResolvedValue(run)
      });
      const storageDeleter = buildMockStorageDeleter();
      const service = new ReportRunService({
        repository,
        storageDeleter,
        logger: buildMockLogger(),
        env: BASE_ENV
      });

      const result = await service.deleteTerminalReportRunForUser(TEST_RUN_ID, TEST_USER_ID);

      expect(result).toEqual({
        runId: TEST_RUN_ID,
        portfolioId: TEST_PORTFOLIO_ID,
        status: "FAILED",
        deletedStorageObject: false,
        storageObjectMissing: false
      });
      expect(repository.getArtifactForCompletedRun).not.toHaveBeenCalled();
      expect(storageDeleter.deleteObject).not.toHaveBeenCalled();
      expect(repository.deleteReportRunForUser).toHaveBeenCalledWith(TEST_RUN_ID, TEST_USER_ID);
    });

    it("rejects deletion for active report runs", async () => {
      const repository = buildMockRepository({
        getReportRunByIdAndUser: vi.fn().mockResolvedValue(buildRunRow({ status: "PROCESSING" }))
      });
      const storageDeleter = buildMockStorageDeleter();
      const service = new ReportRunService({
        repository,
        storageDeleter,
        env: BASE_ENV
      });

      await expect(
        service.deleteTerminalReportRunForUser(TEST_RUN_ID, TEST_USER_ID)
      ).rejects.toThrow(ReportRunNotTerminalError);

      expect(storageDeleter.deleteObject).not.toHaveBeenCalled();
      expect(repository.deleteReportRunForUser).not.toHaveBeenCalled();
    });

    it("returns not-found for cross-user report deletion", async () => {
      const repository = buildMockRepository({
        getReportRunByIdAndUser: vi.fn().mockResolvedValue(null)
      });
      const service = new ReportRunService({
        repository,
        storageDeleter: buildMockStorageDeleter(),
        env: BASE_ENV
      });

      await expect(
        service.deleteTerminalReportRunForUser(TEST_RUN_ID, TEST_USER_ID)
      ).rejects.toThrow(ReportRunNotFoundError);

      expect(repository.deleteReportRunForUser).not.toHaveBeenCalled();
    });

    it("preserves database metadata when storage deletion fails", async () => {
      const run = buildRunRow({ status: "COMPLETED" });
      const repository = buildMockRepository({
        getReportRunByIdAndUser: vi.fn().mockResolvedValue(run),
        getArtifactForCompletedRun: vi.fn().mockResolvedValue({
          storageBucket: "reports",
          storagePath: `${TEST_USER_ID}/${TEST_RUN_ID}/report.pdf`
        })
      });
      const storageDeleter = buildMockStorageDeleter({
        deleteObject: vi.fn().mockRejectedValue(new ReportStorageDeleteError("storage failed"))
      });
      const service = new ReportRunService({
        repository,
        storageDeleter,
        env: BASE_ENV
      });

      await expect(
        service.deleteTerminalReportRunForUser(TEST_RUN_ID, TEST_USER_ID)
      ).rejects.toThrow(ReportStorageDeleteError);

      expect(repository.deleteReportRunForUser).not.toHaveBeenCalled();
    });

    it("treats an already-missing storage object as cleanup success", async () => {
      const logger = buildMockLogger();
      const repository = buildMockRepository({
        getReportRunByIdAndUser: vi.fn().mockResolvedValue(buildRunRow({ status: "COMPLETED" })),
        getArtifactForCompletedRun: vi.fn().mockResolvedValue({
          storageBucket: "reports",
          storagePath: `${TEST_USER_ID}/${TEST_RUN_ID}/report.pdf`
        })
      });
      const storageDeleter = buildMockStorageDeleter({
        deleteObject: vi.fn().mockResolvedValue({ missing: true })
      });
      const service = new ReportRunService({
        repository,
        storageDeleter,
        logger,
        env: BASE_ENV
      });

      const result = await service.deleteTerminalReportRunForUser(TEST_RUN_ID, TEST_USER_ID);

      expect(result.storageObjectMissing).toBe(true);
      expect(repository.deleteReportRunForUser).toHaveBeenCalledWith(TEST_RUN_ID, TEST_USER_ID);
      expect(logger.info).toHaveBeenCalledWith(
        "Report storage object was already missing during deletion.",
        expect.objectContaining({
          event: "report_run.storage_object_missing_on_delete",
          runId: TEST_RUN_ID,
          userId: TEST_USER_ID
        })
      );
    });
  });
});
