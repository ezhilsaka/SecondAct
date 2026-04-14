import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

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
  // 1. Extract and validate X-User-Id header
  const userIdHeader = request.headers.get("x-user-id");
  if (!userIdHeader) {
    return NextResponse.json(
      { error: { code: "MISSING_USER_ID", message: "X-User-Id header is required." } },
      { status: 401 }
    );
  }

  let userId: string;
  try {
    userId = uuidSchema.parse(userIdHeader);
  } catch {
    return NextResponse.json(
      { error: { code: "INVALID_USER_ID", message: "X-User-Id must be a valid UUID." } },
      { status: 401 }
    );
  }

  // 2. Parse and validate request body
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

  // 3. Call service
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
        { error: { code: "PORTFOLIO_NOT_FOUND", message: error.message } },
        { status: 404 }
      );
    }
    throw error;
  }
}
