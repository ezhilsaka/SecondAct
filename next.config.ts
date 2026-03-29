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
    value: "DENY",
  },
  /**
   * Prevent MIME-type sniffing attacks on uploaded content.
   * OWASP A05: Security Misconfiguration
   */
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  /**
   * Limit referrer information sent to third-party origins.
   * Prevents leaking URL tokens/IDs via the Referer header.
   */
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  /**
   * Force HTTPS for 2 years, including subdomains, and submit to preload list.
   * OWASP A02: Cryptographic Failures
   * Note: Only effective once served over HTTPS (Vercel enforces this).
   */
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  /**
   * Restrict access to browser APIs that are not required.
   * Prevents malicious scripts from abusing camera, mic, geolocation, etc.
   */
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  /**
   * Content Security Policy — baseline restrictive configuration.
   *
   * SECURITY-ENGINEER note (loosen as features are added):
   *   - Add Supabase storage URL to img-src if profile images are stored there
   *   - Add font providers (e.g., fonts.gstatic.com) to font-src when custom fonts are loaded
   *   - Add Stripe/payment domains to frame-src when payment iframe is integrated
   *   - Add analytics domains (e.g., plausible.io) to script-src/connect-src when analytics is added
   *   - NEVER add 'unsafe-eval' — it defeats XSS protections; use nonces for Next.js inline scripts if required
   *
   * Note: 'unsafe-inline' in style-src is needed for Next.js CSS-in-JS.
   * This is acceptable; style injection risk is lower than script injection.
   */
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self'",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,

  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
