import { describe, expect, it } from "vitest";

import {
  buildAuthCallbackUrl,
  buildLoginErrorUrl,
  buildLoginProfileCompletionPath,
  buildLoginProfileCompletionUrl,
  sanitizeRelativeRedirect
} from "@/lib/auth/redirect";

describe("auth redirect helpers", () => {
  it("keeps safe relative redirect paths", () => {
    expect(sanitizeRelativeRedirect("/app/reports?tab=latest#run")).toBe(
      "/app/reports?tab=latest#run"
    );
  });

  it("rejects absolute redirect URLs", () => {
    expect(sanitizeRelativeRedirect("https://example.com/app")).toBe("/app");
  });

  it("rejects protocol-relative redirect URLs", () => {
    expect(sanitizeRelativeRedirect("//example.com/app")).toBe("/app");
  });

  it("rejects backslash-based redirect bypass attempts", () => {
    expect(sanitizeRelativeRedirect("/\\\\evil.com")).toBe("/app");
  });

  it("rejects tab and newline redirect bypass attempts", () => {
    expect(sanitizeRelativeRedirect("/\tevil.com")).toBe("/app");
    expect(sanitizeRelativeRedirect("/\nevil.com")).toBe("/app");
  });

  it("rejects percent-encoded slash, backslash, and control-character bypass attempts", () => {
    expect(sanitizeRelativeRedirect("/%2f%2fevil.com")).toBe("/app");
    expect(sanitizeRelativeRedirect("/%5C%5Cevil.com")).toBe("/app");
    expect(sanitizeRelativeRedirect("/%09evil.com")).toBe("/app");
    expect(sanitizeRelativeRedirect("/%0d%0aLocation:%20https://evil.com")).toBe("/app");
  });

  it("uses the first redirect when duplicate next values are received", () => {
    expect(sanitizeRelativeRedirect(["/app", "https://example.com"])).toBe("/app");
  });

  it("builds a callback URL with a sanitized next path", () => {
    expect(buildAuthCallbackUrl("http://localhost:3000", "/app?from=login")).toBe(
      "http://localhost:3000/auth/callback?next=%2Fapp%3Ffrom%3Dlogin"
    );
  });

  it("builds a generic login error URL", () => {
    const url = buildLoginErrorUrl("http://localhost:3000/auth/callback", "https://example.com");

    expect(url.pathname).toBe("/login");
    expect(url.searchParams.get("error")).toBe("auth_callback_failed");
    expect(url.searchParams.get("next")).toBe("/app");
  });

  it("builds a login profile-completion path", () => {
    expect(buildLoginProfileCompletionPath("/app?from=otp")).toBe(
      "/login?step=profile&next=%2Fapp%3Ffrom%3Dotp"
    );
  });

  it("builds a login profile-completion URL with optional error state", () => {
    const url = buildLoginProfileCompletionUrl(
      "http://localhost:3000/auth/callback",
      "https://example.com",
      "missing_name"
    );

    expect(url.pathname).toBe("/login");
    expect(url.searchParams.get("step")).toBe("profile");
    expect(url.searchParams.get("error")).toBe("missing_name");
    expect(url.searchParams.get("next")).toBe("/app");
  });
});
