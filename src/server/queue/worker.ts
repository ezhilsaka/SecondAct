import { pathToFileURL } from "node:url";

import { run as graphileRun, type TaskList } from "graphile-worker";

import { serverEnv } from "@/server/config";
import type { ServerEnv } from "@/server/config";
import { ReportRunOrchestrator } from "@/server/orchestrators/report-run-orchestrator";
import { uuidSchema } from "@/server/shared/types";

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
export function buildTaskList(env: ServerEnv = serverEnv): TaskList {
  return {
    [env.REPORT_RUN_TASK_IDENTIFIER]: async (payload) => {
      const { reportRunId } = payload as { reportRunId: unknown };
      const validatedRunId = uuidSchema.parse(reportRunId);
      const orchestrator = new ReportRunOrchestrator();
      await orchestrator.execute(validatedRunId);
    }
  };
}

/**
 * Start the graphile-worker runner, connecting to the Supabase Postgres
 * database and polling for jobs.
 */
export async function startWorker(
  env: ServerEnv = serverEnv,
  logger: Pick<typeof console, "info"> = console
) {
  const metadata = getWorkerBaselineMetadata(env);
  logger.info("Starting Second Act worker.", metadata);

  const runner = await graphileRun({
    connectionString: env.DATABASE_URL,
    schema: env.GRAPHILE_WORKER_SCHEMA,
    concurrency: env.GRAPHILE_WORKER_CONCURRENCY,
    pollInterval: env.GRAPHILE_WORKER_POLL_INTERVAL_MS,
    taskList: buildTaskList(env)
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
