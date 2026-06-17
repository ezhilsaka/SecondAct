import { loadEnvConfig } from "@next/env";
import { parseServerEnv } from "./schema";
import type { ServerEnv } from "./schema";

/**
 * Server-only runtime configuration for the report pipeline and supporting services.
 */
loadEnvConfig(process.cwd());

let cachedServerEnv: ServerEnv | undefined;

export function getServerEnv(): ServerEnv {
  cachedServerEnv ??= parseServerEnv(process.env);

  return cachedServerEnv;
}

export const serverEnv = new Proxy({} as ServerEnv, {
  get(_target, property) {
    return Reflect.get(getServerEnv(), property);
  },
  getOwnPropertyDescriptor(_target, property) {
    const descriptor = Reflect.getOwnPropertyDescriptor(getServerEnv(), property);

    if (!descriptor) {
      return undefined;
    }

    return {
      ...descriptor,
      configurable: true
    };
  },
  has(_target, property) {
    return property in getServerEnv();
  },
  ownKeys() {
    return Reflect.ownKeys(getServerEnv());
  }
});

export type { ServerEnv } from "./schema";
