import { beforeEach, describe, expect, it, vi } from "vitest";

const TEST_USER_ID = "11111111-1111-4111-8111-111111111111";
const TEST_PORTFOLIO_ID = "22222222-2222-4222-8222-222222222222";
const TEST_RUN_ID = "33333333-3333-4333-8333-333333333333";
const TEST_ACTIVE_RUN_ID = "44444444-4444-4444-8444-444444444444";

const {
  mockCreateAndEnqueue,
  mockFindActiveReportRunForPortfolio,
  mockRedirect,
  mockRequireAuthenticatedUser,
  mockRevalidatePath
} = vi.hoisted(() => ({
  mockCreateAndEnqueue: vi.fn(),
  mockFindActiveReportRunForPortfolio: vi.fn(),
  mockRedirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  mockRequireAuthenticatedUser: vi.fn(),
  mockRevalidatePath: vi.fn()
}));

vi.mock("next/cache", () => ({
  revalidatePath: mockRevalidatePath
}));

vi.mock("next/navigation", () => ({
  redirect: mockRedirect
}));

vi.mock("@/server/auth/supabase-server", () => ({
  requireAuthenticatedUser: mockRequireAuthenticatedUser
}));

vi.mock("@/server/services/report-run-service", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/server/services/report-run-service")>();

  return {
    ...original,
    ReportRunService: class {
      createAndEnqueue = mockCreateAndEnqueue;
      findActiveReportRunForPortfolio = mockFindActiveReportRunForPortfolio;
    }
  };
});

import { generateReportFromPortfolio } from "@/app/app/reports/actions";
import { PortfolioNotFoundError } from "@/server/services/report-run-service";

function buildFormData(values: Record<string, string>) {
  const formData = new FormData();

  Object.entries(values).forEach(([key, value]) => {
    formData.set(key, value);
  });

  return formData;
}

describe("generateReportFromPortfolio", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateAndEnqueue.mockResolvedValue({ runId: TEST_RUN_ID, status: "QUEUED" });
    mockFindActiveReportRunForPortfolio.mockResolvedValue(null);
    mockRequireAuthenticatedUser.mockResolvedValue({ id: TEST_USER_ID });
  });

  it("redirects invalid report currency submissions back to portfolio detail", async () => {
    await expect(
      generateReportFromPortfolio(
        buildFormData({
          portfolioId: TEST_PORTFOLIO_ID,
          reportingCurrency: "EUR"
        })
      )
    ).rejects.toThrow("REDIRECT:");

    expect(mockRedirect).toHaveBeenCalledWith(
      `/app/portfolios/${TEST_PORTFOLIO_ID}?error=report_validation_error`
    );
    expect(mockRequireAuthenticatedUser).not.toHaveBeenCalled();
    expect(mockCreateAndEnqueue).not.toHaveBeenCalled();
  });

  it("creates a report run for the authenticated user and redirects to status page", async () => {
    await expect(
      generateReportFromPortfolio(
        buildFormData({
          portfolioId: TEST_PORTFOLIO_ID,
          reportingCurrency: "CAD",
          userId: "99999999-9999-4999-8999-999999999999"
        })
      )
    ).rejects.toThrow(`REDIRECT:/app/reports/${TEST_RUN_ID}`);

    expect(mockFindActiveReportRunForPortfolio).toHaveBeenCalledWith(
      TEST_USER_ID,
      TEST_PORTFOLIO_ID
    );
    expect(mockCreateAndEnqueue).toHaveBeenCalledWith({
      userId: TEST_USER_ID,
      portfolioId: TEST_PORTFOLIO_ID,
      reportingCurrency: "CAD"
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith(`/app/portfolios/${TEST_PORTFOLIO_ID}`);
  });

  it("retries a failed report by creating a fresh run instead of mutating the failed run", async () => {
    const failedRunId = "55555555-5555-4555-8555-555555555555";

    await expect(
      generateReportFromPortfolio(
        buildFormData({
          portfolioId: TEST_PORTFOLIO_ID,
          reportingCurrency: "CAD",
          retrySourceRunId: failedRunId
        })
      )
    ).rejects.toThrow(`REDIRECT:/app/reports/${TEST_RUN_ID}`);

    expect(mockFindActiveReportRunForPortfolio).toHaveBeenCalledWith(
      TEST_USER_ID,
      TEST_PORTFOLIO_ID
    );
    expect(mockCreateAndEnqueue).toHaveBeenCalledWith({
      userId: TEST_USER_ID,
      portfolioId: TEST_PORTFOLIO_ID,
      reportingCurrency: "CAD"
    });
    expect(mockCreateAndEnqueue).not.toHaveBeenCalledWith(
      expect.objectContaining({ runId: failedRunId })
    );
  });

  it("redirects to an existing active report run instead of creating another one", async () => {
    mockFindActiveReportRunForPortfolio.mockResolvedValue({
      runId: TEST_ACTIVE_RUN_ID,
      portfolioId: TEST_PORTFOLIO_ID,
      portfolioName: "Retirement Portfolio",
      status: "PROCESSING",
      paymentStatus: "NOT_REQUIRED",
      reportingCurrency: "CAD",
      errorCode: null,
      requestedAt: "2026-06-20T12:00:00.000Z",
      startedAt: "2026-06-20T12:00:01.000Z",
      completedAt: null,
      failedAt: null
    });

    await expect(
      generateReportFromPortfolio(
        buildFormData({
          portfolioId: TEST_PORTFOLIO_ID,
          reportingCurrency: "CAD"
        })
      )
    ).rejects.toThrow(`REDIRECT:/app/reports/${TEST_ACTIVE_RUN_ID}`);

    expect(mockCreateAndEnqueue).not.toHaveBeenCalled();
    expect(mockRevalidatePath).toHaveBeenCalledWith(`/app/portfolios/${TEST_PORTFOLIO_ID}`);
  });

  it("handles portfolio not found without leaking IDs into the user-facing URL", async () => {
    mockFindActiveReportRunForPortfolio.mockRejectedValue(
      new PortfolioNotFoundError(
        `Portfolio ${TEST_PORTFOLIO_ID} not found for user ${TEST_USER_ID}.`
      )
    );

    await expect(
      generateReportFromPortfolio(
        buildFormData({
          portfolioId: TEST_PORTFOLIO_ID,
          reportingCurrency: "CAD"
        })
      )
    ).rejects.toThrow("REDIRECT:");

    expect(mockRedirect).toHaveBeenCalledWith("/app/portfolios?error=portfolio_not_found");
  });
});
