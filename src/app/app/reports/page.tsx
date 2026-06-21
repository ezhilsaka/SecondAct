import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { requireAuthenticatedAppUser } from "@/server/auth/app-session";
import {
  PortfolioNotFoundError,
  ReportRunService,
  type ReportRunListResult,
  type ReportRunSummaryResult
} from "@/server/services/report-run-service";
import { uuidSchema } from "@/server/shared/types";

import { ReportDownloadButton } from "./[runId]/ReportDownloadButton";
import { ReportFormSubmitButton } from "./ReportFormSubmitButton";
import { deleteReportRunFromForm, generateReportFromPortfolio } from "./actions";
import styles from "./page.module.css";

type ReportLibraryStatusFilter = "ACTIVE" | "COMPLETED" | "FAILED";
type ReportLibraryCurrencyFilter = "CAD" | "USD";
type ReportLibrarySearchParams = Record<string, string | string[] | undefined>;

type ReportLibraryFilters = {
  status?: ReportLibraryStatusFilter;
  reportingCurrency?: ReportLibraryCurrencyFilter;
  portfolioId?: string;
};

type ReportActionMessage = {
  tone: "success" | "error";
  text: string;
};

type ReportHistoryViewProps = {
  reportRuns: ReportRunSummaryResult[];
  summaryReportRuns: ReportRunSummaryResult[];
  filters: ReportLibraryFilters;
  currentPath: string;
  actionMessage?: ReportActionMessage;
};

type ReportsPageProps = {
  searchParams?: Promise<ReportLibrarySearchParams>;
};

type ReportCounts = {
  active: number;
  completed: number;
  failed: number;
};

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Report Library | Second Act",
  description: "Review, filter, open, re-run, and manage Second Act reports."
};

const STATUS_FILTERS = ["ACTIVE", "COMPLETED", "FAILED"] as const;
const CURRENCY_FILTERS = ["CAD", "USD"] as const;
const STATUS_FILTER_SET: ReadonlySet<string> = new Set(STATUS_FILTERS);
const CURRENCY_FILTER_SET: ReadonlySet<string> = new Set(CURRENCY_FILTERS);

const NOTICE_COPY: Record<string, string> = {
  report_deleted: "Report deleted."
};

const ERROR_COPY: Record<string, string> = {
  report_delete_validation_error: "We could not delete that report. Refresh and try again.",
  report_not_found: "That report is no longer available.",
  report_not_terminal: "Reports can be deleted after they complete or fail.",
  report_delete_storage_failed:
    "We could not remove the saved PDF. Please try deleting the report again.",
  report_delete_failed: "We could not delete that report. Please try again."
};

function readSearchParam(
  params: ReportLibrarySearchParams,
  key: string
): string | undefined {
  const value = params[key];

  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function normalizeStatusFilter(value: string | undefined): ReportLibraryStatusFilter | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.toUpperCase();
  return STATUS_FILTER_SET.has(normalized)
    ? (normalized as ReportLibraryStatusFilter)
    : undefined;
}

function normalizeCurrencyFilter(
  value: string | undefined
): ReportLibraryCurrencyFilter | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.toUpperCase();
  return CURRENCY_FILTER_SET.has(normalized)
    ? (normalized as ReportLibraryCurrencyFilter)
    : undefined;
}

function normalizePortfolioFilter(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const parsedPortfolioId = uuidSchema.safeParse(value);
  return parsedPortfolioId.success ? parsedPortfolioId.data : undefined;
}

function parseFilters(params: ReportLibrarySearchParams): ReportLibraryFilters {
  return {
    status: normalizeStatusFilter(readSearchParam(params, "status")),
    reportingCurrency: normalizeCurrencyFilter(readSearchParam(params, "reportingCurrency")),
    portfolioId: normalizePortfolioFilter(readSearchParam(params, "portfolioId"))
  };
}

function parseActionMessage(params: ReportLibrarySearchParams): ReportActionMessage | undefined {
  const notice = readSearchParam(params, "notice");
  if (notice && NOTICE_COPY[notice]) {
    return { tone: "success", text: NOTICE_COPY[notice] };
  }

  const error = readSearchParam(params, "error");
  if (error && ERROR_COPY[error]) {
    return { tone: "error", text: ERROR_COPY[error] };
  }

  return undefined;
}

function buildReportListOptions(filters: ReportLibraryFilters) {
  return {
    limit: 50,
    ...(filters.portfolioId ? { portfolioId: filters.portfolioId } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.reportingCurrency ? { reportingCurrency: filters.reportingCurrency } : {})
  };
}

function buildSummaryListOptions(filters: ReportLibraryFilters) {
  return {
    limit: 50,
    ...(filters.portfolioId ? { portfolioId: filters.portfolioId } : {})
  };
}

function buildReportsPath(filters: ReportLibraryFilters): string {
  const params = new URLSearchParams();

  if (filters.portfolioId) {
    params.set("portfolioId", filters.portfolioId);
  }

  if (filters.status) {
    params.set("status", filters.status);
  }

  if (filters.reportingCurrency) {
    params.set("reportingCurrency", filters.reportingCurrency);
  }

  const query = params.toString();
  return query ? `/app/reports?${query}` : "/app/reports";
}

function buildResetFiltersPath(filters: ReportLibraryFilters): string {
  return filters.portfolioId
    ? buildReportsPath({ portfolioId: filters.portfolioId })
    : "/app/reports";
}

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

function getStatusLabel(status: string): string {
  return status.replace("_", " ");
}

function getReportCounts(reportRuns: ReportRunSummaryResult[]): ReportCounts {
  return reportRuns.reduce<ReportCounts>(
    (counts, run) => {
      if (run.status === "COMPLETED") {
        counts.completed += 1;
        return counts;
      }

      if (run.status === "FAILED") {
        counts.failed += 1;
        return counts;
      }

      counts.active += 1;
      return counts;
    },
    { active: 0, completed: 0, failed: 0 }
  );
}

function hasAppliedFilters(filters: ReportLibraryFilters): boolean {
  return Boolean(filters.status || filters.reportingCurrency);
}

function DeleteReportForm({
  run,
  currentPath,
  label
}: {
  run: ReportRunSummaryResult;
  currentPath: string;
  label: string;
}) {
  return (
    <form action={deleteReportRunFromForm} className={styles.inlineActionForm}>
      <input type="hidden" name="runId" value={run.runId} />
      <input type="hidden" name="returnTo" value={currentPath} />
      <ReportFormSubmitButton
        className={styles.dangerActionButton}
        pendingLabel="Deleting report..."
        confirmMessage={`Delete this ${run.status.toLowerCase()} report? This removes it from your library.`}
      >
        {label}
      </ReportFormSubmitButton>
    </form>
  );
}

function GenerateReportForm({
  run,
  label,
  pendingLabel
}: {
  run: ReportRunSummaryResult;
  label: string;
  pendingLabel: string;
}) {
  return (
    <form action={generateReportFromPortfolio} className={styles.inlineActionForm}>
      <input type="hidden" name="portfolioId" value={run.portfolioId} />
      <input type="hidden" name="reportingCurrency" value={run.reportingCurrency} />
      {run.status === "FAILED" ? (
        <input type="hidden" name="retrySourceRunId" value={run.runId} />
      ) : null}
      <ReportFormSubmitButton
        className={styles.secondaryActionButton}
        pendingLabel={pendingLabel}
      >
        {label}
      </ReportFormSubmitButton>
    </form>
  );
}

function ReportRowActions({
  run,
  currentPath
}: {
  run: ReportRunSummaryResult;
  currentPath: string;
}) {
  if (run.status === "COMPLETED") {
    return (
      <div className={styles.rowActions}>
        <Link className={styles.secondaryAction} href={`/app/reports/${run.runId}`}>
          Report details
        </Link>
        <ReportDownloadButton
          runId={run.runId}
          containerClassName={styles.inlineDownloadAction}
          buttonClassName={styles.secondaryActionButton}
          messageClassName={styles.inlineError}
        />
        <GenerateReportForm
          run={run}
          label="Generate fresh report"
          pendingLabel="Starting report..."
        />
        <DeleteReportForm run={run} currentPath={currentPath} label="Delete report" />
      </div>
    );
  }

  if (run.status === "FAILED") {
    return (
      <div className={styles.rowActions}>
        <Link className={styles.secondaryAction} href={`/app/reports/${run.runId}`}>
          Report details
        </Link>
        <GenerateReportForm run={run} label="Retry report" pendingLabel="Starting retry..." />
        <DeleteReportForm run={run} currentPath={currentPath} label="Delete report" />
      </div>
    );
  }

  return (
    <div className={styles.rowActions}>
      <Link className={styles.secondaryAction} href={`/app/reports/${run.runId}`}>
        View status
      </Link>
      <p className={styles.activeActionNote}>Management unlocks after this run finishes.</p>
    </div>
  );
}

export function ReportHistoryView({
  reportRuns,
  summaryReportRuns,
  filters,
  currentPath,
  actionMessage
}: ReportHistoryViewProps) {
  const hasReportsInScope = summaryReportRuns.length > 0;
  const hasMatchingReports = reportRuns.length > 0;
  const counts = getReportCounts(summaryReportRuns);
  const resetFiltersPath = buildResetFiltersPath(filters);

  return (
    <div className={styles.reportsPage}>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.kicker}>Reports</p>
          <h1>Report library</h1>
          <p>Open completed PDFs, revisit report status, and manage old report runs.</p>
        </div>
      </header>

      {actionMessage ? (
        <p
          className={
            actionMessage.tone === "success" ? styles.inlineSuccess : styles.inlineError
          }
          role={actionMessage.tone === "success" ? "status" : "alert"}
        >
          {actionMessage.text}
        </p>
      ) : null}

      <section className={styles.summaryGrid} aria-label="Report library summary">
        <div>
          <p>Active</p>
          <strong>{counts.active}</strong>
        </div>
        <div>
          <p>Completed</p>
          <strong>{counts.completed}</strong>
        </div>
        <div>
          <p>Failed</p>
          <strong>{counts.failed}</strong>
        </div>
      </section>

      <form className={styles.filterBar} method="get" action="/app/reports">
        <label>
          <span>Status</span>
          <select name="status" defaultValue={filters.status ?? ""}>
            <option value="">All reports</option>
            <option value="ACTIVE">Active</option>
            <option value="COMPLETED">Completed</option>
            <option value="FAILED">Failed</option>
          </select>
        </label>
        <label>
          <span>Currency</span>
          <select name="reportingCurrency" defaultValue={filters.reportingCurrency ?? ""}>
            <option value="">All currencies</option>
            <option value="CAD">CAD</option>
            <option value="USD">USD</option>
          </select>
        </label>
        {filters.portfolioId ? (
          <>
            <input type="hidden" name="portfolioId" value={filters.portfolioId} />
            <span className={styles.scopePill}>Portfolio scope active</span>
          </>
        ) : null}
        <button className={styles.primaryButton} type="submit">
          Apply filters
        </button>
        <Link className={styles.secondaryAction} href={resetFiltersPath}>
          Reset filters
        </Link>
        {filters.portfolioId ? (
          <Link className={styles.secondaryAction} href="/app/reports">
            Clear portfolio
          </Link>
        ) : null}
      </form>

      {hasMatchingReports ? (
        <section className={styles.reportList} aria-label="Report library">
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
                    <span className={getStatusClass(run.status)}>
                      {getStatusLabel(run.status)}
                    </span>
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

              <ReportRowActions run={run} currentPath={currentPath} />
            </article>
          ))}
        </section>
      ) : (
        <section className={styles.emptyState} aria-labelledby="empty-reports-heading">
          <div>
            <p className={styles.cardLabel}>
              {hasReportsInScope ? "No matching reports" : "No reports yet"}
            </p>
            <h2 id="empty-reports-heading">
              {hasReportsInScope
                ? "No reports match these filters"
                : "Generate a report from a ready portfolio"}
            </h2>
            <p>
              {hasReportsInScope
                ? "Adjust the status or currency filters to bring reports back into view."
                : "Reports appear here after you start one from a portfolio with saved holdings."}
            </p>
          </div>
          {hasReportsInScope || hasAppliedFilters(filters) ? (
            <Link className={styles.primaryAction} href={resetFiltersPath}>
              Clear filters
            </Link>
          ) : (
            <Link className={styles.primaryAction} href="/app/portfolios">
              View Portfolios
            </Link>
          )}
        </section>
      )}
    </div>
  );
}

export default async function ReportsPage({ searchParams }: ReportsPageProps = {}) {
  const params = (await searchParams) ?? {};
  const filters = parseFilters(params);
  const user = await requireAuthenticatedAppUser();
  const service = new ReportRunService();
  let summaryResult: ReportRunListResult;
  let reportResult: ReportRunListResult;

  try {
    summaryResult = await service.listReportRunsForUser(
      user.id,
      buildSummaryListOptions(filters)
    );
    reportResult = hasAppliedFilters(filters)
      ? await service.listReportRunsForUser(user.id, buildReportListOptions(filters))
      : summaryResult;
  } catch (error) {
    if (error instanceof PortfolioNotFoundError) {
      notFound();
    }

    throw error;
  }

  return (
    <ReportHistoryView
      reportRuns={reportResult.reportRuns}
      summaryReportRuns={summaryResult.reportRuns}
      filters={filters}
      currentPath={buildReportsPath(filters)}
      actionMessage={parseActionMessage(params)}
    />
  );
}
