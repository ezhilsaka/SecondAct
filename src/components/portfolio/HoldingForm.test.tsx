import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  applySecuritySearchResult,
  HoldingForm,
  type HoldingFormValues
} from "@/components/portfolio/HoldingForm";

const TEST_PORTFOLIO_ID = "22222222-2222-4222-8222-222222222222";

async function noopAction(_formData: FormData) {}

const DEFAULT_VALUES: HoldingFormValues = {
  ticker: "",
  securityName: "",
  securityCurrency: "USD",
  quantity: "",
  averageCost: "",
  notes: ""
};

describe("HoldingForm", () => {
  it("renders holding fields with manual ticker entry available", () => {
    const html = renderToStaticMarkup(
      <HoldingForm
        mode="create"
        action={noopAction}
        portfolioId={TEST_PORTFOLIO_ID}
        defaultValues={DEFAULT_VALUES}
      />
    );

    expect(html).toContain("Ticker");
    expect(html).toContain("Name");
    expect(html).toContain("Currency for this holding");
    expect(html).toContain("Shares / units");
    expect(html).toContain("Average cost per share");
    expect(html).toContain("Add Holding");
    expect(html).not.toContain("Market value");
    expect(html).not.toContain("quote");
  });

  it("renders edit defaults", () => {
    const html = renderToStaticMarkup(
      <HoldingForm
        mode="edit"
        action={noopAction}
        portfolioId={TEST_PORTFOLIO_ID}
        holdingId="33333333-3333-4333-8333-333333333333"
        defaultValues={{
          ticker: "AAPL",
          securityName: "Apple Inc.",
          securityCurrency: "USD",
          quantity: "2",
          averageCost: "101.25",
          notes: "Core holding"
        }}
      />
    );

    expect(html).toContain("name=\"holdingId\"");
    expect(html).toContain("value=\"33333333-3333-4333-8333-333333333333\"");
    expect(html).toContain("value=\"AAPL\"");
    expect(html).toContain("Apple Inc.");
    expect(html).toContain("Core holding");
    expect(html).toContain("Save Holding");
  });

  it("prefills ticker, name, and supported currency from a search result", () => {
    expect(
      applySecuritySearchResult(DEFAULT_VALUES, {
        symbol: "SHOP.TO",
        name: "Shopify Inc.",
        currency: "CAD",
        provider: "yfinance"
      })
    ).toEqual(
      expect.objectContaining({
        ticker: "SHOP.TO",
        securityName: "Shopify Inc.",
        securityCurrency: "CAD"
      })
    );
  });

  it("keeps the current currency when a result has no supported currency", () => {
    expect(
      applySecuritySearchResult(
        {
          ...DEFAULT_VALUES,
          securityCurrency: "USD"
        },
        {
          symbol: "VOD.L",
          name: "Vodafone Group",
          provider: "yfinance"
        }
      )
    ).toEqual(
      expect.objectContaining({
        ticker: "VOD.L",
        securityCurrency: "USD"
      })
    );
  });
});
