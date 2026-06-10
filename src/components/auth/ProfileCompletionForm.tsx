import { redirect } from "next/navigation";

import {
  buildLoginProfileCompletionPath,
  sanitizeRelativeRedirect
} from "@/lib/auth/redirect";
import { AuthenticationRequiredError } from "@/server/auth/authenticated-user";
import { requireAuthenticatedUser } from "@/server/auth/supabase-server";
import styles from "./AuthLoginForm.module.css";

type ProfileCompletionFormProps = {
  nextPath: string;
  errorCode: string | null;
};

const PROFILE_COMPLETION_ERROR_MESSAGES: Record<string, string> = {
  missing_name: "Enter your first and last name.",
  setup_failed: "We could not complete your profile. Please try again."
};

function getErrorCode(error: unknown): string | null {
  if (!error || typeof error !== "object") {
    return null;
  }

  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

function readFormString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function buildLoginRedirect(nextPath: string): string {
  const loginUrl = new URL("https://second-act.local/login");
  loginUrl.searchParams.set("next", sanitizeRelativeRedirect(nextPath));

  return `${loginUrl.pathname}${loginUrl.search}`;
}

async function requireUserForProfileCompletion(nextPath: string) {
  try {
    return await requireAuthenticatedUser();
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      redirect(buildLoginRedirect(nextPath));
    }

    throw error;
  }
}

async function completeProfileFromLogin(formData: FormData) {
  "use server";

  const nextPath = sanitizeRelativeRedirect(readFormString(formData, "next"));
  const firstName = readFormString(formData, "firstName");
  const lastName = readFormString(formData, "lastName");

  if (!firstName || !lastName) {
    redirect(buildLoginProfileCompletionPath(nextPath, "missing_name"));
  }

  const user = await requireUserForProfileCompletion(nextPath);
  const { completeAuthenticatedUserProfile } = await import(
    "@/server/auth/profile-bootstrap"
  );

  try {
    await completeAuthenticatedUserProfile(user, {
      firstName,
      lastName
    });
  } catch {
    redirect(buildLoginProfileCompletionPath(nextPath, "setup_failed"));
  }

  redirect(nextPath);
}

async function loadProfileCompletionState(nextPath: string) {
  const user = await requireUserForProfileCompletion(nextPath);
  const { bootstrapAuthenticatedUserProfile } = await import(
    "@/server/auth/profile-bootstrap"
  );

  let profileCompletionRequired = false;

  try {
    await bootstrapAuthenticatedUserProfile(user);
  } catch (error) {
    if (getErrorCode(error) === "PROFILE_COMPLETION_REQUIRED") {
      profileCompletionRequired = true;
    } else {
      throw error;
    }
  }

  if (!profileCompletionRequired) {
    redirect(nextPath);
  }

  return {
    email: user.email
  };
}

export async function ProfileCompletionForm({
  nextPath,
  errorCode
}: ProfileCompletionFormProps) {
  const safeNextPath = sanitizeRelativeRedirect(nextPath);
  const errorMessage = errorCode ? PROFILE_COMPLETION_ERROR_MESSAGES[errorCode] : null;
  const { email } = await loadProfileCompletionState(safeNextPath);

  return (
    <div className={styles.loginCard}>
      <div className={styles.formHeader}>
        <p className={styles.kicker}>SECURE SIGN IN</p>
        <h2>Complete your profile</h2>
      </div>

      <p className={styles.helperText}>
        Add your name to finish setting up this Second Act workspace.
      </p>

      {email ? <p className={styles.emailLine}>{email}</p> : null}

      {errorMessage ? (
        <p className={styles.errorMessage} role="alert">
          {errorMessage}
        </p>
      ) : null}

      <form className={styles.form} action={completeProfileFromLogin}>
        <input type="hidden" name="next" value={safeNextPath} />
        <label className={styles.fieldLabel} htmlFor="first-name">
          First name
        </label>
        <input
          id="first-name"
          className={styles.input}
          type="text"
          name="firstName"
          autoComplete="given-name"
          required
        />
        <label className={styles.fieldLabel} htmlFor="last-name">
          Last name
        </label>
        <input
          id="last-name"
          className={styles.input}
          type="text"
          name="lastName"
          autoComplete="family-name"
          required
        />
        <button className={styles.primaryButton} type="submit">
          Continue
        </button>
      </form>
    </div>
  );
}
