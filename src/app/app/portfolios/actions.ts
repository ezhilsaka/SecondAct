"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";

import { requireAuthenticatedUser } from "@/server/auth/supabase-server";
import {
  PortfolioArchivedError,
  PortfolioNotFoundError,
  PortfolioService
} from "@/server/services/portfolio-service";

type PortfolioFormValues = {
  name: string;
  baseCurrency: string;
  description: string;
};

const CREATE_PORTFOLIO_PATH = "/app/portfolios/new";
const PORTFOLIO_LIST_PATH = "/app/portfolios";

function readFormString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function readPortfolioFormValues(formData: FormData): PortfolioFormValues {
  return {
    name: readFormString(formData, "name"),
    baseCurrency: readFormString(formData, "baseCurrency"),
    description: readFormString(formData, "description")
  };
}

function getPortfolioFormError(values: PortfolioFormValues): string | null {
  if (!values.name) {
    return "missing_name";
  }

  if (values.name.length > 80) {
    return "name_too_long";
  }

  if (values.baseCurrency !== "USD" && values.baseCurrency !== "CAD") {
    return "invalid_currency";
  }

  if (values.description.length > 500) {
    return "description_too_long";
  }

  return null;
}

function getSupportedCurrency(value: string): "USD" | "CAD" {
  return value === "USD" ? "USD" : "CAD";
}

function buildFormRedirectPath(
  pathname: string,
  error: string,
  values: PortfolioFormValues
): string {
  const params = new URLSearchParams({
    error,
    name: values.name,
    baseCurrency: values.baseCurrency,
    description: values.description
  });

  return `${pathname}?${params.toString()}`;
}

function getEditPath(portfolioId: string): string {
  return `/app/portfolios/${portfolioId}/edit`;
}

function handlePortfolioMutationError(error: unknown, fallbackPath: string, values: PortfolioFormValues): never {
  if (error instanceof PortfolioNotFoundError || error instanceof PortfolioArchivedError) {
    redirect(`${PORTFOLIO_LIST_PATH}?error=portfolio_not_found`);
  }

  if (error instanceof ZodError) {
    redirect(buildFormRedirectPath(fallbackPath, "validation_error", values));
  }

  redirect(buildFormRedirectPath(fallbackPath, "save_failed", values));
}

export async function createPortfolioFromForm(formData: FormData) {
  const values = readPortfolioFormValues(formData);
  const validationError = getPortfolioFormError(values);

  if (validationError) {
    redirect(buildFormRedirectPath(CREATE_PORTFOLIO_PATH, validationError, values));
  }

  const user = await requireAuthenticatedUser();

  try {
    await new PortfolioService().createPortfolio({
      userId: user.id,
      name: values.name,
      description: values.description,
      baseCurrency: getSupportedCurrency(values.baseCurrency)
    });
  } catch (error) {
    handlePortfolioMutationError(error, CREATE_PORTFOLIO_PATH, values);
  }

  revalidatePath(PORTFOLIO_LIST_PATH);
  redirect(`${PORTFOLIO_LIST_PATH}?status=portfolio_created`);
}

export async function updatePortfolioFromForm(formData: FormData) {
  const portfolioId = readFormString(formData, "portfolioId");
  const values = readPortfolioFormValues(formData);
  const editPath = portfolioId ? getEditPath(portfolioId) : PORTFOLIO_LIST_PATH;
  const validationError = getPortfolioFormError(values);

  if (!portfolioId) {
    redirect(`${PORTFOLIO_LIST_PATH}?error=portfolio_not_found`);
  }

  if (validationError) {
    redirect(buildFormRedirectPath(editPath, validationError, values));
  }

  const user = await requireAuthenticatedUser();

  try {
    await new PortfolioService().updatePortfolio({
      userId: user.id,
      portfolioId,
      name: values.name,
      description: values.description,
      baseCurrency: getSupportedCurrency(values.baseCurrency)
    });
  } catch (error) {
    handlePortfolioMutationError(error, editPath, values);
  }

  revalidatePath(PORTFOLIO_LIST_PATH);
  revalidatePath(editPath);
  redirect(`${PORTFOLIO_LIST_PATH}?status=portfolio_updated`);
}
