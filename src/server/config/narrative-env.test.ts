import { afterEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

function applyValidNarrativeEnv(overrides: Partial<NodeJS.ProcessEnv> = {}) {
  process.env = {
    ...originalEnv,
    NARRATIVE_PROVIDER: "openai-compatible",
    NARRATIVE_PROVIDER_BASE_URL: "https://llm.example.com/v1",
    NARRATIVE_PROVIDER_API_KEY: "api-key",
    NARRATIVE_MODEL: "gpt-test",
    ...overrides
  };
}

describe("narrativeEnv module", () => {
  afterEach(() => {
    process.env = { ...originalEnv };
    vi.doUnmock("@next/env");
    vi.resetModules();
  });

  it("can be imported without validating the runtime environment", async () => {
    vi.doMock("@next/env", () => ({ loadEnvConfig: vi.fn() }));
    process.env = { NODE_ENV: "test" };
    delete process.env.NARRATIVE_PROVIDER_BASE_URL;

    await expect(import("@/server/config/narrative-env")).resolves.toHaveProperty("narrativeEnv");
  });

  it("parses the process environment when accessed", async () => {
    applyValidNarrativeEnv({
      NARRATIVE_PROVIDER: undefined
    });

    const { narrativeEnv } = await import("@/server/config/narrative-env");

    expect(narrativeEnv.NARRATIVE_PROVIDER).toBe("openai-compatible");
    expect(narrativeEnv.NARRATIVE_MODEL).toBe("gpt-test");
  });
});
