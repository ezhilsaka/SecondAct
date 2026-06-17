import type { Metadata } from "next";

import { readSearchParam } from "@/lib/auth/redirect";
import {
  PortfolioForm,
  PORTFOLIO_FORM_ERROR_MESSAGES,
  type PortfolioFormValues
} from "@/components/portfolio/PortfolioForm";

import { createPortfolioFromForm } from "../actions";
import styles from "../form-page.module.css";

type NewPortfolioPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata: Metadata = {
  title: "Create Portfolio | Second Act",
  description: "Create a manual Second Act portfolio."
};

function readCurrency(value: string | string[] | undefined): PortfolioFormValues["baseCurrency"] {
  const currency = readSearchParam(value);
  return currency === "USD" ? "USD" : "CAD";
}

function readDefaultValues(
  params: Record<string, string | string[] | undefined> | undefined
): PortfolioFormValues {
  return {
    name: readSearchParam(params?.name, "") ?? "",
    baseCurrency: readCurrency(params?.baseCurrency),
    description: readSearchParam(params?.description, "") ?? ""
  };
}

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
        defaultValues={readDefaultValues(params)}
        errorMessage={errorMessage ?? null}
      />
    </div>
  );
}
