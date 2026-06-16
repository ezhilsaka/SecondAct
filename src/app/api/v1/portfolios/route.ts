import { NextResponse } from "next/server";

import {
  buildApiUnauthorizedResponse,
  getAuthenticatedApiUserId
} from "@/server/auth/api-auth";
import type { CreatePortfolioInput } from "@/server/services/portfolio-service";

import {
  buildServiceInput,
  mapPortfolioServiceError,
  parseJsonBody
} from "./route-helpers";

export async function GET() {
  const userId = await getAuthenticatedApiUserId();

  if (!userId) {
    return buildApiUnauthorizedResponse();
  }

  const { PortfolioService } = await import("@/server/services/portfolio-service");
  const service = new PortfolioService();
  const result = await service.listPortfolios(userId);

  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const userId = await getAuthenticatedApiUserId();

  if (!userId) {
    return buildApiUnauthorizedResponse();
  }

  const parsedBody = await parseJsonBody(request);

  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const { PortfolioService } = await import("@/server/services/portfolio-service");

  try {
    const service = new PortfolioService();
    const result = await service.createPortfolio(
      buildServiceInput(parsedBody.body, { userId }) as CreatePortfolioInput
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
