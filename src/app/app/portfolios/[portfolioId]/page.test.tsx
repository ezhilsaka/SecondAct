import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const TEST_USER_ID = "11111111-1111-4111-8111-111111111111";
const TEST_PORTFOLIO_ID = "22222222-2222-4222-8222-222222222222";
const TEST_HOLDING_ID = "33333333-3333-4333-8333-333333333333";
const TEST_RUN_ID = "44444444-4444-4444-8444-444444444444";

const {
  mockGetPortfolioDetail,
  mockListReportRunsForUser,
  mockRequireAuthenticatedAppUser
} = vi.hoisted(() => ({
  mockGetPortfolioDetail: vi.fn(),
  mockListReportRunsForUser: vi.fn(),
  mockRequireAuthenticatedAppUser: vi.fn()
}));

vi.mock("@/server/auth/app-session", () => ({
  requireAuthenticatedAppUser: mockRequireAuthenticatedAppUser
}));

vi.mock("@/server/services/portfolio-service", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/server/services/portfolio-service")>();

  return {
    ...original,
    PortfolioService: class {
      getPortfolioDetail = mockGetPortfolioDetail;
    }
  };
});

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

import PortfolioDetailPage, { PortfolioDetailView } from "@/app/app/portfolios/[portfolioId]/page";
import type { PortfolioDetailResult } from "@/server/services/portfolio-service";
import type { ReportRunSummaryResult } from "@/server/services/report-run-service";

function buildPortfolioDetail(
  overrides: Partial<PortfolioDetailResult> = {}
): PortfolioDetailResult {
  const holdings = overrides.holdings ?? [
    {
      id: TEST_HOLDING_ID,
      portfolioId: TEST_PORTFOLIO_ID,
      ticker: "AAPL",
      securityName: "Apple Inc.",
      assetClass: "EQUITY",
      securityCurrency: "USD",
      quantity: "2.0000000000",
      averageCost: "101.25000000",
      estimatedCostBasis: "202.50000000",
      notes: "Core holding",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z"
    }
  ];

  return {
    id: TEST_PORTFOLIO_ID,
    name: "Retirement",
    description: "Dividend and growth portfolio",
    baseCurrency: "CAD",
    sourceType: "MANUAL",
    archivedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T12:00:00.000Z",
    holdingCount: holdings.length,
    readiness:
      holdings.length > 0
        ? {
            status: "READY_FOR_REPORT",
            label: "Ready for report",
            isReadyForReport: true
          }
        : {
            status: "NEEDS_HOLDINGS",
            label: "Needs holdings",
            isReadyForReport: false
          },
    holdings,
    ...overrides
  };
}

function buildReportRun(
  overrides: Partial<ReportRunSummaryResult> = {}
): ReportRunSummaryResult {
  return {
    runId: TEST_RUN_ID,
    portfolioId: TEST_PORTFOLIO_ID,
    portfolioName: "Retirement",
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

describe("PortfolioDetailView", () => {
  it("renders the not-ready state when there are no holdings", () => {
    const html = renderToStaticMarkup(
      <PortfolioDetailView
        portfolio={buildPortfolioDetail({ holdings: [] })}
        reportRuns={[]}
        notice={null}
        error={null}
      />
    );

    expect(html).toContain("Needs holdings");
    expect(html).toContain("Add at least one holding");
    expect(html).toContain("No holdings yet");
    expect(html).toContain("Add Holding");
    expect(html).toContain("Add holdings first");
    expect(html).toContain("View all reports for this portfolio");
    expect(html).toContain(`href="/app/reports?portfolioId=${TEST_PORTFOLIO_ID}"`);
    expect(html).not.toContain("Generate report");
    expect(html).not.toContain("report-runs");
  });

  it("renders holdings, lazy edit/remove toggles, and the ready generate action", () => {
    const html = renderToStaticMarkup(
      <PortfolioDetailView
        portfolio={buildPortfolioDetail()}
        reportRuns={[]}
        notice="Holding added."
        error="This ticker is already in the portfolio."
      />
    );

    expect(html).toContain("Holding added.");
    expect(html).toContain("This ticker is already in the portfolio.");
    expect(html).toContain("Ready for report");
    expect(html).toContain("AAPL");
    expect(html).toContain("Apple Inc.");
    expect(html).toContain("2");
    expect(html).toContain("101.25 USD");
    expect(html).toContain("202.5 USD");
    expect(html).toContain("Edit");
    expect(html).toContain("Remove");
    expect(html).not.toContain("Save Holding");
    expect(html).not.toContain("Remove Holding");
    expect(html).not.toContain('name="holdingId"');
    expect(html).toContain("Generate a portfolio report");
    expect(html).toContain("Generate report");
    expect(html).toContain('name="portfolioId"');
    expect(html).toContain(`value="${TEST_PORTFOLIO_ID}"`);
    expect(html).toContain('name="reportingCurrency"');
    expect(html).toContain("CAD");
    expect(html).not.toContain("market value");
    expect(html).not.toContain("Report generation comes next");
  });

  it("renders an active report preview link for the portfolio", () => {
    const html = renderToStaticMarkup(
      <PortfolioDetailView
        portfolio={buildPortfolioDetail()}
        reportRuns={[
          buildReportRun(),
          buildReportRun({
            runId: "55555555-5555-4555-8555-555555555555",
            status: "COMPLETED",
            requestedAt: "2026-06-19T12:00:00.000Z",
            completedAt: "2026-06-19T12:04:00.000Z"
          })
        ]}
        notice={null}
        error={null}
      />
    );

    expect(html).toContain("Report history");
    expect(html).toContain("A report is already in progress for this portfolio.");
    expect(html).toContain("View active report");
    expect(html).toContain("View all reports for this portfolio");
    expect(html).toContain(`href="/app/reports/${TEST_RUN_ID}"`);
    expect(html).toContain(`href="/app/reports?portfolioId=${TEST_PORTFOLIO_ID}"`);
    expect(html).toContain("QUEUED");
  });

  it("renders the latest completed report preview when no report is active", () => {
    const completedRunId = "55555555-5555-4555-8555-555555555555";
    const html = renderToStaticMarkup(
      <PortfolioDetailView
        portfolio={buildPortfolioDetail()}
        reportRuns={[
          buildReportRun({
            runId: completedRunId,
            status: "COMPLETED",
            requestedAt: "2026-06-20T12:00:00.000Z",
            completedAt: "2026-06-20T12:04:00.000Z"
          }),
          buildReportRun({
            runId: "66666666-6666-4666-8666-666666666666",
            status: "FAILED",
            requestedAt: "2026-06-19T12:00:00.000Z",
            failedAt: "2026-06-19T12:02:00.000Z"
          })
        ]}
        notice={null}
        error={null}
      />
    );

    expect(html).toContain("The latest completed report is ready to revisit.");
    expect(html).toContain("Open completed report");
    expect(html).toContain("Report details");
    expect(html).toContain("Open PDF");
    expect(html).toContain("Manage failed report");
    expect(html).toContain(`href="/app/reports/${completedRunId}"`);
    expect(html).toContain("FAILED");
  });
});

describe("PortfolioDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuthenticatedAppUser.mockResolvedValue({ id: TEST_USER_ID });
    mockGetPortfolioDetail.mockResolvedValue(buildPortfolioDetail());
    mockListReportRunsForUser.mockResolvedValue({
      reportRuns: []
    });
  });

  it("loads portfolio detail for the authenticated user", async () => {
    const jsx = await PortfolioDetailPage({
      params: Promise.resolve({ portfolioId: TEST_PORTFOLIO_ID }),
      searchParams: Promise.resolve({ status: "holding_updated" })
    });
    const html = renderToStaticMarkup(jsx);

    expect(mockRequireAuthenticatedAppUser).toHaveBeenCalled();
    expect(mockGetPortfolioDetail).toHaveBeenCalledWith({
      userId: TEST_USER_ID,
      portfolioId: TEST_PORTFOLIO_ID
    });
    expect(mockListReportRunsForUser).toHaveBeenCalledWith(TEST_USER_ID, {
      portfolioId: TEST_PORTFOLIO_ID,
      limit: 3
    });
    expect(html).toContain("Holding updated.");
    expect(html).toContain("Retirement");
  });
});
