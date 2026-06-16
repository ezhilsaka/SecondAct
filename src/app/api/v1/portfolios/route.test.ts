import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import {
  DuplicateHoldingTickerError,
  PortfolioArchivedError,
  PortfolioNotFoundError
} from "@/server/services/portfolio-service";

const TEST_USER_ID = "11111111-1111-4111-8111-111111111111";
const SPOOFED_USER_ID = "99999999-9999-4999-8999-999999999999";
const TEST_PORTFOLIO_ID = "22222222-2222-4222-8222-222222222222";
const TEST_HOLDING_ID = "33333333-3333-4333-8333-333333333333";

const {
  mockAddHolding,
  mockArchivePortfolio,
  mockCreatePortfolio,
  mockGetAuthenticatedApiUserId,
  mockGetPortfolioDetail,
  mockListPortfolios,
  mockRemoveHolding,
  mockUpdateHolding,
  mockUpdatePortfolio
} = vi.hoisted(() => ({
  mockAddHolding: vi.fn(),
  mockArchivePortfolio: vi.fn(),
  mockCreatePortfolio: vi.fn(),
  mockGetAuthenticatedApiUserId: vi.fn(),
  mockGetPortfolioDetail: vi.fn(),
  mockListPortfolios: vi.fn(),
  mockRemoveHolding: vi.fn(),
  mockUpdateHolding: vi.fn(),
  mockUpdatePortfolio: vi.fn()
}));

vi.mock("@/server/auth/api-auth", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/server/auth/api-auth")>();
  return {
    ...original,
    getAuthenticatedApiUserId: mockGetAuthenticatedApiUserId
  };
});

vi.mock("@/server/services/portfolio-service", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/server/services/portfolio-service")>();
  return {
    ...original,
    PortfolioService: class {
      addHolding = mockAddHolding;
      archivePortfolio = mockArchivePortfolio;
      createPortfolio = mockCreatePortfolio;
      getPortfolioDetail = mockGetPortfolioDetail;
      listPortfolios = mockListPortfolios;
      removeHolding = mockRemoveHolding;
      updateHolding = mockUpdateHolding;
      updatePortfolio = mockUpdatePortfolio;
    }
  };
});

import {
  GET as listPortfolios,
  POST as createPortfolio
} from "@/app/api/v1/portfolios/route";
import {
  DELETE as archivePortfolio,
  GET as getPortfolioDetail,
  PATCH as updatePortfolio
} from "@/app/api/v1/portfolios/[portfolioId]/route";
import { POST as addHolding } from "@/app/api/v1/portfolios/[portfolioId]/holdings/route";
import {
  DELETE as removeHolding,
  PATCH as updateHolding
} from "@/app/api/v1/portfolios/[portfolioId]/holdings/[holdingId]/route";

function buildJsonRequest(
  path: string,
  method: string,
  body: unknown,
  headers: Record<string, string> = {}
) {
  return new Request(`http://localhost${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers
    },
    body: JSON.stringify(body)
  });
}

function buildRawRequest(path: string, method: string, body: string) {
  return new Request(`http://localhost${path}`, {
    method,
    headers: {
      "Content-Type": "application/json"
    },
    body
  });
}

function buildGetRequest(path: string, headers: Record<string, string> = {}) {
  return new Request(`http://localhost${path}`, { method: "GET", headers });
}

function buildPortfolioParams(portfolioId: string = TEST_PORTFOLIO_ID) {
  return { params: Promise.resolve({ portfolioId }) };
}

function buildHoldingParams(
  portfolioId: string = TEST_PORTFOLIO_ID,
  holdingId: string = TEST_HOLDING_ID
) {
  return { params: Promise.resolve({ portfolioId, holdingId }) };
}

const portfolioSummary = {
  id: TEST_PORTFOLIO_ID,
  name: "Retirement",
  description: null,
  baseCurrency: "CAD",
  sourceType: "MANUAL",
  archivedAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
  holdingCount: 0,
  readiness: {
    status: "NEEDS_HOLDINGS",
    label: "Needs holdings",
    isReadyForReport: false
  }
};

const holdingResult = {
  id: TEST_HOLDING_ID,
  portfolioId: TEST_PORTFOLIO_ID,
  ticker: "AAPL",
  securityName: "Apple Inc.",
  assetClass: "EQUITY",
  securityCurrency: "USD",
  quantity: "2.0000000000",
  averageCost: "101.25000000",
  estimatedCostBasis: "202.50000000",
  notes: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z"
};

describe("/api/v1/portfolios routes", () => {
  beforeEach(() => {
    vi.resetAllMocks();

    mockGetAuthenticatedApiUserId.mockResolvedValue(TEST_USER_ID);
    mockListPortfolios.mockResolvedValue({ portfolios: [portfolioSummary] });
    mockCreatePortfolio.mockResolvedValue({ ...portfolioSummary, holdings: [] });
    mockGetPortfolioDetail.mockResolvedValue({
      ...portfolioSummary,
      holdings: [holdingResult],
      holdingCount: 1,
      readiness: {
        status: "READY_FOR_REPORT",
        label: "Ready for report",
        isReadyForReport: true
      }
    });
    mockUpdatePortfolio.mockResolvedValue({ ...portfolioSummary, name: "Income", holdings: [] });
    mockArchivePortfolio.mockResolvedValue({
      portfolioId: TEST_PORTFOLIO_ID,
      archivedAt: "2026-06-16T10:30:00.000Z"
    });
    mockAddHolding.mockResolvedValue(holdingResult);
    mockUpdateHolding.mockResolvedValue({ ...holdingResult, notes: "Rebalanced" });
    mockRemoveHolding.mockResolvedValue({ holdingId: TEST_HOLDING_ID, removed: true });
  });

  it("returns 401 without an authenticated session", async () => {
    mockGetAuthenticatedApiUserId.mockResolvedValue(null);

    const response = await listPortfolios();

    expect(response.status).toBe(401);
    expect(mockListPortfolios).not.toHaveBeenCalled();
    const json = await response.json();
    expect(json.error.code).toBe("UNAUTHORIZED");
  });

  it("lists portfolios for the authenticated user", async () => {
    const response = await listPortfolios();

    expect(response.status).toBe(200);
    expect(mockListPortfolios).toHaveBeenCalledWith(TEST_USER_ID);
    await expect(response.json()).resolves.toEqual({ portfolios: [portfolioSummary] });
  });

  it("creates a portfolio and ignores spoofed user input", async () => {
    const response = await createPortfolio(
      buildJsonRequest(
        "/api/v1/portfolios",
        "POST",
        {
          userId: SPOOFED_USER_ID,
          name: "Retirement",
          baseCurrency: "CAD"
        },
        { "x-user-id": SPOOFED_USER_ID }
      )
    );

    expect(response.status).toBe(201);
    expect(mockCreatePortfolio).toHaveBeenCalledWith({
      userId: TEST_USER_ID,
      name: "Retirement",
      baseCurrency: "CAD"
    });
  });

  it("returns 400 for invalid JSON bodies", async () => {
    const response = await createPortfolio(
      buildRawRequest("/api/v1/portfolios", "POST", "not-json")
    );

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error.code).toBe("INVALID_BODY");
  });

  it("maps validation failures to 400", async () => {
    mockCreatePortfolio.mockImplementation(() => z.object({ name: z.string() }).parse({}));

    const response = await createPortfolio(
      buildJsonRequest("/api/v1/portfolios", "POST", { baseCurrency: "CAD" })
    );

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns portfolio detail for the authenticated user", async () => {
    const response = await getPortfolioDetail(
      buildGetRequest(`/api/v1/portfolios/${TEST_PORTFOLIO_ID}`),
      buildPortfolioParams()
    );

    expect(response.status).toBe(200);
    expect(mockGetPortfolioDetail).toHaveBeenCalledWith({
      userId: TEST_USER_ID,
      portfolioId: TEST_PORTFOLIO_ID
    });
    const json = await response.json();
    expect(json.holdings).toEqual([holdingResult]);
  });

  it("returns 404 when the portfolio is missing or not owned", async () => {
    mockGetPortfolioDetail.mockRejectedValue(new PortfolioNotFoundError("Portfolio not found"));

    const response = await getPortfolioDetail(
      buildGetRequest(`/api/v1/portfolios/${TEST_PORTFOLIO_ID}`),
      buildPortfolioParams()
    );

    expect(response.status).toBe(404);
    const json = await response.json();
    expect(json.error.code).toBe("PORTFOLIO_NOT_FOUND");
  });

  it("updates portfolio metadata", async () => {
    const response = await updatePortfolio(
      buildJsonRequest(`/api/v1/portfolios/${TEST_PORTFOLIO_ID}`, "PATCH", {
        name: "Income"
      }),
      buildPortfolioParams()
    );

    expect(response.status).toBe(200);
    expect(mockUpdatePortfolio).toHaveBeenCalledWith({
      userId: TEST_USER_ID,
      portfolioId: TEST_PORTFOLIO_ID,
      name: "Income"
    });
  });

  it("archives a portfolio and the next list can return no active portfolios", async () => {
    const deleteResponse = await archivePortfolio(
      new Request(`http://localhost/api/v1/portfolios/${TEST_PORTFOLIO_ID}`, {
        method: "DELETE"
      }),
      buildPortfolioParams()
    );

    expect(deleteResponse.status).toBe(200);
    expect(mockArchivePortfolio).toHaveBeenCalledWith({
      userId: TEST_USER_ID,
      portfolioId: TEST_PORTFOLIO_ID
    });

    mockListPortfolios.mockResolvedValue({ portfolios: [] });

    const listResponse = await listPortfolios();

    expect(listResponse.status).toBe(200);
    await expect(listResponse.json()).resolves.toEqual({ portfolios: [] });
  });

  it("adds a holding to the authenticated user's portfolio", async () => {
    const body = {
      ticker: "AAPL",
      securityName: "Apple Inc.",
      securityCurrency: "USD",
      quantity: "2",
      averageCost: "101.25",
      notes: null
    };
    const response = await addHolding(
      buildJsonRequest(`/api/v1/portfolios/${TEST_PORTFOLIO_ID}/holdings`, "POST", body),
      buildPortfolioParams()
    );

    expect(response.status).toBe(201);
    expect(mockAddHolding).toHaveBeenCalledWith({
      ...body,
      userId: TEST_USER_ID,
      portfolioId: TEST_PORTFOLIO_ID
    });
    await expect(response.json()).resolves.toEqual(holdingResult);
  });

  it("returns 409 for duplicate ticker adds", async () => {
    mockAddHolding.mockRejectedValue(
      new DuplicateHoldingTickerError(
        "This ticker is already in the portfolio. Edit the existing holding instead."
      )
    );

    const response = await addHolding(
      buildJsonRequest(`/api/v1/portfolios/${TEST_PORTFOLIO_ID}/holdings`, "POST", {
        ticker: "AAPL",
        securityCurrency: "USD",
        quantity: "2",
        averageCost: "101.25"
      }),
      buildPortfolioParams()
    );

    expect(response.status).toBe(409);
    const json = await response.json();
    expect(json.error.code).toBe("DUPLICATE_HOLDING_TICKER");
  });

  it("returns 404 when adding holdings to an archived portfolio", async () => {
    mockAddHolding.mockRejectedValue(new PortfolioArchivedError("Portfolio has been archived"));

    const response = await addHolding(
      buildJsonRequest(`/api/v1/portfolios/${TEST_PORTFOLIO_ID}/holdings`, "POST", {
        ticker: "AAPL",
        securityCurrency: "USD",
        quantity: "2",
        averageCost: "101.25"
      }),
      buildPortfolioParams()
    );

    expect(response.status).toBe(404);
    const json = await response.json();
    expect(json.error.code).toBe("PORTFOLIO_ARCHIVED");
  });

  it("updates a holding by portfolio and holding ids", async () => {
    const response = await updateHolding(
      buildJsonRequest(
        `/api/v1/portfolios/${TEST_PORTFOLIO_ID}/holdings/${TEST_HOLDING_ID}`,
        "PATCH",
        { notes: "Rebalanced" }
      ),
      buildHoldingParams()
    );

    expect(response.status).toBe(200);
    expect(mockUpdateHolding).toHaveBeenCalledWith({
      userId: TEST_USER_ID,
      portfolioId: TEST_PORTFOLIO_ID,
      holdingId: TEST_HOLDING_ID,
      notes: "Rebalanced"
    });
  });

  it("removes a holding by portfolio and holding ids", async () => {
    const response = await removeHolding(
      new Request(
        `http://localhost/api/v1/portfolios/${TEST_PORTFOLIO_ID}/holdings/${TEST_HOLDING_ID}`,
        { method: "DELETE" }
      ),
      buildHoldingParams()
    );

    expect(response.status).toBe(200);
    expect(mockRemoveHolding).toHaveBeenCalledWith({
      userId: TEST_USER_ID,
      portfolioId: TEST_PORTFOLIO_ID,
      holdingId: TEST_HOLDING_ID
    });
    await expect(response.json()).resolves.toEqual({ holdingId: TEST_HOLDING_ID, removed: true });
  });
});
