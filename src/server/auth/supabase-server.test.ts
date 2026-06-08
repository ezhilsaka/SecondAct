import type { JwtPayload } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

const { cookieStoreMock, cookiesMock, createServerClientMock, getClaimsMock } = vi.hoisted(() => {
  const getClaimsMock = vi.fn();

  return {
    cookieStoreMock: {
      getAll: vi.fn(),
      set: vi.fn()
    },
    cookiesMock: vi.fn(),
    createServerClientMock: vi.fn(() => ({
      auth: {
        getClaims: getClaimsMock
      }
    })),
    getClaimsMock
  };
});

vi.mock("@supabase/ssr", () => ({
  createServerClient: createServerClientMock
}));

vi.mock("next/headers", () => ({
  cookies: cookiesMock
}));

import { AuthenticationRequiredError } from "@/server/auth/authenticated-user";
import {
  createSupabaseServerClient,
  getAuthenticatedUser,
  requireAuthenticatedUser
} from "@/server/auth/supabase-server";

type CapturedServerClientOptions = {
  cookies: {
    getAll: () => { name: string; value: string }[];
    setAll: (cookiesToSet: { name: string; value: string; options: Record<string, unknown> }[]) => void;
  };
};

function buildClaims(overrides: Partial<JwtPayload> = {}): JwtPayload {
  return {
    iss: "https://project.supabase.co/auth/v1",
    sub: "11111111-1111-4111-8111-111111111111",
    aud: "authenticated",
    exp: 4_102_444_800,
    iat: 1_704_067_200,
    role: "authenticated",
    aal: "aal1",
    session_id: "22222222-2222-4222-8222-222222222222",
    email: "user@example.com",
    ...overrides
  };
}

describe("Supabase server auth helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key"
    };
    cookieStoreMock.getAll.mockReturnValue([{ name: "sb-access-token", value: "token" }]);
    cookiesMock.mockResolvedValue(cookieStoreMock);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("creates a request-scoped server client with getAll/setAll cookie methods", async () => {
    await createSupabaseServerClient();

    expect(cookiesMock).toHaveBeenCalledTimes(1);
    expect(createServerClientMock).toHaveBeenCalledWith(
      "https://project.supabase.co",
      "anon-key",
      expect.objectContaining({
        cookies: expect.objectContaining({
          getAll: expect.any(Function),
          setAll: expect.any(Function)
        })
      })
    );

    const [, , options] = createServerClientMock.mock.calls[0] as unknown as [
      string,
      string,
      CapturedServerClientOptions
    ];
    expect(options.cookies.getAll()).toEqual([{ name: "sb-access-token", value: "token" }]);

    options.cookies.setAll([{ name: "sb-access-token", value: "fresh-token", options: { path: "/" } }]);
    expect(cookieStoreMock.set).toHaveBeenCalledWith("sb-access-token", "fresh-token", {
      path: "/"
    });
  });

  it("returns the authenticated user from verified claims", async () => {
    getClaimsMock.mockResolvedValue({
      data: {
        claims: buildClaims(),
        header: {},
        signature: new Uint8Array()
      },
      error: null
    });

    await expect(getAuthenticatedUser()).resolves.toMatchObject({
      id: "11111111-1111-4111-8111-111111111111",
      email: "user@example.com"
    });
    expect(getClaimsMock).toHaveBeenCalledTimes(1);
  });

  it("requires an authenticated user when claims are missing", async () => {
    getClaimsMock.mockResolvedValue({ data: null, error: null });

    await expect(requireAuthenticatedUser()).rejects.toBeInstanceOf(AuthenticationRequiredError);
  });

  it("requires an authenticated user when the subject claim is invalid", async () => {
    getClaimsMock.mockResolvedValue({
      data: {
        claims: buildClaims({ sub: "not-a-uuid" }),
        header: {},
        signature: new Uint8Array()
      },
      error: null
    });

    await expect(requireAuthenticatedUser()).rejects.toBeInstanceOf(AuthenticationRequiredError);
  });
});
