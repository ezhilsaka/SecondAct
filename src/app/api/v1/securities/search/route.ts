import { NextResponse } from "next/server";
import { ZodError } from "zod";

import {
  buildApiUnauthorizedResponse,
  getAuthenticatedApiUserId
} from "@/server/auth/api-auth";
import {
  SecuritySearchService,
  SecuritySearchUnavailableError
} from "@/server/services/security-search-service";

function buildSecuritySearchErrorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function GET(request: Request) {
  const userId = await getAuthenticatedApiUserId();

  if (!userId) {
    return buildApiUnauthorizedResponse();
  }

  const query = new URL(request.url).searchParams.get("query") ?? "";

  try {
    const result = await new SecuritySearchService().search({ query });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ZodError) {
      return buildSecuritySearchErrorResponse(
        "VALIDATION_ERROR",
        error.issues.map((issue) => issue.message).join("; "),
        400
      );
    }

    if (error instanceof SecuritySearchUnavailableError) {
      return buildSecuritySearchErrorResponse(
        "SECURITY_SEARCH_UNAVAILABLE",
        "Security search is temporarily unavailable. You can still enter a ticker manually.",
        502
      );
    }

    throw error;
  }
}
