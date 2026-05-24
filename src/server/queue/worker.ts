import { pathToFileURL } from "node:url";

import { run as graphileRun, type TaskList } from "graphile-worker";

import { serverEnv } from "@/server/config";
import type { ServerEnv } from "@/server/config";
import {
  OrchestratorReportRunNotFoundError,
  ReportRunNotQueuedError,
  ReportRunOrchestrator
} from "@/server/orchestrators/report-run-orchestrator";
import { uuidSchema } from "@/server/shared/types";

type WorkerLogger = Pick<typeof console, "info" | "warn"> & Partial<Pick<typeof console, "error">>;

export function getWorkerBaselineMetadata(env: ServerEnv = serverEnv) {
  return {
    queueName: env.REPORT_RUN_TASK_IDENTIFIER,
    workerSchema: env.GRAPHILE_WORKER_SCHEMA,
    concurrency: env.GRAPHILE_WORKER_CONCURRENCY,
    pollIntervalMs: env.GRAPHILE_WORKER_POLL_INTERVAL_MS
  };
}

/**
 * Build the graphile-worker task list.
 * Each task is keyed by the task identifier from env config.
 */
export function buildTaskList(
  env: ServerEnv = serverEnv,
  logger: WorkerLogger = console
): TaskList {
  return {
    [env.REPORT_RUN_TASK_IDENTIFIER]: async (payload) => {
      const { reportRunId } = payload as { reportRunId: unknown };
      const validatedRunId = uuidSchema.parse(reportRunId);
      const orchestrator = new ReportRunOrchestrator();

      logger.info("Report run job received.", {
        event: "report_run.job_received",
        reportRunId: validatedRunId,
        taskIdentifier: env.REPORT_RUN_TASK_IDENTIFIER
      });

      try {
        await orchestrator.execute(validatedRunId);
        logger.info("Report run job completed.", {
          event: "report_run.job_completed",
          reportRunId: validatedRunId,
          taskIdentifier: env.REPORT_RUN_TASK_IDENTIFIER
        });
      } catch (error) {
        if (
          error instanceof ReportRunNotQueuedError ||
          error instanceof OrchestratorReportRunNotFoundError
        ) {
          logger.warn("Skipping stale report run job.", {
            event: "report_run.job_skipped_stale",
            reportRunId: validatedRunId,
            taskIdentifier: env.REPORT_RUN_TASK_IDENTIFIER,
            errorName: error.name,
            errorMessage: error.message
          });
          return;
        }

        logger.error?.("Report run job failed.", {
          event: "report_run.job_failed",
          reportRunId: validatedRunId,
          taskIdentifier: env.REPORT_RUN_TASK_IDENTIFIER,
          errorName: error instanceof Error ? error.name : "UnknownError",
          errorMessage: error instanceof Error ? error.message : "Unknown worker error"
        });
        throw error;
      }
    }
  };
}

/**
 * Start the graphile-worker runner, connecting to the Supabase Postgres
 * database and polling for jobs.
 */
export async function startWorker(env: ServerEnv = serverEnv, logger: WorkerLogger = console) {
  const metadata = getWorkerBaselineMetadata(env);
  logger.info("Starting Second Act worker.", metadata);

  const runner = await graphileRun({
    connectionString: env.DATABASE_URL,
    schema: env.GRAPHILE_WORKER_SCHEMA,
    concurrency: env.GRAPHILE_WORKER_CONCURRENCY,
    pollInterval: env.GRAPHILE_WORKER_POLL_INTERVAL_MS,
    taskList: buildTaskList(env, logger)
  });

  logger.info("Second Act worker is running.");

  return runner;
}

function isExecutedAsEntryPoint() {
  return Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
}

if (isExecutedAsEntryPoint()) {
  startWorker();
}
