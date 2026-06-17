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

import PortfolioListPage, { PortfolioListView } from "@/app/app/portfolios/page";
import type { PortfolioSummaryResult } from "@/server/services/portfolio-service";

function buildPortfolio(overrides: Partial<PortfolioSummaryResult> = {}): PortfolioSummaryResult {
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

describe("PortfolioListView", () => {
  it("renders an empty state with create action", () => {
    const html = renderToStaticMarkup(
      <PortfolioListView portfolios={[]} notice={null} error={null} />
    );

    expect(html).toContain("No portfolios yet");
    expect(html).toContain("Create your first portfolio");
    expect(html).toContain("href=\"/app/portfolios/new\"");
  });

  it("renders portfolio rows with key summary fields", () => {
    const html = renderToStaticMarkup(
      <PortfolioListView portfolios={[buildPortfolio()]} notice="Portfolio updated." error={null} />
    );

    expect(html).toContain("Portfolio updated.");
    expect(html).toContain("Retirement");
    expect(html).toContain("Dividend and growth portfolio");
    expect(html).toContain("CAD");
    expect(html).toContain("2 holdings");
    expect(html).toContain("Ready for report");
    expect(html).toContain("Jan 2, 2026");
    expect(html).toContain(`href="/app/portfolios/${TEST_PORTFOLIO_ID}/edit"`);
  });
});

describe("PortfolioListPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuthenticatedUser.mockResolvedValue({ id: TEST_USER_ID });
    mockListPortfolios.mockResolvedValue({ portfolios: [buildPortfolio()] });
  });

  it("loads portfolios for the authenticated user", async () => {
    const jsx = await PortfolioListPage({
      searchParams: Promise.resolve({ status: "portfolio_created" })
    });
    const html = renderToStaticMarkup(jsx);

    expect(mockRequireAuthenticatedUser).toHaveBeenCalled();
    expect(mockListPortfolios).toHaveBeenCalledWith(TEST_USER_ID);
    expect(html).toContain("Portfolio created.");
    expect(html).toContain("Retirement");
  });
});
