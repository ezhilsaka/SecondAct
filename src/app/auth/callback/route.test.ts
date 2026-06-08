import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createSupabaseServerClientMock,
  exchangeCodeForSessionMock,
  verifyOtpMock
} = vi.hoisted(() => ({
  createSupabaseServerClientMock: vi.fn(),
  exchangeCodeForSessionMock: vi.fn(),
  verifyOtpMock: vi.fn()
}));

vi.mock("@/server/auth/supabase-server", () => ({
  createSupabaseServerClient: createSupabaseServerClientMock
}));

import { GET } from "@/app/auth/callback/route";

function buildRequest(path: string) {
  return new NextRequest(`http://localhost:3000${path}`);
}

function getLocation(response: Response) {
  const location = response.headers.get("location");

  if (!location) {
    throw new Error("Expected redirect location header.");
  }

  return new URL(location);
}

describe("GET /auth/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createSupabaseServerClientMock.mockResolvedValue({
      auth: {
        exchangeCodeForSession: exchangeCodeForSessionMock,
        verifyOtp: verifyOtpMock
      }
    });
  });

  it("exchanges an OAuth code and redirects to a safe next path", async () => {
    exchangeCodeForSessionMock.mockResolvedValue({ error: null });

    const response = await GET(buildRequest("/auth/callback?code=oauth-code&next=/app/reports"));
    const location = getLocation(response);

    expect(exchangeCodeForSessionMock).toHaveBeenCalledWith("oauth-code");
    expect(location.pathname).toBe("/app/reports");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("rejects external next redirects after OAuth code exchange", async () => {
    exchangeCodeForSessionMock.mockResolvedValue({ error: null });

    const response = await GET(
      buildRequest("/auth/callback?code=oauth-code&next=https://example.com/app")
    );
    const location = getLocation(response);

    expect(location.pathname).toBe("/app");
  });

  it("redirects to login with a generic error when code exchange fails", async () => {
    exchangeCodeForSessionMock.mockResolvedValue({ error: new Error("bad code") });

    const response = await GET(buildRequest("/auth/callback?code=bad-code&next=/app/reports"));
    const location = getLocation(response);

    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("error")).toBe("auth_callback_failed");
    expect(location.searchParams.get("next")).toBe("/app/reports");
  });

  it("verifies supported token-hash email callbacks", async () => {
    verifyOtpMock.mockResolvedValue({ error: null });

    const response = await GET(
      buildRequest("/auth/callback?token_hash=email-token-hash&type=email&next=/app")
    );
    const location = getLocation(response);

    expect(verifyOtpMock).toHaveBeenCalledWith({
      token_hash: "email-token-hash",
      type: "email"
    });
    expect(location.pathname).toBe("/app");
  });

  it("redirects to login without creating a Supabase client when callback params are missing", async () => {
    const response = await GET(buildRequest("/auth/callback?next=/app/reports"));
    const location = getLocation(response);

    expect(createSupabaseServerClientMock).not.toHaveBeenCalled();
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("error")).toBe("auth_callback_failed");
  });
});
