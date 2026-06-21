import Link from "next/link";

import { requireAuthenticatedAppUser } from "@/server/auth/app-session";
import {
  PortfolioService,
  type PortfolioSummaryResult
} from "@/server/services/portfolio-service";
import {
  ReportRunService,
  type ReportRunSummaryResult
} from "@/server/services/report-run-service";

import styles from "./page.module.css";

type AppDashboardViewProps = {
  portfolioCount: number;
  latestPortfolio: PortfolioSummaryResult | null;
  latestReport: ReportRunSummaryResult | null;
};

function formatPortfolioCount(count: number): string {
  return `${count} ${count === 1 ? "portfolio" : "portfolios"}`;
}

function formatHoldingCount(count: number): string {
  return `${count} ${count === 1 ? "holding" : "holdings"}`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(value));
}

function getReportOutcomeDate(run: ReportRunSummaryResult): string {
  if (run.completedAt) {
    return formatDate(run.completedAt);
  }

  if (run.failedAt) {
    return formatDate(run.failedAt);
  }

  return formatDate(run.requestedAt);
}

export function AppDashboardView({
  portfolioCount,
  latestPortfolio,
  latestReport
}: AppDashboardViewProps) {
  return (
    <div className={styles.dashboard}>
      <header className={styles.pageHeader}>
        <p className={styles.kicker}>Workspace</p>
        <h1>Portfolio command center</h1>
        <p>
          Track manual portfolios here, then generate reports from portfolios that are ready.
        </p>
      </header>

      <section className={styles.statusGrid} aria-label="Workspace status">
        <article className={styles.statusCard}>
          <p className={styles.cardLabel}>Product status</p>
          <h2>Portfolio management is live</h2>
          <p>
            Create portfolios, add holdings, and review readiness from the protected workspace.
          </p>
        </article>

        <article className={styles.statusCard}>
          <p className={styles.cardLabel}>Report pipeline</p>
          <h2>Report generation is live</h2>
          <p>
            Open a ready portfolio to start a report, then return to Reports to revisit completed
            runs.
          </p>
        </article>
      </section>

      <section className={styles.reportOverview} aria-label="Report overview">
        {latestReport ? (
          <article className={styles.latestReportPanel}>
            <div>
              <p className={styles.cardLabel}>Latest report</p>
              <h2>{latestReport.portfolioName}</h2>
              <p>Latest report activity from your private report library.</p>
            </div>
            <dl className={styles.latestFacts}>
              <div>
                <dt>Status</dt>
                <dd>{latestReport.status}</dd>
              </div>
              <div>
                <dt>Currency</dt>
                <dd>{latestReport.reportingCurrency}</dd>
              </div>
              <div>
                <dt>Requested / finished</dt>
                <dd>{getReportOutcomeDate(latestReport)}</dd>
              </div>
            </dl>
            <div className={styles.reportLinks}>
              <Link className={styles.secondaryLink} href={`/app/reports/${latestReport.runId}`}>
                Open Report
              </Link>
              <Link className={styles.secondaryLink} href="/app/reports">
                Reports
              </Link>
            </div>
          </article>
        ) : (
          <article className={styles.emptyReportPanel}>
            <div>
              <p className={styles.cardLabel}>Latest report</p>
              <h2>No reports yet</h2>
              <p>
                {portfolioCount > 0
                  ? "Open a ready portfolio to generate your first report."
                  : "Create a portfolio and add holdings before reports appear here."}
              </p>
            </div>
            <Link
              className={styles.secondaryLink}
              href={portfolioCount > 0 ? "/app/portfolios" : "/app/portfolios/new"}
            >
              {portfolioCount > 0 ? "View Portfolios" : "Create Portfolio"}
            </Link>
          </article>
        )}
      </section>

      <section className={styles.portfolioOverview} aria-label="Portfolio overview">
        <article className={styles.metricPanel}>
          <p className={styles.cardLabel}>Portfolios</p>
          <p className={styles.metricValue}>{portfolioCount}</p>
          <p>{formatPortfolioCount(portfolioCount)} in this workspace</p>
        </article>

        {latestPortfolio ? (
          <article className={styles.latestPanel}>
            <div>
              <p className={styles.cardLabel}>Latest portfolio</p>
              <h2>{latestPortfolio.name}</h2>
              <p>{latestPortfolio.description ?? "Manual portfolio"}</p>
            </div>
            <dl className={styles.latestFacts}>
              <div>
                <dt>Holdings</dt>
                <dd>{formatHoldingCount(latestPortfolio.holdingCount)}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{latestPortfolio.readiness.label}</dd>
              </div>
              <div>
                <dt>Updated</dt>
                <dd>{formatDate(latestPortfolio.updatedAt)}</dd>
              </div>
            </dl>
            <Link className={styles.secondaryLink} href={`/app/portfolios/${latestPortfolio.id}`}>
              Open Portfolio
            </Link>
          </article>
        ) : (
          <article className={styles.emptyPanel}>
            <p className={styles.cardLabel}>No portfolios yet</p>
            <h2>Create your first portfolio</h2>
            <p>
              Start with a portfolio name and base currency. Holdings can be added from the detail
              page after the portfolio exists.
            </p>
          </article>
        )}
      </section>

      <section className={styles.nextPanel} aria-labelledby="next-action-heading">
        <div>
          <p className={styles.cardLabel}>Next action</p>
          <h2 id="next-action-heading">
            {portfolioCount > 0 ? "Review Portfolios" : "Create Portfolio"}
          </h2>
          <p>
            {portfolioCount > 0
              ? "Open the portfolio list to review readiness, add holdings, or manage portfolio details."
              : "Name the portfolio and choose a base currency, then add holdings from the detail page."}
          </p>
        </div>
        <Link
          className={styles.primaryLink}
          href={portfolioCount > 0 ? "/app/portfolios" : "/app/portfolios/new"}
        >
          {portfolioCount > 0 ? "View Portfolios" : "Create Portfolio"}
        </Link>
      </section>
    </div>
  );
}

export default async function AppDashboardPage() {
  const user = await requireAuthenticatedAppUser();
  const [{ portfolioCount, latestPortfolio }, reportHistory] = await Promise.all([
    new PortfolioService().getDashboardSummary(user.id),
    new ReportRunService().listReportRunsForUser(user.id, {
      limit: 1
    })
  ]);

  return (
    <AppDashboardView
      portfolioCount={portfolioCount}
      latestPortfolio={latestPortfolio}
      latestReport={reportHistory.reportRuns[0] ?? null}
    />
  );
}
