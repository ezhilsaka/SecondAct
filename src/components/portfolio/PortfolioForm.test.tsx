import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PortfolioForm } from "@/components/portfolio/PortfolioForm";

async function noopAction(_formData: FormData) {}

describe("PortfolioForm", () => {
  it("renders create fields with labels and actions", () => {
    const html = renderToStaticMarkup(
      <PortfolioForm
        mode="create"
        action={noopAction}
        defaultValues={{ name: "", baseCurrency: "CAD", description: "" }}
        errorMessage={null}
      />
    );

    expect(html).toContain("Portfolio name");
    expect(html).toContain("Base currency");
    expect(html).toContain("Description");
    expect(html).toContain("value=\"CAD\"");
    expect(html).toContain("value=\"USD\"");
    expect(html).toContain("Create Portfolio");
    expect(html).toContain("href=\"/app/portfolios\"");
  });

  it("renders edit defaults, hidden id, and validation message", () => {
    const html = renderToStaticMarkup(
      <PortfolioForm
        mode="edit"
        action={noopAction}
        defaultValues={{
          name: "Income",
          baseCurrency: "USD",
          description: "Retirement income account"
        }}
        errorMessage="Enter a portfolio name."
        cancelHref="/app/portfolios/22222222-2222-4222-8222-222222222222"
        portfolioId="22222222-2222-4222-8222-222222222222"
      />
    );

    expect(html).toContain("Enter a portfolio name.");
    expect(html).toContain("name=\"portfolioId\"");
    expect(html).toContain("value=\"22222222-2222-4222-8222-222222222222\"");
    expect(html).toContain("value=\"Income\"");
    expect(html).toContain("Retirement income account");
    expect(html).toContain("Save Portfolio");
    expect(html).toContain("href=\"/app/portfolios/22222222-2222-4222-8222-222222222222\"");
  });
});
