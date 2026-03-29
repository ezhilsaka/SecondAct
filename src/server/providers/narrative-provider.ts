import type { GenerateNarrativeInput, GenerateNarrativeResult } from "@/server/contracts";

/**
 * Swappable provider boundary for converting deterministic analysis into structured prose.
 */
export interface NarrativeProvider {
  readonly providerName: string;
  generateNarrative(input: GenerateNarrativeInput): Promise<GenerateNarrativeResult>;
}
