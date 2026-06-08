import { afterEach, describe, expect, it, vi } from "vitest";

import { getSupabasePublicConfig } from "@/lib/supabase/config";

describe("getSupabasePublicConfig", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reads direct public Supabase environment variables by default", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://default-project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "default-anon-key");

    expect(getSupabasePublicConfig()).toEqual({
      url: "https://default-project.supabase.co",
      anonKey: "default-anon-key"
    });
  });

  it("returns the public Supabase URL and anon key", () => {
    expect(
      getSupabasePublicConfig({
        NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key"
      })
    ).toEqual({
      url: "https://project.supabase.co",
      anonKey: "anon-key"
    });
  });

  it("rejects a missing Supabase URL", () => {
    expect(() =>
      getSupabasePublicConfig({
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key"
      })
    ).toThrow("NEXT_PUBLIC_SUPABASE_URL is required");
  });

  it("rejects an invalid Supabase URL", () => {
    expect(() =>
      getSupabasePublicConfig({
        NEXT_PUBLIC_SUPABASE_URL: "not-a-url",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key"
      })
    ).toThrow("NEXT_PUBLIC_SUPABASE_URL must be a valid URL");
  });

  it("rejects a missing anon key", () => {
    expect(() =>
      getSupabasePublicConfig({
        NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co"
      })
    ).toThrow("NEXT_PUBLIC_SUPABASE_ANON_KEY is required");
  });
});
