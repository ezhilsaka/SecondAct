/**
 * Next.js Middleware — Route-Level Authentication & Security Guard
 *
 * SECURITY-ENGINEER: This is the first line of auth enforcement.
 * All protected routes must be listed in PROTECTED_ROUTE_PATTERNS below.
 * Never rely solely on this — every API route handler MUST also verify
 * the session server-side (defense in depth). This middleware prevents
 * unauthenticated requests from ever reaching the route handler.
 *
 * OWASP A01: Broken Access Control
 * OWASP A07: Identification and Authentication Failures
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  buildContentSecurityPolicy,
  createContentSecurityPolicyNonce
} from "@/lib/security/content-security-policy";

// ---------------------------------------------------------------------------
// Route configuration
// ---------------------------------------------------------------------------

/**
 * Public paths that do NOT require authentication.
 * Everything else will be protected once auth is implemented.
 *
 * SECURITY-ENGINEER note: When adding new public routes (e.g., /about, /pricing),
 * add them here explicitly. Default-deny is intentional — opt-in to public access,
 * not opt-out of protection.
 */
const PUBLIC_PATHS: string[] = [
  "/", // Marketing landing page
  "/legal", // Legal/privacy pages
  "/api/health" // Uptime health check (keep minimal — no sensitive data)
];

/**
 * Path prefixes that are always public (static assets, Next.js internals).
 */
const PUBLIC_PREFIXES: string[] = [
  "/_next/", // Next.js static files
  "/favicon", // Favicons
  "/robots.txt",
  "/sitemap.xml"
];

// ---------------------------------------------------------------------------
// Auth check
// ---------------------------------------------------------------------------

/**
 * Determines whether the current request is from an authenticated user.
 *
 * IMPLEMENTATION NOTE: Currently a stub — returns true (permissive) because
 * auth has not been implemented yet. When NextAuth / Supabase Auth is added:
 *
 *   1. Import and call `getToken({ req })` from "next-auth/jwt", OR
 *   2. Check the Supabase session cookie, OR
 *   3. Validate a Bearer token from the Authorization header
 *
 * This function MUST be updated before any authenticated routes go live.
 *
 * @see https://next-auth.js.org/configuration/nextjs#middleware
 * @see https://supabase.com/docs/guides/auth/server-side/nextjs
 *
 * TODO: Replace stub with real auth check when auth is implemented.
 */
async function isAuthenticated(_req: NextRequest): Promise<boolean> {
  // ⚠️  STUB — Replace with real session check before adding protected routes.
  // Example with NextAuth:
  //
  //   import { getToken } from "next-auth/jwt";
  //   const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  //   return token !== null;
  //
  // Example with Supabase Auth (server-side):
  //   import { createServerClient } from "@supabase/ssr";
  //   ... (see Supabase SSR docs)

  return true; // STUB: allow all — REMOVE this when auth is implemented
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

function nextWithContentSecurityPolicy(req: NextRequest, contentSecurityPolicy: string): NextResponse {
  const requestHeaders = new Headers(req.headers);

  requestHeaders.set("Content-Security-Policy", contentSecurityPolicy);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders
    }
  });

  response.headers.set("Content-Security-Policy", contentSecurityPolicy);

  return response;
}

function withContentSecurityPolicy(
  response: NextResponse,
  contentSecurityPolicy: string
): NextResponse {
  response.headers.set("Content-Security-Policy", contentSecurityPolicy);

  return response;
}

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;
  const nonce = createContentSecurityPolicyNonce();
  const contentSecurityPolicy = buildContentSecurityPolicy({
    nonce,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    isDevelopment: process.env.NODE_ENV !== "production"
  });

  // Allow Next.js internals and static assets without any check
  const isPublicPrefix = PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  if (isPublicPrefix) {
    return nextWithContentSecurityPolicy(req, contentSecurityPolicy);
  }

  // Allow explicitly public paths
  if (PUBLIC_PATHS.includes(pathname)) {
    return nextWithContentSecurityPolicy(req, contentSecurityPolicy);
  }

  // All other routes: require authentication
  const authenticated = await isAuthenticated(req);
  if (!authenticated) {
    // Redirect to login page for browser requests, 401 for API requests
    if (pathname.startsWith("/api/")) {
      return withContentSecurityPolicy(
        new NextResponse(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" }
        }),
        contentSecurityPolicy
      );
    }

    // Preserve the original destination so the login page can redirect after auth
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    return withContentSecurityPolicy(NextResponse.redirect(loginUrl), contentSecurityPolicy);
  }

  return nextWithContentSecurityPolicy(req, contentSecurityPolicy);
}

// ---------------------------------------------------------------------------
// Matcher — controls which paths this middleware runs on
// ---------------------------------------------------------------------------

/**
 * Run middleware on all paths EXCEPT Next.js internals and static files.
 * This is intentionally broad — the isPublicPrefix / PUBLIC_PATHS checks
 * inside the middleware handle the allow-list logic.
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (Next.js static files)
     * - _next/image  (Next.js image optimisation)
     * - favicon.ico, robots.txt, sitemap.xml
     */
    "/((?!_next/static|_next/image|favicon\\.ico|robots\\.txt|sitemap\\.xml).*)"
  ]
};
