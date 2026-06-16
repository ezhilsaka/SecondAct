import { NextResponse } from "next/server";

import {
  buildApiUnauthorizedResponse,
  getAuthenticatedApiUserId
} from "@/server/auth/api-auth";
import type { AddHoldingInput } from "@/server/services/portfolio-service";

import {
  buildServiceInput,
  mapPortfolioServiceError,
  parseJsonBody
} from "../../route-helpers";

type HoldingsRouteContext = {
  params: Promise<{ portfolioId: string }>;
};

export async function POST(request: Request, { params }: HoldingsRouteContext) {
  const userId = await getAuthenticatedApiUserId();

  if (!userId) {
    return buildApiUnauthorizedResponse();
  }

  const parsedBody = await parseJsonBody(request);

  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const { portfolioId } = await params;
  const { PortfolioService } = await import("@/server/services/portfolio-service");

  try {
    const service = new PortfolioService();
    const result = await service.addHolding(
      buildServiceInput(parsedBody.body, { userId, portfolioId }) as AddHoldingInput
    );

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const response = mapPortfolioServiceError(error);

    if (response) {
      return response;
    }

    throw error;
  }
}
