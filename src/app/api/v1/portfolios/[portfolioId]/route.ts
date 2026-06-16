import { NextResponse } from "next/server";

import {
  buildApiUnauthorizedResponse,
  getAuthenticatedApiUserId
} from "@/server/auth/api-auth";
import type { UpdatePortfolioInput } from "@/server/services/portfolio-service";

import {
  buildServiceInput,
  mapPortfolioServiceError,
  parseJsonBody
} from "../route-helpers";

type PortfolioRouteContext = {
  params: Promise<{ portfolioId: string }>;
};

export async function GET(_request: Request, { params }: PortfolioRouteContext) {
  const userId = await getAuthenticatedApiUserId();

  if (!userId) {
    return buildApiUnauthorizedResponse();
  }

  const { portfolioId } = await params;
  const { PortfolioService } = await import("@/server/services/portfolio-service");

  try {
    const service = new PortfolioService();
    const result = await service.getPortfolioDetail({ userId, portfolioId });

    return NextResponse.json(result);
  } catch (error) {
    const response = mapPortfolioServiceError(error);

    if (response) {
      return response;
    }

    throw error;
  }
}

export async function PATCH(request: Request, { params }: PortfolioRouteContext) {
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
    const result = await service.updatePortfolio(
      buildServiceInput(parsedBody.body, { userId, portfolioId }) as UpdatePortfolioInput
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

export async function DELETE(_request: Request, { params }: PortfolioRouteContext) {
  const userId = await getAuthenticatedApiUserId();

  if (!userId) {
    return buildApiUnauthorizedResponse();
  }

  const { portfolioId } = await params;
  const { PortfolioService } = await import("@/server/services/portfolio-service");

  try {
    const service = new PortfolioService();
    const result = await service.archivePortfolio({ userId, portfolioId });

    return NextResponse.json(result);
  } catch (error) {
    const response = mapPortfolioServiceError(error);

    if (response) {
      return response;
    }

    throw error;
  }
}
