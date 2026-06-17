import { ZodError } from "zod";

import {
  securitySearchAdapterResponseSchema,
  securitySearchQuerySchema,
  type SecuritySearchQuery,
  type SecuritySearchResponse
} from "@/server/contracts";
import { serverEnv, type ServerEnv } from "@/server/config";

import type { SecuritySearchProvider } from "@/server/providers/security-search-provider";

type FetchImplementation = typeof fetch;

type SecuritySearchAdapterEnv = Pick<
  ServerEnv,
  | "MARKET_DATA_SERVICE_URL"
  | "MARKET_DATA_SERVICE_TIMEOUT_MS"
  | "MARKET_DATA_ADAPTER_INTERNAL_API_SECRET"
>;

export type SecuritySearchAdapterProviderOptions = {
  serviceUrl: string;
  timeoutMs: number;
  internalApiSecret: string;
  fetchImplementation?: FetchImplementation;
};

export class SecuritySearchClientInputError extends Error {
  override name = "SecuritySearchClientInputError";
}

export class SecuritySearchServiceAuthError extends Error {
  override name = "SecuritySearchServiceAuthError";
}

export class SecuritySearchServiceTimeoutError extends Error {
  override name = "SecuritySearchServiceTimeoutError";
}

export class SecuritySearchServiceError extends Error {
  override name = "SecuritySearchServiceError";
}

export class SecuritySearchContractError extends Error {
  override name = "SecuritySearchContractError";
}

function buildSearchUrl(serviceUrl: string, query: string): string {
  const url = new URL(
    "market-data/search",
    serviceUrl.endsWith("/") ? serviceUrl : `${serviceUrl}/`
  );
  url.searchParams.set("query", query);

  return url.toString();
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
    throw new SecuritySearchContractError("Security search adapter returned a non-JSON response.");
  }
}

function buildHttpError(response: Response, payload: unknown): Error {
  const baseMessage =
    extractAdapterErrorMessage(payload) ||
    `Security search adapter request failed with status ${response.status}.`;

  if (response.status === 401 || response.status === 403 || response.status === 503) {
    return new SecuritySearchServiceAuthError(baseMessage);
  }

  if (response.status === 504) {
    return new SecuritySearchServiceTimeoutError(baseMessage);
  }

  return new SecuritySearchServiceError(baseMessage);
}

export class SecuritySearchAdapterProvider implements SecuritySearchProvider {
  readonly providerName = "market-data-adapter";

  private readonly serviceUrl: string;
  private readonly timeoutMs: number;
  private readonly internalApiSecret: string;
  private readonly fetchImplementation: FetchImplementation;

  constructor(options: SecuritySearchAdapterProviderOptions) {
    this.serviceUrl = options.serviceUrl;
    this.timeoutMs = options.timeoutMs;
    this.internalApiSecret = options.internalApiSecret.trim();
    this.fetchImplementation = options.fetchImplementation ?? fetch;

    if (!this.internalApiSecret) {
      throw new SecuritySearchServiceAuthError(
        "MARKET_DATA_ADAPTER_INTERNAL_API_SECRET must be configured for security search."
      );
    }
  }

  async searchSecurities(input: SecuritySearchQuery): Promise<SecuritySearchResponse> {
    const parsedInput = securitySearchQuerySchema.safeParse(input);

    if (!parsedInput.success) {
      throw new SecuritySearchClientInputError(
        `Invalid security search input: ${formatContractError(parsedInput.error)}`
      );
    }

    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      let response: Response;

      try {
        response = await this.fetchImplementation(
          buildSearchUrl(this.serviceUrl, parsedInput.data.query),
          {
            method: "GET",
            headers: {
              "X-Internal-Secret": this.internalApiSecret
            },
            redirect: "error",
            signal: controller.signal
          }
        );
      } catch (error) {
        if (isAbortError(error)) {
          throw new SecuritySearchServiceTimeoutError(
            "Security search adapter request timed out before a response was received."
          );
        }

        throw new SecuritySearchServiceError(
          error instanceof Error
            ? `Security search adapter request failed: ${error.message}`
            : "Security search adapter request failed."
        );
      }

      const payload = await parseJsonResponse(response);

      if (!response.ok) {
        throw buildHttpError(response, payload);
      }

      const parsedResult = securitySearchAdapterResponseSchema.safeParse(payload);

      if (!parsedResult.success) {
        throw new SecuritySearchContractError(
          `Security search adapter returned an invalid response contract: ${formatContractError(parsedResult.error)}`
        );
      }

      return {
        results: parsedResult.data.results
      };
    } finally {
      clearTimeout(timeoutHandle);
    }
  }
}

export function createSecuritySearchAdapterProvider(
  env: SecuritySearchAdapterEnv = serverEnv,
  fetchImplementation?: FetchImplementation
) {
  return new SecuritySearchAdapterProvider({
    serviceUrl: env.MARKET_DATA_SERVICE_URL,
    timeoutMs: env.MARKET_DATA_SERVICE_TIMEOUT_MS,
    internalApiSecret: env.MARKET_DATA_ADAPTER_INTERNAL_API_SECRET,
    fetchImplementation
  });
}
