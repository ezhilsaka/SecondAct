import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  bootstrapAuthenticatedUserProfileMock,
  createSupabaseServerClientMock,
  exchangeCodeForSessionMock,
  getClaimsMock,
  signOutMock,
  verifyOtpMock
} = vi.hoisted(() => ({
  bootstrapAuthenticatedUserProfileMock: vi.fn(),
  createSupabaseServerClientMock: vi.fn(),
  exchangeCodeForSessionMock: vi.fn(),
  getClaimsMock: vi.fn(),
  signOutMock: vi.fn(),
  verifyOtpMock: vi.fn()
}));

vi.mock("@/server/auth/supabase-server", () => ({
  createSupabaseServerClient: createSupabaseServerClientMock
}));

vi.mock("@/server/auth/profile-bootstrap", () => ({
  bootstrapAuthenticatedUserProfile: bootstrapAuthenticatedUserProfileMock
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

function buildClaims() {
  return {
    iss: "https://project.supabase.co/auth/v1",
    sub: "11111111-1111-4111-8111-111111111111",
    aud: "authenticated",
    exp: 4_102_444_800,
    iat: 1_704_067_200,
    role: "authenticated",
    aal: "aal1",
    session_id: "22222222-2222-4222-8222-222222222222",
    email: "user@example.com"
  };
}

describe("GET /auth/callback", () => {
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    createSupabaseServerClientMock.mockResolvedValue({
      auth: {
        exchangeCodeForSession: exchangeCodeForSessionMock,
        getClaims: getClaimsMock,
        signOut: signOutMock,
        verifyOtp: verifyOtpMock
      }
    });
    getClaimsMock.mockResolvedValue({
      data: {
        claims: buildClaims(),
        header: {},
        signature: new Uint8Array()
      },
      error: null
    });
    bootstrapAuthenticatedUserProfileMock.mockResolvedValue({
      profile: {
        id: "11111111-1111-4111-8111-111111111111"
      },
      created: false
    });
    signOutMock.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  it("exchanges an OAuth code and redirects to a safe next path", async () => {
    exchangeCodeForSessionMock.mockResolvedValue({ error: null });

    const response = await GET(buildRequest("/auth/callback?code=oauth-code&next=/app/reports"));
    const location = getLocation(response);

    expect(exchangeCodeForSessionMock).toHaveBeenCalledWith("oauth-code");
    expect(bootstrapAuthenticatedUserProfileMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "11111111-1111-4111-8111-111111111111",
        email: "user@example.com"
      })
    );
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
    const authError = Object.assign(new Error("bad code"), { code: "bad_code", status: 400 });
    exchangeCodeForSessionMock.mockResolvedValue({ error: authError });

    const response = await GET(buildRequest("/auth/callback?code=bad-code&next=/app/reports"));
    const location = getLocation(response);

    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("error")).toBe("auth_callback_failed");
    expect(location.searchParams.get("next")).toBe("/app/reports");
    expect(bootstrapAuthenticatedUserProfileMock).not.toHaveBeenCalled();
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "[SecondAct auth callback]",
      expect.objectContaining({
        event: "auth.callback_failed",
        reason: "oauth_code_exchange_failed",
        errorCode: "bad_code",
        status: 400
      })
    );
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
    expect(bootstrapAuthenticatedUserProfileMock).toHaveBeenCalledTimes(1);
    expect(location.pathname).toBe("/app");
  });

  it("keeps the session and redirects to the login profile step when profile completion is required", async () => {
    exchangeCodeForSessionMock.mockResolvedValue({ error: null });
    bootstrapAuthenticatedUserProfileMock.mockRejectedValue(
      Object.assign(new Error("profile completion required"), {
        code: "PROFILE_COMPLETION_REQUIRED"
      })
    );

    const response = await GET(buildRequest("/auth/callback?code=oauth-code&next=/app"));
    const location = getLocation(response);

    expect(signOutMock).not.toHaveBeenCalled();
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("step")).toBe("profile");
    expect(location.searchParams.get("next")).toBe("/app");
  });

  it("signs out and redirects to login when profile bootstrap fails", async () => {
    exchangeCodeForSessionMock.mockResolvedValue({ error: null });
    bootstrapAuthenticatedUserProfileMock.mockRejectedValue(new Error("db unavailable"));

    const response = await GET(buildRequest("/auth/callback?code=oauth-code&next=/app"));
    const location = getLocation(response);

    expect(signOutMock).toHaveBeenCalledTimes(1);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("error")).toBe("auth_callback_failed");
    expect(location.searchParams.get("next")).toBe("/app");
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "[SecondAct auth callback]",
      expect.objectContaining({
        event: "auth.callback_failed",
        reason: "profile_bootstrap_failed",
        errorName: "Error"
      })
    );
  });

  it("redirects to login without creating a Supabase client when callback params are missing", async () => {
    const response = await GET(buildRequest("/auth/callback?next=/app/reports"));
    const location = getLocation(response);

    expect(createSupabaseServerClientMock).not.toHaveBeenCalled();
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("error")).toBe("auth_callback_failed");
  });
});
