import type { Metadata } from "next";
import Link from "next/link";

import { requireAuthenticatedUser } from "@/server/auth/supabase-server";
import { PortfolioService, type PortfolioSummaryResult } from "@/server/services/portfolio-service";

import styles from "./page.module.css";

type PortfolioListPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type PortfolioListViewProps = {
  portfolios: PortfolioSummaryResult[];
  notice: string | null;
  error: string | null;
};

const NOTICE_MESSAGES: Record<string, string> = {
  portfolio_created: "Portfolio created.",
  portfolio_updated: "Portfolio updated."
};

const ERROR_MESSAGES: Record<string, string> = {
  portfolio_not_found: "That portfolio is no longer available.",
  save_failed: "We could not save the portfolio. Please try again."
};

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Portfolios | Second Act",
  description: "Create and manage Second Act portfolios."
};

function readSearchParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(value));
}

function formatHoldingCount(count: number): string {
  return `${count} ${count === 1 ? "holding" : "holdings"}`;
}

export function PortfolioListView({ portfolios, notice, error }: PortfolioListViewProps) {
  const hasPortfolios = portfolios.length > 0;

  return (
    <div className={styles.portfolioPage}>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.kicker}>Portfolios</p>
          <h1>Your portfolios</h1>
          <p>
            Create a manual portfolio now. Holdings and report readiness build on this workspace in
            the next steps.
          </p>
        </div>
        <Link className={styles.primaryAction} href="/app/portfolios/new">
          Create Portfolio
        </Link>
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

      {hasPortfolios ? (
        <section className={styles.portfolioList} aria-label="Portfolio list">
          {portfolios.map((portfolio) => (
            <article className={styles.portfolioRow} key={portfolio.id}>
              <div className={styles.portfolioIdentity}>
                <p className={styles.portfolioName}>{portfolio.name}</p>
                <p className={styles.portfolioMeta}>
                  {portfolio.description ?? "Manual portfolio"}
                </p>
              </div>

              <dl className={styles.portfolioFacts}>
                <div>
                  <dt>Base currency</dt>
                  <dd>{portfolio.baseCurrency}</dd>
                </div>
                <div>
                  <dt>Holdings</dt>
                  <dd>{formatHoldingCount(portfolio.holdingCount)}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>
                    <span
                      className={
                        portfolio.readiness.isReadyForReport
                          ? styles.readyBadge
                          : styles.needsHoldingsBadge
                      }
                    >
                      {portfolio.readiness.label}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt>Updated</dt>
                  <dd>{formatDate(portfolio.updatedAt)}</dd>
                </div>
              </dl>

              <div className={styles.rowActions}>
                <Link className={styles.secondaryAction} href={`/app/portfolios/${portfolio.id}`}>
                  View
                </Link>
                <Link
                  className={styles.secondaryAction}
                  href={`/app/portfolios/${portfolio.id}/edit`}
                >
                  Edit
                </Link>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <section className={styles.emptyState} aria-labelledby="empty-portfolios-heading">
          <div>
            <p className={styles.cardLabel}>No portfolios yet</p>
            <h2 id="empty-portfolios-heading">Create your first portfolio</h2>
            <p>
              Start with a name and base currency. You will add holdings after the portfolio exists.
            </p>
          </div>
          <Link className={styles.primaryAction} href="/app/portfolios/new">
            Create Portfolio
          </Link>
        </section>
      )}
    </div>
  );
}

export default async function PortfolioListPage({ searchParams }: PortfolioListPageProps) {
  const user = await requireAuthenticatedUser();
  const { portfolios } = await new PortfolioService().listPortfolios(user.id);
  const params = await searchParams;
  const noticeCode = readSearchParam(params?.status);
  const errorCode = readSearchParam(params?.error);

  return (
    <PortfolioListView
      portfolios={portfolios}
      notice={noticeCode ? NOTICE_MESSAGES[noticeCode] ?? null : null}
      error={errorCode ? ERROR_MESSAGES[errorCode] ?? ERROR_MESSAGES.save_failed : null}
    />
  );
}
