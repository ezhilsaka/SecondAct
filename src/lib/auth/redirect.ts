export const DEFAULT_AUTH_REDIRECT_PATH = "/app";
export const DEFAULT_LOGOUT_REDIRECT_PATH = "/";

const LOCAL_REDIRECT_ORIGIN = "https://second-act.local";
const UNSAFE_REDIRECT_CHARACTER_PATTERN = /[\\\u0000-\u001F\u007F]/;
const UNSAFE_ENCODED_REDIRECT_PATTERN = /%(?:0[0-9a-f]|1[0-9a-f]|2f|5c|7f)/i;

export function readSearchParam(
  value: string | string[] | undefined,
  fallback: string | null = null
): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? fallback;
  }

  return value ?? fallback;
}

export function sanitizeRelativeRedirect(
  value: string | string[] | null | undefined,
  fallback = DEFAULT_AUTH_REDIRECT_PATH
): string {
  const candidate = typeof value === "string" ? value : Array.isArray(value) ? value[0] : null;

  if (
    !candidate ||
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    UNSAFE_REDIRECT_CHARACTER_PATTERN.test(candidate) ||
    UNSAFE_ENCODED_REDIRECT_PATTERN.test(candidate)
  ) {
    return fallback;
  }

  try {
    const parsed = new URL(candidate, LOCAL_REDIRECT_ORIGIN);

    if (parsed.origin !== LOCAL_REDIRECT_ORIGIN) {
      return fallback;
    }

    const relativePath = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    return relativePath.startsWith("//") ? fallback : relativePath;
  } catch {
    return fallback;
  }
}

export function buildAuthCallbackUrl(origin: string, nextPath: string): string {
  const callbackUrl = new URL("/auth/callback", origin);
  callbackUrl.searchParams.set("next", sanitizeRelativeRedirect(nextPath));

  return callbackUrl.toString();
}

export function buildLoginErrorUrl(requestUrl: string, nextPath: string): URL {
  const loginUrl = new URL("/login", requestUrl);
  loginUrl.searchParams.set("error", "auth_callback_failed");
  loginUrl.searchParams.set("next", sanitizeRelativeRedirect(nextPath));

  return loginUrl;
}
