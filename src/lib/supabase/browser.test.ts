import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

const { createBrowserClientMock } = vi.hoisted(() => ({
  createBrowserClientMock: vi.fn(() => ({ auth: {} }))
}));

vi.mock("@supabase/ssr", () => ({
  createBrowserClient: createBrowserClientMock
}));

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

describe("createSupabaseBrowserClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key"
    };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("creates a browser client with only the public Supabase config", () => {
    const client = createSupabaseBrowserClient();

    expect(client).toEqual({ auth: {} });
    expect(createBrowserClientMock).toHaveBeenCalledWith("https://project.supabase.co", "anon-key");
  });
});
