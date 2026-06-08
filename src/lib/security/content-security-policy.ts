type ContentSecurityPolicyOptions = {
  nonce: string;
  supabaseUrl?: string;
  isDevelopment?: boolean;
};

function readOrigin(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function createContentSecurityPolicyNonce(): string {
  return btoa(crypto.randomUUID());
}

export function buildContentSecurityPolicy({
  nonce,
  supabaseUrl,
  isDevelopment = false
}: ContentSecurityPolicyOptions): string {
  const supabaseOrigin = readOrigin(supabaseUrl);
  const scriptSources = ["'self'", `'nonce-${nonce}'`];

  if (isDevelopment) {
    scriptSources.push("'unsafe-eval'");
  }

  const connectSources = ["'self'"];

  if (supabaseOrigin) {
    connectSources.push(supabaseOrigin);
  }

  return [
    "default-src 'self'",
    `script-src ${scriptSources.join(" ")}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: blob:",
    "font-src 'self' https://fonts.gstatic.com",
    `connect-src ${connectSources.join(" ")}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join("; ");
}
