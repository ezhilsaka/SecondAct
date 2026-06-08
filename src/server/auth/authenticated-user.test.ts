import type { JwtPayload } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { getAuthenticatedUserFromClaims } from "@/server/auth/authenticated-user";

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

describe("getAuthenticatedUserFromClaims", () => {
  it("maps verified Supabase claims to the app authenticated user shape", () => {
    expect(getAuthenticatedUserFromClaims(buildClaims())).toEqual({
      id: "11111111-1111-4111-8111-111111111111",
      email: "user@example.com",
      claims: buildClaims()
    });
  });

  it("normalizes blank email claims to null", () => {
    expect(getAuthenticatedUserFromClaims(buildClaims({ email: "   " }))).toMatchObject({
      id: "11111111-1111-4111-8111-111111111111",
      email: null
    });
  });

  it("returns null when the subject claim is not a UUID", () => {
    expect(getAuthenticatedUserFromClaims(buildClaims({ sub: "not-a-uuid" }))).toBeNull();
  });
});
