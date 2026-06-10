import type { EmailOtpType, SupabaseClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import {
  buildLoginErrorUrl,
  buildLoginProfileCompletionUrl,
  sanitizeRelativeRedirect
} from "@/lib/auth/redirect";
import { getAuthenticatedUserFromClaims } from "@/server/auth/authenticated-user";
import { createSupabaseServerClient } from "@/server/auth/supabase-server";

const SUPPORTED_TOKEN_HASH_TYPES = new Set(["email", "magiclink", "signup", "invite"]);

type AuthCallbackFailureReason =
  | "oauth_code_exchange_failed"
  | "email_token_verify_failed"
  | "claims_unavailable"
  | "claims_invalid"
  | "profile_completion_required"
  | "profile_bootstrap_failed"
  | "missing_or_unsupported_callback_params";

type AuthCallbackFailureContext = Record<string, string | number | boolean | null | undefined>;

type BootstrapCurrentUserProfileResult =
  | { ok: true }
  | {
      ok: false;
      reason: Extract<
        AuthCallbackFailureReason,
        | "claims_unavailable"
        | "claims_invalid"
        | "profile_completion_required"
        | "profile_bootstrap_failed"
      >;
      context?: AuthCallbackFailureContext;
    };

function isSupportedTokenHashType(type: string | null): type is EmailOtpType {
  return type !== null && SUPPORTED_TOKEN_HASH_TYPES.has(type);
}

function redirectWithoutStore(url: URL): NextResponse {
  const response = NextResponse.redirect(url);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

async function signOutIgnoringErrors(supabase: SupabaseClient): Promise<void> {
  try {
    await supabase.auth.signOut();
  } catch {
    // The callback already failed; keep the user-facing redirect generic.
  }
}

function summarizeAuthError(error: unknown): AuthCallbackFailureContext {
  if (!error || typeof error !== "object") {
    return {};
  }

  const maybeError = error as {
    code?: unknown;
    name?: unknown;
    status?: unknown;
  };

  return {
    errorCode: typeof maybeError.code === "string" ? maybeError.code : undefined,
    errorName: typeof maybeError.name === "string" ? maybeError.name : undefined,
    status: typeof maybeError.status === "number" ? maybeError.status : undefined
  };
}

function logAuthCallbackFailure(
  reason: AuthCallbackFailureReason,
  context: AuthCallbackFailureContext = {}
): void {
  console.warn("[SecondAct auth callback]", {
    event: "auth.callback_failed",
    reason,
    ...context
  });
}

async function bootstrapCurrentUserProfile(
  supabase: SupabaseClient
): Promise<BootstrapCurrentUserProfileResult> {
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data) {
    return {
      ok: false,
      reason: "claims_unavailable",
      context: summarizeAuthError(error)
    };
  }

  const user = getAuthenticatedUserFromClaims(data.claims);

  if (!user) {
    return {
      ok: false,
      reason: "claims_invalid"
    };
  }

  try {
    const { bootstrapAuthenticatedUserProfile } = await import(
      "@/server/auth/profile-bootstrap"
    );
    await bootstrapAuthenticatedUserProfile(user);
  } catch (bootstrapError) {
    if (
      bootstrapError &&
      typeof bootstrapError === "object" &&
      (bootstrapError as { code?: unknown }).code === "PROFILE_COMPLETION_REQUIRED"
    ) {
      return {
        ok: false,
        reason: "profile_completion_required"
      };
    }

    return {
      ok: false,
      reason: "profile_bootstrap_failed",
      context: summarizeAuthError(bootstrapError)
    };
  }

  return { ok: true };
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const otpType = request.nextUrl.searchParams.get("type");
  const nextPath = sanitizeRelativeRedirect(request.nextUrl.searchParams.get("next"));

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      logAuthCallbackFailure("oauth_code_exchange_failed", summarizeAuthError(error));
    } else {
      const bootstrapResult = await bootstrapCurrentUserProfile(supabase);

      if (bootstrapResult.ok) {
        return redirectWithoutStore(new URL(nextPath, request.url));
      }

      if (bootstrapResult.reason === "profile_completion_required") {
        return redirectWithoutStore(buildLoginProfileCompletionUrl(request.url, nextPath));
      }

      logAuthCallbackFailure(bootstrapResult.reason, bootstrapResult.context);
    }

    await signOutIgnoringErrors(supabase);
  } else if (tokenHash && isSupportedTokenHashType(otpType)) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: otpType
    });

    if (error) {
      logAuthCallbackFailure("email_token_verify_failed", summarizeAuthError(error));
    } else {
      const bootstrapResult = await bootstrapCurrentUserProfile(supabase);

      if (bootstrapResult.ok) {
        return redirectWithoutStore(new URL(nextPath, request.url));
      }

      if (bootstrapResult.reason === "profile_completion_required") {
        return redirectWithoutStore(buildLoginProfileCompletionUrl(request.url, nextPath));
      }

      logAuthCallbackFailure(bootstrapResult.reason, bootstrapResult.context);
    }

    await signOutIgnoringErrors(supabase);
  } else {
    logAuthCallbackFailure("missing_or_unsupported_callback_params", {
      hasCode: Boolean(code),
      hasTokenHash: Boolean(tokenHash),
      otpType,
      otpTypeSupported: isSupportedTokenHashType(otpType)
    });
  }

  return redirectWithoutStore(buildLoginErrorUrl(request.url, nextPath));
}
