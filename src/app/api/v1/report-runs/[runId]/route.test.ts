import { describe, expect, it, vi, beforeEach } from "vitest";

import {
  ReportRunNotFoundError,
  ReportRunNotTerminalError,
  ReportStorageDeleteError
} from "@/server/services/report-run-service";

const TEST_USER_ID = "11111111-1111-4111-8111-111111111111";
const TEST_RUN_ID = "33333333-3333-4333-8333-333333333333";
const TEST_PORTFOLIO_ID = "22222222-2222-4222-8222-222222222222";

const { mockDeleteTerminalReportRunForUser, mockGetAuthenticatedApiUserId, mockGetStatus } = vi.hoisted(() => ({
  mockDeleteTerminalReportRunForUser: vi.fn(),
  mockGetAuthenticatedApiUserId: vi.fn(),
  mockGetStatus: vi.fn()
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
      deleteTerminalReportRunForUser = mockDeleteTerminalReportRunForUser;
      getStatus = mockGetStatus;
    }
  };
});

import { DELETE, GET } from "@/app/api/v1/report-runs/[runId]/route";

function buildRequest(headers: Record<string, string> = {}) {
  return new Request(`http://localhost/api/v1/report-runs/${TEST_RUN_ID}`, {
    method: "GET",
    headers
  });
}

function buildParams(runId: string = TEST_RUN_ID) {
  return { params: Promise.resolve({ runId }) };
}

describe("GET /api/v1/report-runs/:runId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthenticatedApiUserId.mockResolvedValue(TEST_USER_ID);
  });

  it("returns 200 with run status on success", async () => {
    const statusResult = {
      runId: TEST_RUN_ID,
      portfolioId: TEST_PORTFOLIO_ID,
      portfolioName: "Retirement Portfolio",
      status: "PROCESSING",
      paymentStatus: "NOT_REQUIRED",
      reportingCurrency: "CAD",
      errorCode: null,
      requestedAt: "2025-01-01T00:00:00.000Z",
      startedAt: "2025-01-01T00:01:00.000Z",
      completedAt: null,
      failedAt: null
    };
    mockGetStatus.mockResolvedValue(statusResult);

    const response = await GET(buildRequest(), buildParams());

    expect(response.status).toBe(200);
    expect(mockGetStatus).toHaveBeenCalledWith(TEST_RUN_ID, TEST_USER_ID);
    await expect(response.json()).resolves.toEqual(statusResult);
  });

  it("uses the authenticated session user instead of a spoofable user header", async () => {
    const spoofedUserId = "44444444-4444-4444-8444-444444444444";
    mockGetStatus.mockResolvedValue({
      runId: TEST_RUN_ID,
      portfolioId: TEST_PORTFOLIO_ID,
      portfolioName: "Retirement Portfolio",
      status: "QUEUED",
      paymentStatus: "NOT_REQUIRED",
      reportingCurrency: "CAD",
      errorCode: null,
      requestedAt: "2025-01-01T00:00:00.000Z",
      startedAt: null,
      completedAt: null,
      failedAt: null
    });

    const response = await GET(buildRequest({ "x-user-id": spoofedUserId }), buildParams());

    expect(response.status).toBe(200);
    expect(mockGetStatus).toHaveBeenCalledWith(TEST_RUN_ID, TEST_USER_ID);
  });

  it("returns 401 when the request has no authenticated session", async () => {
    mockGetAuthenticatedApiUserId.mockResolvedValue(null);

    const response = await GET(buildRequest(), buildParams());

    expect(response.status).toBe(401);
    const json = await response.json();
    expect(json.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 400 when runId is not a valid UUID", async () => {
    const response = await GET(buildRequest(), buildParams("not-a-uuid"));

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error.code).toBe("INVALID_RUN_ID");
  });

  it("returns 404 when report run is not found", async () => {
    mockGetStatus.mockRejectedValue(
      new ReportRunNotFoundError(`Report run ${TEST_RUN_ID} not found for user ${TEST_USER_ID}.`)
    );

    const response = await GET(buildRequest(), buildParams());

    expect(response.status).toBe(404);
    const json = await response.json();
    expect(json).toEqual({
      error: {
        code: "REPORT_RUN_NOT_FOUND",
        message: "Report run not found."
      }
    });
    expect(JSON.stringify(json)).not.toContain(TEST_USER_ID);
    expect(JSON.stringify(json)).not.toContain(TEST_RUN_ID);
  });
});

describe("DELETE /api/v1/report-runs/:runId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthenticatedApiUserId.mockResolvedValue(TEST_USER_ID);
    mockDeleteTerminalReportRunForUser.mockResolvedValue({
      runId: TEST_RUN_ID,
      portfolioId: TEST_PORTFOLIO_ID,
      status: "COMPLETED",
      deletedStorageObject: true,
      storageObjectMissing: false
    });
  });

  it("returns 204 when a terminal owner report is deleted", async () => {
    const response = await DELETE(buildRequest(), buildParams());

    expect(response.status).toBe(204);
    expect(mockDeleteTerminalReportRunForUser).toHaveBeenCalledWith(TEST_RUN_ID, TEST_USER_ID);
    await expect(response.text()).resolves.toBe("");
  });

  it("uses the authenticated session user instead of a spoofable user header", async () => {
    const spoofedUserId = "44444444-4444-4444-8444-444444444444";

    const response = await DELETE(buildRequest({ "x-user-id": spoofedUserId }), buildParams());

    expect(response.status).toBe(204);
    expect(mockDeleteTerminalReportRunForUser).toHaveBeenCalledWith(TEST_RUN_ID, TEST_USER_ID);
  });

  it("returns 401 when the request has no authenticated session", async () => {
    mockGetAuthenticatedApiUserId.mockResolvedValue(null);

    const response = await DELETE(buildRequest(), buildParams());

    expect(response.status).toBe(401);
    const json = await response.json();
    expect(json.error.code).toBe("UNAUTHORIZED");
    expect(mockDeleteTerminalReportRunForUser).not.toHaveBeenCalled();
  });

  it("returns 400 when runId is not a valid UUID", async () => {
    const response = await DELETE(buildRequest(), buildParams("not-a-uuid"));

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error.code).toBe("INVALID_RUN_ID");
    expect(mockDeleteTerminalReportRunForUser).not.toHaveBeenCalled();
  });

  it("returns 404 when the authenticated user cannot access the report", async () => {
    mockDeleteTerminalReportRunForUser.mockRejectedValue(
      new ReportRunNotFoundError(`Report run ${TEST_RUN_ID} not found for user ${TEST_USER_ID}.`)
    );

    const response = await DELETE(buildRequest(), buildParams());

    expect(response.status).toBe(404);
    const json = await response.json();
    expect(json).toEqual({
      error: {
        code: "REPORT_RUN_NOT_FOUND",
        message: "Report run not found."
      }
    });
    expect(JSON.stringify(json)).not.toContain(TEST_USER_ID);
    expect(JSON.stringify(json)).not.toContain(TEST_RUN_ID);
  });

  it("returns 409 when the report is not terminal", async () => {
    mockDeleteTerminalReportRunForUser.mockRejectedValue(
      new ReportRunNotTerminalError("Only completed or failed reports can be deleted.")
    );

    const response = await DELETE(buildRequest(), buildParams());

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "REPORT_RUN_NOT_TERMINAL",
        message: "Only completed or failed reports can be deleted."
      }
    });
  });

  it("returns 502 when storage cleanup fails", async () => {
    mockDeleteTerminalReportRunForUser.mockRejectedValue(
      new ReportStorageDeleteError("storage cleanup failed")
    );

    const response = await DELETE(buildRequest(), buildParams());

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "REPORT_STORAGE_DELETE_FAILED",
        message: "We could not delete the report PDF. Please try again."
      }
    });
  });
});
