import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { readSearchParam } from "@/lib/auth/redirect";
import { PortfolioForm, PORTFOLIO_FORM_ERROR_MESSAGES } from "@/components/portfolio/PortfolioForm";
import { requireAuthenticatedUser } from "@/server/auth/supabase-server";
import {
  PortfolioArchivedError,
  PortfolioNotFoundError,
  PortfolioService,
  type PortfolioDetailResult
} from "@/server/services/portfolio-service";

import { updatePortfolioFromForm } from "../../actions";
import styles from "../../form-page.module.css";

type EditPortfolioPageProps = {
  params: Promise<{ portfolioId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Edit Portfolio | Second Act",
  description: "Edit Second Act portfolio details."
};

async function loadEditablePortfolio(portfolioId: string): Promise<PortfolioDetailResult> {
  const user = await requireAuthenticatedUser();

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

export default async function EditPortfolioPage({ params, searchParams }: EditPortfolioPageProps) {
  const { portfolioId } = await params;
  const portfolio = await loadEditablePortfolio(portfolioId);
  const query = await searchParams;
  const errorCode = readSearchParam(query?.error);
  const errorMessage = errorCode ? PORTFOLIO_FORM_ERROR_MESSAGES[errorCode] : null;

  return (
    <div className={styles.formPage}>
      <header className={styles.pageHeader}>
        <p className={styles.kicker}>Edit portfolio</p>
        <h1>{portfolio.name}</h1>
        <p>
          Update the portfolio name, base currency, or description. Holdings are managed from the
          portfolio detail page.
        </p>
      </header>

      <PortfolioForm
        mode="edit"
        action={updatePortfolioFromForm}
        defaultValues={{
          name: portfolio.name,
          baseCurrency: portfolio.baseCurrency,
          description: portfolio.description ?? ""
        }}
        errorMessage={errorMessage ?? null}
        cancelHref={`/app/portfolios/${portfolio.id}`}
        portfolioId={portfolio.id}
      />
    </div>
  );
}
