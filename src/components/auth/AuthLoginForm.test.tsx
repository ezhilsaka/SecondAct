import { describe, expect, it } from "vitest";

import { getUserFacingAuthError } from "@/components/auth/AuthLoginForm";

describe("getUserFacingAuthError", () => {
  it("shows a recoverable rate-limit message for email code requests", () => {
    expect(getUserFacingAuthError("email", new Error("email rate limit exceeded"))).toBe(
      "Too many code requests. Please wait a bit and try again."
    );
  });

  it("detects rate-limit auth errors by status and code", () => {
    expect(
      getUserFacingAuthError("otp", {
        code: "over_email_send_rate_limit",
        status: 429
      })
    ).toBe("Too many code requests. Please wait a bit and try again.");
  });

  it("keeps non-rate-limit auth failures generic", () => {
    expect(getUserFacingAuthError("google", new Error("OAuth exchange failed"))).toBe(
      "We could not complete sign-in. Please try again."
    );
    expect(getUserFacingAuthError("email", new Error("Invalid login credentials"))).toBe(
      "We could not complete sign-in. Please try again."
    );
  });
});
