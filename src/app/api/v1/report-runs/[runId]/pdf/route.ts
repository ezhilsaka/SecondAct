import { NextResponse } from "next/server";

import {
    ArtifactNotFoundError,
    ReportRunNotFoundError,
    ReportRunService,
    SignedUrlError,
} from "@/server/services/report-run-service";
import { uuidSchema } from "@/server/shared/types";

// ---------------------------------------------------------------------------
// GET /api/v1/report-runs/:runId/pdf
// ---------------------------------------------------------------------------

export async function GET(
    request: Request,
    { params }: { params: Promise<{ runId: string }> }
) {
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

    // 2. Validate runId param
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

    // 3. Call service
    try {
        const service = new ReportRunService();
        const result = await service.getPdfSignedUrl(validatedRunId, userId);
        return NextResponse.json(result);
    } catch (error) {
        if (error instanceof ReportRunNotFoundError) {
            return NextResponse.json(
                { error: { code: "REPORT_RUN_NOT_FOUND", message: error.message } },
                { status: 404 }
            );
        }
        if (error instanceof ArtifactNotFoundError) {
            return NextResponse.json(
                { error: { code: "ARTIFACT_NOT_FOUND", message: error.message } },
                { status: 404 }
            );
        }
        if (error instanceof SignedUrlError) {
            return NextResponse.json(
                { error: { code: "SIGNED_URL_ERROR", message: "Failed to generate download URL." } },
                { status: 502 }
            );
        }
        throw error;
    }
}
