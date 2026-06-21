import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const TEST_USER_ID = "11111111-1111-4111-8111-111111111111";
const TEST_PORTFOLIO_ID = "22222222-2222-4222-8222-222222222222";
const TEST_RUN_ID = "33333333-3333-4333-8333-333333333333";

const {
  mockGetDashboardSummary,
  mockListReportRunsForUser,
  mockRequireAuthenticatedAppUser
} = vi.hoisted(() => ({
  mockGetDashboardSummary: vi.fn(),
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
      getDashboardSummary = mockGetDashboardSummary;
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

import AppDashboardPage, { AppDashboardView } from "@/app/app/page";
import type { PortfolioSummaryResult } from "@/server/services/portfolio-service";
import type { ReportRunSummaryResult } from "@/server/services/report-run-service";

function buildPortfolio(
  overrides: Partial<PortfolioSummaryResult> = {}
): PortfolioSummaryResult {
  return {
    id: TEST_PORTFOLIO_ID,
    name: "Retirement",
    description: "Dividend and growth portfolio",
    baseCurrency: "CAD",
    sourceType: "MANUAL",
    archivedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T12:00:00.000Z",
    holdingCount: 2,
    readiness: {
      status: "READY_FOR_REPORT",
      label: "Ready for report",
      isReadyForReport: true
    },
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
    status: "COMPLETED",
    paymentStatus: "NOT_REQUIRED",
    reportingCurrency: "CAD",
    errorCode: null,
    requestedAt: "2026-06-20T12:00:00.000Z",
    startedAt: "2026-06-20T12:01:00.000Z",
    completedAt: "2026-06-20T12:04:00.000Z",
    failedAt: null,
    ...overrides
  };
}

describe("AppDashboardView", () => {
  it("renders an empty portfolio state with create link", () => {
    const html = renderToStaticMarkup(
      <AppDashboardView portfolioCount={0} latestPortfolio={null} latestReport={null} />
    );

    expect(html).toContain("Portfolio management is live");
    expect(html).toContain("0 portfolios in this workspace");
    expect(html).toContain("No portfolios yet");
    expect(html).toContain("Create your first portfolio");
    expect(html).toContain("href=\"/app/portfolios/new\"");
    expect(html).toContain("Create Portfolio");
    expect(html).toContain("Report generation is live");
    expect(html).toContain("No reports yet");
    expect(html).toContain("Create a portfolio and add holdings before reports appear here.");
    expect(html).not.toContain("Report generation comes next");
  });

  it("renders portfolio count, latest portfolio, and portfolio list link", () => {
    const html = renderToStaticMarkup(
      <AppDashboardView
        portfolioCount={2}
        latestPortfolio={buildPortfolio()}
        latestReport={null}
      />
    );

    expect(html).toContain("2 portfolios in this workspace");
    expect(html).toContain("Latest portfolio");
    expect(html).toContain("Retirement");
    expect(html).toContain("2 holdings");
    expect(html).toContain("Ready for report");
    expect(html).toContain("Jan 2, 2026");
    expect(html).toContain(`href="/app/portfolios/${TEST_PORTFOLIO_ID}"`);
    expect(html).toContain("href=\"/app/portfolios\"");
    expect(html).toContain("View Portfolios");
    expect(html).toContain("Open a ready portfolio to generate your first report.");
  });

  it("renders the latest report summary when reports exist", () => {
    const html = renderToStaticMarkup(
      <AppDashboardView
        portfolioCount={2}
        latestPortfolio={buildPortfolio()}
        latestReport={buildReportRun()}
      />
    );

    expect(html).toContain("Latest report");
    expect(html).toContain("Retirement");
    expect(html).toContain("COMPLETED");
    expect(html).toContain("CAD");
    expect(html).toContain("Jun 20, 2026");
    expect(html).toContain(`href="/app/reports/${TEST_RUN_ID}"`);
    expect(html).toContain('href="/app/reports"');
  });
});

describe("AppDashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuthenticatedAppUser.mockResolvedValue({ id: TEST_USER_ID });
    mockGetDashboardSummary.mockResolvedValue({
      portfolioCount: 1,
      latestPortfolio: buildPortfolio()
    });
    mockListReportRunsForUser.mockResolvedValue({
      reportRuns: [buildReportRun()]
    });
  });

  it("loads dashboard portfolio and latest report summaries for the authenticated user", async () => {
    const jsx = await AppDashboardPage();
    const html = renderToStaticMarkup(jsx);

    expect(mockRequireAuthenticatedAppUser).toHaveBeenCalled();
    expect(mockGetDashboardSummary).toHaveBeenCalledWith(TEST_USER_ID);
    expect(mockListReportRunsForUser).toHaveBeenCalledWith(TEST_USER_ID, {
      limit: 1
    });
    expect(html).toContain("Retirement");
  });
});
