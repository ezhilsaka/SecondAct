import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const TEST_USER_ID = "11111111-1111-4111-8111-111111111111";
const TEST_PORTFOLIO_ID = "22222222-2222-4222-8222-222222222222";
const TEST_RUN_ID = "33333333-3333-4333-8333-333333333333";

const { mockListReportRunsForUser, mockRequireAuthenticatedAppUser } = vi.hoisted(() => ({
  mockListReportRunsForUser: vi.fn(),
  mockRequireAuthenticatedAppUser: vi.fn()
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
      listReportRunsForUser = mockListReportRunsForUser;
    }
  };
});

import ReportsPage, { ReportHistoryView } from "@/app/app/reports/page";
import type { ReportRunSummaryResult } from "@/server/services/report-run-service";

function buildReportRun(
  overrides: Partial<ReportRunSummaryResult> = {}
): ReportRunSummaryResult {
  return {
    runId: TEST_RUN_ID,
    portfolioId: TEST_PORTFOLIO_ID,
    portfolioName: "Retirement Portfolio",
    status: "COMPLETED",
    paymentStatus: "NOT_REQUIRED",
    reportingCurrency: "CAD",
    errorCode: null,
    requestedAt: "2026-06-20T12:00:00.000Z",
    startedAt: "2026-06-20T12:01:00.000Z",
    completedAt: "2026-06-20T12:03:00.000Z",
    failedAt: null,
    ...overrides
  };
}

describe("ReportHistoryView", () => {
  it("renders the reports empty state", () => {
    const html = renderToStaticMarkup(<ReportHistoryView reportRuns={[]} />);

    expect(html).toContain("No reports yet");
    expect(html).toContain("Generate a report from a ready portfolio");
    expect(html).toContain("href=\"/app/portfolios\"");
  });

  it("renders user-owned report rows with status links", () => {
    const html = renderToStaticMarkup(
      <ReportHistoryView
        reportRuns={[
          buildReportRun(),
          buildReportRun({
            runId: "44444444-4444-4444-8444-444444444444",
            status: "PROCESSING",
            completedAt: null
          })
        ]}
      />
    );

    expect(html).toContain("Report history");
    expect(html).toContain("Retirement Portfolio");
    expect(html).toContain("COMPLETED");
    expect(html).toContain("PROCESSING");
    expect(html).toContain("CAD");
    expect(html).toContain(`href="/app/reports/${TEST_RUN_ID}"`);
    expect(html).toContain(`href="/app/portfolios/${TEST_PORTFOLIO_ID}"`);
    expect(html).toContain("View status");
  });

  it("keeps failed report runs visible in history", () => {
    const failedRunId = "55555555-5555-4555-8555-555555555555";
    const html = renderToStaticMarkup(
      <ReportHistoryView
        reportRuns={[
          buildReportRun({
            runId: failedRunId,
            status: "FAILED",
            completedAt: null,
            failedAt: "2026-06-20T12:02:00.000Z",
            errorCode: "NARRATIVE_FAILURE"
          })
        ]}
      />
    );

    expect(html).toContain("FAILED");
    expect(html).toContain(`href="/app/reports/${failedRunId}"`);
    expect(html).toContain("View status");
  });
});

describe("ReportsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuthenticatedAppUser.mockResolvedValue({ id: TEST_USER_ID });
    mockListReportRunsForUser.mockResolvedValue({
      reportRuns: [buildReportRun()]
    });
  });

  it("loads report history for the authenticated user", async () => {
    const jsx = await ReportsPage();
    const html = renderToStaticMarkup(jsx);

    expect(mockRequireAuthenticatedAppUser).toHaveBeenCalled();
    expect(mockListReportRunsForUser).toHaveBeenCalledWith(TEST_USER_ID, {
      limit: 50
    });
    expect(html).toContain("Retirement Portfolio");
  });
});
