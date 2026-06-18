import { beforeEach, describe, expect, it, vi } from "vitest";

const TEST_USER_ID = "11111111-1111-4111-8111-111111111111";
const TEST_PORTFOLIO_ID = "22222222-2222-4222-8222-222222222222";

const {
  mockAddHolding,
  mockCreatePortfolio,
  mockRedirect,
  mockRemoveHolding,
  mockRequireAuthenticatedUser,
  mockRevalidatePath,
  mockUpdateHolding,
  mockUpdatePortfolio
} = vi.hoisted(() => ({
  mockAddHolding: vi.fn(),
  mockCreatePortfolio: vi.fn(),
  mockRedirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  mockRemoveHolding: vi.fn(),
  mockRequireAuthenticatedUser: vi.fn(),
  mockRevalidatePath: vi.fn(),
  mockUpdateHolding: vi.fn(),
  mockUpdatePortfolio: vi.fn()
}));

vi.mock("next/cache", () => ({
  revalidatePath: mockRevalidatePath
}));

vi.mock("next/navigation", () => ({
  redirect: mockRedirect
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
      addHolding = mockAddHolding;
      createPortfolio = mockCreatePortfolio;
      removeHolding = mockRemoveHolding;
      updateHolding = mockUpdateHolding;
      updatePortfolio = mockUpdatePortfolio;
    }
  };
});

import {
  addHoldingFromForm,
  createPortfolioFromForm,
  removeHoldingFromForm,
  updateHoldingFromForm,
  updatePortfolioFromForm
} from "@/app/app/portfolios/actions";
import { DuplicateHoldingTickerError } from "@/server/services/portfolio-service";

function buildFormData(values: Record<string, string>) {
  const formData = new FormData();

  Object.entries(values).forEach(([key, value]) => {
    formData.set(key, value);
  });

  return formData;
}

describe("portfolio form actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuthenticatedUser.mockResolvedValue({ id: TEST_USER_ID });
    mockAddHolding.mockResolvedValue({ id: "33333333-3333-4333-8333-333333333333" });
    mockCreatePortfolio.mockResolvedValue({ id: TEST_PORTFOLIO_ID });
    mockRemoveHolding.mockResolvedValue({ holdingId: "33333333-3333-4333-8333-333333333333" });
    mockUpdateHolding.mockResolvedValue({ id: "33333333-3333-4333-8333-333333333333" });
    mockUpdatePortfolio.mockResolvedValue({ id: TEST_PORTFOLIO_ID });
  });

  it("redirects create submissions with missing names back to the form", async () => {
    await expect(
      createPortfolioFromForm(
        buildFormData({
          name: "",
          baseCurrency: "CAD",
          description: ""
        })
      )
    ).rejects.toThrow("REDIRECT:");

    expect(mockRedirect).toHaveBeenCalledWith(
      expect.stringContaining("/app/portfolios/new?error=missing_name")
    );
    expect(mockRequireAuthenticatedUser).not.toHaveBeenCalled();
    expect(mockCreatePortfolio).not.toHaveBeenCalled();
  });

  it("creates a portfolio for the authenticated user and redirects to detail", async () => {
    await expect(
      createPortfolioFromForm(
        buildFormData({
          name: "Retirement",
          baseCurrency: "CAD",
          description: "Long term"
        })
      )
    ).rejects.toThrow(
      `REDIRECT:/app/portfolios/${TEST_PORTFOLIO_ID}?status=portfolio_created`
    );

    expect(mockCreatePortfolio).toHaveBeenCalledWith({
      userId: TEST_USER_ID,
      name: "Retirement",
      baseCurrency: "CAD",
      description: "Long term"
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/app/portfolios");
  });

  it("redirects edit submissions with invalid currency back to the edit form", async () => {
    await expect(
      updatePortfolioFromForm(
        buildFormData({
          portfolioId: TEST_PORTFOLIO_ID,
          name: "Retirement",
          baseCurrency: "EUR",
          description: ""
        })
      )
    ).rejects.toThrow("REDIRECT:");

    expect(mockRedirect).toHaveBeenCalledWith(
      expect.stringContaining(
        `/app/portfolios/${TEST_PORTFOLIO_ID}/edit?error=invalid_currency`
      )
    );
    expect(mockUpdatePortfolio).not.toHaveBeenCalled();
  });

  it("updates a portfolio and redirects to detail", async () => {
    await expect(
      updatePortfolioFromForm(
        buildFormData({
          portfolioId: TEST_PORTFOLIO_ID,
          name: "Income",
          baseCurrency: "USD",
          description: "Updated"
        })
      )
    ).rejects.toThrow(
      `REDIRECT:/app/portfolios/${TEST_PORTFOLIO_ID}?status=portfolio_updated`
    );

    expect(mockUpdatePortfolio).toHaveBeenCalledWith({
      userId: TEST_USER_ID,
      portfolioId: TEST_PORTFOLIO_ID,
      name: "Income",
      baseCurrency: "USD",
      description: "Updated"
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/app/portfolios");
    expect(mockRevalidatePath).toHaveBeenCalledWith(`/app/portfolios/${TEST_PORTFOLIO_ID}`);
    expect(mockRevalidatePath).toHaveBeenCalledWith(
      `/app/portfolios/${TEST_PORTFOLIO_ID}/edit`
    );
  });

  it("redirects invalid add holding submissions back to detail", async () => {
    await expect(
      addHoldingFromForm(
        buildFormData({
          portfolioId: TEST_PORTFOLIO_ID,
          ticker: "",
          securityName: "",
          securityCurrency: "USD",
          quantity: "1",
          averageCost: "20",
          notes: ""
        })
      )
    ).rejects.toThrow("REDIRECT:");

    expect(mockRedirect).toHaveBeenCalledWith(
      `/app/portfolios/${TEST_PORTFOLIO_ID}?error=missing_ticker`
    );
    expect(mockRequireAuthenticatedUser).not.toHaveBeenCalled();
    expect(mockAddHolding).not.toHaveBeenCalled();
  });

  it("adds a manual holding for the authenticated user", async () => {
    await expect(
      addHoldingFromForm(
        buildFormData({
          portfolioId: TEST_PORTFOLIO_ID,
          ticker: "aapl",
          securityName: "Apple Inc.",
          securityCurrency: "USD",
          quantity: "2.5",
          averageCost: "101.25",
          notes: "Core holding"
        })
      )
    ).rejects.toThrow(`REDIRECT:/app/portfolios/${TEST_PORTFOLIO_ID}?status=holding_added`);

    expect(mockAddHolding).toHaveBeenCalledWith({
      userId: TEST_USER_ID,
      portfolioId: TEST_PORTFOLIO_ID,
      ticker: "aapl",
      securityName: "Apple Inc.",
      securityCurrency: "USD",
      quantity: "2.5",
      averageCost: "101.25",
      notes: "Core holding"
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/app/portfolios");
    expect(mockRevalidatePath).toHaveBeenCalledWith(`/app/portfolios/${TEST_PORTFOLIO_ID}`);
  });

  it("maps duplicate holding errors to friendly detail errors", async () => {
    mockAddHolding.mockRejectedValueOnce(
      new DuplicateHoldingTickerError("This ticker is already in the portfolio.")
    );

    await expect(
      addHoldingFromForm(
        buildFormData({
          portfolioId: TEST_PORTFOLIO_ID,
          ticker: "AAPL",
          securityName: "Apple Inc.",
          securityCurrency: "USD",
          quantity: "2",
          averageCost: "101.25",
          notes: ""
        })
      )
    ).rejects.toThrow("REDIRECT:");

    expect(mockRedirect).toHaveBeenCalledWith(
      `/app/portfolios/${TEST_PORTFOLIO_ID}?error=duplicate_ticker`
    );
  });

  it("redirects invalid edit holding submissions back to detail", async () => {
    await expect(
      updateHoldingFromForm(
        buildFormData({
          portfolioId: TEST_PORTFOLIO_ID,
          holdingId: "33333333-3333-4333-8333-333333333333",
          ticker: "AAPL",
          securityName: "Apple Inc.",
          securityCurrency: "USD",
          quantity: "0",
          averageCost: "101.25",
          notes: ""
        })
      )
    ).rejects.toThrow("REDIRECT:");

    expect(mockRedirect).toHaveBeenCalledWith(
      `/app/portfolios/${TEST_PORTFOLIO_ID}?error=invalid_quantity`
    );
    expect(mockUpdateHolding).not.toHaveBeenCalled();
  });

  it("updates a holding for the authenticated user", async () => {
    await expect(
      updateHoldingFromForm(
        buildFormData({
          portfolioId: TEST_PORTFOLIO_ID,
          holdingId: "33333333-3333-4333-8333-333333333333",
          ticker: "AAPL",
          securityName: "Apple Inc.",
          securityCurrency: "USD",
          quantity: "3",
          averageCost: "99.50",
          notes: "Updated"
        })
      )
    ).rejects.toThrow(`REDIRECT:/app/portfolios/${TEST_PORTFOLIO_ID}?status=holding_updated`);

    expect(mockUpdateHolding).toHaveBeenCalledWith({
      userId: TEST_USER_ID,
      portfolioId: TEST_PORTFOLIO_ID,
      holdingId: "33333333-3333-4333-8333-333333333333",
      ticker: "AAPL",
      securityName: "Apple Inc.",
      securityCurrency: "USD",
      quantity: "3",
      averageCost: "99.50",
      notes: "Updated"
    });
  });

  it("requires explicit confirmation before removing a holding", async () => {
    await expect(
      removeHoldingFromForm(
        buildFormData({
          portfolioId: TEST_PORTFOLIO_ID,
          holdingId: "33333333-3333-4333-8333-333333333333"
        })
      )
    ).rejects.toThrow("REDIRECT:");

    expect(mockRedirect).toHaveBeenCalledWith(
      `/app/portfolios/${TEST_PORTFOLIO_ID}?error=remove_not_confirmed`
    );
    expect(mockRemoveHolding).not.toHaveBeenCalled();
  });

  it("removes a holding for the authenticated user", async () => {
    await expect(
      removeHoldingFromForm(
        buildFormData({
          portfolioId: TEST_PORTFOLIO_ID,
          holdingId: "33333333-3333-4333-8333-333333333333",
          confirmRemove: "on"
        })
      )
    ).rejects.toThrow(`REDIRECT:/app/portfolios/${TEST_PORTFOLIO_ID}?status=holding_removed`);

    expect(mockRemoveHolding).toHaveBeenCalledWith({
      userId: TEST_USER_ID,
      portfolioId: TEST_PORTFOLIO_ID,
      holdingId: "33333333-3333-4333-8333-333333333333"
    });
  });
});
