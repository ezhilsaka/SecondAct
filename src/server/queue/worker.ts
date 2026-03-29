import { pathToFileURL } from "node:url";

import { serverEnv } from "@/server/config";
import type { ServerEnv } from "@/server/config";

export function getWorkerBaselineMetadata(env: ServerEnv = serverEnv) {
  return {
    queueName: env.REPORT_RUN_TASK_IDENTIFIER,
    workerSchema: env.GRAPHILE_WORKER_SCHEMA,
    concurrency: env.GRAPHILE_WORKER_CONCURRENCY,
    pollIntervalMs: env.GRAPHILE_WORKER_POLL_INTERVAL_MS
  };
}

/**
 * Step 1 baseline worker entrypoint. Job registration is added in Step 11 once
 * the report pipeline stages exist.
 */
export function runWorkerBaseline(
  env: ServerEnv = serverEnv,
  logger: Pick<typeof console, "info"> = console
) {
  const metadata = getWorkerBaselineMetadata(env);

  logger.info("Second Act worker baseline is configured.", metadata);

  return metadata;
}

function isExecutedAsEntryPoint() {
  return Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
}

if (isExecutedAsEntryPoint()) {
  runWorkerBaseline();
}
