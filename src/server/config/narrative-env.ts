import { loadEnvConfig } from "@next/env";

import { parseNarrativeEnv } from "./schema";
import type { NarrativeEnv } from "./schema";

/**
 * Runtime configuration for the narrative stage. This is loaded separately so
 * pre-Step-8 pipeline paths do not require narrative-specific settings yet.
 */
loadEnvConfig(process.cwd());

let cachedNarrativeEnv: NarrativeEnv | undefined;

export function getNarrativeEnv(): NarrativeEnv {
  cachedNarrativeEnv ??= parseNarrativeEnv(process.env);

  return cachedNarrativeEnv;
}

export const narrativeEnv = new Proxy({} as NarrativeEnv, {
  get(_target, property) {
    return Reflect.get(getNarrativeEnv(), property);
  },
  getOwnPropertyDescriptor(_target, property) {
    const descriptor = Reflect.getOwnPropertyDescriptor(getNarrativeEnv(), property);

    if (!descriptor) {
      return undefined;
    }

    return {
      ...descriptor,
      configurable: true
    };
  },
  has(_target, property) {
    return property in getNarrativeEnv();
  },
  ownKeys() {
    return Reflect.ownKeys(getNarrativeEnv());
  }
});

export type { NarrativeEnv } from "./schema";
