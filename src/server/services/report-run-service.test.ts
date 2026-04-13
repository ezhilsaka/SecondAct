import { describe, expect, it, vi } from "vitest";

import {
    ArtifactNotFoundError,
    type JobEnqueuer,
    PortfolioNotFoundError,
    type ReportRunRepository,
    ReportRunNotFoundError,
    ReportRunService,
    SignedUrlError,
    type StorageSigner,
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
    SIGNED_URL_EXPIRY_SECONDS: 300,
};

function buildMockRepository(
    overrides: Partial<ReportRunRepository> = {}
): ReportRunRepository {
    return {
        verifyPortfolioOwnership: vi.fn().mockResolvedValue(true),
        createReportRun: vi.fn().mockResolvedValue({ id: TEST_RUN_ID }),
        deleteReportRun: vi.fn().mockResolvedValue(undefined),
        getReportRunByIdAndUser: vi.fn().mockResolvedValue(null),
        getArtifactForCompletedRun: vi.fn().mockResolvedValue(null),
        ...overrides,
    };
}

function buildMockJobEnqueuer(
    overrides: Partial<JobEnqueuer> = {}
): JobEnqueuer {
    return {
        enqueue: vi.fn().mockResolvedValue(undefined),
        ...overrides,
    };
}

function buildMockStorageSigner(
    overrides: Partial<StorageSigner> = {}
): StorageSigner {
    return {
        createSignedUrl: vi
            .fn()
            .mockResolvedValue({ signedUrl: "https://storage.example.com/signed" }),
        ...overrides,
    };
}

function buildRunRow(overrides: Record<string, unknown> = {}) {
    return {
        id: TEST_RUN_ID,
        userId: TEST_USER_ID,
        portfolioId: TEST_PORTFOLIO_ID,
        status: "QUEUED",
        paymentStatus: "NOT_REQUIRED",
        reportingCurrency: "CAD",
        errorCode: null,
        requestedAt: new Date("2025-01-01T00:00:00Z"),
        startedAt: null,
        completedAt: null,
        failedAt: null,
        ...overrides,
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

            const service = new ReportRunService({
                repository,
                jobEnqueuer,
                env: BASE_ENV,
            });

            const result = await service.createAndEnqueue({
                userId: TEST_USER_ID,
                portfolioId: TEST_PORTFOLIO_ID,
                reportingCurrency: "CAD",
            });

            expect(result).toEqual({ runId: TEST_RUN_ID, status: "QUEUED" });
            expect(repository.verifyPortfolioOwnership).toHaveBeenCalledWith(
                TEST_USER_ID,
                TEST_PORTFOLIO_ID
            );
            expect(repository.createReportRun).toHaveBeenCalledWith({
                userId: TEST_USER_ID,
                portfolioId: TEST_PORTFOLIO_ID,
                reportingCurrency: "CAD",
            });
            expect(jobEnqueuer.enqueue).toHaveBeenCalledWith("report.run.generate", {
                reportRunId: TEST_RUN_ID,
            });
        });

        it("throws PortfolioNotFoundError when portfolio is not owned by user", async () => {
            const repository = buildMockRepository({
                verifyPortfolioOwnership: vi.fn().mockResolvedValue(false),
            });

            const service = new ReportRunService({
                repository,
                jobEnqueuer: buildMockJobEnqueuer(),
                env: BASE_ENV,
            });

            await expect(
                service.createAndEnqueue({
                    userId: TEST_USER_ID,
                    portfolioId: TEST_PORTFOLIO_ID,
                    reportingCurrency: "CAD",
                })
            ).rejects.toThrow(PortfolioNotFoundError);

            expect(repository.createReportRun).not.toHaveBeenCalled();
        });

        it("rejects an invalid userId", async () => {
            const service = new ReportRunService({
                repository: buildMockRepository(),
                jobEnqueuer: buildMockJobEnqueuer(),
                env: BASE_ENV,
            });

            await expect(
                service.createAndEnqueue({
                    userId: "not-a-uuid",
                    portfolioId: TEST_PORTFOLIO_ID,
                    reportingCurrency: "CAD",
                })
            ).rejects.toThrow();
        });

        it("rejects an invalid portfolioId", async () => {
            const service = new ReportRunService({
                repository: buildMockRepository(),
                jobEnqueuer: buildMockJobEnqueuer(),
                env: BASE_ENV,
            });

            await expect(
                service.createAndEnqueue({
                    userId: TEST_USER_ID,
                    portfolioId: "not-a-uuid",
                    reportingCurrency: "CAD",
                })
            ).rejects.toThrow();
        });

        it("deletes the created run when enqueue fails", async () => {
            const repository = buildMockRepository();
            const enqueueError = new Error("connection refused");
            const jobEnqueuer = buildMockJobEnqueuer({
                enqueue: vi.fn().mockRejectedValue(enqueueError),
            });

            const service = new ReportRunService({
                repository,
                jobEnqueuer,
                env: BASE_ENV,
            });

            await expect(
                service.createAndEnqueue({
                    userId: TEST_USER_ID,
                    portfolioId: TEST_PORTFOLIO_ID,
                    reportingCurrency: "CAD",
                })
            ).rejects.toThrow("connection refused");

            expect(repository.createReportRun).toHaveBeenCalled();
            expect(repository.deleteReportRun).toHaveBeenCalledWith(TEST_RUN_ID);
        });

        it("preserves the enqueue error when cleanup delete also fails", async () => {
            const repository = buildMockRepository({
                deleteReportRun: vi.fn().mockRejectedValue(new Error("delete failed")),
            });
            const jobEnqueuer = buildMockJobEnqueuer({
                enqueue: vi.fn().mockRejectedValue(new Error("connection refused")),
            });

            const service = new ReportRunService({
                repository,
                jobEnqueuer,
                env: BASE_ENV,
            });

            await expect(
                service.createAndEnqueue({
                    userId: TEST_USER_ID,
                    portfolioId: TEST_PORTFOLIO_ID,
                    reportingCurrency: "CAD",
                })
            ).rejects.toThrow("connection refused");

            expect(repository.deleteReportRun).toHaveBeenCalledWith(TEST_RUN_ID);
        });
    });

    // ---------------------------------------------------------------------------
    // getStatus
    // ---------------------------------------------------------------------------

    describe("getStatus", () => {
        it("returns the run status for a valid run", async () => {
            const run = buildRunRow({ status: "PROCESSING", startedAt: new Date("2025-01-01T00:01:00Z") });
            const repository = buildMockRepository({
                getReportRunByIdAndUser: vi.fn().mockResolvedValue(run),
            });

            const service = new ReportRunService({ repository, env: BASE_ENV });

            const result = await service.getStatus(TEST_RUN_ID, TEST_USER_ID);

            expect(result).toEqual({
                runId: TEST_RUN_ID,
                portfolioId: TEST_PORTFOLIO_ID,
                status: "PROCESSING",
                paymentStatus: "NOT_REQUIRED",
                reportingCurrency: "CAD",
                errorCode: null,
                requestedAt: "2025-01-01T00:00:00.000Z",
                startedAt: "2025-01-01T00:01:00.000Z",
                completedAt: null,
                failedAt: null,
            });
        });

        it("throws ReportRunNotFoundError when run does not exist", async () => {
            const repository = buildMockRepository({
                getReportRunByIdAndUser: vi.fn().mockResolvedValue(null),
            });

            const service = new ReportRunService({ repository, env: BASE_ENV });

            await expect(service.getStatus(TEST_RUN_ID, TEST_USER_ID)).rejects.toThrow(
                ReportRunNotFoundError
            );
        });

        it("rejects an invalid runId", async () => {
            const service = new ReportRunService({
                repository: buildMockRepository(),
                env: BASE_ENV,
            });

            await expect(service.getStatus("not-a-uuid", TEST_USER_ID)).rejects.toThrow();
        });
    });

    // ---------------------------------------------------------------------------
    // getPdfSignedUrl
    // ---------------------------------------------------------------------------

    describe("getPdfSignedUrl", () => {
        it("returns a signed URL for a completed run's PDF", async () => {
            const run = buildRunRow({ status: "COMPLETED", completedAt: new Date("2025-01-01T01:00:00Z") });
            const artifact = {
                storageBucket: "reports",
                storagePath: `${TEST_USER_ID}/${TEST_RUN_ID}/report.pdf`,
            };
            const repository = buildMockRepository({
                getReportRunByIdAndUser: vi.fn().mockResolvedValue(run),
                getArtifactForCompletedRun: vi.fn().mockResolvedValue(artifact),
            });
            const storageSigner = buildMockStorageSigner();

            const service = new ReportRunService({
                repository,
                storageSigner,
                env: BASE_ENV,
            });

            const result = await service.getPdfSignedUrl(TEST_RUN_ID, TEST_USER_ID);

            expect(result).toEqual({
                signedUrl: "https://storage.example.com/signed",
                expiresInSeconds: 300,
            });
            expect(storageSigner.createSignedUrl).toHaveBeenCalledWith(
                "reports",
                `${TEST_USER_ID}/${TEST_RUN_ID}/report.pdf`,
                300
            );
        });

        it("throws ReportRunNotFoundError when run does not exist", async () => {
            const repository = buildMockRepository({
                getReportRunByIdAndUser: vi.fn().mockResolvedValue(null),
            });

            const service = new ReportRunService({ repository, env: BASE_ENV });

            await expect(service.getPdfSignedUrl(TEST_RUN_ID, TEST_USER_ID)).rejects.toThrow(
                ReportRunNotFoundError
            );
        });

        it("throws ArtifactNotFoundError when run is not COMPLETED", async () => {
            const run = buildRunRow({ status: "PROCESSING" });
            const repository = buildMockRepository({
                getReportRunByIdAndUser: vi.fn().mockResolvedValue(run),
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
                getArtifactForCompletedRun: vi.fn().mockResolvedValue(null),
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
                storagePath: `${TEST_USER_ID}/${TEST_RUN_ID}/report.pdf`,
            };
            const repository = buildMockRepository({
                getReportRunByIdAndUser: vi.fn().mockResolvedValue(run),
                getArtifactForCompletedRun: vi.fn().mockResolvedValue(artifact),
            });
            const storageSigner = buildMockStorageSigner({
                createSignedUrl: vi
                    .fn()
                    .mockRejectedValue(new SignedUrlError("Storage error")),
            });

            const service = new ReportRunService({
                repository,
                storageSigner,
                env: BASE_ENV,
            });

            await expect(service.getPdfSignedUrl(TEST_RUN_ID, TEST_USER_ID)).rejects.toThrow(
                SignedUrlError
            );
        });
    });
});
