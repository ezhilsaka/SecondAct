import { describe, expect, it, vi, beforeEach } from "vitest";

import { ReportRunNotFoundError } from "@/server/services/report-run-service";

const TEST_USER_ID = "11111111-1111-4111-8111-111111111111";
const TEST_RUN_ID = "33333333-3333-4333-8333-333333333333";
const TEST_PORTFOLIO_ID = "22222222-2222-4222-8222-222222222222";

const { mockGetStatus } = vi.hoisted(() => ({
    mockGetStatus: vi.fn(),
}));

vi.mock("@/server/services/report-run-service", async (importOriginal) => {
    const original = await importOriginal<typeof import("@/server/services/report-run-service")>();
    return {
        ...original,
        ReportRunService: class {
            getStatus = mockGetStatus;
        },
    };
});

import { GET } from "@/app/api/v1/report-runs/[runId]/route";

function buildRequest(headers: Record<string, string> = {}) {
    return new Request(`http://localhost/api/v1/report-runs/${TEST_RUN_ID}`, {
        method: "GET",
        headers,
    });
}

function buildParams(runId: string = TEST_RUN_ID) {
    return { params: Promise.resolve({ runId }) };
}

describe("GET /api/v1/report-runs/:runId", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns 200 with run status on success", async () => {
        const statusResult = {
            runId: TEST_RUN_ID,
            portfolioId: TEST_PORTFOLIO_ID,
            status: "PROCESSING",
            paymentStatus: "NOT_REQUIRED",
            reportingCurrency: "CAD",
            errorCode: null,
            requestedAt: "2025-01-01T00:00:00.000Z",
            startedAt: "2025-01-01T00:01:00.000Z",
            completedAt: null,
            failedAt: null,
        };
        mockGetStatus.mockResolvedValue(statusResult);

        const response = await GET(
            buildRequest({ "x-user-id": TEST_USER_ID }),
            buildParams()
        );

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual(statusResult);
    });

    it("returns 401 when X-User-Id header is missing", async () => {
        const response = await GET(buildRequest(), buildParams());

        expect(response.status).toBe(401);
        const json = await response.json();
        expect(json.error.code).toBe("MISSING_USER_ID");
    });

    it("returns 401 when X-User-Id is not a valid UUID", async () => {
        const response = await GET(
            buildRequest({ "x-user-id": "bad" }),
            buildParams()
        );

        expect(response.status).toBe(401);
        const json = await response.json();
        expect(json.error.code).toBe("INVALID_USER_ID");
    });

    it("returns 400 when runId is not a valid UUID", async () => {
        const response = await GET(
            buildRequest({ "x-user-id": TEST_USER_ID }),
            buildParams("not-a-uuid")
        );

        expect(response.status).toBe(400);
        const json = await response.json();
        expect(json.error.code).toBe("INVALID_RUN_ID");
    });

    it("returns 404 when report run is not found", async () => {
        mockGetStatus.mockRejectedValue(
            new ReportRunNotFoundError("Not found")
        );

        const response = await GET(
            buildRequest({ "x-user-id": TEST_USER_ID }),
            buildParams()
        );

        expect(response.status).toBe(404);
        const json = await response.json();
        expect(json.error.code).toBe("REPORT_RUN_NOT_FOUND");
    });
});
