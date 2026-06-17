import { beforeEach, describe, expect, it, vi } from "vitest";

const TEST_USER_ID = "11111111-1111-4111-8111-111111111111";
const TEST_PORTFOLIO_ID = "22222222-2222-4222-8222-222222222222";

const {
  mockCreatePortfolio,
  mockRedirect,
  mockRequireAuthenticatedUser,
  mockRevalidatePath,
  mockUpdatePortfolio
} = vi.hoisted(() => ({
  mockCreatePortfolio: vi.fn(),
  mockRedirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  mockRequireAuthenticatedUser: vi.fn(),
  mockRevalidatePath: vi.fn(),
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
      createPortfolio = mockCreatePortfolio;
      updatePortfolio = mockUpdatePortfolio;
    }
  };
});

import { createPortfolioFromForm, updatePortfolioFromForm } from "@/app/app/portfolios/actions";

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
    mockCreatePortfolio.mockResolvedValue({ id: TEST_PORTFOLIO_ID });
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

  it("creates a portfolio for the authenticated user and redirects to the list", async () => {
    await expect(
      createPortfolioFromForm(
        buildFormData({
          name: "Retirement",
          baseCurrency: "CAD",
          description: "Long term"
        })
      )
    ).rejects.toThrow("REDIRECT:/app/portfolios?status=portfolio_created");

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

  it("updates a portfolio and redirects to the list", async () => {
    await expect(
      updatePortfolioFromForm(
        buildFormData({
          portfolioId: TEST_PORTFOLIO_ID,
          name: "Income",
          baseCurrency: "USD",
          description: "Updated"
        })
      )
    ).rejects.toThrow("REDIRECT:/app/portfolios?status=portfolio_updated");

    expect(mockUpdatePortfolio).toHaveBeenCalledWith({
      userId: TEST_USER_ID,
      portfolioId: TEST_PORTFOLIO_ID,
      name: "Income",
      baseCurrency: "USD",
      description: "Updated"
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/app/portfolios");
    expect(mockRevalidatePath).toHaveBeenCalledWith(
      `/app/portfolios/${TEST_PORTFOLIO_ID}/edit`
    );
  });
});
