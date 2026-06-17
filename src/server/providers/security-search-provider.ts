import type { SecuritySearchQuery, SecuritySearchResponse } from "@/server/contracts";

export interface SecuritySearchProvider {
  readonly providerName: string;
  searchSecurities(input: SecuritySearchQuery): Promise<SecuritySearchResponse>;
}
