import styles from "./page.module.css";

export default function AppAccountPage() {
  return (
    <div className={styles.accountPage}>
      <header className={styles.pageHeader}>
        <p className={styles.kicker}>Account</p>
        <h1>Profile foundation</h1>
        <p>
          Second Act now loads an app-owned profile for each authenticated user.
        </p>
      </header>

      <section className={styles.accountPanel} aria-labelledby="account-status-heading">
        <div>
          <p className={styles.panelLabel}>Status</p>
          <h2 id="account-status-heading">Profile bootstrap enabled</h2>
          <p>
            Name completion, account preferences, and billing controls will be layered onto this
            profile record in later product phases.
          </p>
        </div>
      </section>
    </div>
  );
}
