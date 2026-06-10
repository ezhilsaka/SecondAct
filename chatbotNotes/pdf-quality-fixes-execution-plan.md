# PDF Quality Fixes Execution Plan

Last updated: 2026-05-21

## 1) Goal

Improve the quality, readability, and presentation of the generated PDF report without breaking the working Phase 1 pipeline:

`Completed report run -> narrative output -> report document -> HTML -> PDF -> storage/download`

This plan ends when the generated PDF is noticeably more polished for end users while preserving:

- the current backend pipeline behavior
- deterministic analysis integrity
- successful narrative generation with the production-grade LLM path
- methodology and disclaimer correctness

## 2) Scope Boundaries (Locked)

Included:

- user-facing report formatting improvements
- executive summary wording polish
- section and metric narrative compression
- metric/label wording cleanup
- PDF length reduction for small/simple portfolios
- friendlier `N/A` handling
- consistency across report cards, findings, tables, and narrative text

Excluded in this pass:

- changes to canonical model formulas
- changes to analysis formulas or metric definitions
- changes to queueing, storage, or API behavior
- payment/auth/product workflow changes
- front-end UI changes outside the generated PDF
- major visual redesign not required to fix the reviewed quality issues

## 3) Architecture Style (Locked)

- Keep deterministic data computation separate from presentation formatting.
- Keep report assembly separate from report rendering.
- Keep narrative generation separate from final report copy shaping where possible.
- Prefer app-owned formatting and wording rules over relying on the LLM for numeric presentation.

## 4) Locked Quality Decisions

- Numbers should be formatted by the application, not by the LLM.
- The same metric should not appear nicely formatted in one part of the report and raw in another.
- The executive summary should sound productized, not backend-generated.
- Technical labels should be translated into beginner-friendly wording where helpful.
- The report should stay complete, but should avoid over-explaining small/simple portfolios.
- `N/A` is acceptable in tables, but prose around it should be more human-friendly.
- Methodology and disclaimer sections remain system-owned and should not be softened or shortened carelessly.

## 5) Main Problems To Fix

1. Raw numeric precision leaks into the PDF in too many places.
2. Executive summary wording is too technical and too raw.
3. Formatting is inconsistent across cards, findings, tables, and narrative.
4. Narrative phrasing is repetitive and template-like.
5. Some metric explanations are logically correct but awkward for humans.
6. Small portfolios produce longer-than-necessary reports.
7. Some labels are too technical for the intended audience.
8. `N/A` handling is mechanically correct, but not always polished.

## 6) Execution Strategy

We should execute these fixes in isolated phases, with verification after each phase.

Guiding principle:

- first fix formatting infrastructure
- then fix content wording
- then reduce repetition/length
- then do a final report-quality pass

This order reduces the risk of mixing presentational issues with narrative-content issues.

## 7) Workstreams

### Workstream A: Global Presentation Formatting Layer

#### Objective

Create one consistent formatting layer used everywhere the PDF displays values.

#### Problems addressed

- raw decimals in summary/findings/tables
- inconsistent positive/negative formatting
- inconsistent ratio/index display

#### Likely implementation areas

- report document assembly helpers
- PDF/HTML rendering helpers
- any existing server-side formatting utilities used by the report layer
- narrative input shaping only if preformatted display values need tightening

#### Rules to introduce

- money:
  - currency code + grouped thousands + 2 decimals
  - example: `USD 1,196.15`
- percentages:
  - usually 2 decimals, optionally 1 when visually better
  - example: `37.40%`
- counts:
  - integers only
- ratios/indexes:
  - limited precision, typically 2 decimals
- signed values:
  - consistent positive/negative display across findings, cards, and stress values
- missing values:
  - one consistent display rule

#### Deliverables

1. formatting rule set documented in code
2. reusable formatting helpers
3. report assembly updated to use them everywhere
4. regression tests for representative values

#### Verification

- unit tests for formatting helpers
- generated sample report no longer shows raw values like `1196.15374975`
- spot-check summary, findings, tables, and methodology page

---

### Workstream B: Executive Summary Polish

#### Objective

Make the executive summary feel like a polished report summary rather than a raw metric dump.

#### Problems addressed

- technical/system wording
- over-precise numbers
- weak “what this means” framing

#### Desired direction

- natural and concise wording
- rounded values
- investor-friendly explanations
- less internal phrasing such as `reporting-currency terms`

#### Likely implementation areas

- report document assembly for executive summary blocks
- narrative shaping between analysis output and executive summary rendering
- possibly prompt/context phrasing only if summary prose depends directly on narrative output

#### Deliverables

1. cleaner executive summary text rules
2. improved summary sentence structure
3. summary cards/findings using the same formatting layer from Workstream A

#### Verification

- executive summary reads naturally in a fresh PDF
- no raw numeric strings
- summary remains faithful to the deterministic outputs

---

### Workstream C: Report-Wide Formatting Consistency

#### Objective

Ensure the same metric family is displayed consistently across all report surfaces.

#### Problems addressed

- nicely formatted values in one place but raw values elsewhere
- inconsistent negative sign and percentage presentation

#### Areas to check

- executive summary
- section highlight cards
- findings
- tables
- scenario/stress sections
- methodology metadata where applicable

#### Deliverables

1. consistency checklist for all major report sections
2. code cleanup where duplicate formatting logic exists
3. tests for representative document sections

#### Verification

- no mixed formatting styles for the same metric type
- generated HTML/PDF samples look internally consistent

---

### Workstream D: Narrative Compression and Repetition Reduction

#### Objective

Reduce repetitive, template-like phrasing without weakening the report’s usefulness.

#### Problems addressed

- repeated sentence openings
- repeated explanation structure
- overlong sections for small portfolios

#### Desired direction

- shorter section intros
- tighter metric narratives
- fewer repeated transitions
- preserve clarity for DIY investors

#### Likely implementation areas

- narrative prompt guidance
- provider output handling only if needed
- report assembly rules for how much narrative gets displayed
- possible trimming rules for small/simple portfolios

#### Important guardrail

Do not change the persisted narrative contract unless absolutely necessary. Prefer:

- prompt refinement
- display-layer trimming
- section-specific rendering rules

#### Deliverables

1. reduced repetition in rendered report text
2. shorter intros and tighter metric prose
3. improved readability without removing important meaning

#### Verification

- compare old vs new PDF text for repeated phrases
- confirm no broken narrative sections
- verify small portfolios produce noticeably tighter reports

---

### Workstream E: Metric-Specific Wording Cleanup

#### Objective

Rewrite awkward but technically correct phrasing into investor-friendly wording.

#### Problems addressed

- awkward breakeven wording
- awkward ratio/index wording like `HHI is 0.65x`
- phrasing that is mathematically correct but cognitively awkward

#### Likely implementation areas

- report copy layer
- label/description helpers
- prompt guidance for specific metric families

#### Deliverables

1. metric-specific wording map for awkward metrics
2. friendlier phrasing in rendered report
3. preserved factual meaning

#### Verification

- targeted PDF checks for known awkward metrics
- language reads naturally to a non-technical investor

---

### Workstream F: Beginner-Friendly Label Simplification

#### Objective

Reduce jargon in visible labels while preserving conceptual meaning.

#### Problems addressed

- labels like `Concentration (HHI)`
- `Benchmark-lite`
- `reporting-currency terms`

#### Desired direction

- plainer surface labels
- technical terms retained only where still useful
- optional short clarifiers if needed

#### Deliverables

1. visible label audit
2. approved replacements for user-facing labels
3. report rendering updated with friendlier text

#### Verification

- visible labels feel understandable to a DIY investor
- methodology can still preserve precision where necessary

---

### Workstream G: `N/A` Handling Polish

#### Objective

Keep missing-data handling accurate, but soften the user-facing wording around it.

#### Problems addressed

- mechanical `N/A` feel
- insufficient explanation in prose around unavailable values

#### Desired direction

- tables may still use `N/A`
- nearby prose should explain why when useful
- avoid sounding like a raw system output

#### Deliverables

1. clear rules for table vs prose handling of unavailable values
2. better fallback wording in visible report copy

#### Verification

- sample PDFs show clearer handling for no-loser/no-winner style cases
- no misleading invented content

---

### Workstream H: Length Optimization for Small Portfolios

#### Objective

Reduce unnecessary report length without dropping required sections.

#### Problems addressed

- 16-page report for a 2-holding portfolio feels long
- too much repeated explanation for simple datasets

#### Likely implementation directions

- shorter section intros
- tighter metric narratives
- possible conditional rendering of secondary explanatory text for very small portfolios
- more compact summary/findings layout where safe

#### Guardrails

- do not remove methodology
- do not remove disclaimer
- do not hide important risk interpretation
- avoid coupling length optimization to specific sample data

#### Deliverables

1. shorter report for small/simple portfolios
2. preserved full pipeline completeness
3. no reduction in core investor understanding

#### Verification

- compare page count before/after on the sample portfolio
- confirm the report still feels complete

## 8) Recommended Execution Order

### Phase 1

Workstream A: Global Presentation Formatting Layer

### Phase 2

Workstream B: Executive Summary Polish

### Phase 3

Workstream C: Report-Wide Formatting Consistency

### Phase 4

Workstream E: Metric-Specific Wording Cleanup

### Phase 5

Workstream F: Beginner-Friendly Label Simplification

### Phase 6

Workstream G: `N/A` Handling Polish

### Phase 7

Workstream D: Narrative Compression and Repetition Reduction

### Phase 8

Workstream H: Length Optimization for Small Portfolios

### Phase 9

Final PDF quality review and visual/content signoff

## 9) Testing and Verification Plan

For each phase:

1. implement only the scoped changes for that phase
2. run focused tests first
3. run broader backend safety checks
4. generate a fresh PDF sample
5. compare old vs new output for regressions

### Minimum verification after each phase

- relevant unit tests pass
- `npm run typecheck`
- `npm run lint`
- targeted report generation succeeds

### Strong verification at milestone phases

- generate a real sample PDF through the full run
- read PDF text/content for regression signals
- visually inspect key pages when possible:
  - cover
  - executive summary
  - one table-heavy section
  - one narrative-heavy section
  - methodology
  - disclaimer

## 10) Risks and Guardrails

### Main risks

1. formatting changes create inconsistencies across sections
2. prompt/narrative changes degrade content quality
3. report shortening removes useful investor guidance
4. label simplification loses important meaning
5. touching too many layers at once causes regressions

### Guardrails

- do not combine too many workstreams in one implementation pass
- keep formatting logic centralized
- prefer deterministic app-owned formatting over LLM-driven formatting
- preserve the current final `NarrativeOutput` contract unless there is a strong reason to change it
- generate a real PDF sample after major text/formatting changes

## 11) Acceptance Criteria

This PDF quality-fix plan is complete when:

1. raw engineering-style numeric values no longer leak into the visible report
2. executive summary reads naturally and uses rounded/formatted values
3. the same metric type is formatted consistently across the report
4. repetitive narrative phrasing is materially reduced
5. awkward metric wording is improved for investor readability
6. visible labels are more beginner-friendly where needed
7. `N/A` handling feels more polished without becoming misleading
8. small/simple portfolios produce shorter, tighter reports
9. the pipeline still generates PDFs successfully end to end
10. no unrelated backend functionality regresses

## 12) Practical Working Style For Execution

When we start implementing, we should handle this one phase at a time:

1. agree the phase scope
2. implement only that slice
3. verify thoroughly
4. update local notes if we lock a new decision
5. then move to the next phase

That is the safest way to improve report quality while protecting the working backend pipeline.

## 13) Execution Log

### Phase 1: Global Presentation Formatting Layer

Status: completed on 2026-05-02

Locked display rules:

- currency uses the reporting-currency code with two decimals, for example `USD 1,196.15`
- negative currency uses a leading sign before the currency code, for example `-USD 1,196.15`
- percentages are plain by default, for example `37.4%`
- performance/emphasis percentages may show a positive sign where helpful, for example `+37.4%`
- generic ratios/indexes do not use an `x` suffix, for example `0.65`
- counts render as whole numbers

Implementation notes:

- added a shared report formatting helper
- wired report HTML metric/table/executive-summary values through the shared formatter
- wired narrative prompt formatted values through the same shared formatter
- formatted deterministic analysis summaries/findings that were previously embedding raw decimals
- added focused tests for currency, percentage, count, ratio, narrative input formatting, report HTML formatting, and analysis prose formatting

### Phase 2: Executive Summary Polish

Status: completed on 2026-05-03

Locked behavior:

- keep the existing six-card executive summary layout
- add one concise overview paragraph before the cards
- replace stitched-together section findings with curated executive findings
- generate executive findings deterministically from summary metrics
- keep cautionary language calm, using wording such as `main item to watch`

Implementation notes:

- added deterministic executive summary copy helpers in the report HTML renderer
- summary overview now highlights portfolio P&L and concentration in plain language
- key findings now focus on portfolio return, concentration, downside shock when available, and winners/losers
- missing percentage context is omitted instead of rendering `(N/A)`
- added focused renderer tests for the overview and curated executive findings

### Phase 3: Report-Wide Formatting Consistency

Status: completed on 2026-05-11

Locked behavior:

- numeric table columns are right-aligned
- numeric table values should stay on one line where possible
- text table columns remain left-aligned
- executive and metric card values use regular report text with tabular numerals instead of full monospace styling
- `N/A` values render in neutral text color even when the metric's unavailable source metric has positive/negative emphasis

Implementation notes:

- added numeric/text cell classes for table headers and cells
- reduced table font size slightly to improve fit for wider financial tables
- added no-wrap and tabular-numeric styling for numeric table cells and card values
- removed monospace styling from executive and metric card values
- made unavailable metric and executive P&L values visually neutral
- rendered an updated fixture PDF through Playwright and inspected key pages with Poppler-generated PNGs
- added focused renderer tests for table alignment classes, card typography behavior, and neutral `N/A` rendering

### Phase 4: Metric-Specific Wording Cleanup

Status: completed on 2026-05-12

Locked behavior:

- keep visible report labels mostly unchanged; broader label simplification remains Phase 5
- describe negative breakeven values as above-cost-basis cushion, not as needing a negative return
- describe modeled drawdowns and scenario losses as readable reductions/loss amounts
- describe effective positions as how many equally sized positions the portfolio behaves like
- describe equal-weight benchmark comparison as an internal same-holdings comparison, not an external market index
- bump prompt guidance to `narrative-explainer.v2` without changing the narrative JSON contract

Implementation notes:

- added deterministic copy helpers for breakeven, drawdown, scenario P&L, effective-position, and active-return findings
- updated executive shock finding wording to avoid negative estimated-move phrasing
- tightened narrative interpretation hints for HHI, effective positions, drawdown, breakeven, and equal-weight comparison
- updated the narrative system prompt with targeted guidance for the same awkward metric families
- added regression tests to prevent `would need -X%`, negative drawdown phrasing, negative scenario P&L phrasing, and external-benchmark ambiguity from returning

### Phase 5: Beginner-Friendly Label Simplification

Status: completed on 2026-05-21

Locked behavior:

- simplify visible user-facing report labels while preserving internal keys and schemas
- keep methodology metadata labels technical for audit/debug precision
- use `Paper Gain / Loss` instead of `P&L` in visible report labels
- use `Concentration Score` instead of exposing HHI in executive cards and metric labels
- use `What-If Stress Tests` for the scenario/stress section title
- keep equal-weight benchmark language, but remove `Benchmark-lite` from the visible section title

Implementation notes:

- updated deterministic analysis section titles, metric labels, table titles, and table column labels
- updated executive summary card labels in the report HTML renderer
- left contract keys and section keys unchanged to avoid storage/API contract drift
- allowed narrative input to inherit the simpler display names from analysis output
- added focused tests for simplified labels and old-jargon regression checks

### Phase 6: `N/A` Handling Polish

Status: completed on 2026-05-21

Locked behavior:

- metric and executive cards use `Not available` for unavailable values
- dense tables continue to use compact `N/A`
- section-level data-quality notes render near the top of the section, before tables and narrative
- data-quality notes are deduped at render time
- raw data-quality flag keys stay unchanged in contracts/storage, but render as human-friendly labels in the PDF
- visible report copy should say `downside risk` instead of `risk proxy`

Implementation notes:

- added card-specific unavailable-value display handling in the report HTML renderer
- added friendly data-quality flag labels and render-time deduplication
- added page-break protection for data-quality note boxes
- moved section data-quality notes closer to the metrics they explain
- replaced the remaining visible `Risk-proxy metrics` section summary with `Downside risk metrics`
- added focused tests for friendly unavailable card values, compact table `N/A`, deduped data-quality labels, page-break protection, and the downside-risk wording regression

### Phase 7: Narrative Compression and Repetition Reduction

Status: completed on 2026-05-21

Locked behavior:

- concise prose must still explain the practical meaning for a DIY investor
- prompt iteration is tracked as `narrative-explainer.v3`
- narrative JSON contract remains unchanged
- stored narrative output is not mutated by display trimming
- rendered section takeaways and metric takeaways are capped to one each
- long rendered narrative text is trimmed only at sentence boundaries

Implementation notes:

- tightened the narrative system prompt to ask for 1-2 sentence section summaries and metric narratives
- added explicit prompt guidance to avoid vague brevity, repeated missing-data warnings, and repeated sentence openings such as `This metric...`
- added prompt tests for Phase 7 compactness and contract preservation
- added renderer guardrails for rendered narrative length and takeaway counts
- added renderer tests for takeaway caps and sentence-boundary trimming
- rendered a fixture PDF and confirmed methodology shows `narrative-explainer.v3`

### Phase 8: Length Optimization for Small Portfolios

Status: completed on 2026-05-22

Locked behavior:

- keep all major report sections and page breaks intact
- keep all analysis table rows visible; do not truncate holdings in this phase
- preserve plain-English metric explanations even when a metric is unavailable
- suppress metric-level takeaway bullets for unavailable metrics to reduce repeated `N/A` explanations
- keep Phase 8 renderer-only; no narrative prompt version bump

Implementation notes:

- added renderer awareness of unavailable analysis metrics when rendering narrative output
- kept unavailable metric headings and narratives, but removed their repeated metric takeaway bullets
- kept available metric takeaway bullets unchanged
- tightened dense table spacing slightly while preserving readability
- added renderer regression tests for unavailable takeaway suppression, available takeaway preservation, and compact table spacing
- verification passed: focused renderer tests, full `npm test`, `npm run typecheck`, and `npm run lint`

### Phase 9: Final PDF Quality Review and Visual/Content Signoff

Status: completed on 2026-05-24

Locked behavior:

- table rows should avoid splitting across PDF page breaks where Chromium can honor print CSS
- table headers should be eligible to repeat on continued PDF table pages
- no report sections, table rows, methodology, or disclaimer are removed as part of final polish
- Phase 9 remains renderer-only; no schema, prompt, or pipeline contract changes

Implementation notes:

- reviewed `report (12).pdf` for metadata, text regressions, old labels, methodology, disclaimer, and visual structure
- identified awkward long-table row splitting as the only final polish item before signoff
- added PDF-friendly table CSS using `display: table-header-group` for table headers
- added `break-inside: avoid` and `page-break-inside: avoid` on table body rows
- added renderer regression coverage for table continuation/page-break guardrails
- verification passed: focused renderer tests, full `npm test`, `npm run typecheck`, and `npm run lint`
- visually reviewed `report (13).pdf` and confirmed the table continuation polish is acceptable for signoff
