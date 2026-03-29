import { loadEnvConfig } from "@next/env";
import { parseServerEnv } from "./schema";

/**
 * Server-only runtime configuration for the report pipeline and supporting services.
 */
loadEnvConfig(process.cwd());

export const serverEnv = parseServerEnv(process.env);

export type { ServerEnv } from "./schema";
