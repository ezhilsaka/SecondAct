import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import {
  buildPortfolioReadiness,
  DuplicateHoldingTickerError,
  HoldingNotFoundError,
  PortfolioArchivedError,
  PortfolioNotFoundError,
  type PortfolioRepository,
  PortfolioService
} from "@/server/services/portfolio-service";

const TEST_USER_ID = "11111111-1111-4111-8111-111111111111";
const TEST_PORTFOLIO_ID = "22222222-2222-4222-8222-222222222222";
const TEST_HOLDING_ID = "33333333-3333-4333-8333-333333333333";
const OTHER_HOLDING_ID = "44444444-4444-4444-8444-444444444444";
const NOW = new Date("2026-06-16T10:30:00.000Z");

function buildMockRepository(overrides: Partial<PortfolioRepository> = {}): PortfolioRepository {
  return {
    listActivePortfolios: vi.fn().mockResolvedValue([]),
    getPortfolioStatusByIdAndUser: vi
      .fn()
      .mockResolvedValue({ id: TEST_PORTFOLIO_ID, archivedAt: null }),
    getActivePortfolioDetail: vi.fn().mockResolvedValue(buildPortfolioDetailRow()),
    createPortfolio: vi.fn().mockImplementation(async (input) =>
      buildPortfolioDetailRow({
        name: input.name,
        description: input.description,
        baseCurrency: input.baseCurrency,
        holdings: []
      })
    ),
    updatePortfolio: vi.fn().mockImplementation(async (input) =>
      buildPortfolioDetailRow({
        name: input.name ?? "Retirement",
        description: input.description === undefined ? "Long term" : input.description,
        baseCurrency: input.baseCurrency ?? "CAD"
      })
    ),
    archivePortfolio: vi.fn().mockResolvedValue({ id: TEST_PORTFOLIO_ID, archivedAt: NOW }),
    findHoldingByTicker: vi.fn().mockResolvedValue(null),
    findHoldingById: vi.fn().mockResolvedValue(buildHoldingRow()),
    createHolding: vi.fn().mockImplementation(async (input) =>
      buildHoldingRow({
        ticker: input.ticker,
        securityName: input.securityName,
        securityCurrency: input.securityCurrency,
        quantity: input.quantity,
        averageCost: input.averageCost,
        notes: input.notes
      })
    ),
    updateHolding: vi.fn().mockImplementation(async (input) =>
      buildHoldingRow({
        ticker: input.ticker ?? "AAPL",
        securityName: input.securityName === undefined ? "Apple Inc." : input.securityName,
        securityCurrency: input.securityCurrency ?? "USD",
        quantity: input.quantity ?? "2",
        averageCost: input.averageCost ?? "101.25",
        notes: input.notes === undefined ? "Core holding" : input.notes
      })
    ),
    removeHolding: vi.fn().mockResolvedValue(undefined),
    ...overrides
  };
}

function buildPortfolioSummaryRow(overrides: Record<string, unknown> = {}) {
  return {
    id: TEST_PORTFOLIO_ID,
    userId: TEST_USER_ID,
    name: "Retirement",
    description: "Long term",
    baseCurrency: "CAD",
    sourceType: "MANUAL",
    archivedAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    _count: {
      holdings: 1
    },
    ...overrides
  };
}

function buildPortfolioDetailRow(overrides: Record<string, unknown> = {}) {
  return {
    ...buildPortfolioSummaryRow(),
    holdings: [buildHoldingRow()],
    ...overrides
  };
}

function buildHoldingRow(overrides: Record<string, unknown> = {}) {
  return {
    id: TEST_HOLDING_ID,
    userId: TEST_USER_ID,
    portfolioId: TEST_PORTFOLIO_ID,
    ticker: "AAPL",
    securityName: "Apple Inc.",
    assetClass: "EQUITY",
    securityCurrency: "USD",
    quantity: new Prisma.Decimal("2"),
    averageCost: new Prisma.Decimal("101.25"),
    notes: "Core holding",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    ...overrides
  };
}

describe("buildPortfolioReadiness", () => {
  it("marks empty portfolios as needing holdings", () => {
    expect(buildPortfolioReadiness(0)).toEqual({
      status: "NEEDS_HOLDINGS",
      label: "Needs holdings",
      isReadyForReport: false
    });
  });

  it("marks portfolios with holdings as ready for a future report", () => {
    expect(buildPortfolioReadiness(1)).toEqual({
      status: "READY_FOR_REPORT",
      label: "Ready for report",
      isReadyForReport: true
    });
  });
});

describe("PortfolioService", () => {
  it("lists active portfolios for the authenticated user only", async () => {
    const repository = buildMockRepository({
      listActivePortfolios: vi
        .fn()
        .mockResolvedValue([buildPortfolioSummaryRow({ _count: { holdings: 0 } })])
    });
    const service = new PortfolioService({ repository });

    const result = await service.listPortfolios(TEST_USER_ID);

    expect(repository.listActivePortfolios).toHaveBeenCalledWith(TEST_USER_ID);
    expect(result).toEqual({
      portfolios: [
        expect.objectContaining({
          id: TEST_PORTFOLIO_ID,
          holdingCount: 0,
          readiness: expect.objectContaining({ status: "NEEDS_HOLDINGS" })
        })
      ]
    });
  });

  it("creates a portfolio with normalized text and no holdings", async () => {
    const repository = buildMockRepository();
    const service = new PortfolioService({ repository });

    const result = await service.createPortfolio({
      userId: TEST_USER_ID,
      name: "  Long   Term  ",
      description: "  Dividends   and   growth  ",
      baseCurrency: "CAD"
    });

    expect(repository.createPortfolio).toHaveBeenCalledWith({
      userId: TEST_USER_ID,
      name: "Long Term",
      description: "Dividends and growth",
      baseCurrency: "CAD"
    });
    expect(result).toEqual(
      expect.objectContaining({
        name: "Long Term",
        description: "Dividends and growth",
        holdingCount: 0,
        readiness: expect.objectContaining({ status: "NEEDS_HOLDINGS" }),
        holdings: []
      })
    );
  });

  it("returns detail with decimal strings and estimated cost basis", async () => {
    const repository = buildMockRepository();
    const service = new PortfolioService({ repository });

    const result = await service.getPortfolioDetail({
      userId: TEST_USER_ID,
      portfolioId: TEST_PORTFOLIO_ID
    });

    expect(result).toEqual(
      expect.objectContaining({
        id: TEST_PORTFOLIO_ID,
        holdingCount: 1,
        readiness: expect.objectContaining({ status: "READY_FOR_REPORT" }),
        holdings: [
          expect.objectContaining({
            ticker: "AAPL",
            quantity: "2.0000000000",
            averageCost: "101.25000000",
            estimatedCostBasis: "202.50000000"
          })
        ]
      })
    );
  });

  it("throws not found when a portfolio is missing or not owned", async () => {
    const repository = buildMockRepository({
      getActivePortfolioDetail: vi.fn().mockResolvedValue(null),
      getPortfolioStatusByIdAndUser: vi.fn().mockResolvedValue(null)
    });
    const service = new PortfolioService({ repository });

    await expect(
      service.getPortfolioDetail({ userId: TEST_USER_ID, portfolioId: TEST_PORTFOLIO_ID })
    ).rejects.toThrow(PortfolioNotFoundError);
  });

  it("throws archived when an archived portfolio is requested", async () => {
    const repository = buildMockRepository({
      getActivePortfolioDetail: vi.fn().mockResolvedValue(null),
      getPortfolioStatusByIdAndUser: vi
        .fn()
        .mockResolvedValue({ id: TEST_PORTFOLIO_ID, archivedAt: NOW })
    });
    const service = new PortfolioService({ repository });

    await expect(
      service.getPortfolioDetail({ userId: TEST_USER_ID, portfolioId: TEST_PORTFOLIO_ID })
    ).rejects.toThrow(PortfolioArchivedError);
  });

  it("archives an active portfolio with the injected clock", async () => {
    const repository = buildMockRepository();
    const service = new PortfolioService({ repository, now: () => NOW });

    const result = await service.archivePortfolio({
      userId: TEST_USER_ID,
      portfolioId: TEST_PORTFOLIO_ID
    });

    expect(repository.archivePortfolio).toHaveBeenCalledWith(TEST_PORTFOLIO_ID, NOW);
    expect(result).toEqual({
      portfolioId: TEST_PORTFOLIO_ID,
      archivedAt: "2026-06-16T10:30:00.000Z"
    });
  });

  it("adds a holding after normalizing ticker and nullable text", async () => {
    const repository = buildMockRepository();
    const service = new PortfolioService({ repository });

    const result = await service.addHolding({
      userId: TEST_USER_ID,
      portfolioId: TEST_PORTFOLIO_ID,
      ticker: " aapl ",
      securityName: "  Apple   Inc. ",
      securityCurrency: "USD",
      quantity: "2",
      averageCost: "101.25",
      notes: ""
    });

    expect(repository.getPortfolioStatusByIdAndUser).toHaveBeenCalledWith(
      TEST_USER_ID,
      TEST_PORTFOLIO_ID
    );
    expect(repository.findHoldingByTicker).toHaveBeenCalledWith(
      TEST_USER_ID,
      TEST_PORTFOLIO_ID,
      "AAPL"
    );
    expect(repository.createHolding).toHaveBeenCalledWith({
      userId: TEST_USER_ID,
      portfolioId: TEST_PORTFOLIO_ID,
      ticker: "AAPL",
      securityName: "Apple Inc.",
      securityCurrency: "USD",
      quantity: "2",
      averageCost: "101.25",
      notes: null
    });
    expect(result).toEqual(
      expect.objectContaining({
        ticker: "AAPL",
        notes: null,
        estimatedCostBasis: "202.50000000"
      })
    );
  });

  it("rejects duplicate ticker adds before relying on the database", async () => {
    const repository = buildMockRepository({
      findHoldingByTicker: vi.fn().mockResolvedValue(buildHoldingRow())
    });
    const service = new PortfolioService({ repository });

    await expect(
      service.addHolding({
        userId: TEST_USER_ID,
        portfolioId: TEST_PORTFOLIO_ID,
        ticker: "AAPL",
        securityName: "Apple Inc.",
        securityCurrency: "USD",
        quantity: "2",
        averageCost: "101.25",
        notes: null
      })
    ).rejects.toThrow(DuplicateHoldingTickerError);

    expect(repository.createHolding).not.toHaveBeenCalled();
  });

  it("updates a holding and checks duplicate ticker only when the ticker changes", async () => {
    const repository = buildMockRepository({
      findHoldingById: vi.fn().mockResolvedValue(buildHoldingRow({ ticker: "AAPL" }))
    });
    const service = new PortfolioService({ repository });

    await service.updateHolding({
      userId: TEST_USER_ID,
      portfolioId: TEST_PORTFOLIO_ID,
      holdingId: TEST_HOLDING_ID,
      ticker: "AAPL",
      notes: "  Rebalanced  "
    });

    expect(repository.findHoldingByTicker).not.toHaveBeenCalled();
    expect(repository.updateHolding).toHaveBeenCalledWith({
      holdingId: TEST_HOLDING_ID,
      ticker: "AAPL",
      securityName: undefined,
      securityCurrency: undefined,
      quantity: undefined,
      averageCost: undefined,
      notes: "Rebalanced"
    });
  });

  it("rejects holding updates when the holding is missing or not owned", async () => {
    const repository = buildMockRepository({
      findHoldingById: vi.fn().mockResolvedValue(null)
    });
    const service = new PortfolioService({ repository });

    await expect(
      service.updateHolding({
        userId: TEST_USER_ID,
        portfolioId: TEST_PORTFOLIO_ID,
        holdingId: OTHER_HOLDING_ID,
        notes: "Nope"
      })
    ).rejects.toThrow(HoldingNotFoundError);
  });

  it("removes an owned holding from an active portfolio", async () => {
    const repository = buildMockRepository();
    const service = new PortfolioService({ repository });

    const result = await service.removeHolding({
      userId: TEST_USER_ID,
      portfolioId: TEST_PORTFOLIO_ID,
      holdingId: TEST_HOLDING_ID
    });

    expect(repository.removeHolding).toHaveBeenCalledWith(TEST_HOLDING_ID);
    expect(result).toEqual({ holdingId: TEST_HOLDING_ID, removed: true });
  });
});
