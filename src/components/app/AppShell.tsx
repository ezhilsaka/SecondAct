import Link from "next/link";
import type { ReactNode } from "react";

import styles from "./AppShell.module.css";

export type AppShellProfile = {
  email: string;
  firstName: string;
  lastName: string;
  investorHandle: string;
};

type AppShellProps = {
  profile: AppShellProfile;
  children: ReactNode;
};

function getDisplayName(profile: AppShellProfile): string {
  return `${profile.firstName} ${profile.lastName}`.trim();
}

export function AppShell({ profile, children }: AppShellProps) {
  const displayName = getDisplayName(profile);

  return (
    <div className={styles.shellRoot}>
      <aside className={styles.sidebar} aria-label="Second Act app navigation">
        <div className={styles.brandBlock}>
          <span className={styles.brandMark} aria-hidden="true">
            <span className={styles.brandDot} />
            <span className={styles.brandPillarA} />
            <span className={styles.brandPillarB} />
            <span className={styles.brandBase} />
          </span>
          <div>
            <p className={styles.brandName}>Second Act</p>
            <p className={styles.brandMode}>Portfolio Workspace</p>
          </div>
        </div>

        <nav className={styles.navList} aria-label="Primary">
          <Link href="/app" className={styles.navItem}>
            Dashboard
          </Link>
          <Link href="/app/portfolios" className={styles.navItem}>
            Portfolios
          </Link>
          <span className={styles.navItemDisabled} aria-disabled="true">
            Reports
          </span>
          <Link href="/app/account" className={styles.navItem}>
            Account
          </Link>
        </nav>
      </aside>

      <div className={styles.mainColumn}>
        <header className={styles.topbar}>
          <div className={styles.profileSummary}>
            <p className={styles.profileName}>{displayName}</p>
            <p className={styles.profileMeta}>
              {profile.email} - @{profile.investorHandle}
            </p>
          </div>

          <form action="/auth/logout" method="post">
            <button className={styles.logoutButton} type="submit">
              Sign out
            </button>
          </form>
        </header>

        <main className={styles.contentArea}>{children}</main>
      </div>
    </div>
  );
}
