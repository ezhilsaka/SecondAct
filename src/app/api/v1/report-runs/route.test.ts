import { describe, expect, it, vi, beforeEach } from "vitest";

import { PortfolioNotFoundError } from "@/server/services/report-run-service";

const TEST_USER_ID = "11111111-1111-4111-8111-111111111111";
const TEST_RUN_ID = "33333333-3333-4333-8333-333333333333";
const TEST_PORTFOLIO_ID = "22222222-2222-4222-8222-222222222222";

const { mockCreateAndEnqueue } = vi.hoisted(() => ({
    mockCreateAndEnqueue: vi.fn(),
}));

vi.mock("@/server/services/report-run-service", async (importOriginal) => {
    const original = await importOriginal<typeof import("@/server/services/report-run-service")>();
    return {
        ...original,
        ReportRunService: class {
            createAndEnqueue = mockCreateAndEnqueue;
        },
    };
});

import { POST } from "@/app/api/v1/report-runs/route";

function buildRequest(body: unknown, headers: Record<string, string> = {}) {
    return new Request("http://localhost/api/v1/report-runs", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...headers,
        },
        body: JSON.stringify(body),
    });
}

describe("POST /api/v1/report-runs", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns 201 with runId and status on success", async () => {
        mockCreateAndEnqueue.mockResolvedValue({ runId: TEST_RUN_ID, status: "QUEUED" });

        const response = await POST(
            buildRequest(
                { portfolioId: TEST_PORTFOLIO_ID, reportingCurrency: "CAD" },
                { "x-user-id": TEST_USER_ID }
            )
        );

        expect(response.status).toBe(201);
        await expect(response.json()).resolves.toEqual({
            runId: TEST_RUN_ID,
            status: "QUEUED",
        });
    });

    it("returns 401 when X-User-Id header is missing", async () => {
        const response = await POST(
            buildRequest({ portfolioId: TEST_PORTFOLIO_ID, reportingCurrency: "CAD" })
        );

        expect(response.status).toBe(401);
        const json = await response.json();
        expect(json.error.code).toBe("MISSING_USER_ID");
    });

    it("returns 401 when X-User-Id is not a valid UUID", async () => {
        const response = await POST(
            buildRequest(
                { portfolioId: TEST_PORTFOLIO_ID, reportingCurrency: "CAD" },
                { "x-user-id": "not-a-uuid" }
            )
        );

        expect(response.status).toBe(401);
        const json = await response.json();
        expect(json.error.code).toBe("INVALID_USER_ID");
    });

    it("returns 400 when portfolioId is missing", async () => {
        const response = await POST(
            buildRequest(
                { reportingCurrency: "CAD" },
                { "x-user-id": TEST_USER_ID }
            )
        );

        expect(response.status).toBe(400);
        const json = await response.json();
        expect(json.error.code).toBe("VALIDATION_ERROR");
    });

    it("returns 400 when reportingCurrency is invalid", async () => {
        const response = await POST(
            buildRequest(
                { portfolioId: TEST_PORTFOLIO_ID, reportingCurrency: "EUR" },
                { "x-user-id": TEST_USER_ID }
            )
        );

        expect(response.status).toBe(400);
        const json = await response.json();
        expect(json.error.code).toBe("VALIDATION_ERROR");
    });

    it("returns 400 when body is not valid JSON", async () => {
        const request = new Request("http://localhost/api/v1/report-runs", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-user-id": TEST_USER_ID,
            },
            body: "not-json",
        });

        const response = await POST(request);

        expect(response.status).toBe(400);
        const json = await response.json();
        expect(json.error.code).toBe("INVALID_BODY");
    });

    it("returns 404 when portfolio is not found", async () => {
        mockCreateAndEnqueue.mockRejectedValue(
            new PortfolioNotFoundError("Portfolio not found")
        );

        const response = await POST(
            buildRequest(
                { portfolioId: TEST_PORTFOLIO_ID, reportingCurrency: "CAD" },
                { "x-user-id": TEST_USER_ID }
            )
        );

        expect(response.status).toBe(404);
        const json = await response.json();
        expect(json.error.code).toBe("PORTFOLIO_NOT_FOUND");
    });
});
