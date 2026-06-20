import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  HoldingRowActions,
  RemoveHoldingForm
} from "@/app/app/portfolios/[portfolioId]/HoldingRowActions";
import type { HoldingFormValues } from "@/components/portfolio/HoldingForm";
import type { PortfolioHoldingResult } from "@/server/services/portfolio-service";

const TEST_PORTFOLIO_ID = "22222222-2222-4222-8222-222222222222";
const TEST_HOLDING_ID = "33333333-3333-4333-8333-333333333333";

async function noopAction(_formData: FormData) {}

const TEST_HOLDING: PortfolioHoldingResult = {
  id: TEST_HOLDING_ID,
  portfolioId: TEST_PORTFOLIO_ID,
  ticker: "AAPL",
  securityName: "Apple Inc.",
  assetClass: "EQUITY",
  securityCurrency: "USD",
  quantity: "2.0000000000",
  averageCost: "101.25000000",
  estimatedCostBasis: "202.50000000",
  notes: "Core holding",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z"
};

const DEFAULT_VALUES: HoldingFormValues = {
  ticker: "AAPL",
  securityName: "Apple Inc.",
  securityCurrency: "USD",
  quantity: "2",
  averageCost: "101.25",
  notes: "Core holding"
};

describe("HoldingRowActions", () => {
  it("renders only action toggles before a saved holding action is opened", () => {
    const html = renderToStaticMarkup(
      <HoldingRowActions
        portfolioId={TEST_PORTFOLIO_ID}
        holding={TEST_HOLDING}
        defaultValues={DEFAULT_VALUES}
        updateAction={noopAction}
        removeAction={noopAction}
      />
    );

    expect(html).toContain("Edit");
    expect(html).toContain("Remove");
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain("Save Holding");
    expect(html).not.toContain("Remove Holding");
    expect(html).not.toContain('name="holdingId"');
    expect(html).not.toContain("Core holding");
  });
});

describe("RemoveHoldingForm", () => {
  it("preserves the removal server-action field contract when mounted", () => {
    const html = renderToStaticMarkup(
      <RemoveHoldingForm
        portfolioId={TEST_PORTFOLIO_ID}
        holding={TEST_HOLDING}
        action={noopAction}
      />
    );

    expect(html).toContain('name="portfolioId"');
    expect(html).toContain(`value="${TEST_PORTFOLIO_ID}"`);
    expect(html).toContain('name="holdingId"');
    expect(html).toContain(`value="${TEST_HOLDING_ID}"`);
    expect(html).toContain('name="confirmRemove"');
    expect(html).toContain("Remove AAPL from this portfolio");
    expect(html).toContain("Remove Holding");
  });
});
