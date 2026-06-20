import { describe, expect, it, vi } from "vitest";

const { bootstrapAuthenticatedUserProfileMock, cacheMock, requireAuthenticatedUserMock } =
  vi.hoisted(() => ({
    bootstrapAuthenticatedUserProfileMock: vi.fn(),
    cacheMock: vi.fn(),
    requireAuthenticatedUserMock: vi.fn()
  }));

vi.mock("react", () => ({
  cache: <TArgs extends unknown[], TResult>(fn: (...args: TArgs) => Promise<TResult>) => {
    cacheMock(fn);

    let cachedPromise: Promise<TResult> | null = null;

    return (...args: TArgs) => {
      cachedPromise ??= fn(...args);
      return cachedPromise;
    };
  }
}));

vi.mock("@/server/auth/supabase-server", () => ({
  requireAuthenticatedUser: requireAuthenticatedUserMock
}));

vi.mock("@/server/auth/profile-bootstrap", () => ({
  bootstrapAuthenticatedUserProfile: bootstrapAuthenticatedUserProfileMock
}));

import {
  loadAuthenticatedAppSession,
  requireAuthenticatedAppUser
} from "@/server/auth/app-session";

describe("app session auth loader", () => {
  it("loads the authenticated app session through a cached server helper", async () => {
    const user = {
      id: "11111111-1111-4111-8111-111111111111",
      email: "user@example.com",
      claims: {}
    };
    const profile = {
      id: user.id,
      email: user.email,
      firstName: "Ada",
      lastName: "Lovelace",
      investorHandle: "ada-lovelace",
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-01T00:00:00Z")
    };

    requireAuthenticatedUserMock.mockResolvedValue(user);
    bootstrapAuthenticatedUserProfileMock.mockResolvedValue({
      profile,
      created: false
    });

    await expect(loadAuthenticatedAppSession()).resolves.toEqual({ user, profile });
    await expect(requireAuthenticatedAppUser()).resolves.toBe(user);
    await expect(loadAuthenticatedAppSession()).resolves.toEqual({ user, profile });

    expect(cacheMock).toHaveBeenCalledTimes(1);
    expect(requireAuthenticatedUserMock).toHaveBeenCalledTimes(1);
    expect(bootstrapAuthenticatedUserProfileMock).toHaveBeenCalledTimes(1);
    expect(bootstrapAuthenticatedUserProfileMock).toHaveBeenCalledWith(user);
  });
});
