import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getAuthenticatedUserMock } = vi.hoisted(() => ({
  getAuthenticatedUserMock: vi.fn()
}));

vi.mock("@/server/auth/supabase-server", () => ({
  getAuthenticatedUser: getAuthenticatedUserMock
}));

import MarketingHomePage, { getLandingReportCtaHref } from "@/app/(marketing)/page";

describe("MarketingHomePage", () => {
  beforeEach(() => {
    getAuthenticatedUserMock.mockReset();
  });

  it("sends unauthenticated landing CTAs to login with the app as next path", async () => {
    getAuthenticatedUserMock.mockResolvedValue(null);

    const html = renderToStaticMarkup(await MarketingHomePage());

    expect(getLandingReportCtaHref(false)).toBe("/login?next=%2Fapp");
    expect(html.match(/href="\/login\?next=%2Fapp"/g)).toHaveLength(3);
  });

  it("sends authenticated landing CTAs directly to the app shell", async () => {
    getAuthenticatedUserMock.mockResolvedValue({
      id: "11111111-1111-4111-8111-111111111111",
      email: "user@example.com",
      claims: {}
    });

    const html = renderToStaticMarkup(await MarketingHomePage());

    expect(getLandingReportCtaHref(true)).toBe("/app");
    expect(html.match(/href="\/app"/g)).toHaveLength(3);
    expect(html).not.toContain('href="/login?next=%2Fapp"');
  });
});
