import type { ServerEnv } from "@/server/config";

import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/config", () => ({
  serverEnv: {
    REPORT_RUN_TASK_IDENTIFIER: "report.run.generate",
    GRAPHILE_WORKER_SCHEMA: "graphile_worker",
    GRAPHILE_WORKER_CONCURRENCY: 1,
    GRAPHILE_WORKER_POLL_INTERVAL_MS: 1000
  }
}));

import { getWorkerBaselineMetadata, runWorkerBaseline } from "@/server/queue/worker";

function buildWorkerEnv(overrides: Partial<ServerEnv> = {}) {
  return {
    REPORT_RUN_TASK_IDENTIFIER: "report.run.generate",
    GRAPHILE_WORKER_SCHEMA: "graphile_worker",
    GRAPHILE_WORKER_CONCURRENCY: 3,
    GRAPHILE_WORKER_POLL_INTERVAL_MS: 1500,
    ...overrides
  } as ServerEnv;
}

describe("worker baseline", () => {
  it("builds startup metadata from the server environment", () => {
    expect(getWorkerBaselineMetadata(buildWorkerEnv())).toEqual({
      queueName: "report.run.generate",
      workerSchema: "graphile_worker",
      concurrency: 3,
      pollIntervalMs: 1500
    });
  });

  it("logs the startup message and metadata", () => {
    const info = vi.fn();
    const env = buildWorkerEnv({
      REPORT_RUN_TASK_IDENTIFIER: "report.run.custom",
      GRAPHILE_WORKER_SCHEMA: "custom_worker",
      GRAPHILE_WORKER_CONCURRENCY: 5,
      GRAPHILE_WORKER_POLL_INTERVAL_MS: 500
    });

    expect(runWorkerBaseline(env, { info })).toEqual({
      queueName: "report.run.custom",
      workerSchema: "custom_worker",
      concurrency: 5,
      pollIntervalMs: 500
    });
    expect(info).toHaveBeenCalledWith("Second Act worker baseline is configured.", {
      queueName: "report.run.custom",
      workerSchema: "custom_worker",
      concurrency: 5,
      pollIntervalMs: 500
    });
  });
});
