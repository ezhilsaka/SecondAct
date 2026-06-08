import type { NextConfig } from "next";

/**
 * HTTP security headers applied to every response.
 *
 * SECURITY-ENGINEER note: start restrictive, loosen only when a specific
 * feature requires it (e.g., add trusted CDN origins to CSP as needed).
 * Do NOT widen these headers wholesale — evaluate each change in isolation.
 */
const securityHeaders = [
  /**
   * Prevent clickjacking — page cannot be framed by any origin.
   * OWASP A05: Security Misconfiguration
   */
  {
    key: "X-Frame-Options",
    value: "DENY"
  },
  /**
   * Prevent MIME-type sniffing attacks on uploaded content.
   * OWASP A05: Security Misconfiguration
   */
  {
    key: "X-Content-Type-Options",
    value: "nosniff"
  },
  /**
   * Limit referrer information sent to third-party origins.
   * Prevents leaking URL tokens/IDs via the Referer header.
   */
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin"
  },
  /**
   * Force HTTPS for 2 years, including subdomains, and submit to preload list.
   * OWASP A02: Cryptographic Failures
   * Note: Only effective once served over HTTPS (Vercel enforces this).
   */
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload"
  },
  /**
   * Restrict access to browser APIs that are not required.
   * Prevents malicious scripts from abusing camera, mic, geolocation, etc.
   */
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()"
  },
  // Content-Security-Policy is generated per request in middleware so Next.js
  // can attach a nonce to App Router bootstrap scripts.
];

const nextConfig: NextConfig = {
  reactStrictMode: true,

  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: "/:path*",
        headers: securityHeaders
      }
    ];
  }
};

export default nextConfig;
