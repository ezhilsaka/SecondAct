import { NextResponse } from "next/server";

import {
  buildApiUnauthorizedResponse,
  getAuthenticatedApiUserId
} from "@/server/auth/api-auth";
import type { UpdateHoldingInput } from "@/server/services/portfolio-service";

import {
  buildServiceInput,
  mapPortfolioServiceError,
  parseJsonBody
} from "../../../route-helpers";

type HoldingRouteContext = {
  params: Promise<{ portfolioId: string; holdingId: string }>;
};

export async function PATCH(request: Request, { params }: HoldingRouteContext) {
  const userId = await getAuthenticatedApiUserId();

  if (!userId) {
    return buildApiUnauthorizedResponse();
  }

  const parsedBody = await parseJsonBody(request);

  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const { portfolioId, holdingId } = await params;
  const { PortfolioService } = await import("@/server/services/portfolio-service");

  try {
    const service = new PortfolioService();
    const result = await service.updateHolding(
      buildServiceInput(parsedBody.body, { userId, portfolioId, holdingId }) as UpdateHoldingInput
    );

    return NextResponse.json(result);
  } catch (error) {
    const response = mapPortfolioServiceError(error);

    if (response) {
      return response;
    }

    throw error;
  }
}

export async function DELETE(_request: Request, { params }: HoldingRouteContext) {
  const userId = await getAuthenticatedApiUserId();

  if (!userId) {
    return buildApiUnauthorizedResponse();
  }

  const { portfolioId, holdingId } = await params;
  const { PortfolioService } = await import("@/server/services/portfolio-service");

  try {
    const service = new PortfolioService();
    const result = await service.removeHolding({ userId, portfolioId, holdingId });

    return NextResponse.json(result);
  } catch (error) {
    const response = mapPortfolioServiceError(error);

    if (response) {
      return response;
    }

    throw error;
  }
}
