import type { Metadata } from "next";

import { readSearchParam, sanitizeRelativeRedirect } from "@/lib/auth/redirect";
import { AuthLoginForm } from "@/components/auth/AuthLoginForm";
import { ProfileCompletionForm } from "@/components/auth/ProfileCompletionForm";
import styles from "./LoginPage.module.css";

type LoginPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const LOGIN_ERROR_MESSAGES: Record<string, string> = {
  auth_callback_failed: "We could not complete sign-in. Please try again.",
  session_expired: "Your session expired. Please sign in again."
};

export const metadata: Metadata = {
  title: "Sign in | Second Act",
  description: "Sign in to Second Act."
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const nextPath = sanitizeRelativeRedirect(readSearchParam(params?.next));
  const errorCode = readSearchParam(params?.error);
  const step = readSearchParam(params?.step);
  const isProfileStep = step === "profile";
  const initialError =
    errorCode && !isProfileStep
      ? LOGIN_ERROR_MESSAGES[errorCode] ?? LOGIN_ERROR_MESSAGES.auth_callback_failed
      : null;

  return (
    <main className={styles.loginRoot}>
      <section className={styles.brandPanel} aria-label="Second Act sign in">
        <div className={styles.brandWrap}>
          <span className={styles.brandMark} aria-hidden="true">
            <span className={styles.brandDot} />
            <span className={styles.brandPillarA} />
            <span className={styles.brandPillarB} />
            <span className={styles.brandBase} />
          </span>
          <p className={styles.brandWord}>Second Act</p>
        </div>
        <div className={styles.brandCopy}>
          <p className={styles.kicker}>PORTFOLIO CLARITY</p>
          <h1>Sign in to continue your report.</h1>
          <p>Use Google or a one-time email code to access your Second Act workspace.</p>
        </div>
      </section>

      <section className={styles.formPanel}>
        {isProfileStep ? (
          <ProfileCompletionForm nextPath={nextPath} errorCode={errorCode} />
        ) : (
          <AuthLoginForm nextPath={nextPath} initialError={initialError} />
        )}
      </section>
    </main>
  );
}
