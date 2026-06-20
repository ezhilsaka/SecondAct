import { NextResponse } from "next/server";

import { buildApiUnauthorizedResponse, getAuthenticatedApiUserId } from "@/server/auth/api-auth";
import { uuidSchema } from "@/server/shared/types";

// ---------------------------------------------------------------------------
// GET /api/v1/report-runs/:runId
// ---------------------------------------------------------------------------

export async function GET(request: Request, { params }: { params: Promise<{ runId: string }> }) {
  const userId = await getAuthenticatedApiUserId();

  if (!userId) {
    return buildApiUnauthorizedResponse();
  }

  // 1. Validate runId param
  const { runId } = await params;
  let validatedRunId: string;
  try {
    validatedRunId = uuidSchema.parse(runId);
  } catch {
    return NextResponse.json(
      { error: { code: "INVALID_RUN_ID", message: "runId must be a valid UUID." } },
      { status: 400 }
    );
  }

  // 2. Call service
  const { ReportRunService, ReportRunNotFoundError } =
    await import("@/server/services/report-run-service");
  try {
    const service = new ReportRunService();
    const result = await service.getStatus(validatedRunId, userId);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ReportRunNotFoundError) {
      return NextResponse.json(
        { error: { code: "REPORT_RUN_NOT_FOUND", message: "Report run not found." } },
        { status: 404 }
      );
    }
    throw error;
  }
}
