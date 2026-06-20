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
