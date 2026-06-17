import { afterEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };
const supabaseGlobals = globalThis as typeof globalThis & {
  __secondActSupabaseAdmin?: unknown;
};

function applyEnvWithoutRuntimeConfig() {
  process.env = {
    NODE_ENV: "test"
  };
  delete process.env.DATABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
}

describe("supabase storage client module", () => {
  afterEach(() => {
    process.env = { ...originalEnv };
    delete supabaseGlobals.__secondActSupabaseAdmin;
    vi.doUnmock("@next/env");
    vi.resetModules();
  });

  it("can be imported without server runtime configuration", async () => {
    vi.doMock("@next/env", () => ({ loadEnvConfig: vi.fn() }));
    applyEnvWithoutRuntimeConfig();

    await expect(import("@/server/providers/supabase-storage-client")).resolves.toHaveProperty(
      "supabaseAdmin"
    );
  });

  it("validates server runtime configuration when the real client is requested", async () => {
    vi.doMock("@next/env", () => ({ loadEnvConfig: vi.fn() }));
    applyEnvWithoutRuntimeConfig();

    const { getSupabaseAdminClient } = await import("@/server/providers/supabase-storage-client");

    expect(() => getSupabaseAdminClient()).toThrow("Invalid server environment configuration:");
  });
});
