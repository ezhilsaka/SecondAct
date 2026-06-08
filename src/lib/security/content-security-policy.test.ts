import { describe, expect, it } from "vitest";

import { buildContentSecurityPolicy } from "@/lib/security/content-security-policy";

describe("buildContentSecurityPolicy", () => {
  it("uses a nonce for scripts instead of unsafe inline scripts", () => {
    const policy = buildContentSecurityPolicy({
      nonce: "test-nonce",
      supabaseUrl: "https://project.supabase.co"
    });
    const scriptDirective = policy
      .split("; ")
      .find((directive) => directive.startsWith("script-src"));

    expect(policy).toContain("script-src 'self' 'nonce-test-nonce'");
    expect(scriptDirective).not.toContain("'unsafe-inline'");
  });

  it("allows the Supabase origin for auth requests", () => {
    const policy = buildContentSecurityPolicy({
      nonce: "test-nonce",
      supabaseUrl: "https://project.supabase.co/auth/v1"
    });

    expect(policy).toContain("connect-src 'self' https://project.supabase.co");
  });

  it("allows the configured Google Font stylesheet and font origins", () => {
    const policy = buildContentSecurityPolicy({
      nonce: "test-nonce"
    });

    expect(policy).toContain("style-src 'self' 'unsafe-inline' https://fonts.googleapis.com");
    expect(policy).toContain("font-src 'self' https://fonts.gstatic.com");
  });

  it("does not add invalid Supabase origins to connect-src", () => {
    const policy = buildContentSecurityPolicy({
      nonce: "test-nonce",
      supabaseUrl: "not-a-url"
    });

    expect(policy).toContain("connect-src 'self'");
    expect(policy).not.toContain("not-a-url");
  });

  it("allows eval only in development for Next.js dev tooling", () => {
    const productionPolicy = buildContentSecurityPolicy({
      nonce: "test-nonce",
      isDevelopment: false
    });
    const developmentPolicy = buildContentSecurityPolicy({
      nonce: "test-nonce",
      isDevelopment: true
    });

    expect(productionPolicy).not.toContain("'unsafe-eval'");
    expect(developmentPolicy).toContain("'unsafe-eval'");
  });
});
