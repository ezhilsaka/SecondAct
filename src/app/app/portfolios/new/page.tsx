import type { Metadata } from "next";

import { readSearchParam } from "@/lib/auth/redirect";
import { PortfolioForm, PORTFOLIO_FORM_ERROR_MESSAGES } from "@/components/portfolio/PortfolioForm";

import { createPortfolioFromForm } from "../actions";
import styles from "../form-page.module.css";

type NewPortfolioPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata: Metadata = {
  title: "Create Portfolio | Second Act",
  description: "Create a manual Second Act portfolio."
};

export default async function NewPortfolioPage({ searchParams }: NewPortfolioPageProps) {
  const params = await searchParams;
  const errorCode = readSearchParam(params?.error);
  const errorMessage = errorCode ? PORTFOLIO_FORM_ERROR_MESSAGES[errorCode] : null;

  return (
    <div className={styles.formPage}>
      <header className={styles.pageHeader}>
        <p className={styles.kicker}>New portfolio</p>
        <h1>Create a portfolio</h1>
        <p>
          Start with the basic portfolio details. Holdings are added after this portfolio exists.
        </p>
      </header>

      <PortfolioForm
        mode="create"
        action={createPortfolioFromForm}
        defaultValues={{ name: "", baseCurrency: "CAD", description: "" }}
        errorMessage={errorMessage ?? null}
      />
    </div>
  );
}
