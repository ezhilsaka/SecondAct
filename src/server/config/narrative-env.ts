import { loadEnvConfig } from "@next/env";

import { parseNarrativeEnv } from "./schema";

/**
 * Runtime configuration for the narrative stage. This is loaded separately so
 * pre-Step-8 pipeline paths do not require narrative-specific settings yet.
 */
loadEnvConfig(process.cwd());

export const narrativeEnv = parseNarrativeEnv(process.env);

export type { NarrativeEnv } from "./schema";
