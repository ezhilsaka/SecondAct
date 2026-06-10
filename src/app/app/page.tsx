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
          <h2>Portfolio setup coming next</h2>
          <p>
            The shell, session, and profile foundation are in place for the next product step.
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
            Portfolio creation will connect this shell to the report-generation flow in the next
            product phase.
          </p>
        </div>
        <button className={styles.disabledButton} type="button" disabled>
          Create Portfolio
        </button>
      </section>
    </div>
  );
}
