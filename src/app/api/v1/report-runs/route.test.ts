import { describe, expect, it, vi, beforeEach } from "vitest";

import { PortfolioNotFoundError } from "@/server/services/report-run-service";

const TEST_USER_ID = "11111111-1111-4111-8111-111111111111";
const TEST_RUN_ID = "33333333-3333-4333-8333-333333333333";
const TEST_PORTFOLIO_ID = "22222222-2222-4222-8222-222222222222";

const { mockCreateAndEnqueue, mockGetAuthenticatedApiUserId } = vi.hoisted(() => ({
  mockCreateAndEnqueue: vi.fn(),
  mockGetAuthenticatedApiUserId: vi.fn()
}));

vi.mock("@/server/auth/api-auth", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/server/auth/api-auth")>();
  return {
    ...original,
    getAuthenticatedApiUserId: mockGetAuthenticatedApiUserId
  };
});

vi.mock("@/server/services/report-run-service", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/server/services/report-run-service")>();
  return {
    ...original,
    ReportRunService: class {
      createAndEnqueue = mockCreateAndEnqueue;
    }
  };
});

import { POST } from "@/app/api/v1/report-runs/route";

function buildRequest(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/v1/report-runs", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers
    },
    body: JSON.stringify(body)
  });
}

describe("POST /api/v1/report-runs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthenticatedApiUserId.mockResolvedValue(TEST_USER_ID);
  });

  it("returns 201 with runId and status on success", async () => {
    mockCreateAndEnqueue.mockResolvedValue({ runId: TEST_RUN_ID, status: "QUEUED" });

    const response = await POST(
      buildRequest({ portfolioId: TEST_PORTFOLIO_ID, reportingCurrency: "CAD" })
    );

    expect(response.status).toBe(201);
    expect(mockCreateAndEnqueue).toHaveBeenCalledWith({
      userId: TEST_USER_ID,
      portfolioId: TEST_PORTFOLIO_ID,
      reportingCurrency: "CAD"
    });
    await expect(response.json()).resolves.toEqual({
      runId: TEST_RUN_ID,
      status: "QUEUED"
    });
  });

  it("passes the deferred positive-path smoke with authenticated user ownership", async () => {
    const spoofedUserId = "44444444-4444-4444-8444-444444444444";
    mockCreateAndEnqueue.mockResolvedValue({ runId: TEST_RUN_ID, status: "QUEUED" });

    const response = await POST(
      buildRequest(
        { portfolioId: TEST_PORTFOLIO_ID, reportingCurrency: "CAD", userId: spoofedUserId },
        { "x-user-id": spoofedUserId }
      )
    );

    expect(response.status).toBe(201);
    expect(mockCreateAndEnqueue).toHaveBeenCalledWith({
      userId: TEST_USER_ID,
      portfolioId: TEST_PORTFOLIO_ID,
      reportingCurrency: "CAD"
    });
    await expect(response.json()).resolves.toEqual({
      runId: TEST_RUN_ID,
      status: "QUEUED"
    });
  });

  it("returns 401 when the request has no authenticated session", async () => {
    mockGetAuthenticatedApiUserId.mockResolvedValue(null);

    const response = await POST(
      buildRequest({ portfolioId: TEST_PORTFOLIO_ID, reportingCurrency: "CAD" })
    );

    expect(response.status).toBe(401);
    const json = await response.json();
    expect(json.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 400 when portfolioId is missing", async () => {
    const response = await POST(buildRequest({ reportingCurrency: "CAD" }));

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 when reportingCurrency is invalid", async () => {
    const response = await POST(
      buildRequest({ portfolioId: TEST_PORTFOLIO_ID, reportingCurrency: "EUR" })
    );

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 when body is not valid JSON", async () => {
    const request = new Request("http://localhost/api/v1/report-runs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: "not-json"
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error.code).toBe("INVALID_BODY");
  });

  it("returns 404 when portfolio is not found", async () => {
    mockCreateAndEnqueue.mockRejectedValue(
      new PortfolioNotFoundError(
        `Portfolio ${TEST_PORTFOLIO_ID} not found for user ${TEST_USER_ID}.`
      )
    );

    const response = await POST(
      buildRequest({ portfolioId: TEST_PORTFOLIO_ID, reportingCurrency: "CAD" })
    );

    expect(response.status).toBe(404);
    const json = await response.json();
    expect(json).toEqual({
      error: {
        code: "PORTFOLIO_NOT_FOUND",
        message: "Portfolio not found."
      }
    });
    expect(JSON.stringify(json)).not.toContain(TEST_USER_ID);
    expect(JSON.stringify(json)).not.toContain(TEST_PORTFOLIO_ID);
  });
});
