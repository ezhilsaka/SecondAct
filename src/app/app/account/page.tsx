import type { Metadata } from "next";

import { readSearchParam } from "@/lib/auth/redirect";
import { loadAuthenticatedAppSession } from "@/server/auth/app-session";
import type { AppUserProfile } from "@/server/auth/profile-bootstrap";

import { updateProfileNameFromForm } from "./actions";
import styles from "./page.module.css";

type AccountPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type AccountPageViewProps = {
  profile: AppUserProfile;
  notice: string | null;
  error: string | null;
};

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Account | Second Act",
  description: "View and update your Second Act profile."
};

const NOTICE_MESSAGES: Record<string, string> = {
  profile_updated: "Profile updated."
};

const ERROR_MESSAGES: Record<string, string> = {
  profile_validation_error: "Enter both first and last name.",
  profile_update_failed: "We could not update your profile. Please try again."
};

function formatDateTime(value: Date): string {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(value);
}

export function AccountPageView({ profile, notice, error }: AccountPageViewProps) {
  return (
    <div className={styles.accountPage}>
      <header className={styles.pageHeader}>
        <p className={styles.kicker}>Account</p>
        <h1>Profile</h1>
        <p>Review your Second Act profile and keep your display name current.</p>
      </header>

      {notice ? (
        <p className={styles.noticeMessage} role="status">
          {notice}
        </p>
      ) : null}

      {error ? (
        <p className={styles.errorMessage} role="alert">
          {error}
        </p>
      ) : null}

      <section className={styles.profileGrid} aria-label="Profile details">
        <div>
          <p className={styles.panelLabel}>First name</p>
          <p>{profile.firstName}</p>
        </div>
        <div>
          <p className={styles.panelLabel}>Last name</p>
          <p>{profile.lastName}</p>
        </div>
        <div>
          <p className={styles.panelLabel}>Email</p>
          <p>{profile.email}</p>
          <span>Read-only</span>
        </div>
        <div>
          <p className={styles.panelLabel}>Investor handle</p>
          <p>@{profile.investorHandle}</p>
          <span>Read-only</span>
        </div>
        <div>
          <p className={styles.panelLabel}>Created</p>
          <p>{formatDateTime(profile.createdAt)}</p>
        </div>
        <div>
          <p className={styles.panelLabel}>Updated</p>
          <p>{formatDateTime(profile.updatedAt)}</p>
        </div>
      </section>

      <section className={styles.accountPanel} aria-labelledby="profile-edit-heading">
        <div>
          <p className={styles.panelLabel}>Edit profile</p>
          <h2 id="profile-edit-heading">Update display name</h2>
          <p>Email and investor handle stay read-only for this local MVP.</p>
        </div>
        <form action={updateProfileNameFromForm} className={styles.profileForm}>
          <label>
            <span>First name</span>
            <input
              name="firstName"
              type="text"
              autoComplete="given-name"
              defaultValue={profile.firstName}
              required
            />
          </label>
          <label>
            <span>Last name</span>
            <input
              name="lastName"
              type="text"
              autoComplete="family-name"
              defaultValue={profile.lastName}
              required
            />
          </label>
          <button type="submit">Save profile</button>
        </form>
      </section>
    </div>
  );
}

export default async function AppAccountPage({ searchParams }: AccountPageProps = {}) {
  const { profile } = await loadAuthenticatedAppSession();
  const query = await searchParams;
  const noticeCode = readSearchParam(query?.notice);
  const errorCode = readSearchParam(query?.error);

  return (
    <AccountPageView
      profile={profile}
      notice={noticeCode ? NOTICE_MESSAGES[noticeCode] ?? null : null}
      error={errorCode ? ERROR_MESSAGES[errorCode] ?? ERROR_MESSAGES.profile_update_failed : null}
    />
  );
}
