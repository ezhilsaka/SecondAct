import { z, ZodError } from "zod";

import {
  generateNarrativeInputSchema,
  narrativeOutputSchema,
  type GenerateNarrativeInput,
  type GenerateNarrativeResult
} from "@/server/contracts";
import { narrativeEnv, type NarrativeEnv } from "@/server/config";
import type { NarrativeProvider } from "@/server/providers/narrative-provider";
import {
  NARRATIVE_EXPLAINER_SYSTEM_PROMPT,
  buildNarrativeExplainerUserPrompt
} from "@/server/prompts/narrative-explainer";
import { CONTRACT_SCHEMA_VERSIONS } from "@/server/shared/constants";

type FetchImplementation = typeof fetch;

type OpenAICompatibleNarrativeEnv = Pick<
  NarrativeEnv,
  | "NARRATIVE_PROVIDER"
  | "NARRATIVE_PROVIDER_BASE_URL"
  | "NARRATIVE_PROVIDER_API_KEY"
  | "NARRATIVE_MODEL"
  | "NARRATIVE_PROVIDER_TIMEOUT_MS"
>;

export type OpenAICompatibleNarrativeProviderOptions = {
  providerName: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
  fetchImplementation?: FetchImplementation;
  now?: () => Date;
  nowMs?: () => number;
  logger?: Pick<typeof console, "info" | "warn" | "error">;
};

export class NarrativeClientInputError extends Error {
  override name = "NarrativeClientInputError";
}

export class NarrativeProviderAuthError extends Error {
  override name = "NarrativeProviderAuthError";
}

export class NarrativeProviderTimeoutError extends Error {
  override name = "NarrativeProviderTimeoutError";
}

export class NarrativeProviderError extends Error {
  override name = "NarrativeProviderError";
}

export class NarrativeContractError extends Error {
  override name = "NarrativeContractError";
}

const llmNarrativeMetricSchema = z.object({
  narrative: z.string().trim().min(1),
  takeaways: z.array(z.string().trim().min(1)).max(2).default([])
});

const llmNarrativeSectionSchema = z.object({
  summary_narrative: z.string().trim().min(1),
  key_takeaways: z.array(z.string().trim().min(1)).max(2).default([]),
  metrics: z.array(llmNarrativeMetricSchema)
});

const llmNarrativeResponseSchema = z.object({
  sections: z.array(llmNarrativeSectionSchema)
});

const chatCompletionResponseSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({
          content: z.union([
            z.string(),
            z.array(
              z.object({
                type: z.string(),
                text: z.string().optional()
              })
            )
          ])
        })
      })
    )
    .min(1)
});

function buildChatCompletionsUrl(baseUrl: string): string {
  return new URL("chat/completions", baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`).toString();
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function formatContractError(error: ZodError) {
  return error.issues.map((issue) => issue.message).join("; ");
}

function extractProviderErrorMessage(payload: unknown): string | undefined {
  if (payload && typeof payload === "object") {
    const maybeError = "error" in payload ? payload.error : undefined;
    if (typeof maybeError === "string" && maybeError.length > 0) {
      return maybeError;
    }

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
    throw new NarrativeContractError("Narrative provider returned a non-JSON HTTP response.");
  }
}

function normalizeChatMessageContent(
  content: string | Array<{ type: string; text?: string }>
): string {
  if (typeof content === "string") {
    return content;
  }

  return content
    .map((part) => (part.type === "text" ? (part.text ?? "") : ""))
    .join("")
    .trim();
}

function extractJsonCandidate(rawContent: string): string {
  const fencedMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  const firstBraceIndex = rawContent.indexOf("{");
  const lastBraceIndex = rawContent.lastIndexOf("}");
  if (firstBraceIndex >= 0 && lastBraceIndex > firstBraceIndex) {
    return rawContent.slice(firstBraceIndex, lastBraceIndex + 1).trim();
  }

  return rawContent.trim();
}

function validateReturnedStructure(
  input: GenerateNarrativeInput,
  payload: z.infer<typeof llmNarrativeResponseSchema>
) {
  if (payload.sections.length !== input.sections.length) {
    throw new NarrativeContractError(
      "Narrative provider returned a different section count than requested."
    );
  }

  payload.sections.forEach((section, index) => {
    const expectedSection = input.sections[index];

    if (!expectedSection) {
      throw new NarrativeContractError("Narrative provider returned an unexpected extra section.");
    }

    if (section.metrics.length !== expectedSection.metrics.length) {
      throw new NarrativeContractError(
        `Narrative provider returned a different metric count for ${expectedSection.sectionKey}.`
      );
    }

    section.metrics.forEach((metric, metricIndex) => {
      const expectedMetric = expectedSection.metrics[metricIndex];

      if (!expectedMetric) {
        throw new NarrativeContractError(
          `Narrative provider returned an unexpected extra metric for ${expectedSection.sectionKey}.`
        );
      }
    });
  });
}

function buildNarrativeOutput(
  input: GenerateNarrativeInput,
  providerName: string,
  model: string,
  generatedAt: Date,
  payload: z.infer<typeof llmNarrativeResponseSchema>
): GenerateNarrativeResult {
  return narrativeOutputSchema.parse({
    schemaVersion: CONTRACT_SCHEMA_VERSIONS.narrative,
    generatedAt: generatedAt.toISOString(),
    provider: providerName,
    model,
    sections: payload.sections.map((section, sectionIndex) => ({
      sectionKey: input.sections[sectionIndex]!.sectionKey,
      sectionTitle: input.sections[sectionIndex]!.sectionTitle,
      summaryNarrative: section.summary_narrative,
      keyTakeaways: section.key_takeaways,
      metrics: section.metrics.map((metric, metricIndex) => ({
        name: input.sections[sectionIndex]!.metrics[metricIndex]!.name,
        displayName: input.sections[sectionIndex]!.metrics[metricIndex]!.displayName,
        narrative: metric.narrative,
        takeaways: metric.takeaways
      }))
    })),
    dataQualityFlags: input.globalDataQualityFlags
  });
}

function buildHttpError(response: Response, payload: unknown): Error {
  const baseMessage =
    extractProviderErrorMessage(payload) ||
    `Narrative provider request failed with status ${response.status}.`;

  if (response.status === 401 || response.status === 403) {
    return new NarrativeProviderAuthError(baseMessage);
  }

  if (response.status === 408 || response.status === 504) {
    return new NarrativeProviderTimeoutError(baseMessage);
  }

  return new NarrativeProviderError(baseMessage);
}

export class OpenAICompatibleNarrativeProvider implements NarrativeProvider {
  readonly providerName: string;

  private readonly chatCompletionsUrl: string;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly fetchImplementation: FetchImplementation;
  private readonly now: () => Date;
  private readonly nowMs: () => number;
  private readonly logger: Pick<typeof console, "info" | "warn" | "error">;

  constructor(options: OpenAICompatibleNarrativeProviderOptions) {
    this.providerName = options.providerName.trim();
    this.chatCompletionsUrl = buildChatCompletionsUrl(options.baseUrl);
    this.apiKey = options.apiKey.trim();
    this.model = options.model.trim();
    this.timeoutMs = options.timeoutMs;
    this.fetchImplementation = options.fetchImplementation ?? fetch;
    this.now = options.now ?? (() => new Date());
    this.nowMs = options.nowMs ?? (() => Date.now());
    this.logger = options.logger ?? console;

    if (!this.providerName) {
      throw new NarrativeProviderError("NARRATIVE_PROVIDER must be configured.");
    }

    if (!this.apiKey) {
      throw new NarrativeProviderAuthError("NARRATIVE_PROVIDER_API_KEY must be configured.");
    }

    if (!this.model) {
      throw new NarrativeProviderError("NARRATIVE_MODEL must be configured.");
    }
  }

  async generateNarrative(input: GenerateNarrativeInput): Promise<GenerateNarrativeResult> {
    const parsedInput = generateNarrativeInputSchema.safeParse(input);

    if (!parsedInput.success) {
      throw new NarrativeClientInputError(
        `Invalid narrative input: ${formatContractError(parsedInput.error)}`
      );
    }

    const promptPayload = buildNarrativeExplainerUserPrompt(parsedInput.data);
    const firstAttemptStartedAtMs = this.nowMs();
    const firstAttempt = await this.requestNarrative(promptPayload);
    const parsedFirstAttempt = this.parseModelPayload(firstAttempt);
    const firstAttemptDurationMs = this.elapsedMs(firstAttemptStartedAtMs);

    if (parsedFirstAttempt.success) {
      validateReturnedStructure(parsedInput.data, parsedFirstAttempt.data);

      return buildNarrativeOutput(
        parsedInput.data,
        this.providerName,
        this.model,
        this.now(),
        parsedFirstAttempt.data
      );
    }

    this.logger.warn("Narrative provider first attempt returned invalid structured output.", {
      event: "narrative_provider.first_attempt_invalid",
      provider: this.providerName,
      model: this.model,
      durationMs: firstAttemptDurationMs,
      errorMessage: formatContractError(parsedFirstAttempt.error)
    });

    const retryInstruction =
      "Your previous reply was not valid JSON that matched the required schema. Return ONLY valid JSON with the top-level key `sections`. Follow the provided `output_template` exactly: preserve the exact section count, preserve the exact metric count inside each section, and fill every slot in the template. Each section must contain `summary_narrative`, `key_takeaways`, and `metrics`. Each metric must contain only `narrative` and `takeaways`. Do not repeat section keys, section titles, metric names, or display names. Do not add markdown fences or extra commentary.";
    const retryStartedAtMs = this.nowMs();
    const secondAttempt = await this.requestNarrative(
      promptPayload,
      retryInstruction,
      firstAttempt
    );
    const parsedSecondAttempt = this.parseModelPayload(secondAttempt);
    const retryDurationMs = this.elapsedMs(retryStartedAtMs);

    if (!parsedSecondAttempt.success) {
      this.logger.error("Narrative provider retry returned invalid structured output.", {
        event: "narrative_provider.retry_invalid",
        provider: this.providerName,
        model: this.model,
        firstAttemptDurationMs,
        retryDurationMs,
        errorMessage: formatContractError(parsedSecondAttempt.error)
      });

      throw new NarrativeContractError(
        `Narrative provider returned invalid JSON output after retry: ${formatContractError(parsedSecondAttempt.error)}`
      );
    }

    validateReturnedStructure(parsedInput.data, parsedSecondAttempt.data);
    this.logger.info("Narrative provider retry recovered structured output.", {
      event: "narrative_provider.retry_recovered",
      provider: this.providerName,
      model: this.model,
      firstAttemptDurationMs,
      retryDurationMs
    });

    return buildNarrativeOutput(
      parsedInput.data,
      this.providerName,
      this.model,
      this.now(),
      parsedSecondAttempt.data
    );
  }

  private parseModelPayload(rawContent: string) {
    try {
      const candidate = extractJsonCandidate(rawContent);
      const parsedJson = JSON.parse(candidate);
      const parsedPayload = llmNarrativeResponseSchema.parse(parsedJson);

      return {
        success: true as const,
        data: parsedPayload
      };
    } catch (error) {
      if (error instanceof ZodError) {
        return {
          success: false as const,
          error
        };
      }

      return {
        success: false as const,
        error: new ZodError([
          {
            code: "custom",
            message: "The model response was not valid JSON.",
            path: []
          }
        ])
      };
    }
  }

  private elapsedMs(startedAtMs: number) {
    return Math.max(0, Math.round(this.nowMs() - startedAtMs));
  }

  private async requestNarrative(
    promptPayload: string,
    retryInstruction?: string,
    previousAssistantResponse?: string
  ): Promise<string> {
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
        {
          role: "system",
          content: NARRATIVE_EXPLAINER_SYSTEM_PROMPT
        },
        {
          role: "user",
          content: promptPayload
        }
      ];

      if (previousAssistantResponse && retryInstruction) {
        messages.push(
          {
            role: "assistant",
            content: previousAssistantResponse
          },
          {
            role: "user",
            content: retryInstruction
          }
        );
      }

      let response: Response;

      try {
        response = await this.fetchImplementation(this.chatCompletionsUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`
          },
          body: JSON.stringify({
            model: this.model,
            temperature: 0.2,
            response_format: { type: "json_object" },
            messages
          }),
          redirect: "error",
          signal: controller.signal
        });
      } catch (error) {
        if (isAbortError(error)) {
          throw new NarrativeProviderTimeoutError(
            "Narrative provider request timed out before a response was received."
          );
        }

        throw new NarrativeProviderError(
          error instanceof Error
            ? `Narrative provider request failed: ${error.message}`
            : "Narrative provider request failed."
        );
      }

      const payload = await parseJsonResponse(response);

      if (!response.ok) {
        throw buildHttpError(response, payload);
      }

      const parsedResponse = chatCompletionResponseSchema.safeParse(payload);

      if (!parsedResponse.success) {
        throw new NarrativeContractError(
          `Narrative provider returned an invalid HTTP response contract: ${formatContractError(parsedResponse.error)}`
        );
      }

      const firstChoice = parsedResponse.data.choices[0];
      const normalizedContent = normalizeChatMessageContent(firstChoice.message.content).trim();

      if (!normalizedContent) {
        throw new NarrativeContractError("Narrative provider returned an empty message content.");
      }

      return normalizedContent;
    } finally {
      clearTimeout(timeoutHandle);
    }
  }
}

export function createOpenAICompatibleNarrativeProvider(
  env: OpenAICompatibleNarrativeEnv = narrativeEnv,
  fetchImplementation?: FetchImplementation
) {
  return new OpenAICompatibleNarrativeProvider({
    providerName: env.NARRATIVE_PROVIDER,
    baseUrl: env.NARRATIVE_PROVIDER_BASE_URL,
    apiKey: env.NARRATIVE_PROVIDER_API_KEY,
    model: env.NARRATIVE_MODEL,
    timeoutMs: env.NARRATIVE_PROVIDER_TIMEOUT_MS,
    fetchImplementation
  });
}
