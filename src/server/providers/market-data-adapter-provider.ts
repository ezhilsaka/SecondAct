import { ZodError } from "zod";

import {
  getMarketDataInputSchema,
  getMarketDataResultSchema,
  type GetMarketDataInput,
  type GetMarketDataResult
} from "@/server/contracts";
import { serverEnv, type ServerEnv } from "@/server/config";

import type { MarketDataProvider } from "@/server/providers/market-data-provider";

type FetchImplementation = typeof fetch;

type MarketDataAdapterEnv = Pick<
  ServerEnv,
  | "MARKET_DATA_SERVICE_URL"
  | "MARKET_DATA_SERVICE_TIMEOUT_MS"
  | "MARKET_DATA_ADAPTER_INTERNAL_API_SECRET"
>;

export type MarketDataAdapterProviderOptions = {
  serviceUrl: string;
  timeoutMs: number;
  internalApiSecret: string;
  fetchImplementation?: FetchImplementation;
};

export class MarketDataClientInputError extends Error {
  override name = "MarketDataClientInputError";
}

export class MarketDataServiceAuthError extends Error {
  override name = "MarketDataServiceAuthError";
}

export class MarketDataServiceTimeoutError extends Error {
  override name = "MarketDataServiceTimeoutError";
}

export class MarketDataServiceError extends Error {
  override name = "MarketDataServiceError";
}

export class MarketDataContractError extends Error {
  override name = "MarketDataContractError";
}

function buildQuotesUrl(serviceUrl: string): string {
  return new URL(
    "market-data/quotes",
    serviceUrl.endsWith("/") ? serviceUrl : `${serviceUrl}/`
  ).toString();
}

function formatContractError(error: ZodError) {
  return error.issues.map((issue) => issue.message).join("; ");
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function extractAdapterErrorMessage(payload: unknown): string | undefined {
  if (payload && typeof payload === "object") {
    const maybeDetail = "detail" in payload ? payload.detail : undefined;
    if (typeof maybeDetail === "string" && maybeDetail.length > 0) {
      return maybeDetail;
    }

    const maybeError = "error" in payload ? payload.error : undefined;
    if (maybeError && typeof maybeError === "object" && "message" in maybeError) {
      const maybeMessage = maybeError.message;
      if (typeof maybeMessage === "string" && maybeMessage.length > 0) {
        return maybeMessage;
      }
    }
  }

  return undefined;
}

async function parseJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new MarketDataContractError("Market data adapter returned a non-JSON response.");
  }
}

function buildHttpError(response: Response, payload: unknown): Error {
  const baseMessage =
    extractAdapterErrorMessage(payload) ||
    `Market data adapter request failed with status ${response.status}.`;

  if (response.status === 401 || response.status === 403 || response.status === 503) {
    return new MarketDataServiceAuthError(baseMessage);
  }

  if (response.status === 504) {
    return new MarketDataServiceTimeoutError(baseMessage);
  }

  return new MarketDataServiceError(baseMessage);
}

export class MarketDataAdapterProvider implements MarketDataProvider {
  readonly providerName = "market-data-adapter";

  private readonly quotesUrl: string;
  private readonly timeoutMs: number;
  private readonly internalApiSecret: string;
  private readonly fetchImplementation: FetchImplementation;

  constructor(options: MarketDataAdapterProviderOptions) {
    this.quotesUrl = buildQuotesUrl(options.serviceUrl);
    this.timeoutMs = options.timeoutMs;
    this.internalApiSecret = options.internalApiSecret.trim();
    this.fetchImplementation = options.fetchImplementation ?? fetch;

    if (!this.internalApiSecret) {
      throw new MarketDataServiceAuthError(
        "MARKET_DATA_ADAPTER_INTERNAL_API_SECRET must be configured for the market data client."
      );
    }
  }

  async getSecurities(input: GetMarketDataInput): Promise<GetMarketDataResult> {
    const parsedInput = getMarketDataInputSchema.safeParse(input);

    if (!parsedInput.success) {
      throw new MarketDataClientInputError(
        `Invalid market data input: ${formatContractError(parsedInput.error)}`
      );
    }

    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      let response: Response;

      try {
        response = await this.fetchImplementation(this.quotesUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Internal-Secret": this.internalApiSecret
          },
          body: JSON.stringify(parsedInput.data),
          redirect: "error",
          signal: controller.signal
        });
      } catch (error) {
        if (isAbortError(error)) {
          throw new MarketDataServiceTimeoutError(
            "Market data adapter request timed out before a response was received."
          );
        }

        throw new MarketDataServiceError(
          error instanceof Error
            ? `Market data adapter request failed: ${error.message}`
            : "Market data adapter request failed."
        );
      }

      const payload = await parseJsonResponse(response);

      if (!response.ok) {
        throw buildHttpError(response, payload);
      }

      const parsedResult = getMarketDataResultSchema.safeParse(payload);

      if (!parsedResult.success) {
        throw new MarketDataContractError(
          `Market data adapter returned an invalid response contract: ${formatContractError(parsedResult.error)}`
        );
      }

      return parsedResult.data;
    } finally {
      clearTimeout(timeoutHandle);
    }
  }
}

export function createMarketDataAdapterProvider(
  env: MarketDataAdapterEnv = serverEnv,
  fetchImplementation?: FetchImplementation
) {
  return new MarketDataAdapterProvider({
    serviceUrl: env.MARKET_DATA_SERVICE_URL,
    timeoutMs: env.MARKET_DATA_SERVICE_TIMEOUT_MS,
    internalApiSecret: env.MARKET_DATA_ADAPTER_INTERNAL_API_SECRET,
    fetchImplementation
  });
}
