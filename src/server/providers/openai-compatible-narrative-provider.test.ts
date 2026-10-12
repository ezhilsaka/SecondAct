import { afterEach, describe, expect, it, vi } from "vitest";

import { buildContractFixturePayloads } from "@/server/contracts/fixtures";
import {
  NarrativeClientInputError,
  NarrativeContractError,
  NarrativeProviderAuthError,
  NarrativeProviderError,
  NarrativeProviderTimeoutError,
  OpenAICompatibleNarrativeProvider,
  type OpenAICompatibleNarrativeProviderOptions
} from "@/server/providers/openai-compatible-narrative-provider";

function createProvider(
  fetchImplementation: typeof fetch,
  options: Partial<Pick<OpenAICompatibleNarrativeProviderOptions, "logger" | "nowMs">> = {}
) {
  return new OpenAICompatibleNarrativeProvider({
    providerName: "openai-compatible",
    baseUrl: "http://127.0.0.1:11434/v1",
    apiKey: "ollama",
    model: "qwen3.5:9b",
    timeoutMs: 5000,
    fetchImplementation,
    now: () => new Date("2026-04-06T12:30:00.000Z"),
    ...options
  });
}

function createMockLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  };
}

function buildSuccessfulResponse() {
  return {
    choices: [
      {
        message: {
          content: JSON.stringify({
            sections: [
              {
                summary_narrative: "Summary for Section 1.",
                key_takeaways: ["Takeaway 1"],
                metrics: [
                  {
                    narrative: "Narrative for market value.",
                    takeaways: ["Metric takeaway"]
                  },
                  {
                    narrative: "Narrative for holding count.",
                    takeaways: ["Count takeaway"]
                  }
                ]
              },
              {
                summary_narrative: "Summary for Section 2.",
                key_takeaways: ["Takeaway 2"],
                metrics: [
                  {
                    narrative: "Narrative for market value.",
                    takeaways: ["Metric takeaway"]
                  },
                  {
                    narrative: "Narrative for holding count.",
                    takeaways: ["Count takeaway"]
                  }
                ]
              },
              {
                summary_narrative: "Summary for Section 3.",
                key_takeaways: ["Takeaway 3"],
                metrics: [
                  {
                    narrative: "Narrative for market value.",
                    takeaways: ["Metric takeaway"]
                  },
                  {
                    narrative: "Narrative for holding count.",
                    takeaways: ["Count takeaway"]
                  }
                ]
              },
              {
                summary_narrative: "Summary for Section 4.",
                key_takeaways: ["Takeaway 4"],
                metrics: [
                  {
                    narrative: "Narrative for market value.",
                    takeaways: ["Metric takeaway"]
                  },
                  {
                    narrative: "Narrative for holding count.",
                    takeaways: ["Count takeaway"]
                  }
                ]
              },
              {
                summary_narrative: "Summary for Section 5.",
                key_takeaways: ["Takeaway 5"],
                metrics: [
                  {
                    narrative: "Narrative for market value.",
                    takeaways: ["Metric takeaway"]
                  },
                  {
                    narrative: "Narrative for holding count.",
                    takeaways: ["Count takeaway"]
                  }
                ]
              },
              {
                summary_narrative: "Summary for Section 6.",
                key_takeaways: ["Takeaway 6"],
                metrics: [
                  {
                    narrative: "Narrative for market value.",
                    takeaways: ["Metric takeaway"]
                  },
                  {
                    narrative: "Narrative for holding count.",
                    takeaways: ["Count takeaway"]
                  }
                ]
              },
              {
                summary_narrative: "Summary for Section 7.",
                key_takeaways: ["Takeaway 7"],
                metrics: [
                  {
                    narrative: "Narrative for market value.",
                    takeaways: ["Metric takeaway"]
                  },
                  {
                    narrative: "Narrative for holding count.",
                    takeaways: ["Count takeaway"]
                  }
                ]
              }
            ]
          })
        }
      }
    ]
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("OpenAICompatibleNarrativeProvider", () => {
  it("sends the prompt to the OpenAI-compatible endpoint and returns validated narrative output", async () => {
    const { narrativeInput } = buildContractFixturePayloads();
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(buildSuccessfulResponse()), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );
    const provider = createProvider(fetchMock);

    const result = await provider.generateNarrative(narrativeInput);

    expect(result.provider).toBe("openai-compatible");
    expect(result.model).toBe("qwen3.5:9b");
    expect(result.sections).toHaveLength(narrativeInput.sections.length);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:11434/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          Authorization: "Bearer ollama"
        }),
        redirect: "error"
      })
    );
    const requestInit = fetchMock.mock.calls[0]?.[1];
    const requestBody =
      requestInit && typeof requestInit === "object" && "body" in requestInit
        ? JSON.parse(String(requestInit.body))
        : null;
    expect(requestBody).toMatchObject({
      model: "qwen3.5:9b",
      response_format: { type: "json_object" }
    });
    expect(requestBody).not.toHaveProperty("temperature");
    const userPayload = JSON.parse(String(requestBody.messages[1]?.content));
    expect(userPayload.output_template.sections).toHaveLength(narrativeInput.sections.length);
    expect(userPayload.output_template.sections[0]?.metrics).toHaveLength(
      narrativeInput.sections[0]?.metrics.length ?? 0
    );
    expect(userPayload.output_template.sections[0]?.summary_narrative).toBe("");
    expect(userPayload.output_template.sections[0]?.metrics[0]).toEqual({
      narrative: "",
      takeaways: []
    });
    expect(result.sections[0]?.sectionKey).toBe(narrativeInput.sections[0]?.sectionKey);
    expect(result.sections[0]?.metrics[0]?.name).toBe(narrativeInput.sections[0]?.metrics[0]?.name);
  });

  it("retries once when the model returns invalid JSON", async () => {
    const { narrativeInput } = buildContractFixturePayloads();
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: "not-valid-json" } }]
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(buildSuccessfulResponse()), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
      );
    const logger = createMockLogger();
    const nowMs = vi
      .fn()
      .mockReturnValueOnce(1000)
      .mockReturnValueOnce(1125)
      .mockReturnValueOnce(2000)
      .mockReturnValueOnce(2200);
    const provider = createProvider(fetchMock, { logger, nowMs });

    const result = await provider.generateNarrative(narrativeInput);

    expect(result.sections).toHaveLength(narrativeInput.sections.length);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const retryRequestInit = fetchMock.mock.calls[1]?.[1];
    const retryRequestBody =
      retryRequestInit && typeof retryRequestInit === "object" && "body" in retryRequestInit
        ? JSON.parse(String(retryRequestInit.body))
        : null;
    expect(retryRequestBody.messages.at(-1)?.content).toContain("output_template");
    expect(logger.warn).toHaveBeenCalledWith(
      "Narrative provider first attempt returned invalid structured output.",
      expect.objectContaining({
        event: "narrative_provider.first_attempt_invalid",
        provider: "openai-compatible",
        model: "qwen3.5:9b",
        durationMs: 125,
        errorMessage: expect.stringContaining("valid JSON")
      })
    );
    expect(logger.info).toHaveBeenCalledWith(
      "Narrative provider retry recovered structured output.",
      expect.objectContaining({
        event: "narrative_provider.retry_recovered",
        provider: "openai-compatible",
        model: "qwen3.5:9b",
        firstAttemptDurationMs: 125,
        retryDurationMs: 200
      })
    );
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("fails fast for invalid narrative input", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    const provider = createProvider(fetchMock);

    await expect(
      provider.generateNarrative({
        schemaVersion: "narrative.v1",
        generatedAt: "not-a-date",
        context: {} as never,
        portfolio: {} as never,
        sections: [],
        globalDataQualityFlags: []
      })
    ).rejects.toBeInstanceOf(NarrativeClientInputError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps auth failures to a specific error", async () => {
    const { narrativeInput } = buildContractFixturePayloads();
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify({ error: { message: "Unauthorized" } }), { status: 401 })
      );
    const provider = createProvider(fetchMock);

    await expect(provider.generateNarrative(narrativeInput)).rejects.toBeInstanceOf(
      NarrativeProviderAuthError
    );
  });

  it("maps abort-style failures to a timeout error", async () => {
    const { narrativeInput } = buildContractFixturePayloads();
    const abortError = new Error("The operation was aborted.");
    abortError.name = "AbortError";
    const fetchMock = vi.fn<typeof fetch>().mockRejectedValue(abortError);
    const provider = createProvider(fetchMock);

    await expect(provider.generateNarrative(narrativeInput)).rejects.toBeInstanceOf(
      NarrativeProviderTimeoutError
    );
  });

  it("rejects a structurally mismatched model response", async () => {
    const { narrativeInput } = buildContractFixturePayloads();
    const mismatchedResponse = buildSuccessfulResponse();
    mismatchedResponse.choices[0]!.message.content = JSON.stringify({
      sections: [
        {
          summary_narrative: "Summary",
          key_takeaways: [],
          metrics: []
        }
      ]
    });
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(mismatchedResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );
    const provider = createProvider(fetchMock);

    await expect(provider.generateNarrative(narrativeInput)).rejects.toBeInstanceOf(
      NarrativeContractError
    );
  });

  it("rejects a response when a required prose field is missing after retry", async () => {
    const { narrativeInput } = buildContractFixturePayloads();
    const invalidPayload = {
      sections: [
        {
          key_takeaways: ["Takeaway 1"],
          metrics: [
            {
              narrative: "Narrative for market value.",
              takeaways: ["Metric takeaway"]
            },
            {
              narrative: "Narrative for holding count.",
              takeaways: ["Count takeaway"]
            }
          ]
        }
      ]
    };
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: JSON.stringify(invalidPayload) } }]
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: JSON.stringify(invalidPayload) } }]
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );
    const logger = createMockLogger();
    const nowMs = vi
      .fn()
      .mockReturnValueOnce(10)
      .mockReturnValueOnce(20)
      .mockReturnValueOnce(100)
      .mockReturnValueOnce(160);
    const provider = createProvider(fetchMock, { logger, nowMs });

    await expect(provider.generateNarrative(narrativeInput)).rejects.toBeInstanceOf(
      NarrativeContractError
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(logger.warn).toHaveBeenCalledWith(
      "Narrative provider first attempt returned invalid structured output.",
      expect.objectContaining({
        event: "narrative_provider.first_attempt_invalid",
        durationMs: 10
      })
    );
    expect(logger.error).toHaveBeenCalledWith(
      "Narrative provider retry returned invalid structured output.",
      expect.objectContaining({
        event: "narrative_provider.retry_invalid",
        provider: "openai-compatible",
        model: "qwen3.5:9b",
        firstAttemptDurationMs: 10,
        retryDurationMs: 60,
        errorMessage: expect.any(String)
      })
    );
    expect(logger.info).not.toHaveBeenCalled();
  });

  it("throws a transport error for non-timeout fetch failures", async () => {
    const { narrativeInput } = buildContractFixturePayloads();
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error("connect ECONNREFUSED 127.0.0.1:11434"));
    const provider = createProvider(fetchMock);

    await expect(provider.generateNarrative(narrativeInput)).rejects.toBeInstanceOf(
      NarrativeProviderError
    );
  });
});
