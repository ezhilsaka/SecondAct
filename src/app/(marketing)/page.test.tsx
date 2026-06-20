import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import MarketingHomePage, { getLandingReportCtaHref } from "@/app/(marketing)/page";

describe("MarketingHomePage", () => {
  it("sends landing CTAs to the app shell and lets route protection handle auth", () => {
    const html = renderToStaticMarkup(<MarketingHomePage />);

    expect(getLandingReportCtaHref()).toBe("/app");
    expect(html.match(/href="\/app"/g)).toHaveLength(3);
    expect(html).not.toContain('href="/login?next=%2Fapp"');
  });
});
