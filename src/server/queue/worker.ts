import { serverEnv } from "@/server/config";

/**
 * Step 1 baseline worker entrypoint. Job registration is added in Step 11 once
 * the report pipeline stages exist.
 */
function main() {
  console.info("Second Act worker baseline is configured.", {
    queueName: serverEnv.REPORT_RUN_TASK_IDENTIFIER,
    workerSchema: serverEnv.GRAPHILE_WORKER_SCHEMA,
    concurrency: serverEnv.GRAPHILE_WORKER_CONCURRENCY,
    pollIntervalMs: serverEnv.GRAPHILE_WORKER_POLL_INTERVAL_MS
  });
}

main();
