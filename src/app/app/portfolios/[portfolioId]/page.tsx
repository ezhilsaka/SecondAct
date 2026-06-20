import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { readSearchParam } from "@/lib/auth/redirect";
import {
  HoldingForm,
  type HoldingFormValues
} from "@/components/portfolio/HoldingForm";
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
  addHoldingFromForm,
  removeHoldingFromForm,
  updateHoldingFromForm
} from "../actions";
import styles from "./page.module.css";

type PortfolioDetailPageProps = {
  params: Promise<{ portfolioId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type PortfolioDetailViewProps = {
  portfolio: PortfolioDetailResult;
  notice: string | null;
  error: string | null;
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

async function loadPortfolioDetail(portfolioId: string): Promise<PortfolioDetailResult> {
  const user = await requireAuthenticatedAppUser();

  try {
    return await new PortfolioService().getPortfolioDetail({
      userId: user.id,
      portfolioId
    });
  } catch (error) {
    if (error instanceof PortfolioNotFoundError || error instanceof PortfolioArchivedError) {
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

export function PortfolioDetailView({ portfolio, notice, error }: PortfolioDetailViewProps) {
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
              ? "This portfolio is ready for the next phase"
              : "Add at least one holding"}
          </h2>
          <p>
            {portfolio.readiness.isReadyForReport
              ? "Report generation comes next."
              : "A saved holding is required before this portfolio can be used for a future report."}
          </p>
        </div>
        <button type="button" disabled>
          Report generation comes next
        </button>
      </section>

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
  const portfolio = await loadPortfolioDetail(portfolioId);
  const query = await searchParams;
  const noticeCode = readSearchParam(query?.status);
  const errorCode = readSearchParam(query?.error);

  return (
    <PortfolioDetailView
      portfolio={portfolio}
      notice={noticeCode ? NOTICE_MESSAGES[noticeCode] ?? null : null}
      error={errorCode ? ERROR_MESSAGES[errorCode] ?? ERROR_MESSAGES.holding_save_failed : null}
    />
  );
}
