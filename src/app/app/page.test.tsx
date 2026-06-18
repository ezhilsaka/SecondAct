import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const TEST_USER_ID = "11111111-1111-4111-8111-111111111111";
const TEST_PORTFOLIO_ID = "22222222-2222-4222-8222-222222222222";

const { mockListPortfolios, mockRequireAuthenticatedUser } = vi.hoisted(() => ({
  mockListPortfolios: vi.fn(),
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
      listPortfolios = mockListPortfolios;
    }
  };
});

import AppDashboardPage, { AppDashboardView } from "@/app/app/page";
import type { PortfolioSummaryResult } from "@/server/services/portfolio-service";

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

describe("AppDashboardView", () => {
  it("renders an empty portfolio state with create link", () => {
    const html = renderToStaticMarkup(<AppDashboardView portfolios={[]} />);

    expect(html).toContain("Portfolio management is live");
    expect(html).toContain("0 portfolios in this workspace");
    expect(html).toContain("No portfolios yet");
    expect(html).toContain("Create your first portfolio");
    expect(html).toContain("href=\"/app/portfolios/new\"");
    expect(html).toContain("Create Portfolio");
    expect(html).toContain("Report generation comes next");
  });

  it("renders portfolio count, latest portfolio, and portfolio list link", () => {
    const html = renderToStaticMarkup(
      <AppDashboardView
        portfolios={[
          buildPortfolio(),
          buildPortfolio({
            id: "44444444-4444-4444-8444-444444444444",
            name: "Income",
            updatedAt: "2026-01-01T12:00:00.000Z"
          })
        ]}
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
  });
});

describe("AppDashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuthenticatedUser.mockResolvedValue({ id: TEST_USER_ID });
    mockListPortfolios.mockResolvedValue({ portfolios: [buildPortfolio()] });
  });

  it("loads portfolios for the authenticated user", async () => {
    const jsx = await AppDashboardPage();
    const html = renderToStaticMarkup(jsx);

    expect(mockRequireAuthenticatedUser).toHaveBeenCalled();
    expect(mockListPortfolios).toHaveBeenCalledWith(TEST_USER_ID);
    expect(html).toContain("Retirement");
  });
});
