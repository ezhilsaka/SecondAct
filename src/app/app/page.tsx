import styles from "./page.module.css";

export default function AppDashboardPage() {
  return (
    <div className={styles.dashboard}>
      <header className={styles.pageHeader}>
        <p className={styles.kicker}>Workspace</p>
        <h1>Portfolio command center</h1>
        <p>
          Your authenticated Second Act workspace is ready for the portfolio setup flow.
        </p>
      </header>

      <section className={styles.statusGrid} aria-label="Workspace status">
        <article className={styles.statusCard}>
          <p className={styles.cardLabel}>Product status</p>
          <h2>Portfolio setup is ready</h2>
          <p>
            Start with a manual portfolio, then add holdings once the detail workspace is ready.
          </p>
        </article>

        <article className={styles.statusCard}>
          <p className={styles.cardLabel}>Report pipeline</p>
          <h2>Backend ready</h2>
          <p>
            Canonical model, analysis, narrative, and PDF generation remain ready behind the
            authenticated workspace.
          </p>
        </article>
      </section>

      <section className={styles.nextPanel} aria-labelledby="next-action-heading">
        <div>
          <p className={styles.cardLabel}>Next action</p>
          <h2 id="next-action-heading">Create Portfolio</h2>
          <p>
            Name the portfolio and choose a base currency. Holdings management comes after this
            metadata step.
          </p>
        </div>
        <a className={styles.primaryLink} href="/app/portfolios/new">
          Create Portfolio
        </a>
      </section>
    </div>
  );
}
