import { afterEach, describe, expect, it, vi } from "vitest";

import { buildContractFixturePayloads } from "@/server/contracts/fixtures";
import {
  NarrativeClientInputError,
  NarrativeContractError,
  NarrativeProviderAuthError,
  NarrativeProviderError,
  NarrativeProviderTimeoutError,
  OpenAICompatibleNarrativeProvider
} from "@/server/providers/openai-compatible-narrative-provider";

function createProvider(fetchImplementation: typeof fetch) {
  return new OpenAICompatibleNarrativeProvider({
    providerName: "openai-compatible",
    baseUrl: "http://127.0.0.1:11434/v1",
    apiKey: "ollama",
    model: "qwen3.5:9b",
    timeoutMs: 5000,
    fetchImplementation,
    now: () => new Date("2026-04-06T12:30:00.000Z")
  });
}

function buildSuccessfulResponse() {
  return {
    choices: [
      {
        message: {
          content: JSON.stringify({
            sections: [
              {
                section_key: "section-1",
                section_title: "Section 1",
                summary_narrative: "Summary for Section 1.",
                key_takeaways: ["Takeaway 1"],
                metrics: [
                  {
                    name: "section-1-market-value",
                    display_name: "Market value",
                    narrative: "Narrative for market value.",
                    takeaways: ["Metric takeaway"]
                  },
                  {
                    name: "section-1-holding-count",
                    display_name: "Holding count",
                    narrative: "Narrative for holding count.",
                    takeaways: ["Count takeaway"]
                  }
                ]
              },
              {
                section_key: "section-2",
                section_title: "Section 2",
                summary_narrative: "Summary for Section 2.",
                key_takeaways: ["Takeaway 2"],
                metrics: [
                  {
                    name: "section-2-market-value",
                    display_name: "Market value",
                    narrative: "Narrative for market value.",
                    takeaways: ["Metric takeaway"]
                  },
                  {
                    name: "section-2-holding-count",
                    display_name: "Holding count",
                    narrative: "Narrative for holding count.",
                    takeaways: ["Count takeaway"]
                  }
                ]
              },
              {
                section_key: "section-3",
                section_title: "Section 3",
                summary_narrative: "Summary for Section 3.",
                key_takeaways: ["Takeaway 3"],
                metrics: [
                  {
                    name: "section-3-market-value",
                    display_name: "Market value",
                    narrative: "Narrative for market value.",
                    takeaways: ["Metric takeaway"]
                  },
                  {
                    name: "section-3-holding-count",
                    display_name: "Holding count",
                    narrative: "Narrative for holding count.",
                    takeaways: ["Count takeaway"]
                  }
                ]
              },
              {
                section_key: "section-4",
                section_title: "Section 4",
                summary_narrative: "Summary for Section 4.",
                key_takeaways: ["Takeaway 4"],
                metrics: [
                  {
                    name: "section-4-market-value",
                    display_name: "Market value",
                    narrative: "Narrative for market value.",
                    takeaways: ["Metric takeaway"]
                  },
                  {
                    name: "section-4-holding-count",
                    display_name: "Holding count",
                    narrative: "Narrative for holding count.",
                    takeaways: ["Count takeaway"]
                  }
                ]
              },
              {
                section_key: "section-5",
                section_title: "Section 5",
                summary_narrative: "Summary for Section 5.",
                key_takeaways: ["Takeaway 5"],
                metrics: [
                  {
                    name: "section-5-market-value",
                    display_name: "Market value",
                    narrative: "Narrative for market value.",
                    takeaways: ["Metric takeaway"]
                  },
                  {
                    name: "section-5-holding-count",
                    display_name: "Holding count",
                    narrative: "Narrative for holding count.",
                    takeaways: ["Count takeaway"]
                  }
                ]
              },
              {
                section_key: "section-6",
                section_title: "Section 6",
                summary_narrative: "Summary for Section 6.",
                key_takeaways: ["Takeaway 6"],
                metrics: [
                  {
                    name: "section-6-market-value",
                    display_name: "Market value",
                    narrative: "Narrative for market value.",
                    takeaways: ["Metric takeaway"]
                  },
                  {
                    name: "section-6-holding-count",
                    display_name: "Holding count",
                    narrative: "Narrative for holding count.",
                    takeaways: ["Count takeaway"]
                  }
                ]
              },
              {
                section_key: "section-7",
                section_title: "Section 7",
                summary_narrative: "Summary for Section 7.",
                key_takeaways: ["Takeaway 7"],
                metrics: [
                  {
                    name: "section-7-market-value",
                    display_name: "Market value",
                    narrative: "Narrative for market value.",
                    takeaways: ["Metric takeaway"]
                  },
                  {
                    name: "section-7-holding-count",
                    display_name: "Holding count",
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
    const provider = createProvider(fetchMock);

    const result = await provider.generateNarrative(narrativeInput);

    expect(result.sections).toHaveLength(narrativeInput.sections.length);
    expect(fetchMock).toHaveBeenCalledTimes(2);
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
          section_key: "different-section",
          section_title: "Section 1",
          summary_narrative: "Summary",
          key_takeaways: [],
          metrics: [
            {
              name: "section-1-market-value",
              display_name: "Market value",
              narrative: "Narrative",
              takeaways: []
            },
            {
              name: "section-1-holding-count",
              display_name: "Holding count",
              narrative: "Narrative",
              takeaways: []
            }
          ]
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
