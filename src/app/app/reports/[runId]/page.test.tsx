import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const TEST_USER_ID = "11111111-1111-4111-8111-111111111111";
const TEST_RUN_ID = "33333333-3333-4333-8333-333333333333";
const TEST_PORTFOLIO_ID = "22222222-2222-4222-8222-222222222222";

const { mockGetStatus, mockNotFound, mockRequireAuthenticatedAppUser } = vi.hoisted(() => ({
  mockGetStatus: vi.fn(),
  mockNotFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
  mockRequireAuthenticatedAppUser: vi.fn()
}));

vi.mock("next/navigation", () => ({
  notFound: mockNotFound
}));

vi.mock("@/server/auth/app-session", () => ({
  requireAuthenticatedAppUser: mockRequireAuthenticatedAppUser
}));

vi.mock("@/server/services/report-run-service", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/server/services/report-run-service")>();

  return {
    ...original,
    ReportRunService: class {
      getStatus = mockGetStatus;
    }
  };
});

import ReportStatusPage, { ReportStatusPageView } from "@/app/app/reports/[runId]/page";
import {
  ReportRunNotFoundError,
  type ReportRunStatusResult
} from "@/server/services/report-run-service";

function buildStatus(overrides: Partial<ReportRunStatusResult> = {}): ReportRunStatusResult {
  return {
    runId: TEST_RUN_ID,
    portfolioId: TEST_PORTFOLIO_ID,
    portfolioName: "Retirement Portfolio",
    status: "QUEUED",
    paymentStatus: "NOT_REQUIRED",
    reportingCurrency: "CAD",
    errorCode: null,
    requestedAt: "2026-06-20T12:00:00.000Z",
    startedAt: null,
    completedAt: null,
    failedAt: null,
    ...overrides
  };
}

describe("ReportStatusPageView", () => {
  it("renders report status and a source portfolio link", () => {
    const html = renderToStaticMarkup(<ReportStatusPageView status={buildStatus()} />);

    expect(html).toContain("Report run");
    expect(html).toContain("Retirement Portfolio");
    expect(html).toContain(`href="/app/portfolios/${TEST_PORTFOLIO_ID}"`);
    expect(html).toContain("Back to Portfolio");
    expect(html).toContain("Your report is in line to be generated.");
  });
});

describe("ReportStatusPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuthenticatedAppUser.mockResolvedValue({ id: TEST_USER_ID });
    mockGetStatus.mockResolvedValue(buildStatus());
  });

  it("loads report status for the authenticated user", async () => {
    const jsx = await ReportStatusPage({
      params: Promise.resolve({ runId: TEST_RUN_ID })
    });
    const html = renderToStaticMarkup(jsx);

    expect(mockRequireAuthenticatedAppUser).toHaveBeenCalled();
    expect(mockGetStatus).toHaveBeenCalledWith(TEST_RUN_ID, TEST_USER_ID);
    expect(html).toContain("Retirement Portfolio");
  });

  it("returns not found for invalid run ids without loading a user", async () => {
    await expect(
      ReportStatusPage({
        params: Promise.resolve({ runId: "not-a-uuid" })
      })
    ).rejects.toThrow("NOT_FOUND");

    expect(mockRequireAuthenticatedAppUser).not.toHaveBeenCalled();
    expect(mockGetStatus).not.toHaveBeenCalled();
  });

  it("returns not found when the authenticated user cannot access the run", async () => {
    mockGetStatus.mockRejectedValue(
      new ReportRunNotFoundError(`Report run ${TEST_RUN_ID} not found for user ${TEST_USER_ID}.`)
    );

    await expect(
      ReportStatusPage({
        params: Promise.resolve({ runId: TEST_RUN_ID })
      })
    ).rejects.toThrow("NOT_FOUND");

    expect(mockNotFound).toHaveBeenCalled();
  });
});
