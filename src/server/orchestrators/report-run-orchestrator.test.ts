import { describe, expect, it, vi, beforeEach } from "vitest";

import type { ReportRunForDocumentAssembly } from "./build-report-document";
import {
  ReportRunOrchestrator,
  ReportRunNotQueuedError,
  OrchestratorReportRunNotFoundError,
  ORCHESTRATOR_ERROR_CATEGORIES,
  ORCHESTRATOR_ERROR_CODES,
  type OrchestratorRepository,
  type ArtifactStorageStage
} from "./report-run-orchestrator";

// ---------------------------------------------------------------------------
// Mock buildReportDocument — tested independently
// ---------------------------------------------------------------------------

vi.mock("./build-report-document", () => ({
  buildReportDocument: vi.fn()
}));

const { buildReportDocument } = await import("./build-report-document");
const mockBuildReportDocument = vi.mocked(buildReportDocument);

// ---------------------------------------------------------------------------
// Shared IDs and clock
// ---------------------------------------------------------------------------

const RUN_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "11111111-1111-4111-8111-111111111111";
const PORTFOLIO_ID = "33333333-3333-4333-8333-333333333333";
const ARTIFACT_ID = "44444444-4444-4444-8444-444444444444";
const FIXED_NOW = new Date("2026-04-11T12:00:00.000Z");

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

type MockedRepository = {
  [K in keyof OrchestratorRepository]: ReturnType<typeof vi.fn>;
};

function createMockRepository(): MockedRepository {
  return {
    getReportRunForProcessing: vi.fn(),
    transitionToProcessing: vi.fn().mockResolvedValue(undefined),
    loadCompletedRunData: vi.fn(),
    completeRunAndIncrementUsage: vi.fn().mockResolvedValue(undefined),
    failRun: vi.fn().mockResolvedValue(undefined)
  };
}

function createMockCanonical() {
  return { buildForReportRun: vi.fn().mockResolvedValue({ status: "PROCESSING" }) };
}

function createMockAnalysis() {
  return { buildForReportRun: vi.fn().mockResolvedValue({ status: "PROCESSING" }) };
}

function createMockNarrative() {
  return { buildForReportRun: vi.fn().mockResolvedValue({ status: "PROCESSING" }) };
}

function createMockPdfRenderer() {
  return {
    rendererName: "mock-renderer",
    render: vi.fn().mockResolvedValue({
      filePath: "/tmp/report.pdf",
      mimeType: "application/pdf" as const,
      byteSize: 1024,
      checksumSha256: "abc123"
    })
  };
}

function createMockArtifactStorage() {
  return {
    storeForReportRun: vi.fn().mockResolvedValue({
      artifactId: ARTIFACT_ID,
      storageBucket: "reports",
      storagePath: `${USER_ID}/${RUN_ID}/report.pdf`
    })
  };
}

function createMockLogger() {
  return {
    info: vi.fn(),
    error: vi.fn()
  };
}

const FAKE_REPORT_DOCUMENT = { schemaVersion: "1.0.0", fakeField: "test" };

const QUEUED_RUN = {
  id: RUN_ID,
  userId: USER_ID,
  portfolioId: PORTFOLIO_ID,
  status: "QUEUED" as const,
  paymentStatus: "NOT_REQUIRED" as const
};

const COMPLETED_RUN_DATA: ReportRunForDocumentAssembly = {
  id: RUN_ID,
  userId: USER_ID,
  portfolioId: PORTFOLIO_ID,
  reportingCurrency: "USD",
  requestedAt: new Date("2026-04-11T11:55:00.000Z"),
  marketDataProvider: "yfinance",
  narrativeProvider: "openai-compatible",
  narrativeModel: "local-mistral",
  promptVersion: "narrative-explainer.v1",
  valuationAsOf: new Date("2026-04-10T20:00:00.000Z"),
  canonicalSnapshot: { schemaVersion: "1.0.0" },
  analysisOutput: { schemaVersion: "1.0.0" },
  narrativeOutput: { schemaVersion: "1.0.0" },
  portfolio: {
    name: "Test Portfolio",
    description: "A test portfolio",
    baseCurrency: "USD"
  }
};

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("ReportRunOrchestrator", () => {
  let repo: ReturnType<typeof createMockRepository>;
  let canonical: ReturnType<typeof createMockCanonical>;
  let analysis: ReturnType<typeof createMockAnalysis>;
  let narrative: ReturnType<typeof createMockNarrative>;
  let renderer: ReturnType<typeof createMockPdfRenderer>;
  let storage: ReturnType<typeof createMockArtifactStorage>;
  let logger: ReturnType<typeof createMockLogger>;
  let orchestrator: ReportRunOrchestrator;

  beforeEach(() => {
    vi.clearAllMocks();

    repo = createMockRepository();
    canonical = createMockCanonical();
    analysis = createMockAnalysis();
    narrative = createMockNarrative();
    renderer = createMockPdfRenderer();
    storage = createMockArtifactStorage();
    logger = createMockLogger();

    repo.getReportRunForProcessing.mockResolvedValue(QUEUED_RUN);
    repo.loadCompletedRunData.mockResolvedValue(COMPLETED_RUN_DATA);
    mockBuildReportDocument.mockReturnValue(FAKE_REPORT_DOCUMENT as any);

    orchestrator = new ReportRunOrchestrator({
      repository: repo as unknown as OrchestratorRepository,
      canonicalModelService: canonical,
      analysisEngineService: analysis,
      narrativeEngineService: narrative,
      pdfRenderer: renderer,
      artifactStorageService: storage,
      now: () => FIXED_NOW,
      logger
    });
  });

  // -------------------------------------------------------------------------
  // Happy path
  // -------------------------------------------------------------------------

  describe("happy path", () => {
    it("runs the full pipeline and returns COMPLETED result", async () => {
      const result = await orchestrator.execute(RUN_ID);

      expect(result).toEqual({
        runId: RUN_ID,
        status: "COMPLETED",
        artifactId: ARTIFACT_ID
      });
    });

    it("transitions to PROCESSING before running stages", async () => {
      await orchestrator.execute(RUN_ID);

      expect(repo.transitionToProcessing).toHaveBeenCalledWith(RUN_ID, FIXED_NOW);
    });

    it("calls pipeline stages in order with reportRunId", async () => {
      await orchestrator.execute(RUN_ID);

      const canonicalOrder = canonical.buildForReportRun.mock.invocationCallOrder[0];
      const analysisOrder = analysis.buildForReportRun.mock.invocationCallOrder[0];
      const narrativeOrder = narrative.buildForReportRun.mock.invocationCallOrder[0];

      expect(canonical.buildForReportRun).toHaveBeenCalledWith(RUN_ID);
      expect(analysis.buildForReportRun).toHaveBeenCalledWith(RUN_ID);
      expect(narrative.buildForReportRun).toHaveBeenCalledWith(RUN_ID);
      expect(canonicalOrder).toBeLessThan(analysisOrder);
      expect(analysisOrder).toBeLessThan(narrativeOrder);
    });

    it("loads completed run data and calls buildReportDocument", async () => {
      await orchestrator.execute(RUN_ID);

      expect(repo.loadCompletedRunData).toHaveBeenCalledWith(RUN_ID);
      expect(mockBuildReportDocument).toHaveBeenCalledWith(COMPLETED_RUN_DATA, FIXED_NOW);
    });

    it("passes report document to the PDF renderer", async () => {
      await orchestrator.execute(RUN_ID);

      expect(renderer.render).toHaveBeenCalledWith(FAKE_REPORT_DOCUMENT);
    });

    it("passes render result and userId to artifact storage", async () => {
      const expectedRenderResult = {
        filePath: "/tmp/report.pdf",
        mimeType: "application/pdf" as const,
        byteSize: 1024,
        checksumSha256: "abc123"
      };

      await orchestrator.execute(RUN_ID);

      expect(storage.storeForReportRun).toHaveBeenCalledWith({
        reportRunId: RUN_ID,
        userId: USER_ID,
        renderResult: expectedRenderResult
      });
    });

    it("completes run and increments usage atomically", async () => {
      await orchestrator.execute(RUN_ID);

      expect(repo.completeRunAndIncrementUsage).toHaveBeenCalledWith(RUN_ID, USER_ID, FIXED_NOW);
    });

    it("emits report.completed domain event", async () => {
      await orchestrator.execute(RUN_ID);

      expect(logger.info).toHaveBeenCalledWith("Domain event emitted.", {
        event: "report.completed",
        runId: RUN_ID,
        userId: USER_ID,
        portfolioId: PORTFOLIO_ID,
        artifactId: ARTIFACT_ID
      });
    });

    it("logs status transitions with payment status for auditability", async () => {
      await orchestrator.execute(RUN_ID);

      expect(logger.info).toHaveBeenCalledWith(
        "Report run status transition.",
        expect.objectContaining({
          event: "report_run.status_transition",
          runId: RUN_ID,
          userId: USER_ID,
          portfolioId: PORTFOLIO_ID,
          paymentStatus: "NOT_REQUIRED",
          statusFrom: "QUEUED",
          statusTo: "PROCESSING"
        })
      );
      expect(logger.info).toHaveBeenCalledWith(
        "Report run status transition.",
        expect.objectContaining({
          event: "report_run.status_transition",
          runId: RUN_ID,
          paymentStatus: "NOT_REQUIRED",
          statusFrom: "PROCESSING",
          statusTo: "COMPLETED"
        })
      );
    });

    it("logs stage timing metadata for successful pipeline stages", async () => {
      await orchestrator.execute(RUN_ID);

      expect(logger.info).toHaveBeenCalledWith(
        "Report run stage started.",
        expect.objectContaining({
          event: "report_run.stage_started",
          runId: RUN_ID,
          userId: USER_ID,
          portfolioId: PORTFOLIO_ID,
          paymentStatus: "NOT_REQUIRED",
          stage: "canonical_model"
        })
      );
      expect(logger.info).toHaveBeenCalledWith(
        "Report run stage completed.",
        expect.objectContaining({
          event: "report_run.stage_completed",
          runId: RUN_ID,
          stage: "canonical_model",
          durationMs: expect.any(Number)
        })
      );
    });

    it("logs overall processing completion duration", async () => {
      await orchestrator.execute(RUN_ID);

      expect(logger.info).toHaveBeenCalledWith(
        "Report run processing completed.",
        expect.objectContaining({
          event: "report_run.processing_completed",
          runId: RUN_ID,
          userId: USER_ID,
          portfolioId: PORTFOLIO_ID,
          artifactId: ARTIFACT_ID,
          durationMs: expect.any(Number)
        })
      );
    });
  });

  // -------------------------------------------------------------------------
  // Guard: run not found
  // -------------------------------------------------------------------------

  describe("guard — run not found", () => {
    it("throws OrchestratorReportRunNotFoundError", async () => {
      repo.getReportRunForProcessing.mockResolvedValue(null);

      await expect(orchestrator.execute(RUN_ID)).rejects.toThrow(
        OrchestratorReportRunNotFoundError
      );
    });

    it("does not transition to PROCESSING", async () => {
      repo.getReportRunForProcessing.mockResolvedValue(null);

      await expect(orchestrator.execute(RUN_ID)).rejects.toThrow();
      expect(repo.transitionToProcessing).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Guard: run not QUEUED
  // -------------------------------------------------------------------------

  describe("guard — run not QUEUED", () => {
    for (const status of ["DRAFT", "PROCESSING", "COMPLETED", "FAILED"]) {
      it(`throws ReportRunNotQueuedError for status "${status}"`, async () => {
        repo.getReportRunForProcessing.mockResolvedValue({
          ...QUEUED_RUN,
          status
        });

        await expect(orchestrator.execute(RUN_ID)).rejects.toThrow(ReportRunNotQueuedError);
        expect(repo.transitionToProcessing).not.toHaveBeenCalled();
      });
    }
  });

  // -------------------------------------------------------------------------
  // Stage failures
  // -------------------------------------------------------------------------

  describe("stage failures", () => {
    const stageScenarios: {
      label: string;
      errorCode: string;
      errorCategory: string;
      failFn: () => void;
      shouldNotBeCalled: string[];
    }[] = [
      {
        label: "canonical model service",
        errorCode: ORCHESTRATOR_ERROR_CODES.CANONICAL_FAILURE,
        errorCategory: ORCHESTRATOR_ERROR_CATEGORIES.MARKET_DATA_OR_CANONICAL_FAILURE,
        failFn: () => {
          canonical.buildForReportRun.mockRejectedValue(new Error("Market data unavailable"));
        },
        shouldNotBeCalled: ["analysis", "narrative", "render", "store"]
      },
      {
        label: "analysis engine service",
        errorCode: ORCHESTRATOR_ERROR_CODES.ANALYSIS_FAILURE,
        errorCategory: ORCHESTRATOR_ERROR_CATEGORIES.ANALYSIS_FAILURE,
        failFn: () => {
          analysis.buildForReportRun.mockRejectedValue(new Error("Analysis computation failed"));
        },
        shouldNotBeCalled: ["narrative", "render", "store"]
      },
      {
        label: "narrative engine service",
        errorCode: ORCHESTRATOR_ERROR_CODES.NARRATIVE_FAILURE,
        errorCategory: ORCHESTRATOR_ERROR_CATEGORIES.NARRATIVE_FAILURE,
        failFn: () => {
          narrative.buildForReportRun.mockRejectedValue(new Error("LLM timeout"));
        },
        shouldNotBeCalled: ["render", "store"]
      },
      {
        label: "PDF renderer",
        errorCode: ORCHESTRATOR_ERROR_CODES.RENDER_FAILURE,
        errorCategory: ORCHESTRATOR_ERROR_CATEGORIES.PDF_FAILURE,
        failFn: () => {
          renderer.render.mockRejectedValue(new Error("Chromium crash"));
        },
        shouldNotBeCalled: ["store"]
      },
      {
        label: "artifact storage",
        errorCode: ORCHESTRATOR_ERROR_CODES.STORAGE_FAILURE,
        errorCategory: ORCHESTRATOR_ERROR_CATEGORIES.STORAGE_FAILURE,
        failFn: () => {
          storage.storeForReportRun.mockRejectedValue(new Error("Upload failed"));
        },
        shouldNotBeCalled: []
      }
    ];

    for (const scenario of stageScenarios) {
      describe(`when ${scenario.label} fails`, () => {
        beforeEach(() => {
          scenario.failFn();
        });

        it("transitions the run to FAILED with correct error code", async () => {
          await expect(orchestrator.execute(RUN_ID)).rejects.toThrow();

          expect(repo.failRun).toHaveBeenCalledWith(
            expect.objectContaining({
              reportRunId: RUN_ID,
              errorCode: scenario.errorCode,
              failedAt: FIXED_NOW
            })
          );
        });

        it("emits report.failed domain event", async () => {
          await expect(orchestrator.execute(RUN_ID)).rejects.toThrow();

          expect(logger.error).toHaveBeenCalledWith(
            "Domain event emitted.",
            expect.objectContaining({
              event: "report.failed",
              runId: RUN_ID,
              errorCode: scenario.errorCode,
              errorCategory: scenario.errorCategory
            })
          );
        });

        it("logs stage failure timing and error category", async () => {
          await expect(orchestrator.execute(RUN_ID)).rejects.toThrow();

          expect(logger.error).toHaveBeenCalledWith(
            "Report run stage failed.",
            expect.objectContaining({
              event: "report_run.stage_failed",
              runId: RUN_ID,
              userId: USER_ID,
              portfolioId: PORTFOLIO_ID,
              paymentStatus: "NOT_REQUIRED",
              errorCode: scenario.errorCode,
              errorCategory: scenario.errorCategory,
              durationMs: expect.any(Number)
            })
          );
        });

        it("logs FAILED status transition with payment status", async () => {
          await expect(orchestrator.execute(RUN_ID)).rejects.toThrow();

          expect(logger.info).toHaveBeenCalledWith(
            "Report run status transition.",
            expect.objectContaining({
              event: "report_run.status_transition",
              runId: RUN_ID,
              paymentStatus: "NOT_REQUIRED",
              statusFrom: "PROCESSING",
              statusTo: "FAILED"
            })
          );
        });

        it("does not call completeRunAndIncrementUsage", async () => {
          await expect(orchestrator.execute(RUN_ID)).rejects.toThrow();

          expect(repo.completeRunAndIncrementUsage).not.toHaveBeenCalled();
        });

        if (scenario.shouldNotBeCalled.length > 0) {
          it(`does not call downstream stages: ${scenario.shouldNotBeCalled.join(", ")}`, async () => {
            await expect(orchestrator.execute(RUN_ID)).rejects.toThrow();

            const stageMap: Record<string, ReturnType<typeof vi.fn>> = {
              analysis: analysis.buildForReportRun,
              narrative: narrative.buildForReportRun,
              render: renderer.render,
              store: storage.storeForReportRun
            };

            for (const name of scenario.shouldNotBeCalled) {
              expect(stageMap[name]).not.toHaveBeenCalled();
            }
          });
        }
      });
    }
  });

  // -------------------------------------------------------------------------
  // Orchestration failures (non-stage errors)
  // -------------------------------------------------------------------------

  describe("orchestration failures", () => {
    it("fails with ORCHESTRATION_FAILURE when loadCompletedRunData returns null", async () => {
      repo.loadCompletedRunData.mockResolvedValue(null);

      await expect(orchestrator.execute(RUN_ID)).rejects.toThrow(/not found after pipeline stages/);

      expect(repo.failRun).toHaveBeenCalledWith(
        expect.objectContaining({
          reportRunId: RUN_ID,
          errorCode: ORCHESTRATOR_ERROR_CODES.ORCHESTRATION_FAILURE
        })
      );
    });

    it("fails with ORCHESTRATION_FAILURE when buildReportDocument throws", async () => {
      mockBuildReportDocument.mockImplementation(() => {
        throw new Error("Invalid canonical snapshot JSON");
      });

      await expect(orchestrator.execute(RUN_ID)).rejects.toThrow("Invalid canonical snapshot JSON");

      expect(repo.failRun).toHaveBeenCalledWith(
        expect.objectContaining({
          reportRunId: RUN_ID,
          errorCode: ORCHESTRATOR_ERROR_CODES.ORCHESTRATION_FAILURE
        })
      );
    });

    it("fails with ORCHESTRATION_FAILURE when completeRunAndIncrementUsage throws", async () => {
      repo.completeRunAndIncrementUsage.mockRejectedValue(new Error("Transaction deadlock"));

      await expect(orchestrator.execute(RUN_ID)).rejects.toThrow("Transaction deadlock");

      expect(repo.failRun).toHaveBeenCalledWith(
        expect.objectContaining({
          reportRunId: RUN_ID,
          errorCode: ORCHESTRATOR_ERROR_CODES.ORCHESTRATION_FAILURE
        })
      );
    });
  });

  // -------------------------------------------------------------------------
  // Resilience: failRun itself throws
  // -------------------------------------------------------------------------

  describe("resilience — failRun throws", () => {
    it("logs the failure-to-persist error and still re-throws the original error", async () => {
      canonical.buildForReportRun.mockRejectedValue(new Error("Market data unavailable"));
      repo.failRun.mockRejectedValue(new Error("DB connection lost"));

      await expect(orchestrator.execute(RUN_ID)).rejects.toThrow();

      expect(logger.error).toHaveBeenCalledWith(
        "Failed to persist failure status for report run.",
        expect.objectContaining({
          reportRunId: RUN_ID,
          errorCode: ORCHESTRATOR_ERROR_CODES.CANONICAL_FAILURE,
          originalError: "Market data unavailable",
          failError: "DB connection lost"
        })
      );
    });
  });
});
