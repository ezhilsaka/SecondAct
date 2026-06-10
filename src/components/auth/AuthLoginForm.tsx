"use client";

import { FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  buildAuthCallbackUrl,
  buildLoginProfileCompletionPath,
  sanitizeRelativeRedirect
} from "@/lib/auth/redirect";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import styles from "./AuthLoginForm.module.css";

type AuthLoginFormProps = {
  nextPath: string;
  initialError: string | null;
};

type PendingAction = "google" | "email" | "otp" | null;
type AuthFlow = NonNullable<PendingAction>;

const GENERIC_AUTH_ERROR = "We could not complete sign-in. Please try again.";
const EMAIL_RATE_LIMIT_ERROR = "Too many code requests. Please wait a bit and try again.";

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Unknown auth error";
}

function getErrorCode(error: unknown): string | null {
  if (!error || typeof error !== "object") {
    return null;
  }

  const maybeError = error as { code?: unknown };

  return typeof maybeError.code === "string" ? maybeError.code : null;
}

function getErrorStatus(error: unknown): number | null {
  if (!error || typeof error !== "object") {
    return null;
  }

  const maybeError = error as { status?: unknown };

  return typeof maybeError.status === "number" ? maybeError.status : null;
}

function isRateLimitAuthError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  const code = getErrorCode(error)?.toLowerCase() ?? "";

  return (
    getErrorStatus(error) === 429 ||
    message.includes("rate limit") ||
    message.includes("too many") ||
    code.includes("rate_limit") ||
    code.includes("over_email_send_rate_limit")
  );
}

export function getUserFacingAuthError(flow: AuthFlow, error: unknown): string {
  if ((flow === "email" || flow === "otp") && isRateLimitAuthError(error)) {
    return EMAIL_RATE_LIMIT_ERROR;
  }

  return GENERIC_AUTH_ERROR;
}

function reportAuthError(flow: PendingAction, error: unknown) {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  console.warn("[SecondAct auth]", {
    flow,
    message: getErrorMessage(error)
  });
}

export function AuthLoginForm({ nextPath, initialError }: AuthLoginFormProps) {
  const router = useRouter();
  const supabaseRef = useRef<ReturnType<typeof createSupabaseBrowserClient> | null>(null);
  const safeNextPath = sanitizeRelativeRedirect(nextPath);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [codeRequested, setCodeRequested] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(initialError);

  const isBusy = pendingAction !== null;

  function getCallbackUrl() {
    return buildAuthCallbackUrl(window.location.origin, safeNextPath);
  }

  function getProfileCompletionPath() {
    return buildLoginProfileCompletionPath(safeNextPath);
  }

  function getSupabaseClient(flow: AuthFlow) {
    try {
      supabaseRef.current ??= createSupabaseBrowserClient();
      return supabaseRef.current;
    } catch (authError) {
      reportAuthError(flow, authError);
      setError(getUserFacingAuthError(flow, authError));
      return null;
    }
  }

  async function handleGoogleSignIn() {
    setPendingAction("google");
    setError(null);
    setMessage(null);

    const supabase = getSupabaseClient("google");

    if (!supabase) {
      setPendingAction(null);
      return;
    }

    try {
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: getCallbackUrl()
        }
      });

      if (!authError) {
        return;
      }

      reportAuthError("google", authError);
      setError(getUserFacingAuthError("google", authError));
    } catch (authError) {
      reportAuthError("google", authError);
      setError(getUserFacingAuthError("google", authError));
    }

    setPendingAction(null);
  }

  async function handleEmailSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setError("Enter a valid email address.");
      return;
    }

    setPendingAction("email");
    setError(null);
    setMessage(null);

    const supabase = getSupabaseClient("email");

    if (!supabase) {
      setPendingAction(null);
      return;
    }

    let authError: Error | null = null;

    try {
      const result = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: getCallbackUrl()
        }
      });

      authError = result.error;
    } catch {
      authError = new Error("Email OTP sign-in failed.");
    }

    setPendingAction(null);

    if (authError) {
      reportAuthError("email", authError);
      setError(getUserFacingAuthError("email", authError));
      return;
    }

    setCodeRequested(true);
    setMessage("Code sent. Check your email.");
  }

  async function handleOtpSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedOtp = otp.trim();

    if (!normalizedEmail || normalizedOtp.length < 6) {
      setError("Enter the email address and six-digit code.");
      return;
    }

    setPendingAction("otp");
    setError(null);
    setMessage(null);

    const supabase = getSupabaseClient("otp");

    if (!supabase) {
      setPendingAction(null);
      return;
    }

    let authError: Error | null = null;

    try {
      const result = await supabase.auth.verifyOtp({
        email: normalizedEmail,
        token: normalizedOtp,
        type: "email"
      });

      authError = result.error;
    } catch {
      authError = new Error("Email OTP verification failed.");
    }

    if (authError) {
      reportAuthError("otp", authError);
      setError(getUserFacingAuthError("otp", authError));
      setPendingAction(null);
      return;
    }

    router.replace(getProfileCompletionPath());
    router.refresh();
  }

  return (
    <div className={styles.loginCard}>
      <div className={styles.formHeader}>
        <p className={styles.kicker}>SECURE SIGN IN</p>
        <h2>Welcome back</h2>
      </div>

      {error ? (
        <p className={styles.errorMessage} role="alert">
          {error}
        </p>
      ) : null}

      {message ? <p className={styles.successMessage}>{message}</p> : null}

      <button
        type="button"
        className={styles.googleButton}
        onClick={handleGoogleSignIn}
        disabled={isBusy}
      >
        <span className={styles.googleMark} aria-hidden="true">
          G
        </span>
        <span>{pendingAction === "google" ? "Connecting..." : "Continue with Google"}</span>
      </button>

      <div className={styles.divider} aria-hidden="true">
        <span />
        <p>or</p>
        <span />
      </div>

      <form className={styles.form} onSubmit={handleEmailSubmit}>
        <label className={styles.fieldLabel} htmlFor="email">
          Email
        </label>
        <input
          id="email"
          className={styles.input}
          type="email"
          name="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={isBusy}
          required
        />
        <button type="submit" className={styles.primaryButton} disabled={isBusy}>
          {pendingAction === "email" ? "Sending..." : "Continue with Email"}
        </button>
      </form>

      {codeRequested ? (
        <form className={styles.form} onSubmit={handleOtpSubmit}>
          <label className={styles.fieldLabel} htmlFor="otp">
            Code
          </label>
          <input
            id="otp"
            className={styles.input}
            type="text"
            name="otp"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={otp}
            onChange={(event) => setOtp(event.target.value)}
            disabled={isBusy}
            maxLength={8}
            required
          />
          <button type="submit" className={styles.primaryButton} disabled={isBusy}>
            {pendingAction === "otp" ? "Verifying..." : "Verify Code"}
          </button>
        </form>
      ) : null}
    </div>
  );
}
