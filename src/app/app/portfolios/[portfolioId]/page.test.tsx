import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const TEST_USER_ID = "11111111-1111-4111-8111-111111111111";
const TEST_PORTFOLIO_ID = "22222222-2222-4222-8222-222222222222";
const TEST_HOLDING_ID = "33333333-3333-4333-8333-333333333333";

const { mockGetPortfolioDetail, mockRequireAuthenticatedUser } = vi.hoisted(() => ({
  mockGetPortfolioDetail: vi.fn(),
  mockRequireAuthenticatedUser: vi.fn()
}));

vi.mock("@/server/auth/supabase-server", () => ({
  requireAuthenticatedUser: mockRequireAuthenticatedUser
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

import PortfolioDetailPage, { PortfolioDetailView } from "@/app/app/portfolios/[portfolioId]/page";
import type { PortfolioDetailResult } from "@/server/services/portfolio-service";

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

describe("PortfolioDetailView", () => {
  it("renders the not-ready state when there are no holdings", () => {
    const html = renderToStaticMarkup(
      <PortfolioDetailView
        portfolio={buildPortfolioDetail({ holdings: [] })}
        notice={null}
        error={null}
      />
    );

    expect(html).toContain("Needs holdings");
    expect(html).toContain("Add at least one holding");
    expect(html).toContain("No holdings yet");
    expect(html).toContain("Add Holding");
    expect(html).toContain("Report generation comes next");
    expect(html).not.toContain("report-runs");
  });

  it("renders holdings, edit/remove flows, and the ready placeholder action", () => {
    const html = renderToStaticMarkup(
      <PortfolioDetailView
        portfolio={buildPortfolioDetail()}
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
    expect(html).toContain("Remove Holding");
    expect(html).toContain("disabled");
    expect(html).not.toContain("market value");
  });
});

describe("PortfolioDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuthenticatedUser.mockResolvedValue({ id: TEST_USER_ID });
    mockGetPortfolioDetail.mockResolvedValue(buildPortfolioDetail());
  });

  it("loads portfolio detail for the authenticated user", async () => {
    const jsx = await PortfolioDetailPage({
      params: Promise.resolve({ portfolioId: TEST_PORTFOLIO_ID }),
      searchParams: Promise.resolve({ status: "holding_updated" })
    });
    const html = renderToStaticMarkup(jsx);

    expect(mockRequireAuthenticatedUser).toHaveBeenCalled();
    expect(mockGetPortfolioDetail).toHaveBeenCalledWith({
      userId: TEST_USER_ID,
      portfolioId: TEST_PORTFOLIO_ID
    });
    expect(html).toContain("Holding updated.");
    expect(html).toContain("Retirement");
  });
});
