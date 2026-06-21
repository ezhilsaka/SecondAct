import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { buildApiUnauthorizedResponse, getAuthenticatedApiUserId } from "@/server/auth/api-auth";
import { uuidSchema } from "@/server/shared/types";

// ---------------------------------------------------------------------------
// Request validation
// ---------------------------------------------------------------------------

const createReportRunBodySchema = z.object({
  portfolioId: uuidSchema,
  reportingCurrency: z.enum(["USD", "CAD"])
});

const MAX_REPORT_RUN_LIST_LIMIT = 50;

const listReportRunsQuerySchema = z.object({
  portfolioId: uuidSchema.optional(),
  status: z.enum(["ACTIVE", "COMPLETED", "FAILED"]).optional(),
  reportingCurrency: z.enum(["USD", "CAD"]).optional(),
  limit: z.preprocess((value) => {
    if (value === undefined) {
      return undefined;
    }

    return Number(value);
  }, z.number().int().min(1).max(MAX_REPORT_RUN_LIST_LIMIT).optional())
});

function parseListReportRunsQuery(request: Request): z.infer<typeof listReportRunsQuerySchema> {
  const url = new URL(request.url);
  const portfolioId = url.searchParams.get("portfolioId") ?? undefined;
  const status = url.searchParams.get("status") ?? undefined;
  const reportingCurrency = url.searchParams.get("reportingCurrency") ?? undefined;
  const limit = url.searchParams.get("limit") ?? undefined;

  return listReportRunsQuerySchema.parse({
    portfolioId,
    status,
    reportingCurrency,
    limit
  });
}

function buildValidationErrorResponse(error: ZodError) {
  return NextResponse.json(
    {
      error: {
        code: "VALIDATION_ERROR",
        message: error.issues.map((i) => i.message).join("; ")
      }
    },
    { status: 400 }
  );
}

// ---------------------------------------------------------------------------
// GET /api/v1/report-runs
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
  const userId = await getAuthenticatedApiUserId();

  if (!userId) {
    return buildApiUnauthorizedResponse();
  }

  let query: z.infer<typeof listReportRunsQuerySchema>;
  try {
    query = parseListReportRunsQuery(request);
  } catch (error) {
    if (error instanceof ZodError) {
      return buildValidationErrorResponse(error);
    }

    throw error;
  }

  const { ReportRunService, PortfolioNotFoundError } =
    await import("@/server/services/report-run-service");
  try {
    const service = new ReportRunService();
    const result = await service.listReportRunsForUser(userId, {
      portfolioId: query.portfolioId,
      status: query.status,
      reportingCurrency: query.reportingCurrency,
      limit: query.limit
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof PortfolioNotFoundError) {
      return NextResponse.json(
        { error: { code: "PORTFOLIO_NOT_FOUND", message: "Portfolio not found." } },
        { status: 404 }
      );
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// POST /api/v1/report-runs
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  const userId = await getAuthenticatedApiUserId();

  if (!userId) {
    return buildApiUnauthorizedResponse();
  }

  // 1. Parse and validate request body
  let body: z.infer<typeof createReportRunBodySchema>;
  try {
    const raw = await request.json();
    body = createReportRunBodySchema.parse(raw);
  } catch (error) {
    if (error instanceof ZodError) {
      return buildValidationErrorResponse(error);
    }
    return NextResponse.json(
      { error: { code: "INVALID_BODY", message: "Request body must be valid JSON." } },
      { status: 400 }
    );
  }

  // 2. Call service
  const { ReportRunService, PortfolioNotFoundError } =
    await import("@/server/services/report-run-service");
  try {
    const service = new ReportRunService();
    const result = await service.createAndEnqueue({
      userId,
      portfolioId: body.portfolioId,
      reportingCurrency: body.reportingCurrency
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof PortfolioNotFoundError) {
      return NextResponse.json(
        { error: { code: "PORTFOLIO_NOT_FOUND", message: "Portfolio not found." } },
        { status: 404 }
      );
    }
    throw error;
  }
}
