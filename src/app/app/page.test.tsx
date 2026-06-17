import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import AppDashboardPage from "@/app/app/page";

describe("AppDashboardPage", () => {
  it("links the primary portfolio action to create portfolio", () => {
    const html = renderToStaticMarkup(<AppDashboardPage />);

    expect(html).toContain("Portfolio setup is ready");
    expect(html).toContain("href=\"/app/portfolios/new\"");
    expect(html).toContain("Create Portfolio");
  });
});
