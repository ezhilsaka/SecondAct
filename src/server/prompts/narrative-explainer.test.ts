import { describe, expect, it } from "vitest";

import { buildContractFixturePayloads } from "@/server/contracts/fixtures";
import { NARRATIVE_EXPLAINER_PROMPT_VERSION } from "@/server/shared/constants";

import {
  buildNarrativeExplainerUserPrompt,
  NARRATIVE_EXPLAINER_SYSTEM_PROMPT
} from "./narrative-explainer";

describe("narrative explainer prompt", () => {
  it("uses the Phase 7 prompt version", () => {
    expect(NARRATIVE_EXPLAINER_PROMPT_VERSION).toBe("narrative-explainer.v3");
  });

  it("asks for concise prose without losing beginner-friendly meaning", () => {
    expect(NARRATIVE_EXPLAINER_SYSTEM_PROMPT).toContain(
      "Be concise, but do not become vague"
    );
    expect(NARRATIVE_EXPLAINER_SYSTEM_PROMPT).toContain(
      "A shorter answer must still explain the right practical meaning"
    );
    expect(NARRATIVE_EXPLAINER_SYSTEM_PROMPT).toContain(
      "Keep each metric narrative to 1-2 clear sentences"
    );
    expect(NARRATIVE_EXPLAINER_SYSTEM_PROMPT).toContain(
      "Use 0-1 section takeaway and 0-1 metric takeaway"
    );
    expect(NARRATIVE_EXPLAINER_SYSTEM_PROMPT).toContain(
      "Avoid starting most metric narratives with \"This metric...\""
    );
    expect(NARRATIVE_EXPLAINER_SYSTEM_PROMPT).toContain(
      "Keep wording beginner-friendly"
    );
  });

  it("keeps the user prompt output template contract unchanged", () => {
    const { narrativeInput } = buildContractFixturePayloads();
    const promptPayload = JSON.parse(buildNarrativeExplainerUserPrompt(narrativeInput));

    expect(promptPayload.output_template.sections).toHaveLength(narrativeInput.sections.length);
    expect(promptPayload.output_template.sections[0].summary_narrative).toBe("");
    expect(promptPayload.output_template.sections[0].key_takeaways).toEqual([]);
    expect(promptPayload.output_template.sections[0].metrics[0]).toEqual({
      narrative: "",
      takeaways: []
    });
  });
});
