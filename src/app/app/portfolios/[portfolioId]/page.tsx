import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { readSearchParam } from "@/lib/auth/redirect";
import {
  HoldingForm,
  type HoldingFormValues
} from "@/components/portfolio/HoldingForm";
import { GenerateReportSubmitButton } from "@/components/report/GenerateReportSubmitButton";
import { HoldingRowActions } from "./HoldingRowActions";
import { requireAuthenticatedAppUser } from "@/server/auth/app-session";
import {
  PortfolioArchivedError,
  PortfolioNotFoundError,
  PortfolioService,
  type PortfolioDetailResult,
  type PortfolioHoldingResult
} from "@/server/services/portfolio-service";
import {
  PortfolioNotFoundError as ReportPortfolioNotFoundError,
  ReportRunService,
  type ReportRunSummaryResult
} from "@/server/services/report-run-service";

import {
  addHoldingFromForm,
  removeHoldingFromForm,
  updateHoldingFromForm
} from "../actions";
import { generateReportFromPortfolio } from "../../reports/actions";
import styles from "./page.module.css";

type PortfolioDetailPageProps = {
  params: Promise<{ portfolioId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type PortfolioDetailViewProps = {
  portfolio: PortfolioDetailResult;
  reportRuns: ReportRunSummaryResult[];
  notice: string | null;
  error: string | null;
};

type PortfolioDetailPageData = {
  portfolio: PortfolioDetailResult;
  reportRuns: ReportRunSummaryResult[];
};

const NOTICE_MESSAGES: Record<string, string> = {
  portfolio_created: "Portfolio created.",
  portfolio_updated: "Portfolio updated.",
  holding_added: "Holding added.",
  holding_updated: "Holding updated.",
  holding_removed: "Holding removed."
};

const ERROR_MESSAGES: Record<string, string> = {
  duplicate_ticker: "This ticker is already in the portfolio. Edit the existing holding instead.",
  holding_not_found: "That holding is no longer available.",
  holding_save_failed: "We could not save the holding. Please try again.",
  holding_notes_too_long: "Holding notes must be 500 characters or fewer.",
  invalid_average_cost: "Enter an average cost greater than 0 with up to 8 decimal places.",
  invalid_holding_currency: "Choose USD or CAD as the holding currency.",
  invalid_quantity: "Enter shares or units greater than 0 with up to 10 decimal places.",
  invalid_ticker: "Ticker can only contain letters, numbers, dots, and hyphens.",
  missing_ticker: "Enter a ticker.",
  remove_not_confirmed: "Confirm the holding removal before submitting.",
  report_create_failed: "We could not start the report. Please try again.",
  report_validation_error: "Choose USD or CAD as the report currency.",
  security_name_too_long: "Name must be 120 characters or fewer.",
  validation_error: "Check the holding details and try again."
};

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Portfolio Detail | Second Act",
  description: "Review and manage a Second Act portfolio."
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(value));
}

function formatDecimal(value: string): string {
  return value.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
}

function buildHoldingDefaults(holding?: PortfolioHoldingResult): HoldingFormValues {
  return {
    ticker: holding?.ticker ?? "",
    securityName: holding?.securityName ?? "",
    securityCurrency: holding?.securityCurrency ?? "USD",
    quantity: holding ? formatDecimal(holding.quantity) : "",
    averageCost: holding ? formatDecimal(holding.averageCost) : "",
    notes: holding?.notes ?? ""
  };
}

function getReadinessClass(portfolio: PortfolioDetailResult): string {
  return portfolio.readiness.isReadyForReport ? styles.readyBadge : styles.needsHoldingsBadge;
}

function ReportGenerationPanel({ portfolio }: { portfolio: PortfolioDetailResult }) {
  if (!portfolio.readiness.isReadyForReport) {
    return (
      <button type="button" disabled>
        Add holdings first
      </button>
    );
  }

  return (
    <form action={generateReportFromPortfolio} className={styles.reportForm}>
      <input type="hidden" name="portfolioId" value={portfolio.id} />
      <label>
        <span>Report currency</span>
        <select name="reportingCurrency" defaultValue={portfolio.baseCurrency}>
          <option value="CAD">CAD</option>
          <option value="USD">USD</option>
        </select>
      </label>
      <GenerateReportSubmitButton />
    </form>
  );
}

function isActiveReportRun(run: ReportRunSummaryResult): boolean {
  return run.status === "QUEUED" || run.status === "PROCESSING";
}

function formatReportTimestamp(value: string | null): string {
  if (!value) {
    return "Not yet";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(value));
}

function PortfolioReportPreview({ reportRuns }: { reportRuns: ReportRunSummaryResult[] }) {
  const activeRun = reportRuns.find(isActiveReportRun) ?? null;
  const latestCompletedRun = reportRuns.find((run) => run.status === "COMPLETED") ?? null;
  const highlightedRun = activeRun ?? latestCompletedRun;

  return (
    <section className={styles.reportPreviewPanel} aria-labelledby="report-preview-heading">
      <div className={styles.reportPreviewLead}>
        <div>
          <p className={styles.cardLabel}>Reports</p>
          <h2 id="report-preview-heading">Report history</h2>
          <p>
            {activeRun
              ? "A report is already in progress for this portfolio."
              : latestCompletedRun
                ? "The latest completed report is ready to revisit."
                : "Reports for this portfolio will appear here after generation starts."}
          </p>
        </div>

        {highlightedRun ? (
          <Link className={styles.reportPreviewAction} href={`/app/reports/${highlightedRun.runId}`}>
            {activeRun ? "View active report" : "Open completed report"}
          </Link>
        ) : (
          <Link className={styles.reportPreviewAction} href="/app/reports">
            View all reports
          </Link>
        )}
      </div>

      {reportRuns.length > 0 ? (
        <ul className={styles.reportPreviewList} aria-label="Recent reports for this portfolio">
          {reportRuns.map((run) => (
            <li key={run.runId}>
              <span>{run.status}</span>
              <span>{run.reportingCurrency}</span>
              <span>{formatReportTimestamp(run.requestedAt)}</span>
              <Link href={`/app/reports/${run.runId}`}>View status</Link>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

async function loadPortfolioDetailData(portfolioId: string): Promise<PortfolioDetailPageData> {
  const user = await requireAuthenticatedAppUser();

  try {
    const [portfolio, reportHistory] = await Promise.all([
      new PortfolioService().getPortfolioDetail({
        userId: user.id,
        portfolioId
      }),
      new ReportRunService().listReportRunsForUser(user.id, {
        portfolioId,
        limit: 3
      })
    ]);

    return {
      portfolio,
      reportRuns: reportHistory.reportRuns
    };
  } catch (error) {
    if (
      error instanceof PortfolioNotFoundError ||
      error instanceof PortfolioArchivedError ||
      error instanceof ReportPortfolioNotFoundError
    ) {
      redirect("/app/portfolios?error=portfolio_not_found");
    }

    throw error;
  }
}

function HoldingsTable({ portfolio }: { portfolio: PortfolioDetailResult }) {
  if (portfolio.holdings.length === 0) {
    return (
      <section className={styles.emptyHoldings} aria-labelledby="empty-holdings-heading">
        <p className={styles.cardLabel}>No holdings yet</p>
        <h2 id="empty-holdings-heading">Add a holding to make this portfolio ready</h2>
        <p>
          Start with a ticker, shares or units, average cost, and holding currency. You can type a
          ticker manually or pick a symbol from search.
        </p>
      </section>
    );
  }

  return (
    <div className={styles.tableWrap}>
      <table className={styles.holdingsTable}>
        <thead>
          <tr>
            <th scope="col">Ticker</th>
            <th scope="col">Name</th>
            <th scope="col">Shares / units</th>
            <th scope="col">Average cost</th>
            <th scope="col">Currency</th>
            <th scope="col">Estimated cost basis</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {portfolio.holdings.map((holding) => (
            <tr key={holding.id}>
              <td className={styles.tickerCell}>{holding.ticker}</td>
              <td>{holding.securityName ?? "Manual holding"}</td>
              <td>{formatDecimal(holding.quantity)}</td>
              <td>
                {formatDecimal(holding.averageCost)} {holding.securityCurrency}
              </td>
              <td>{holding.securityCurrency}</td>
              <td>
                {formatDecimal(holding.estimatedCostBasis)} {holding.securityCurrency}
              </td>
              <td>
                <HoldingRowActions
                  portfolioId={portfolio.id}
                  holding={holding}
                  defaultValues={buildHoldingDefaults(holding)}
                  updateAction={updateHoldingFromForm}
                  removeAction={removeHoldingFromForm}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PortfolioDetailView({
  portfolio,
  reportRuns,
  notice,
  error
}: PortfolioDetailViewProps) {
  return (
    <div className={styles.detailPage}>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.kicker}>Portfolio detail</p>
          <h1>{portfolio.name}</h1>
          <p>{portfolio.description ?? "Manual portfolio"}</p>
        </div>
        <div className={styles.headerActions}>
          <Link href="/app/portfolios">Back to Portfolios</Link>
          <Link href={`/app/portfolios/${portfolio.id}/edit`}>Edit Portfolio</Link>
        </div>
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

      <section className={styles.summaryGrid} aria-label="Portfolio summary">
        <div>
          <p className={styles.cardLabel}>Base currency</p>
          <p>{portfolio.baseCurrency}</p>
        </div>
        <div>
          <p className={styles.cardLabel}>Holdings</p>
          <p>{portfolio.holdingCount}</p>
        </div>
        <div>
          <p className={styles.cardLabel}>Updated</p>
          <p>{formatDate(portfolio.updatedAt)}</p>
        </div>
        <div>
          <p className={styles.cardLabel}>Readiness</p>
          <p>
            <span className={getReadinessClass(portfolio)}>{portfolio.readiness.label}</span>
          </p>
        </div>
      </section>

      <section className={styles.readinessPanel} aria-labelledby="readiness-heading">
        <div>
          <p className={styles.cardLabel}>Next step</p>
          <h2 id="readiness-heading">
            {portfolio.readiness.isReadyForReport
              ? "Generate a portfolio report"
              : "Add at least one holding"}
          </h2>
          <p>
            {portfolio.readiness.isReadyForReport
              ? "Start a report from the saved holdings. You can leave and come back while it runs."
              : "A saved holding is required before this portfolio can be used for a report."}
          </p>
        </div>
        <ReportGenerationPanel portfolio={portfolio} />
      </section>

      <PortfolioReportPreview reportRuns={reportRuns} />

      <section className={styles.addHoldingPanel} aria-labelledby="add-holding-heading">
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.cardLabel}>Holdings</p>
            <h2 id="add-holding-heading">Add holding</h2>
          </div>
        </div>
        <HoldingForm
          mode="create"
          action={addHoldingFromForm}
          portfolioId={portfolio.id}
          defaultValues={buildHoldingDefaults()}
        />
      </section>

      <section className={styles.holdingsPanel} aria-labelledby="holdings-heading">
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.cardLabel}>Saved holdings</p>
            <h2 id="holdings-heading">Portfolio holdings</h2>
          </div>
        </div>
        <HoldingsTable portfolio={portfolio} />
      </section>
    </div>
  );
}

export default async function PortfolioDetailPage({
  params,
  searchParams
}: PortfolioDetailPageProps) {
  const { portfolioId } = await params;
  const { portfolio, reportRuns } = await loadPortfolioDetailData(portfolioId);
  const query = await searchParams;
  const noticeCode = readSearchParam(query?.status);
  const errorCode = readSearchParam(query?.error);

  return (
    <PortfolioDetailView
      portfolio={portfolio}
      reportRuns={reportRuns}
      notice={noticeCode ? NOTICE_MESSAGES[noticeCode] ?? null : null}
      error={errorCode ? ERROR_MESSAGES[errorCode] ?? ERROR_MESSAGES.holding_save_failed : null}
    />
  );
}
