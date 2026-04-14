import type { ServerEnv } from "@/server/config";

import { describe, expect, it, vi, beforeEach } from "vitest";

const { mockGraphileRun, mockExecute } = vi.hoisted(() => {
  const mockGraphileRun = vi.fn().mockResolvedValue({ stop: vi.fn() });
  const mockExecute = vi.fn().mockResolvedValue({ status: "COMPLETED" });
  return { mockGraphileRun, mockExecute };
});

vi.mock("@/server/config", () => ({
  serverEnv: {
    REPORT_RUN_TASK_IDENTIFIER: "report.run.generate",
    GRAPHILE_WORKER_SCHEMA: "graphile_worker",
    GRAPHILE_WORKER_CONCURRENCY: 1,
    GRAPHILE_WORKER_POLL_INTERVAL_MS: 1000,
    DATABASE_URL: "postgres://localhost:5432/second-act"
  }
}));

vi.mock("graphile-worker", () => ({
  run: mockGraphileRun
}));

vi.mock("@/server/orchestrators/report-run-orchestrator", () => ({
  ReportRunOrchestrator: class {
    execute = mockExecute;
  },
  ReportRunNotQueuedError: class extends Error {
    override name = "ReportRunNotQueuedError";
  },
  OrchestratorReportRunNotFoundError: class extends Error {
    override name = "OrchestratorReportRunNotFoundError";
  }
}));

import {
  OrchestratorReportRunNotFoundError,
  ReportRunNotQueuedError
} from "@/server/orchestrators/report-run-orchestrator";
import { getWorkerBaselineMetadata, buildTaskList, startWorker } from "@/server/queue/worker";

function buildWorkerEnv(overrides: Partial<ServerEnv> = {}) {
  return {
    REPORT_RUN_TASK_IDENTIFIER: "report.run.generate",
    GRAPHILE_WORKER_SCHEMA: "graphile_worker",
    GRAPHILE_WORKER_CONCURRENCY: 3,
    GRAPHILE_WORKER_POLL_INTERVAL_MS: 1500,
    DATABASE_URL: "postgres://localhost:5432/second-act",
    ...overrides
  } as ServerEnv;
}

describe("worker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getWorkerBaselineMetadata", () => {
    it("builds startup metadata from the server environment", () => {
      expect(getWorkerBaselineMetadata(buildWorkerEnv())).toEqual({
        queueName: "report.run.generate",
        workerSchema: "graphile_worker",
        concurrency: 3,
        pollIntervalMs: 1500
      });
    });
  });

  describe("buildTaskList", () => {
    it("creates a task list keyed by the task identifier", () => {
      const env = buildWorkerEnv({ REPORT_RUN_TASK_IDENTIFIER: "custom.task" });
      const taskList = buildTaskList(env);

      expect(Object.keys(taskList)).toEqual(["custom.task"]);
      expect(typeof taskList["custom.task"]).toBe("function");
    });

    it("task handler validates reportRunId and calls execute", async () => {
      const env = buildWorkerEnv();
      const taskList = buildTaskList(env);
      const handler = taskList[env.REPORT_RUN_TASK_IDENTIFIER]!;
      const validId = "22222222-2222-4222-8222-222222222222";

      await handler({ reportRunId: validId }, {} as never);

      expect(mockExecute).toHaveBeenCalledWith(validId);
    });

    it("rejects a non-UUID reportRunId", async () => {
      const env = buildWorkerEnv();
      const taskList = buildTaskList(env);
      const handler = taskList[env.REPORT_RUN_TASK_IDENTIFIER]!;

      await expect(handler({ reportRunId: "not-a-uuid" }, {} as never)).rejects.toThrow();
      expect(mockExecute).not.toHaveBeenCalled();
    });

    it("rejects a missing reportRunId", async () => {
      const env = buildWorkerEnv();
      const taskList = buildTaskList(env);
      const handler = taskList[env.REPORT_RUN_TASK_IDENTIFIER]!;

      await expect(handler({}, {} as never)).rejects.toThrow();
      expect(mockExecute).not.toHaveBeenCalled();
    });

    it("logs and swallows ReportRunNotQueuedError for stale jobs", async () => {
      const env = buildWorkerEnv();
      const logger = { info: vi.fn(), warn: vi.fn() };
      const taskList = buildTaskList(env, logger);
      const handler = taskList[env.REPORT_RUN_TASK_IDENTIFIER]!;
      const validId = "22222222-2222-4222-8222-222222222222";

      mockExecute.mockRejectedValueOnce(
        new ReportRunNotQueuedError("Report run is no longer QUEUED.")
      );

      await expect(handler({ reportRunId: validId }, {} as never)).resolves.toBeUndefined();
      expect(logger.warn).toHaveBeenCalledWith(
        "Skipping stale report run job.",
        expect.objectContaining({
          reportRunId: validId,
          errorName: "ReportRunNotQueuedError"
        })
      );
    });

    it("logs and swallows OrchestratorReportRunNotFoundError for stale jobs", async () => {
      const env = buildWorkerEnv();
      const logger = { info: vi.fn(), warn: vi.fn() };
      const taskList = buildTaskList(env, logger);
      const handler = taskList[env.REPORT_RUN_TASK_IDENTIFIER]!;
      const validId = "22222222-2222-4222-8222-222222222222";

      mockExecute.mockRejectedValueOnce(
        new OrchestratorReportRunNotFoundError("Report run not found.")
      );

      await expect(handler({ reportRunId: validId }, {} as never)).resolves.toBeUndefined();
      expect(logger.warn).toHaveBeenCalledWith(
        "Skipping stale report run job.",
        expect.objectContaining({
          reportRunId: validId,
          errorName: "OrchestratorReportRunNotFoundError"
        })
      );
    });

    it("rethrows real pipeline failures", async () => {
      const env = buildWorkerEnv();
      const logger = { info: vi.fn(), warn: vi.fn() };
      const taskList = buildTaskList(env, logger);
      const handler = taskList[env.REPORT_RUN_TASK_IDENTIFIER]!;
      const validId = "22222222-2222-4222-8222-222222222222";

      mockExecute.mockRejectedValueOnce(new Error("render exploded"));

      await expect(handler({ reportRunId: validId }, {} as never)).rejects.toThrow(
        "render exploded"
      );
      expect(logger.warn).not.toHaveBeenCalled();
    });
  });

  describe("startWorker", () => {
    it("calls graphile-worker run with correct config", async () => {
      const env = buildWorkerEnv({
        DATABASE_URL: "postgres://db:5432/test",
        GRAPHILE_WORKER_SCHEMA: "custom_schema",
        GRAPHILE_WORKER_CONCURRENCY: 5,
        GRAPHILE_WORKER_POLL_INTERVAL_MS: 2000
      });
      const logger = { info: vi.fn(), warn: vi.fn() };

      await startWorker(env, logger);

      expect(mockGraphileRun).toHaveBeenCalledWith(
        expect.objectContaining({
          connectionString: "postgres://db:5432/test",
          schema: "custom_schema",
          concurrency: 5,
          pollInterval: 2000
        })
      );
    });

    it("logs startup and running messages", async () => {
      const env = buildWorkerEnv();
      const logger = { info: vi.fn(), warn: vi.fn() };

      await startWorker(env, logger);

      expect(logger.info).toHaveBeenCalledWith(
        "Starting Second Act worker.",
        expect.objectContaining({
          queueName: "report.run.generate"
        })
      );
      expect(logger.info).toHaveBeenCalledWith("Second Act worker is running.");
    });

    it("returns the graphile-worker runner", async () => {
      const env = buildWorkerEnv();
      const logger = { info: vi.fn(), warn: vi.fn() };

      const runner = await startWorker(env, logger);

      expect(runner).toBeDefined();
      expect(typeof runner.stop).toBe("function");
    });
  });
});
