import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  buildContentSecurityPolicy,
  createContentSecurityPolicyNonce
} from "@/lib/security/content-security-policy";
import { getAuthenticatedUserForProxy } from "@/server/auth/supabase-proxy";

const PUBLIC_PATHS = new Set([
  "/",
  "/legal",
  "/login",
  "/profile/setup",
  "/auth/callback",
  "/auth/logout",
  "/api/health"
]);

const PUBLIC_PREFIXES = [
  "/_next/",
  "/favicon",
  "/images/",
  "/robots.txt",
  "/sitemap.xml"
];

const API_UNAUTHORIZED_ERROR = {
  error: {
    code: "UNAUTHORIZED",
    message: "Authentication is required."
  }
};

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.has(pathname) || PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isApiRequest(pathname: string): boolean {
  return pathname.startsWith("/api/");
}

function buildContentSecurityPolicyForRequest(): string {
  return buildContentSecurityPolicy({
    nonce: createContentSecurityPolicyNonce(),
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    isDevelopment: process.env.NODE_ENV !== "production"
  });
}

function nextWithContentSecurityPolicy(
  request: NextRequest,
  contentSecurityPolicy: string
): NextResponse {
  const requestHeaders = new Headers(request.headers);
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

function buildLoginRedirect(request: NextRequest): NextResponse {
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = "";
  loginUrl.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);

  return NextResponse.redirect(loginUrl);
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  const contentSecurityPolicy = buildContentSecurityPolicyForRequest();
  const response = nextWithContentSecurityPolicy(request, contentSecurityPolicy);

  if (isPublicPath(pathname)) {
    return response;
  }

  const user = await getAuthenticatedUserForProxy(request, response);

  if (user) {
    return response;
  }

  if (isApiRequest(pathname)) {
    return withContentSecurityPolicy(
      NextResponse.json(API_UNAUTHORIZED_ERROR, { status: 401 }),
      contentSecurityPolicy
    );
  }

  return withContentSecurityPolicy(buildLoginRedirect(request), contentSecurityPolicy);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|robots\\.txt|sitemap\\.xml).*)"
  ]
};
