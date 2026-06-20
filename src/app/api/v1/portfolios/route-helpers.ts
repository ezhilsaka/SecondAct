import { NextResponse } from "next/server";
import { ZodError } from "zod";

import {
  DuplicateHoldingTickerError,
  HoldingNotFoundError,
  PortfolioArchivedError,
  PortfolioNotFoundError
} from "@/server/services/portfolio-service";

export function buildPortfolioApiErrorResponse(
  code: string,
  message: string,
  status: number
): NextResponse {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function parseJsonBody(
  request: Request
): Promise<{ ok: true; body: unknown } | { ok: false; response: NextResponse }> {
  try {
    return { ok: true, body: await request.json() };
  } catch {
    return {
      ok: false,
      response: buildPortfolioApiErrorResponse(
        "INVALID_BODY",
        "Request body must be valid JSON.",
        400
      )
    };
  }
}

export function buildServiceInput(
  body: unknown,
  serverFields: Record<string, string>
): Record<string, unknown> {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return serverFields;
  }

  return {
    ...body,
    ...serverFields
  };
}

export function mapPortfolioServiceError(error: unknown): NextResponse | null {
  if (error instanceof ZodError) {
    return buildPortfolioApiErrorResponse(
      "VALIDATION_ERROR",
      error.issues.map((issue) => issue.message).join("; "),
      400
    );
  }

  if (error instanceof PortfolioNotFoundError) {
    return buildPortfolioApiErrorResponse("PORTFOLIO_NOT_FOUND", "Portfolio not found.", 404);
  }

  if (error instanceof PortfolioArchivedError) {
    return buildPortfolioApiErrorResponse("PORTFOLIO_ARCHIVED", "Portfolio not found.", 404);
  }

  if (error instanceof HoldingNotFoundError) {
    return buildPortfolioApiErrorResponse("HOLDING_NOT_FOUND", "Holding not found.", 404);
  }

  if (error instanceof DuplicateHoldingTickerError) {
    return buildPortfolioApiErrorResponse("DUPLICATE_HOLDING_TICKER", error.message, 409);
  }

  return null;
}
