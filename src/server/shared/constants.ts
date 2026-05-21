/**
 * Version pins for contract payloads emitted across the report pipeline.
 */
export const CONTRACT_SCHEMA_VERSIONS = {
  marketData: "market-data.v1",
  canonicalModel: "canonical-model.v1",
  analysis: "analysis.v1",
  narrative: "narrative.v1",
  report: "report.v1"
} as const;

/**
 * System-owned disclaimer content for generated reports.
 */
export const REPORT_DISCLAIMER_VERSION = "report-disclaimer.v1";
export const REPORT_DISCLAIMER_TEXT =
  "This report is provided for informational and educational purposes only. It is not investment, financial, legal, or tax advice and should not be relied on as a recommendation to buy, sell, or hold any security. Consider consulting a qualified professional before making investment decisions.";

/**
 * Prompt version used by the narrative provider. This stays separate from the
 * contract schema version so prompt iteration does not imply payload drift.
 */
export const NARRATIVE_EXPLAINER_PROMPT_VERSION = "narrative-explainer.v2";

/**
 * Contract design note: analysis sections should be driven by the product taxonomy,
 * not hardcoded provider-specific assumptions.
 */
export const ANALYSIS_SECTION_TAXONOMY_NOTE =
  "Use product-owned taxonomy keys and titles when materializing analysis sections for a report run.";
