import type { JwtPayload } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getAuthenticatedUserForProxyMock } = vi.hoisted(() => ({
  getAuthenticatedUserForProxyMock: vi.fn()
}));

vi.mock("@/server/auth/supabase-proxy", () => ({
  getAuthenticatedUserForProxy: getAuthenticatedUserForProxyMock
}));

import { proxy } from "@/proxy";

const TEST_USER_ID = "11111111-1111-4111-8111-111111111111";

function buildRequest(path: string) {
  return new NextRequest(`http://localhost:3000${path}`);
}

function buildAuthenticatedUser() {
  return {
    id: TEST_USER_ID,
    email: "user@example.com",
    claims: {
      sub: TEST_USER_ID,
      email: "user@example.com"
    } as JwtPayload
  };
}

function getLocation(response: Response) {
  const location = response.headers.get("location");

  if (!location) {
    throw new Error("Expected redirect location header.");
  }

  return new URL(location);
}

describe("proxy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
  });

  it("allows public routes without requiring a session", async () => {
    const response = await proxy(buildRequest("/login?next=/app"));

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Security-Policy")).toContain("script-src");
    expect(getAuthenticatedUserForProxyMock).not.toHaveBeenCalled();
  });

  it("allows public compatibility profile setup redirects without requiring a session", async () => {
    const response = await proxy(buildRequest("/profile/setup?next=/app"));

    expect(response.status).toBe(200);
    expect(getAuthenticatedUserForProxyMock).not.toHaveBeenCalled();
  });

  it("allows public static asset prefixes without requiring a session", async () => {
    const response = await proxy(buildRequest("/images/logo.png"));

    expect(response.status).toBe(200);
    expect(getAuthenticatedUserForProxyMock).not.toHaveBeenCalled();
  });

  it("allows protected browser routes for authenticated users", async () => {
    getAuthenticatedUserForProxyMock.mockResolvedValue(buildAuthenticatedUser());

    const request = buildRequest("/app");
    const response = await proxy(request);

    expect(response.status).toBe(200);
    expect(getAuthenticatedUserForProxyMock).toHaveBeenCalledWith(
      request,
      expect.any(Response)
    );
  });

  it("redirects unauthenticated browser routes to login with the original destination", async () => {
    getAuthenticatedUserForProxyMock.mockResolvedValue(null);

    const response = await proxy(buildRequest("/app/account?tab=profile"));
    const location = getLocation(response);

    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe("/app/account?tab=profile");
    expect(response.headers.get("Content-Security-Policy")).toContain("script-src");
  });

  it("returns JSON 401 for unauthenticated API routes", async () => {
    getAuthenticatedUserForProxyMock.mockResolvedValue(null);

    const response = await proxy(buildRequest("/api/v1/report-runs"));

    expect(response.status).toBe(401);
    expect(response.headers.get("Content-Security-Policy")).toContain("script-src");
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication is required."
      }
    });
  });
});
