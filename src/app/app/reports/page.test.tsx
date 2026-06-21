import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const TEST_USER_ID = "11111111-1111-4111-8111-111111111111";
const TEST_PORTFOLIO_ID = "22222222-2222-4222-8222-222222222222";
const TEST_RUN_ID = "33333333-3333-4333-8333-333333333333";

const {
  mockListReportRunsForUser,
  mockNotFound,
  mockRequireAuthenticatedAppUser
} = vi.hoisted(() => ({
  mockListReportRunsForUser: vi.fn(),
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
      listReportRunsForUser = mockListReportRunsForUser;
    }
  };
});

import ReportsPage, { ReportHistoryView } from "@/app/app/reports/page";
import {
  PortfolioNotFoundError,
  type ReportRunSummaryResult
} from "@/server/services/report-run-service";

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

function renderHistoryView({
  reportRuns = [],
  summaryReportRuns = reportRuns,
  filters = {},
  currentPath = "/app/reports",
  actionMessage
}: Partial<Parameters<typeof ReportHistoryView>[0]> = {}) {
  return renderToStaticMarkup(
    <ReportHistoryView
      reportRuns={reportRuns}
      summaryReportRuns={summaryReportRuns}
      filters={filters}
      currentPath={currentPath}
      actionMessage={actionMessage}
    />
  );
}

describe("ReportHistoryView", () => {
  it("renders the empty report library next step", () => {
    const html = renderHistoryView();

    expect(html).toContain("Report library");
    expect(html).toContain("No reports yet");
    expect(html).toContain("Generate a report from a ready portfolio");
    expect(html).toContain("href=\"/app/portfolios\"");
  });

  it("renders summary counts and preserves selected filter search params", () => {
    const html = renderHistoryView({
      reportRuns: [buildReportRun()],
      summaryReportRuns: [
        buildReportRun(),
        buildReportRun({
          runId: "44444444-4444-4444-8444-444444444444",
          status: "PROCESSING",
          completedAt: null
        }),
        buildReportRun({
          runId: "55555555-5555-4555-8555-555555555555",
          status: "FAILED",
          completedAt: null,
          failedAt: "2026-06-20T12:05:00.000Z"
        })
      ],
      filters: {
        status: "COMPLETED",
        reportingCurrency: "CAD",
        portfolioId: TEST_PORTFOLIO_ID
      },
      currentPath: `/app/reports?portfolioId=${TEST_PORTFOLIO_ID}&status=COMPLETED&reportingCurrency=CAD`
    });

    expect(html).toContain("Active");
    expect(html).toContain("Completed");
    expect(html).toContain("Failed");
    expect(html).toContain('name="status"');
    expect(html).toContain('value="COMPLETED" selected=""');
    expect(html).toContain('name="reportingCurrency"');
    expect(html).toContain('value="CAD" selected=""');
    expect(html).toContain(`name="portfolioId" value="${TEST_PORTFOLIO_ID}"`);
    expect(html).toContain("Portfolio scope active");
    expect(html).toContain(`href="/app/reports?portfolioId=${TEST_PORTFOLIO_ID}"`);
  });

  it("shows direct actions for completed report rows", () => {
    const html = renderHistoryView({
      reportRuns: [buildReportRun()],
      currentPath: "/app/reports?status=COMPLETED"
    });

    expect(html).toContain("Retirement Portfolio");
    expect(html).toContain("Report details");
    expect(html).toContain("Open PDF");
    expect(html).toContain("Generate fresh report");
    expect(html).toContain("Delete report");
    expect(html).toContain(`href="/app/reports/${TEST_RUN_ID}"`);
    expect(html).toContain(`href="/app/portfolios/${TEST_PORTFOLIO_ID}"`);
    expect(html).toContain('name="returnTo" value="/app/reports?status=COMPLETED"');
  });

  it("shows retry and delete actions for failed rows", () => {
    const failedRunId = "55555555-5555-4555-8555-555555555555";
    const html = renderHistoryView({
      reportRuns: [
        buildReportRun({
          runId: failedRunId,
          status: "FAILED",
          completedAt: null,
          failedAt: "2026-06-20T12:02:00.000Z",
          errorCode: "NARRATIVE_FAILURE"
        })
      ],
      currentPath: "/app/reports?status=FAILED"
    });

    expect(html).toContain("FAILED");
    expect(html).toContain("Retry report");
    expect(html).toContain("Delete report");
    expect(html).toContain(`href="/app/reports/${failedRunId}"`);
    expect(html).toContain('name="retrySourceRunId"');
  });

  it("keeps active rows visible without terminal management actions", () => {
    const html = renderHistoryView({
      reportRuns: [
        buildReportRun({
          status: "PROCESSING",
          completedAt: null
        })
      ]
    });

    expect(html).toContain("PROCESSING");
    expect(html).toContain("View status");
    expect(html).toContain("Management unlocks after this run finishes.");
    expect(html).not.toContain("Delete report");
    expect(html).not.toContain("Open PDF");
    expect(html).not.toContain("Generate fresh report");
  });

  it("renders a filtered empty state when reports exist but none match", () => {
    const html = renderHistoryView({
      reportRuns: [],
      summaryReportRuns: [buildReportRun()],
      filters: {
        status: "FAILED"
      },
      currentPath: "/app/reports?status=FAILED"
    });

    expect(html).toContain("No matching reports");
    expect(html).toContain("No reports match these filters");
    expect(html).toContain('href="/app/reports"');
  });

  it("does not render raw pipeline or storage details", () => {
    const html = renderHistoryView({
      reportRuns: [
        buildReportRun({
          status: "FAILED",
          completedAt: null,
          failedAt: "2026-06-20T12:02:00.000Z",
          errorCode: "ANALYSIS_FAILURE"
        })
      ]
    });

    expect(html).not.toContain("canonicalSnapshot");
    expect(html).not.toContain("analysisOutput");
    expect(html).not.toContain("narrativeOutput");
    expect(html).not.toContain("storageBucket");
    expect(html).not.toContain("ANALYSIS_FAILURE");
  });

  it("renders friendly action feedback", () => {
    const html = renderHistoryView({
      actionMessage: {
        tone: "success",
        text: "Report deleted."
      }
    });

    expect(html).toContain("Report deleted.");
    expect(html).toContain('role="status"');
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

  it("loads the report library for the authenticated user", async () => {
    const jsx = await ReportsPage();
    const html = renderToStaticMarkup(jsx);

    expect(mockRequireAuthenticatedAppUser).toHaveBeenCalled();
    expect(mockListReportRunsForUser).toHaveBeenCalledTimes(1);
    expect(mockListReportRunsForUser).toHaveBeenCalledWith(TEST_USER_ID, {
      limit: 50
    });
    expect(html).toContain("Retirement Portfolio");
  });

  it("passes URL filters to the report-list service", async () => {
    mockListReportRunsForUser
      .mockResolvedValueOnce({ reportRuns: [buildReportRun()] })
      .mockResolvedValueOnce({ reportRuns: [buildReportRun()] });

    const jsx = await ReportsPage({
      searchParams: Promise.resolve({
        portfolioId: TEST_PORTFOLIO_ID,
        status: "completed",
        reportingCurrency: "cad"
      })
    });
    const html = renderToStaticMarkup(jsx);

    expect(mockListReportRunsForUser).toHaveBeenNthCalledWith(1, TEST_USER_ID, {
      limit: 50,
      portfolioId: TEST_PORTFOLIO_ID
    });
    expect(mockListReportRunsForUser).toHaveBeenNthCalledWith(2, TEST_USER_ID, {
      limit: 50,
      portfolioId: TEST_PORTFOLIO_ID,
      status: "COMPLETED",
      reportingCurrency: "CAD"
    });
    expect(html).toContain("Report library");
  });

  it("returns not found when a portfolio-scoped library cannot be accessed", async () => {
    mockListReportRunsForUser.mockRejectedValue(
      new PortfolioNotFoundError("Portfolio not found.")
    );

    await expect(
      ReportsPage({
        searchParams: Promise.resolve({
          portfolioId: TEST_PORTFOLIO_ID
        })
      })
    ).rejects.toThrow("NOT_FOUND");

    expect(mockNotFound).toHaveBeenCalled();
  });
});
