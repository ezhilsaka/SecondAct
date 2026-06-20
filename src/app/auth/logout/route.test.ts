import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createSupabaseServerClientMock, signOutMock } = vi.hoisted(() => ({
  createSupabaseServerClientMock: vi.fn(),
  signOutMock: vi.fn()
}));

vi.mock("@/server/auth/supabase-server", () => ({
  createSupabaseServerClient: createSupabaseServerClientMock
}));

import { GET, POST } from "@/app/auth/logout/route";

function buildRequest() {
  return new NextRequest("http://localhost:3000/auth/logout");
}

function getLocation(response: Response) {
  const location = response.headers.get("location");

  if (!location) {
    throw new Error("Expected redirect location header.");
  }

  return new URL(location);
}

describe("/auth/logout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createSupabaseServerClientMock.mockResolvedValue({
      auth: {
        signOut: signOutMock
      }
    });
    signOutMock.mockResolvedValue({ error: null });
  });

  it("rejects GET without signing out", async () => {
    const response = await GET();

    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("POST");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(signOutMock).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "METHOD_NOT_ALLOWED",
        message: "Use POST to sign out."
      }
    });
  });

  it("signs out and redirects home on POST", async () => {
    const response = await POST(buildRequest());
    const location = getLocation(response);

    expect(signOutMock).toHaveBeenCalledTimes(1);
    expect(location.pathname).toBe("/");
  });
});
