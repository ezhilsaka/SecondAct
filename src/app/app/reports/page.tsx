import type { Metadata } from "next";
import Link from "next/link";

import { requireAuthenticatedAppUser } from "@/server/auth/app-session";
import {
  ReportRunService,
  type ReportRunSummaryResult
} from "@/server/services/report-run-service";

import styles from "./page.module.css";

type ReportHistoryViewProps = {
  reportRuns: ReportRunSummaryResult[];
};

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Reports | Second Act",
  description: "Review Second Act report generation history."
};

function formatDateTime(value: string | null): string {
  if (!value) {
    return "Not yet";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function getReportOutcomeDate(run: ReportRunSummaryResult): string {
  if (run.completedAt) {
    return formatDateTime(run.completedAt);
  }

  if (run.failedAt) {
    return formatDateTime(run.failedAt);
  }

  return "Not yet";
}

function getStatusClass(status: string): string {
  if (status === "COMPLETED") {
    return styles.completedBadge;
  }

  if (status === "FAILED") {
    return styles.failedBadge;
  }

  if (status === "PROCESSING") {
    return styles.processingBadge;
  }

  return styles.queuedBadge;
}

export function ReportHistoryView({ reportRuns }: ReportHistoryViewProps) {
  const hasReports = reportRuns.length > 0;

  return (
    <div className={styles.reportsPage}>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.kicker}>Reports</p>
          <h1>Report history</h1>
          <p>Return to in-progress and completed portfolio reports from one place.</p>
        </div>
      </header>

      {hasReports ? (
        <section className={styles.reportList} aria-label="Report history">
          {reportRuns.map((run) => (
            <article className={styles.reportRow} key={run.runId}>
              <div className={styles.reportIdentity}>
                <p className={styles.reportName}>{run.portfolioName}</p>
                <Link href={`/app/portfolios/${run.portfolioId}`}>Source portfolio</Link>
              </div>

              <dl className={styles.reportFacts}>
                <div>
                  <dt>Status</dt>
                  <dd>
                    <span className={getStatusClass(run.status)}>{run.status}</span>
                  </dd>
                </div>
                <div>
                  <dt>Currency</dt>
                  <dd>{run.reportingCurrency}</dd>
                </div>
                <div>
                  <dt>Requested</dt>
                  <dd>{formatDateTime(run.requestedAt)}</dd>
                </div>
                <div>
                  <dt>Completed / failed</dt>
                  <dd>{getReportOutcomeDate(run)}</dd>
                </div>
              </dl>

              <div className={styles.rowActions}>
                <Link className={styles.secondaryAction} href={`/app/reports/${run.runId}`}>
                  View status
                </Link>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <section className={styles.emptyState} aria-labelledby="empty-reports-heading">
          <div>
            <p className={styles.cardLabel}>No reports yet</p>
            <h2 id="empty-reports-heading">Generate a report from a ready portfolio</h2>
            <p>
              Reports appear here after you start one from a portfolio with saved holdings.
            </p>
          </div>
          <Link className={styles.primaryAction} href="/app/portfolios">
            View Portfolios
          </Link>
        </section>
      )}
    </div>
  );
}

export default async function ReportsPage() {
  const user = await requireAuthenticatedAppUser();
  const { reportRuns } = await new ReportRunService().listReportRunsForUser(user.id, {
    limit: 50
  });

  return <ReportHistoryView reportRuns={reportRuns} />;
}
