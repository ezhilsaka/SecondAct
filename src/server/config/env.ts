import { loadEnvConfig } from "@next/env";
import { z } from "zod";

loadEnvConfig(process.cwd());

const optionalEnvString = z.preprocess((value) => {
  if (typeof value === "string" && value.trim().length === 0) {
    return undefined;
  }

  return value;
}, z.string().min(1).optional());

function requiredString(name: string) {
  return z.string().min(1, `${name} is required.`);
}

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: requiredString("DATABASE_URL"),
  DIRECT_URL: optionalEnvString,
  NEXT_PUBLIC_SUPABASE_URL: z.string().url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL."),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: requiredString("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  SUPABASE_SERVICE_ROLE_KEY: requiredString("SUPABASE_SERVICE_ROLE_KEY"),
  SUPABASE_REPORTS_BUCKET: requiredString("SUPABASE_REPORTS_BUCKET"),
  GRAPHILE_WORKER_SCHEMA: requiredString("GRAPHILE_WORKER_SCHEMA").default("graphile_worker"),
  GRAPHILE_WORKER_CONCURRENCY: z.coerce
    .number()
    .int()
    .positive("GRAPHILE_WORKER_CONCURRENCY must be greater than zero.")
    .default(1),
  GRAPHILE_WORKER_POLL_INTERVAL_MS: z.coerce
    .number()
    .int()
    .positive("GRAPHILE_WORKER_POLL_INTERVAL_MS must be greater than zero.")
    .default(1000),
  REPORT_RUN_TASK_IDENTIFIER: requiredString("REPORT_RUN_TASK_IDENTIFIER").default(
    "report.run.generate"
  ),
  NARRATIVE_PROVIDER: z
    .string()
    .min(1, "NARRATIVE_PROVIDER is required.")
    .default("openai-compatible"),
  NARRATIVE_PROVIDER_BASE_URL: z.string().url("NARRATIVE_PROVIDER_BASE_URL must be a valid URL."),
  NARRATIVE_PROVIDER_API_KEY: requiredString("NARRATIVE_PROVIDER_API_KEY"),
  NARRATIVE_MODEL: requiredString("NARRATIVE_MODEL"),
  MARKET_DATA_SERVICE_URL: z.string().url("MARKET_DATA_SERVICE_URL must be a valid URL."),
  MARKET_DATA_SERVICE_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .positive("MARKET_DATA_SERVICE_TIMEOUT_MS must be greater than zero.")
    .default(10000),
  PLAYWRIGHT_BROWSER: z.enum(["chromium"]).default("chromium")
});

function formatIssues(issues: z.ZodIssue[]): string {
  return issues.map((issue) => `- ${issue.message}`).join("\n");
}

const parsedEnv = serverEnvSchema.safeParse(process.env);

if (!parsedEnv.success) {
  throw new Error(
    `Invalid server environment configuration:\n${formatIssues(parsedEnv.error.issues)}`
  );
}

/**
 * Server-only runtime configuration for the report pipeline and supporting services.
 */
export const serverEnv = parsedEnv.data;

export type ServerEnv = typeof serverEnv;
