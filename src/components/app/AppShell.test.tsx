import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AppShell } from "@/components/app/AppShell";

describe("AppShell", () => {
  it("renders profile data, navigation, and logout action", () => {
    const html = renderToStaticMarkup(
      <AppShell
        profile={{
          email: "user@example.com",
          firstName: "Ada",
          lastName: "Lovelace",
          investorHandle: "ada-lovelace"
        }}
      >
        <p>Dashboard content</p>
      </AppShell>
    );

    expect(html).toContain("Second Act");
    expect(html).toContain("Ada Lovelace");
    expect(html).toContain("user@example.com - @ada-lovelace");
    expect(html).toContain("Dashboard");
    expect(html).toContain("Portfolios");
    expect(html).toContain("Reports");
    expect(html).toContain("Account");
    expect(html).toContain("action=\"/auth/logout\"");
    expect(html).toContain("method=\"post\"");
  });
});
