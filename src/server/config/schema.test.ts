import { describe, expect, it } from "vitest";

import { parseNarrativeEnv, parseServerEnv } from "@/server/config/schema";

function buildValidEnv(overrides: Partial<NodeJS.ProcessEnv> = {}): NodeJS.ProcessEnv {
  return {
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

function buildValidNarrativeEnv(overrides: Partial<NodeJS.ProcessEnv> = {}): NodeJS.ProcessEnv {
  return {
    NARRATIVE_PROVIDER: "openai-compatible",
    NARRATIVE_PROVIDER_BASE_URL: "https://llm.example.com/v1",
    NARRATIVE_PROVIDER_API_KEY: "api-key",
    NARRATIVE_MODEL: "gpt-test",
    ...overrides
  } as NodeJS.ProcessEnv;
}

describe("parseServerEnv", () => {
  it("coerces values and applies defaults", () => {
    const parsedEnv = parseServerEnv(
      buildValidEnv({
        DIRECT_URL: "   ",
        GRAPHILE_WORKER_SCHEMA: undefined,
        GRAPHILE_WORKER_CONCURRENCY: undefined,
        GRAPHILE_WORKER_POLL_INTERVAL_MS: undefined,
        REPORT_RUN_TASK_IDENTIFIER: undefined,
        PAYMENT_GATE_ENABLED: undefined,
        SIGNED_URL_EXPIRY_SECONDS: undefined,
        MARKET_DATA_SERVICE_TIMEOUT_MS: undefined,
        PLAYWRIGHT_BROWSER: undefined
      })
    );

    expect(parsedEnv.DIRECT_URL).toBeUndefined();
    expect(parsedEnv.GRAPHILE_WORKER_SCHEMA).toBe("graphile_worker");
    expect(parsedEnv.GRAPHILE_WORKER_CONCURRENCY).toBe(1);
    expect(parsedEnv.GRAPHILE_WORKER_POLL_INTERVAL_MS).toBe(1000);
    expect(parsedEnv.REPORT_RUN_TASK_IDENTIFIER).toBe("report.run.generate");
    expect(parsedEnv.PAYMENT_GATE_ENABLED).toBe(false);
    expect(parsedEnv.SIGNED_URL_EXPIRY_SECONDS).toBe(300);
    expect(parsedEnv.MARKET_DATA_SERVICE_TIMEOUT_MS).toBe(10000);
    expect(parsedEnv.PLAYWRIGHT_BROWSER).toBe("chromium");
  });

  it("parses PAYMENT_GATE_ENABLED string values explicitly", () => {
    const enabledEnv = parseServerEnv(buildValidEnv({ PAYMENT_GATE_ENABLED: "true" }));
    const disabledEnv = parseServerEnv(buildValidEnv({ PAYMENT_GATE_ENABLED: "false" }));

    expect(enabledEnv.PAYMENT_GATE_ENABLED).toBe(true);
    expect(disabledEnv.PAYMENT_GATE_ENABLED).toBe(false);
  });

  it("surfaces aggregated validation errors", () => {
    expect(() =>
      parseServerEnv(
        buildValidEnv({
          NEXT_PUBLIC_SUPABASE_URL: "not-a-url",
          GRAPHILE_WORKER_CONCURRENCY: "0",
          MARKET_DATA_ADAPTER_INTERNAL_API_SECRET: "",
          MARKET_DATA_SERVICE_TIMEOUT_MS: "-5"
        })
      )
    ).toThrowError(
      /NEXT_PUBLIC_SUPABASE_URL must be a valid URL\.[\s\S]*GRAPHILE_WORKER_CONCURRENCY must be greater than zero\.[\s\S]*MARKET_DATA_ADAPTER_INTERNAL_API_SECRET is required\.[\s\S]*MARKET_DATA_SERVICE_TIMEOUT_MS must be greater than zero\./
    );
  });

  it("parses narrative env separately", () => {
    const parsedEnv = parseNarrativeEnv(
      buildValidNarrativeEnv({
        NARRATIVE_PROVIDER: undefined
      })
    );

    expect(parsedEnv.NARRATIVE_PROVIDER).toBe("openai-compatible");
    expect(parsedEnv.NARRATIVE_MODEL).toBe("gpt-test");
  });

  it("surfaces aggregated narrative env validation errors", () => {
    expect(() =>
      parseNarrativeEnv(
        buildValidNarrativeEnv({
          NARRATIVE_PROVIDER_BASE_URL: "not-a-url",
          NARRATIVE_PROVIDER_API_KEY: "",
          NARRATIVE_MODEL: ""
        })
      )
    ).toThrowError(
      /NARRATIVE_PROVIDER_BASE_URL must be a valid URL\.[\s\S]*NARRATIVE_PROVIDER_API_KEY is required\.[\s\S]*NARRATIVE_MODEL is required\./
    );
  });
});
