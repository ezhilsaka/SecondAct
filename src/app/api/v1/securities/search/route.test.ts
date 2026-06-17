import { beforeEach, describe, expect, it, vi } from "vitest";

import { securitySearchQuerySchema } from "@/server/contracts/security-search";
import { SecuritySearchUnavailableError } from "@/server/services/security-search-service";

const TEST_USER_ID = "11111111-1111-4111-8111-111111111111";

const { mockGetAuthenticatedApiUserId, mockSearch } = vi.hoisted(() => ({
  mockGetAuthenticatedApiUserId: vi.fn(),
  mockSearch: vi.fn()
}));

vi.mock("@/server/auth/api-auth", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/server/auth/api-auth")>();
  return {
    ...original,
    getAuthenticatedApiUserId: mockGetAuthenticatedApiUserId
  };
});

vi.mock("@/server/services/security-search-service", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/server/services/security-search-service")>();
  return {
    ...original,
    SecuritySearchService: class {
      search = mockSearch;
    }
  };
});

import { GET } from "@/app/api/v1/securities/search/route";

function buildRequest(query: string, headers: Record<string, string> = {}) {
  return new Request(`http://localhost/api/v1/securities/search?query=${query}`, {
    method: "GET",
    headers
  });
}

describe("GET /api/v1/securities/search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthenticatedApiUserId.mockResolvedValue(TEST_USER_ID);
    mockSearch.mockResolvedValue({
      results: [
        {
          symbol: "AAPL",
          name: "Apple Inc.",
          exchange: "NASDAQ",
          region: "United States",
          currency: "USD",
          matchScore: "0.9500",
          provider: "yfinance"
        }
      ]
    });
  });

  it("returns 401 without an authenticated session", async () => {
    mockGetAuthenticatedApiUserId.mockResolvedValue(null);

    const response = await GET(buildRequest("Apple"));

    expect(response.status).toBe(401);
    expect(mockSearch).not.toHaveBeenCalled();
    const json = await response.json();
    expect(json.error.code).toBe("UNAUTHORIZED");
  });

  it("returns normalized search results for authenticated users", async () => {
    const response = await GET(buildRequest("Apple"));

    expect(response.status).toBe(200);
    expect(mockSearch).toHaveBeenCalledWith({ query: "Apple" });
    await expect(response.json()).resolves.toEqual({
      results: [
        {
          symbol: "AAPL",
          name: "Apple Inc.",
          exchange: "NASDAQ",
          region: "United States",
          currency: "USD",
          matchScore: "0.9500",
          provider: "yfinance"
        }
      ]
    });
  });

  it("returns 400 for invalid queries", async () => {
    mockSearch.mockImplementationOnce((input) => securitySearchQuerySchema.parse(input));

    const response = await GET(buildRequest("A"));

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error.code).toBe("VALIDATION_ERROR");
    expect(mockSearch).toHaveBeenCalledWith({ query: "A" });
  });

  it("returns a generic error when provider search fails", async () => {
    mockSearch.mockRejectedValue(
      new SecuritySearchUnavailableError("raw provider payload with details")
    );

    const response = await GET(buildRequest("Apple"));

    expect(response.status).toBe(502);
    const json = await response.json();
    expect(json.error).toEqual({
      code: "SECURITY_SEARCH_UNAVAILABLE",
      message: "Security search is temporarily unavailable. You can still enter a ticker manually."
    });
  });
});
