"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";

import { requireAuthenticatedUser } from "@/server/auth/supabase-server";
import {
  PortfolioNotFoundError,
  ReportRunNotFoundError,
  ReportRunNotTerminalError,
  ReportRunService,
  ReportStorageDeleteError
} from "@/server/services/report-run-service";
import { supportedCurrencySchema, uuidSchema } from "@/server/shared/types";

const PORTFOLIO_LIST_PATH = "/app/portfolios";
const REPORTS_PATH = "/app/reports";

function readFormString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function getPortfolioDetailPath(portfolioId: string): string {
  return `/app/portfolios/${portfolioId}`;
}

function getReportStatusPath(runId: string): string {
  return `/app/reports/${runId}`;
}

function appendReportActionParam(path: string, key: "status" | "error", value: string): string {
  const url = new URL(path, "http://localhost");
  url.searchParams.delete("status");
  url.searchParams.delete("error");
  url.searchParams.set(key, value);

  return `${url.pathname}${url.search}`;
}

function readSafeReportsReturnPath(formData: FormData): string {
  const returnTo = readFormString(formData, "returnTo");

  if (returnTo === REPORTS_PATH || returnTo.startsWith(`${REPORTS_PATH}?`)) {
    return returnTo;
  }

  return REPORTS_PATH;
}

function buildDetailErrorPath(portfolioId: string, error: string): string {
  return `${getPortfolioDetailPath(portfolioId)}?error=${error}`;
}

function redirectReportValidationError(portfolioId: string): never {
  if (!portfolioId) {
    redirect(`${PORTFOLIO_LIST_PATH}?error=portfolio_not_found`);
  }

  redirect(buildDetailErrorPath(portfolioId, "report_validation_error"));
}

function handleGenerateReportError(error: unknown, portfolioId: string): never {
  if (!portfolioId || error instanceof PortfolioNotFoundError) {
    redirect(`${PORTFOLIO_LIST_PATH}?error=portfolio_not_found`);
  }

  if (error instanceof ZodError) {
    redirect(buildDetailErrorPath(portfolioId, "report_validation_error"));
  }

  redirect(buildDetailErrorPath(portfolioId, "report_create_failed"));
}

function handleDeleteReportError(error: unknown, returnPath: string): never {
  if (error instanceof ZodError) {
    redirect(appendReportActionParam(returnPath, "error", "report_delete_validation_error"));
  }

  if (error instanceof ReportRunNotFoundError) {
    redirect(appendReportActionParam(returnPath, "error", "report_not_found"));
  }

  if (error instanceof ReportRunNotTerminalError) {
    redirect(appendReportActionParam(returnPath, "error", "report_not_terminal"));
  }

  if (error instanceof ReportStorageDeleteError) {
    redirect(appendReportActionParam(returnPath, "error", "report_delete_storage_failed"));
  }

  redirect(appendReportActionParam(returnPath, "error", "report_delete_failed"));
}

export async function generateReportFromPortfolio(formData: FormData) {
  const portfolioId = readFormString(formData, "portfolioId");
  const reportingCurrency = readFormString(formData, "reportingCurrency");
  const parsedPortfolioId = uuidSchema.safeParse(portfolioId);
  const parsedReportingCurrency = supportedCurrencySchema.safeParse(reportingCurrency);

  if (!parsedPortfolioId.success || !parsedReportingCurrency.success) {
    redirectReportValidationError(portfolioId);
  }

  const user = await requireAuthenticatedUser();
  const service = new ReportRunService();
  let targetRunId: string;

  try {
    const activeRun = await service.findActiveReportRunForPortfolio(
      user.id,
      parsedPortfolioId.data
    );

    if (activeRun) {
      targetRunId = activeRun.runId;
    } else {
      const run = await service.createAndEnqueue({
        userId: user.id,
        portfolioId: parsedPortfolioId.data,
        reportingCurrency: parsedReportingCurrency.data
      });
      targetRunId = run.runId;
    }

    revalidatePath(getPortfolioDetailPath(parsedPortfolioId.data));
  } catch (error) {
    handleGenerateReportError(error, parsedPortfolioId.data);
  }

  redirect(getReportStatusPath(targetRunId));
}

export async function deleteReportRunFromForm(formData: FormData) {
  const runId = readFormString(formData, "runId");
  const parsedRunId = uuidSchema.safeParse(runId);
  const returnPath = readSafeReportsReturnPath(formData);

  if (!parsedRunId.success) {
    redirect(appendReportActionParam(returnPath, "error", "report_delete_validation_error"));
  }

  const user = await requireAuthenticatedUser();
  const service = new ReportRunService();

  try {
    const result = await service.deleteTerminalReportRunForUser(parsedRunId.data, user.id);

    revalidatePath(REPORTS_PATH);
    revalidatePath(getReportStatusPath(parsedRunId.data));
    revalidatePath(getPortfolioDetailPath(result.portfolioId));
  } catch (error) {
    handleDeleteReportError(error, returnPath);
  }

  redirect(appendReportActionParam(returnPath, "status", "report_deleted"));
}
