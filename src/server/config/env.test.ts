import { afterEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

function applyValidEnv(overrides: Partial<NodeJS.ProcessEnv> = {}) {
  process.env = {
    ...originalEnv,
    NODE_ENV: "test",
    DATABASE_URL: "postgres://localhost:5432/second-act",
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
    SUPABASE_REPORTS_BUCKET: "reports",
    GRAPHILE_WORKER_SCHEMA: "graphile_worker",
    GRAPHILE_WORKER_CONCURRENCY: "2",
    GRAPHILE_WORKER_POLL_INTERVAL_MS: "2500",
    REPORT_RUN_TASK_IDENTIFIER: "report.run.generate",
    PAYMENT_GATE_ENABLED: "false",
    SIGNED_URL_EXPIRY_SECONDS: "300",
    MARKET_DATA_SERVICE_URL: "https://quotes.example.com",
    MARKET_DATA_ADAPTER_INTERNAL_API_SECRET: "test-internal-secret",
    MARKET_DATA_SERVICE_TIMEOUT_MS: "7000",
    PLAYWRIGHT_BROWSER: "chromium",
    ...overrides
  };
}

describe("serverEnv module", () => {
  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  it("parses the process environment during module import", async () => {
    applyValidEnv({
      DIRECT_URL: "   ",
      GRAPHILE_WORKER_SCHEMA: undefined
    });

    const { serverEnv } = await import("@/server/config/env");

    expect(serverEnv.DIRECT_URL).toBeUndefined();
    expect(serverEnv.GRAPHILE_WORKER_SCHEMA).toBe("graphile_worker");
    expect(serverEnv.GRAPHILE_WORKER_CONCURRENCY).toBe(2);
    expect(serverEnv.MARKET_DATA_ADAPTER_INTERNAL_API_SECRET).toBe("test-internal-secret");
  });
});
