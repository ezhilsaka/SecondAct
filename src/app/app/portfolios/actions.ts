"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";

import { requireAuthenticatedUser } from "@/server/auth/supabase-server";
import {
  DuplicateHoldingTickerError,
  HoldingNotFoundError,
  PortfolioArchivedError,
  PortfolioNotFoundError,
  PortfolioService
} from "@/server/services/portfolio-service";

type PortfolioFormValues = {
  name: string;
  baseCurrency: string;
  description: string;
};

type HoldingFormValues = {
  portfolioId: string;
  holdingId: string;
  ticker: string;
  securityName: string;
  securityCurrency: string;
  quantity: string;
  averageCost: string;
  notes: string;
};

const CREATE_PORTFOLIO_PATH = "/app/portfolios/new";
const PORTFOLIO_LIST_PATH = "/app/portfolios";
const TICKER_PATTERN = /^[A-Za-z0-9.-]+$/;
const DECIMAL_PATTERN = /^(0|[1-9]\d*)(\.\d+)?$/;

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

function readHoldingFormValues(formData: FormData): HoldingFormValues {
  return {
    portfolioId: readFormString(formData, "portfolioId"),
    holdingId: readFormString(formData, "holdingId"),
    ticker: readFormString(formData, "ticker"),
    securityName: readFormString(formData, "securityName"),
    securityCurrency: readFormString(formData, "securityCurrency"),
    quantity: readFormString(formData, "quantity"),
    averageCost: readFormString(formData, "averageCost"),
    notes: readFormString(formData, "notes")
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

function isPositiveDecimalString(value: string, maxDecimalPlaces: number): boolean {
  if (!DECIMAL_PATTERN.test(value)) {
    return false;
  }

  const [, fractional = ""] = value.split(".");

  if (fractional.length > maxDecimalPlaces) {
    return false;
  }

  return /[1-9]/.test(value);
}

function getHoldingFormError(
  values: HoldingFormValues,
  mode: "create" | "edit"
): string | null {
  if (!values.portfolioId) {
    return "portfolio_not_found";
  }

  if (mode === "edit" && !values.holdingId) {
    return "holding_not_found";
  }

  if (!values.ticker) {
    return "missing_ticker";
  }

  if (values.ticker.length > 15 || !TICKER_PATTERN.test(values.ticker)) {
    return "invalid_ticker";
  }

  if (values.securityName.length > 120) {
    return "security_name_too_long";
  }

  if (values.securityCurrency !== "USD" && values.securityCurrency !== "CAD") {
    return "invalid_holding_currency";
  }

  if (!isPositiveDecimalString(values.quantity, 10)) {
    return "invalid_quantity";
  }

  if (!isPositiveDecimalString(values.averageCost, 8)) {
    return "invalid_average_cost";
  }

  if (values.notes.length > 500) {
    return "holding_notes_too_long";
  }

  return null;
}

function getSupportedCurrency(value: string): "USD" | "CAD" {
  return value === "USD" ? "USD" : "CAD";
}

function getPortfolioDetailPath(portfolioId: string): string {
  return `/app/portfolios/${portfolioId}`;
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

function getHoldingCurrency(value: string): "USD" | "CAD" {
  return value === "CAD" ? "CAD" : "USD";
}

function buildDetailStatusPath(portfolioId: string, status: string): string {
  return `${getPortfolioDetailPath(portfolioId)}?status=${status}`;
}

function buildDetailErrorPath(portfolioId: string, error: string): string {
  return `${getPortfolioDetailPath(portfolioId)}?error=${error}`;
}

function handlePortfolioMutationError(
  error: unknown,
  fallbackPath: string,
  values: PortfolioFormValues
): never {
  if (error instanceof PortfolioNotFoundError || error instanceof PortfolioArchivedError) {
    redirect(`${PORTFOLIO_LIST_PATH}?error=portfolio_not_found`);
  }

  if (error instanceof ZodError) {
    redirect(buildFormRedirectPath(fallbackPath, "validation_error", values));
  }

  redirect(buildFormRedirectPath(fallbackPath, "save_failed", values));
}

function handleHoldingMutationError(error: unknown, portfolioId: string): never {
  if (
    !portfolioId ||
    error instanceof PortfolioNotFoundError ||
    error instanceof PortfolioArchivedError
  ) {
    redirect(`${PORTFOLIO_LIST_PATH}?error=portfolio_not_found`);
  }

  if (error instanceof HoldingNotFoundError) {
    redirect(buildDetailErrorPath(portfolioId, "holding_not_found"));
  }

  if (error instanceof DuplicateHoldingTickerError) {
    redirect(buildDetailErrorPath(portfolioId, "duplicate_ticker"));
  }

  if (error instanceof ZodError) {
    redirect(buildDetailErrorPath(portfolioId, "validation_error"));
  }

  redirect(buildDetailErrorPath(portfolioId, "holding_save_failed"));
}

function redirectHoldingValidationError(portfolioId: string, validationError: string): never {
  if (!portfolioId || validationError === "portfolio_not_found") {
    redirect(`${PORTFOLIO_LIST_PATH}?error=portfolio_not_found`);
  }

  redirect(buildDetailErrorPath(portfolioId, validationError));
}

export async function createPortfolioFromForm(formData: FormData) {
  const values = readPortfolioFormValues(formData);
  const validationError = getPortfolioFormError(values);

  if (validationError) {
    redirect(buildFormRedirectPath(CREATE_PORTFOLIO_PATH, validationError, values));
  }

  const user = await requireAuthenticatedUser();
  let portfolio: { id: string };

  try {
    portfolio = await new PortfolioService().createPortfolio({
      userId: user.id,
      name: values.name,
      description: values.description,
      baseCurrency: getSupportedCurrency(values.baseCurrency)
    });
  } catch (error) {
    handlePortfolioMutationError(error, CREATE_PORTFOLIO_PATH, values);
  }

  revalidatePath(PORTFOLIO_LIST_PATH);
  redirect(buildDetailStatusPath(portfolio.id, "portfolio_created"));
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

  const detailPath = getPortfolioDetailPath(portfolioId);

  revalidatePath(PORTFOLIO_LIST_PATH);
  revalidatePath(detailPath);
  revalidatePath(editPath);
  redirect(buildDetailStatusPath(portfolioId, "portfolio_updated"));
}

export async function addHoldingFromForm(formData: FormData) {
  const values = readHoldingFormValues(formData);
  const validationError = getHoldingFormError(values, "create");

  if (validationError) {
    redirectHoldingValidationError(values.portfolioId, validationError);
  }

  const user = await requireAuthenticatedUser();

  try {
    await new PortfolioService().addHolding({
      userId: user.id,
      portfolioId: values.portfolioId,
      ticker: values.ticker,
      securityName: values.securityName,
      securityCurrency: getHoldingCurrency(values.securityCurrency),
      quantity: values.quantity,
      averageCost: values.averageCost,
      notes: values.notes
    });
  } catch (error) {
    handleHoldingMutationError(error, values.portfolioId);
  }

  revalidatePath(PORTFOLIO_LIST_PATH);
  revalidatePath(getPortfolioDetailPath(values.portfolioId));
  redirect(buildDetailStatusPath(values.portfolioId, "holding_added"));
}

export async function updateHoldingFromForm(formData: FormData) {
  const values = readHoldingFormValues(formData);
  const validationError = getHoldingFormError(values, "edit");

  if (validationError) {
    redirectHoldingValidationError(values.portfolioId, validationError);
  }

  const user = await requireAuthenticatedUser();

  try {
    await new PortfolioService().updateHolding({
      userId: user.id,
      portfolioId: values.portfolioId,
      holdingId: values.holdingId,
      ticker: values.ticker,
      securityName: values.securityName,
      securityCurrency: getHoldingCurrency(values.securityCurrency),
      quantity: values.quantity,
      averageCost: values.averageCost,
      notes: values.notes
    });
  } catch (error) {
    handleHoldingMutationError(error, values.portfolioId);
  }

  revalidatePath(PORTFOLIO_LIST_PATH);
  revalidatePath(getPortfolioDetailPath(values.portfolioId));
  redirect(buildDetailStatusPath(values.portfolioId, "holding_updated"));
}

export async function removeHoldingFromForm(formData: FormData) {
  const portfolioId = readFormString(formData, "portfolioId");
  const holdingId = readFormString(formData, "holdingId");
  const confirmed = formData.get("confirmRemove") === "on";

  if (!portfolioId) {
    redirect(`${PORTFOLIO_LIST_PATH}?error=portfolio_not_found`);
  }

  if (!holdingId) {
    redirect(buildDetailErrorPath(portfolioId, "holding_not_found"));
  }

  if (!confirmed) {
    redirect(buildDetailErrorPath(portfolioId, "remove_not_confirmed"));
  }

  const user = await requireAuthenticatedUser();

  try {
    await new PortfolioService().removeHolding({
      userId: user.id,
      portfolioId,
      holdingId
    });
  } catch (error) {
    handleHoldingMutationError(error, portfolioId);
  }

  revalidatePath(PORTFOLIO_LIST_PATH);
  revalidatePath(getPortfolioDetailPath(portfolioId));
  redirect(buildDetailStatusPath(portfolioId, "holding_removed"));
}
