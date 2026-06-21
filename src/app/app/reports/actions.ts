"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";

import { requireAuthenticatedUser } from "@/server/auth/supabase-server";
import {
  PortfolioNotFoundError,
  ReportRunService
} from "@/server/services/report-run-service";
import { supportedCurrencySchema, uuidSchema } from "@/server/shared/types";

const PORTFOLIO_LIST_PATH = "/app/portfolios";

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
