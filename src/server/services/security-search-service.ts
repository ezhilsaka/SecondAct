import { z } from "zod";

import {
  securitySearchQuerySchema,
  type SecuritySearchQuery,
  type SecuritySearchResponse
} from "@/server/contracts";
import { createSecuritySearchAdapterProvider } from "@/server/providers/security-search-adapter-provider";
import type { SecuritySearchProvider } from "@/server/providers/security-search-provider";

const DEFAULT_SEARCH_RESULT_LIMIT = 8;

export type SecuritySearchServiceDependencies = {
  provider?: SecuritySearchProvider;
  resultLimit?: number;
};

export class SecuritySearchUnavailableError extends Error {
  override name = "SecuritySearchUnavailableError";
}

export class SecuritySearchService {
  private readonly provider: SecuritySearchProvider;
  private readonly resultLimit: number;

  constructor(dependencies: SecuritySearchServiceDependencies = {}) {
    this.provider = dependencies.provider ?? createSecuritySearchAdapterProvider();
    this.resultLimit = dependencies.resultLimit ?? DEFAULT_SEARCH_RESULT_LIMIT;
  }

  async search(input: z.input<typeof securitySearchQuerySchema>): Promise<SecuritySearchResponse> {
    const parsedInput: SecuritySearchQuery = securitySearchQuerySchema.parse(input);

    try {
      const result = await this.provider.searchSecurities(parsedInput);

      return {
        results: result.results.slice(0, this.resultLimit)
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw error;
      }

      throw new SecuritySearchUnavailableError(
        "Security search is temporarily unavailable. Manual ticker entry remains available."
      );
    }
  }
}
