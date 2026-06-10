import type { JwtPayload } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthenticationRequiredError } from "@/server/auth/authenticated-user";

const TEST_USER_ID = "11111111-1111-4111-8111-111111111111";

const { requireAuthenticatedUserMock } = vi.hoisted(() => ({
  requireAuthenticatedUserMock: vi.fn()
}));

vi.mock("@/server/auth/supabase-server", () => ({
  requireAuthenticatedUser: requireAuthenticatedUserMock
}));

import {
  buildApiUnauthorizedResponse,
  getAuthenticatedApiUser,
  getAuthenticatedApiUserId
} from "@/server/auth/api-auth";

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

describe("api auth helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the authenticated API user and user id", async () => {
    requireAuthenticatedUserMock.mockResolvedValue(buildAuthenticatedUser());

    await expect(getAuthenticatedApiUser()).resolves.toMatchObject({
      id: TEST_USER_ID,
      email: "user@example.com"
    });
    await expect(getAuthenticatedApiUserId()).resolves.toBe(TEST_USER_ID);
  });

  it("returns null when authentication is required", async () => {
    requireAuthenticatedUserMock.mockRejectedValue(new AuthenticationRequiredError());

    await expect(getAuthenticatedApiUser()).resolves.toBeNull();
    await expect(getAuthenticatedApiUserId()).resolves.toBeNull();
  });

  it("builds a consistent API unauthorized response", async () => {
    const response = buildApiUnauthorizedResponse();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication is required."
      }
    });
  });
});
