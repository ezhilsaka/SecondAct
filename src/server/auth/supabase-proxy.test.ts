import type { JwtPayload } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

const { createServerClientMock, getClaimsMock } = vi.hoisted(() => {
  const getClaimsMock = vi.fn();

  return {
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

import {
  createSupabaseProxyClient,
  getAuthenticatedUserForProxy,
  updateSupabaseSession
} from "@/server/auth/supabase-proxy";

type CapturedProxyClientOptions = {
  cookies: {
    getAll: () => { name: string; value: string }[];
    setAll: (
      cookiesToSet: { name: string; value: string; options: Record<string, unknown> }[],
      headers: Record<string, string>
    ) => void;
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

function buildProxyPair() {
  const request = new NextRequest("http://localhost:3000/app", {
    headers: {
      cookie: "sb-access-token=old-token; theme=dark"
    }
  });
  const response = NextResponse.next({ request });

  return { request, response };
}

describe("Supabase proxy auth helpers", () => {
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

  it("creates a proxy client that reads request cookies and writes refreshed cookies", () => {
    const { request, response } = buildProxyPair();

    createSupabaseProxyClient(request, response);

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
      CapturedProxyClientOptions
    ];
    expect(options.cookies.getAll()).toEqual([
      { name: "sb-access-token", value: "old-token" },
      { name: "theme", value: "dark" }
    ]);

    options.cookies.setAll(
      [{ name: "sb-access-token", value: "fresh-token", options: { path: "/", sameSite: "lax" } }],
      { "Cache-Control": "private, no-store", Pragma: "no-cache" }
    );

    expect(request.cookies.get("sb-access-token")?.value).toBe("fresh-token");
    expect(response.cookies.get("sb-access-token")?.value).toBe("fresh-token");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("Pragma")).toBe("no-cache");
  });

  it("returns the authenticated proxy user from verified claims", async () => {
    getClaimsMock.mockResolvedValue({
      data: {
        claims: buildClaims(),
        header: {},
        signature: new Uint8Array()
      },
      error: null
    });

    const { request, response } = buildProxyPair();

    await expect(getAuthenticatedUserForProxy(request, response)).resolves.toMatchObject({
      id: "11111111-1111-4111-8111-111111111111",
      email: "user@example.com"
    });
  });

  it("returns a response and null user when the proxy request has no valid claims", async () => {
    getClaimsMock.mockResolvedValue({ data: null, error: null });

    const { response, user } = await updateSupabaseSession(buildProxyPair().request);

    expect(response).toBeInstanceOf(NextResponse);
    expect(user).toBeNull();
  });
});
