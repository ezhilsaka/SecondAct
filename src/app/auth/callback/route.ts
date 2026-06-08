import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { buildLoginErrorUrl, sanitizeRelativeRedirect } from "@/lib/auth/redirect";
import { createSupabaseServerClient } from "@/server/auth/supabase-server";

const SUPPORTED_TOKEN_HASH_TYPES = new Set(["email", "magiclink", "signup", "invite"]);

function isSupportedTokenHashType(type: string | null): type is EmailOtpType {
  return type !== null && SUPPORTED_TOKEN_HASH_TYPES.has(type);
}

function redirectWithoutStore(url: URL): NextResponse {
  const response = NextResponse.redirect(url);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const otpType = request.nextUrl.searchParams.get("type");
  const nextPath = sanitizeRelativeRedirect(request.nextUrl.searchParams.get("next"));

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return redirectWithoutStore(new URL(nextPath, request.url));
    }
  } else if (tokenHash && isSupportedTokenHashType(otpType)) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: otpType
    });

    if (!error) {
      return redirectWithoutStore(new URL(nextPath, request.url));
    }
  }

  return redirectWithoutStore(buildLoginErrorUrl(request.url, nextPath));
}
