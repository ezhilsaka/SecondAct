import type {
  AnalysisMetric,
  AnalysisTable,
  NarrativeOutput,
  NarrativeSection,
  ReportDocument
} from "@/server/contracts";
import {
  formatReportCount,
  formatReportCurrency,
  formatReportPercentage,
  formatReportRatio,
  formatReportValue
} from "@/server/shared/report-formatting";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDate(iso: string | null): string {
  if (!iso) return "N/A";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "N/A";
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "N/A";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "N/A";
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short"
  });
}

function emphasisColor(emphasis: string | undefined): string {
  switch (emphasis) {
    case "positive":
      return "#059669";
    case "negative":
      return "#e11d48";
    case "cautionary":
      return "#ea580c";
    default:
      return "#24292f";
  }
}

function displayValueColor(displayValue: string, emphasis: string | undefined): string {
  return isUnavailableDisplayValue(displayValue) ? "#24292f" : emphasisColor(emphasis);
}

function isNumericUnit(unit: string | undefined): boolean {
  return unit === "currency" || unit === "percentage" || unit === "count" || unit === "ratio";
}

function parseReportNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatPnlWithOptionalPercent(
  amount: string | number | null | undefined,
  percent: string | number | null | undefined,
  currency: string
): string {
  if (parseReportNumber(amount) === null) {
    return "N/A";
  }

  const amountText = formatReportCurrency(amount, currency);
  return parseReportNumber(percent) === null
    ? amountText
    : `${amountText} (${formatReportPercentage(percent, { showPositiveSign: true })})`;
}

function formatAbsoluteCurrency(
  value: string | number | null | undefined,
  currency: string
): string {
  const parsed = parseReportNumber(value);
  return parsed === null
    ? formatReportCurrency(value, currency)
    : formatReportCurrency(Math.abs(parsed), currency);
}

function metricDisplayValue(metric: AnalysisMetric, currency: string): string {
  if (metric.displayValue && (metric.unit === "text" || metric.unit === undefined)) {
    return cardDisplayValue(metric.displayValue);
  }

  return cardDisplayValue(formatReportValue(metric.value, metric.unit, { currency }));
}

function unavailableMetricNames(metrics: AnalysisMetric[], currency: string): Set<string> {
  return new Set(
    metrics
      .filter((metric) => isUnavailableDisplayValue(metricDisplayValue(metric, currency)))
      .map((metric) => metric.key)
  );
}

const SECTION_NARRATIVE_MAX_CHARS = 500;
const METRIC_NARRATIVE_MAX_CHARS = 420;
const TAKEAWAY_MAX_CHARS = 180;
const MAX_RENDERED_TAKEAWAYS = 1;

function normalizeNarrativeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function trimToSentenceBoundary(value: string, maxChars: number): string {
  const normalized = normalizeNarrativeWhitespace(value);
  if (normalized.length <= maxChars) {
    return normalized;
  }

  const sentences = normalized.match(/[^.!?]+[.!?]+(?:["')\]]+)?|[^.!?]+$/g) ?? [normalized];
  let result = "";

  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim();
    const candidate = result ? `${result} ${trimmedSentence}` : trimmedSentence;

    if (candidate.length > maxChars) {
      break;
    }

    result = candidate;
  }

  // If the first sentence is long, prefer one complete sentence over a mid-sentence cutoff.
  return result || sentences[0]?.trim() || normalized;
}

function renderedSectionNarrative(value: string): string {
  return trimToSentenceBoundary(value, SECTION_NARRATIVE_MAX_CHARS);
}

function renderedMetricNarrative(value: string): string {
  return trimToSentenceBoundary(value, METRIC_NARRATIVE_MAX_CHARS);
}

function renderedTakeaways(takeaways: string[]): string[] {
  return takeaways
    .slice(0, MAX_RENDERED_TAKEAWAYS)
    .map((takeaway) => trimToSentenceBoundary(takeaway, TAKEAWAY_MAX_CHARS));
}

function isUnavailableDisplayValue(value: string): boolean {
  return value === "N/A" || value === "Not available";
}

function cardDisplayValue(value: string): string {
  return value === "N/A" ? "Not available" : value;
}

const REPORT_VISUAL_COLORS = [
  "#4338ca",
  "#5b4de1",
  "#059669",
  "#e11d48",
  "#ea580c",
  "#7c3aed",
  "#64748b"
];

function allocationLabel(ticker: string, securityName: string | null | undefined): string {
  const trimmedName = securityName?.trim();
  return trimmedName ? `${ticker} - ${trimmedName}` : ticker;
}

function buildPortfolioAllocationVisual(report: ReportDocument): string {
  const weightedHoldings = report.canonicalSnapshot.holdings
    .map((holding) => ({
      ticker: holding.ticker,
      securityName: holding.securityName,
      weight: parseReportNumber(holding.portfolioWeightPercent)
    }))
    .filter(
      (holding): holding is typeof holding & { weight: number } =>
        holding.weight !== null && holding.weight > 0
    )
    .sort((a, b) => b.weight - a.weight);

  if (weightedHoldings.length === 0) {
    return `
      <div class="allocation-visual allocation-visual-empty">
        <div class="visual-kicker">Portfolio structure</div>
        <p>Allocation is not available because holding weights could not be calculated safely.</p>
      </div>
    `;
  }

  const totalWeight = weightedHoldings.reduce((total, holding) => total + holding.weight, 0);
  const normalizedHoldings = weightedHoldings.map((holding) => ({
    ...holding,
    weight: (holding.weight / totalWeight) * 100
  }));
  const visibleHoldings = normalizedHoldings.slice(0, 5);
  const visibleWeight = visibleHoldings.reduce((total, holding) => total + holding.weight, 0);
  const remainder = Math.max(0, 100 - visibleWeight);
  const segments = [
    ...visibleHoldings.map((holding) => ({
      label: allocationLabel(holding.ticker, holding.securityName),
      shortLabel: holding.ticker,
      weight: holding.weight
    })),
    ...(remainder > 0.25
      ? [{ label: "Other holdings", shortLabel: "Other", weight: remainder }]
      : [])
  ];

  let offset = 0;
  const donutSegments = segments
    .map((segment, index) => {
      const segmentMarkup = `
        <circle
          class="allocation-donut-segment"
          cx="50"
          cy="50"
          r="36"
          pathLength="100"
          stroke="${REPORT_VISUAL_COLORS[index % REPORT_VISUAL_COLORS.length]}"
          stroke-dasharray="${segment.weight.toFixed(3)} ${(100 - segment.weight).toFixed(3)}"
          stroke-dashoffset="-${offset.toFixed(3)}"
          transform="rotate(-90 50 50)"
        />
      `;
      offset += segment.weight;
      return segmentMarkup;
    })
    .join("");

  const legend = segments
    .map(
      (segment, index) => `
        <div class="allocation-legend-item">
          <span class="allocation-legend-swatch" style="background: ${REPORT_VISUAL_COLORS[index % REPORT_VISUAL_COLORS.length]};"></span>
          <span class="allocation-legend-name">${esc(segment.shortLabel)}</span>
          <span class="allocation-legend-value">${formatReportPercentage(segment.weight)}</span>
        </div>
      `
    )
    .join("");

  const stackedBar = segments
    .map(
      (segment, index) =>
        `<span class="allocation-bar-segment" style="width: ${Math.min(100, segment.weight)}%; background: ${REPORT_VISUAL_COLORS[index % REPORT_VISUAL_COLORS.length]};"></span>`
    )
    .join("");

  return `
    <div class="allocation-visual">
      <div class="allocation-visual-copy">
        <div class="visual-kicker">Portfolio structure</div>
        <h3>Capital Allocation</h3>
        <p>Top holdings by portfolio weight, with the remaining positions grouped for readability.</p>
        <div class="allocation-bar" aria-label="Portfolio allocation bar">${stackedBar}</div>
        <div class="allocation-total"><span>${formatReportCount(report.canonicalSnapshot.portfolioTotals.holdingCount)} positions</span><strong>${formatReportPercentage(100)} allocated</strong></div>
      </div>
      <div class="allocation-visual-chart">
        <svg class="allocation-donut" viewBox="0 0 100 100" role="img" aria-label="Portfolio allocation by holding">
          <circle cx="50" cy="50" r="36" pathLength="100" class="allocation-donut-track" />
          ${donutSegments}
          <text x="50" y="47" class="allocation-donut-value">${formatReportCount(report.canonicalSnapshot.portfolioTotals.holdingCount)}</text>
          <text x="50" y="58" class="allocation-donut-label">positions</text>
        </svg>
        <div class="allocation-legend">${legend}</div>
      </div>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// CSS
// ---------------------------------------------------------------------------

function buildStyles(): string {
  return `
    @page {
      size: A4;
      margin: 16mm 16mm 18mm 16mm;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    :root {
      --canvas: #faf8ff;
      --surface: #ffffff;
      --surface-low: #f2f3ff;
      --surface-high: #e2e7ff;
      --surface-deep: #dae2fd;
      --ink: #131b2e;
      --muted: #64748b;
      --outline: #c7c4d7;
      --primary: #4338ca;
      --primary-dark: #2a14b4;
      --positive: #059669;
      --positive-soft: #d1fae5;
      --negative: #e11d48;
      --negative-soft: #ffe4e6;
      --warning: #ea580c;
      --warning-soft: #ffedd5;
      --warm-legacy: #f96b2a;
    }

    body {
      font-family: 'Avenir Next', 'Helvetica Neue', Helvetica, Arial, sans-serif;
      font-size: 10pt;
      line-height: 1.5;
      color: var(--ink);
      background: var(--canvas);
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    h1, h2, h3, h4 {
      font-family: 'Avenir Next', 'Helvetica Neue', Helvetica, Arial, sans-serif;
      color: var(--ink);
    }

    h1 { font-size: 28pt; font-weight: 800; letter-spacing: -0.5pt; }
    h2 { font-size: 16pt; font-weight: 700; margin-bottom: 0; letter-spacing: -0.2pt; }
    h3 { font-size: 11.5pt; font-weight: 700; margin-bottom: 6pt; }
    h4 { font-size: 9pt; font-weight: 700; margin-bottom: 4pt; }

    .accent { color: var(--primary); }
    .accent-warm { color: var(--warm-legacy); }
    .muted { color: var(--muted); }
    .mono { font-family: 'SFMono-Regular', Menlo, Consolas, 'Courier New', monospace; }

    /* Cover page */
    .cover {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: flex-start;
      min-height: 250mm;
      padding: 34pt 30pt;
      background: var(--surface-low);
      border-left: 10pt solid var(--primary);
      page-break-after: always;
    }
    .cover-brand {
      display: inline-flex;
      align-items: center;
      gap: 8pt;
      font-size: 8pt;
      font-weight: 700;
      letter-spacing: 1.4pt;
      text-transform: uppercase;
      color: #ffffff;
      background: var(--primary-dark);
      padding: 7pt 10pt;
      border-radius: 4pt;
      margin-bottom: 18pt;
    }
    .cover h1 {
      margin-bottom: 12pt;
      line-height: 1.12;
      max-width: 390pt;
    }
    .cover-subtitle {
      max-width: 390pt;
      font-size: 11pt;
      color: var(--muted);
      margin-bottom: 12pt;
    }
    .cover-meta {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 7pt;
      width: 100%;
      max-width: 430pt;
      margin-top: 22pt;
      color: var(--ink);
      line-height: 1.5;
    }
    .cover-meta-item {
      background: var(--surface);
      border: 1pt solid var(--outline);
      border-radius: 5pt;
      padding: 8pt 10pt;
    }
    .cover-meta-label {
      display: block;
      color: var(--muted);
      font-family: 'SFMono-Regular', Menlo, Consolas, 'Courier New', monospace;
      font-size: 7pt;
      font-weight: 700;
      letter-spacing: 0.7pt;
      text-transform: uppercase;
      margin-bottom: 3pt;
    }
    .cover-divider {
      width: 100%;
      max-width: 430pt;
      height: 5pt;
      background: var(--primary);
      margin: 20pt 0 14pt;
      border: none;
      border-radius: 999pt;
    }

    /* Executive summary */
    .exec-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8pt;
      margin: 12pt 0 16pt;
    }
    .exec-grid-secondary .exec-card {
      grid-column: span 2;
    }
    .exec-overview {
      margin: 0 0 12pt;
      font-size: 10.5pt;
      color: var(--ink);
      max-width: 540pt;
    }
    .exec-card {
      min-height: 62pt;
      background: var(--surface);
      border: 1pt solid var(--outline);
      border-top: 3pt solid var(--primary);
      border-radius: 5pt;
      padding: 9pt 10pt;
      box-shadow: 0 2pt 8pt rgba(42, 20, 180, 0.06);
    }
    .exec-card-positive {
      border-top-color: var(--positive);
      background: var(--positive-soft);
    }
    .exec-card-negative {
      border-top-color: var(--negative);
      background: var(--negative-soft);
    }
    .exec-card-warning {
      border-top-color: var(--warning);
      background: var(--warning-soft);
    }
    .exec-card-label {
      font-family: 'SFMono-Regular', Menlo, Consolas, 'Courier New', monospace;
      font-size: 7pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.7pt;
      color: var(--muted);
      margin-bottom: 4pt;
    }
    .exec-card-value {
      font-size: 13pt;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }

    /* Section blocks */
    .section-block {
      margin-bottom: 20pt;
      break-before: auto;
      page-break-before: auto;
    }
    .section-header {
      display: flex;
      align-items: center;
      background: var(--surface-low);
      border-left: 4pt solid var(--primary);
      border-bottom: 1pt solid var(--outline);
      border-radius: 4pt;
      padding: 8pt 10pt;
      margin-bottom: 12pt;
      break-inside: avoid;
      page-break-inside: avoid;
      break-after: avoid;
      page-break-after: avoid;
    }

    /* Portfolio visual summary */
    .allocation-visual {
      display: grid;
      grid-template-columns: 1.15fr 0.85fr;
      gap: 14pt;
      align-items: center;
      margin: 10pt 0 18pt;
      padding: 12pt;
      background: var(--surface);
      border: 1pt solid var(--outline);
      border-radius: 6pt;
      box-shadow: 0 3pt 10pt rgba(42, 20, 180, 0.07);
    }
    .allocation-visual-empty {
      display: block;
    }
    .visual-kicker {
      color: var(--primary);
      font-family: 'SFMono-Regular', Menlo, Consolas, 'Courier New', monospace;
      font-size: 7pt;
      font-weight: 700;
      letter-spacing: 0.8pt;
      text-transform: uppercase;
      margin-bottom: 4pt;
    }
    .allocation-visual h3 {
      margin-bottom: 4pt;
    }
    .allocation-visual p {
      color: var(--muted);
      font-size: 8.5pt;
      max-width: 250pt;
    }
    .allocation-bar {
      display: flex;
      width: 100%;
      height: 8pt;
      overflow: hidden;
      margin: 13pt 0 6pt;
      border-radius: 999pt;
      background: var(--surface-deep);
    }
    .allocation-bar-segment {
      display: block;
      height: 100%;
    }
    .allocation-total {
      display: flex;
      justify-content: space-between;
      color: var(--muted);
      font-family: 'SFMono-Regular', Menlo, Consolas, 'Courier New', monospace;
      font-size: 7.5pt;
    }
    .allocation-total strong {
      color: var(--positive);
    }
    .allocation-visual-chart {
      display: grid;
      grid-template-columns: 92pt 1fr;
      gap: 9pt;
      align-items: center;
    }
    .allocation-donut {
      width: 92pt;
      height: 92pt;
    }
    .allocation-donut-track,
    .allocation-donut-segment {
      fill: none;
      stroke-width: 12;
    }
    .allocation-donut-track {
      stroke: var(--surface-deep);
    }
    .allocation-donut-value,
    .allocation-donut-label {
      text-anchor: middle;
      font-family: 'SFMono-Regular', Menlo, Consolas, 'Courier New', monospace;
    }
    .allocation-donut-value {
      fill: var(--ink);
      font-size: 13px;
      font-weight: 700;
    }
    .allocation-donut-label {
      fill: var(--muted);
      font-size: 5px;
    }
    .allocation-legend {
      display: grid;
      gap: 4pt;
    }
    .allocation-legend-item {
      display: grid;
      grid-template-columns: 6pt 1fr auto;
      gap: 5pt;
      align-items: center;
      font-size: 7.5pt;
    }
    .allocation-legend-swatch {
      width: 6pt;
      height: 6pt;
      border-radius: 1pt;
    }
    .allocation-legend-name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .allocation-legend-value {
      color: var(--muted);
      font-family: 'SFMono-Regular', Menlo, Consolas, 'Courier New', monospace;
      font-size: 7pt;
    }

    /* Metrics list */
    .metrics-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 8pt;
      margin: 10pt 0;
    }
    .metric-item {
      background: var(--surface);
      border: 1pt solid var(--outline);
      border-top: 3pt solid var(--primary);
      border-radius: 4pt;
      padding: 7pt 8pt;
      box-shadow: 0 2pt 7pt rgba(42, 20, 180, 0.05);
    }
    .metric-label {
      font-family: 'SFMono-Regular', Menlo, Consolas, 'Courier New', monospace;
      font-size: 7pt;
      font-weight: 700;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.5pt;
    }
    .metric-value {
      font-size: 12pt;
      font-weight: 700;
      margin-top: 2pt;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }

    /* Tables */
    .data-table {
      width: 100%;
      border-collapse: collapse;
      margin: 8pt 0;
      font-size: 8.25pt;
      background: var(--surface);
      border: 1pt solid var(--outline);
      border-radius: 4pt;
      overflow: hidden;
    }
    .data-table thead {
      display: table-header-group;
    }
    .data-table tbody tr {
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .data-table caption {
      text-align: left;
      font-weight: 600;
      font-size: 9pt;
      margin-bottom: 4pt;
      color: var(--muted);
    }
    .data-table th {
      text-align: left;
      font-size: 8pt;
      text-transform: uppercase;
      letter-spacing: 0.3pt;
      color: var(--muted);
      padding: 5pt 7pt;
      border-bottom: 1.5pt solid var(--outline);
      background: var(--surface-high);
    }
    .data-table td {
      padding: 4pt 7pt;
      border-bottom: 0.5pt solid var(--outline);
    }
    .data-table tbody tr:nth-child(even) td {
      background: var(--surface-low);
    }
    .data-table .numeric-cell {
      text-align: right;
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
    }
    .data-table .text-cell {
      text-align: left;
    }
    .data-table tr:last-child td {
      border-bottom: none;
    }

    /* Narrative blocks */
    .narrative-block {
      background: var(--surface-low);
      border-left: 4pt solid var(--primary);
      padding: 10pt 14pt;
      margin: 10pt 0;
      border-radius: 0 5pt 5pt 0;
      box-shadow: inset 0 1pt 0 rgba(255, 255, 255, 0.8);
    }
    .narrative-block p {
      margin-bottom: 6pt;
    }
    .narrative-block p:last-child {
      margin-bottom: 0;
    }

    /* Takeaways */
    .takeaway-list {
      margin: 6pt 0 6pt 16pt;
      padding: 0;
    }
    .takeaway-list li {
      margin-bottom: 3pt;
      color: var(--ink);
    }

    /* Findings */
    .findings-list {
      margin: 8pt 0 8pt 16pt;
      padding: 0;
    }
    .findings-list li {
      margin-bottom: 4pt;
    }

    /* Data quality flags */
    .dq-flags {
      margin: 8pt 0;
      padding: 8pt 10pt;
      background: var(--warning-soft);
      border: 1pt solid #fdba74;
      border-radius: 3pt;
      font-size: 9pt;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .dq-flags strong {
      font-size: 8pt;
      text-transform: uppercase;
      letter-spacing: 0.3pt;
    }
    .dq-flags ul {
      margin: 4pt 0 0 16pt;
      padding: 0;
    }

    /* Methodology */
    .methodology-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9pt;
      margin: 10pt 0;
    }
    .methodology-table th {
      text-align: left;
      width: 30%;
      padding: 5pt 8pt;
      background: var(--surface-high);
      border-bottom: 0.5pt solid var(--outline);
      color: var(--muted);
      font-size: 8pt;
      text-transform: uppercase;
    }
    .methodology-table td {
      padding: 5pt 8pt;
      border-bottom: 0.5pt solid var(--outline);
    }

    /* Disclaimer */
    .disclaimer {
      margin-top: 24pt;
      padding: 14pt 16pt;
      background: var(--negative-soft);
      border: 1pt solid #fda4af;
      border-radius: 4pt;
      font-size: 8.5pt;
      line-height: 1.5;
      color: #881337;
    }
    .disclaimer-title {
      font-size: 9pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5pt;
      color: #881337;
      margin-bottom: 6pt;
    }
  `;
}

// ---------------------------------------------------------------------------
// Cover page
// ---------------------------------------------------------------------------

function buildCoverPage(report: ReportDocument): string {
  const { metadata, portfolio } = report;
  return `
    <div class="cover">
      <div class="cover-brand">Second Act</div>
      <h1>Quarterly Portfolio<br/>Grading Report</h1>
      <hr class="cover-divider" />
      <div style="font-size: 15pt; font-weight: 700; margin-bottom: 4pt;">
        ${esc(portfolio.name)}
      </div>
      ${portfolio.description ? `<div class="cover-subtitle">${esc(portfolio.description)}</div>` : ""}
      <div class="cover-meta">
        <div class="cover-meta-item"><span class="cover-meta-label">Report ID</span><span class="mono">${esc(metadata.runId)}</span></div>
        <div class="cover-meta-item"><span class="cover-meta-label">Generated</span>${formatDate(metadata.generatedAt)}</div>
        <div class="cover-meta-item"><span class="cover-meta-label">Valuation As Of</span>${formatDateTime(metadata.valuationAsOf)}</div>
        <div class="cover-meta-item"><span class="cover-meta-label">Reporting Currency</span>${esc(metadata.reportingCurrency)}</div>
      </div>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Executive summary
// ---------------------------------------------------------------------------

function buildExecutiveOverview(report: ReportDocument): string {
  const summary = report.analysis.summary;
  const currency = report.portfolio.reportingCurrency;
  const pnl = parseReportNumber(summary.totalUnrealizedPnL);
  const largestWeight = parseReportNumber(summary.largestPositionWeightPercent);

  if (pnl === null) {
    return "Portfolio-level performance is partially unavailable because market-value coverage is incomplete. The summary below highlights the values that can be calculated safely from the available data.";
  }

  const pnlDirection = pnl >= 0 ? "ahead of" : "below";
  const pnlValue = formatPnlWithOptionalPercent(
    summary.totalUnrealizedPnL,
    summary.totalUnrealizedPnLPercent,
    currency
  );

  if (largestWeight !== null) {
    return `Your portfolio is currently ${pnlDirection} cost basis by ${pnlValue}. The main item to watch is concentration: the largest holding represents ${formatReportPercentage(summary.largestPositionWeightPercent)} of the portfolio, so one position has an outsized influence on results.`;
  }

  return `Your portfolio is currently ${pnlDirection} cost basis by ${pnlValue}. Concentration metrics are partially unavailable, so read the portfolio-level view alongside the data quality notes in this report.`;
}

function buildExecutiveFindings(report: ReportDocument): string[] {
  const { analysis, canonicalSnapshot } = report;
  const summary = analysis.summary;
  const currency = report.portfolio.reportingCurrency;
  const findings: string[] = [];
  const pnl = parseReportNumber(summary.totalUnrealizedPnL);
  const largestWeight = parseReportNumber(summary.largestPositionWeightPercent);
  const riskSection = analysis.sections.find((section) => section.sectionKey === "risk-proxies");
  const drawdownMetric = riskSection?.metrics.find(
    (metric) => metric.key === "portfolio-drawdown-minus-20"
  );

  if (pnl !== null) {
    const direction = pnl >= 0 ? "ahead of" : "below";
    findings.push(
      `The portfolio is ${direction} cost basis by ${formatPnlWithOptionalPercent(summary.totalUnrealizedPnL, summary.totalUnrealizedPnLPercent, currency)}.`
    );
  } else {
    findings.push(
      "Portfolio-level paper gain/loss is unavailable because market-value coverage is incomplete."
    );
  }

  if (largestWeight !== null) {
    findings.push(
      `The largest holding represents ${formatReportPercentage(summary.largestPositionWeightPercent)} of the portfolio, making concentration the main item to watch.`
    );
  } else {
    findings.push("Concentration cannot be fully assessed until all holdings have usable weights.");
  }

  if (drawdownMetric?.value !== null && drawdownMetric?.value !== undefined) {
    findings.push(
      `A uniform -20% market shock would reduce the portfolio by about ${formatAbsoluteCurrency(drawdownMetric.value, currency)}.`
    );
  }

  findings.push(
    `The portfolio currently has ${formatReportCount(summary.gainersCount)} winning holdings and ${formatReportCount(summary.losersCount)} losing holdings.`
  );

  if (canonicalSnapshot.dataQualityFlags.length > 0 || analysis.dataQualityFlags.length > 0) {
    findings.push(
      "Some results should be read alongside the data quality notes later in the report."
    );
  }

  return findings.slice(0, 4);
}

function buildExecutiveSummary(report: ReportDocument): string {
  const { analysis, canonicalSnapshot } = report;
  const totals = canonicalSnapshot.portfolioTotals;
  const summary = analysis.summary;
  const currency = report.portfolio.reportingCurrency;
  const parsedPnl = parseReportNumber(summary.totalUnrealizedPnL);

  const pnlColor = emphasisColor(
    parsedPnl === null ? "neutral" : parsedPnl >= 0 ? "positive" : "negative"
  );

  const executiveFindings = buildExecutiveFindings(report);
  const executiveOverview = buildExecutiveOverview(report);

  return `
    <div class="section-block">
      <div class="section-header">
        <h2><span class="accent">01</span> Executive Summary</h2>
      </div>
      <p class="exec-overview">${esc(executiveOverview)}</p>
      <div class="exec-grid">
        <div class="exec-card exec-card-primary">
          <div class="exec-card-label">Total Market Value</div>
          <div class="exec-card-value">${cardDisplayValue(formatReportCurrency(totals.totalMarketValue, currency))}</div>
        </div>
        <div class="exec-card exec-card-primary">
          <div class="exec-card-label">Total Cost Basis</div>
          <div class="exec-card-value">${cardDisplayValue(formatReportCurrency(totals.totalCostBasis, currency))}</div>
        </div>
        <div class="exec-card exec-card-positive">
          <div class="exec-card-label">Paper Gain / Loss</div>
          <div class="exec-card-value" style="color: ${pnlColor};">
            ${cardDisplayValue(formatPnlWithOptionalPercent(summary.totalUnrealizedPnL, summary.totalUnrealizedPnLPercent, currency))}
          </div>
        </div>
        <div class="exec-card exec-card-primary">
          <div class="exec-card-label">Holdings</div>
          <div class="exec-card-value">${cardDisplayValue(formatReportCount(totals.holdingCount))}</div>
        </div>
      </div>
      <div class="exec-grid exec-grid-secondary">
        <div class="exec-card exec-card-positive">
          <div class="exec-card-label">Winners / Losers</div>
          <div class="exec-card-value">${cardDisplayValue(formatReportCount(summary.gainersCount))} / ${cardDisplayValue(formatReportCount(summary.losersCount))}</div>
        </div>
        <div class="exec-card exec-card-warning">
          <div class="exec-card-label">Concentration Score</div>
          <div class="exec-card-value">${cardDisplayValue(formatReportRatio(summary.concentrationHhi))}</div>
        </div>
      </div>
      ${buildPortfolioAllocationVisual(report)}
      ${
        executiveFindings.length > 0
          ? `
        <h3>Key Findings</h3>
        <ul class="findings-list">
          ${executiveFindings.map((f) => `<li>${esc(f)}</li>`).join("\n          ")}
        </ul>
      `
          : ""
      }
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Analysis + Narrative sections
// ---------------------------------------------------------------------------

function buildMetricsGrid(metrics: AnalysisMetric[], currency: string): string {
  if (metrics.length === 0) return "";
  return `
    <div class="metrics-grid">
      ${metrics
        .map((m) => {
          const displayValue = metricDisplayValue(m, currency);

          return `
        <div class="metric-item">
          <div class="metric-label">${esc(m.label)}</div>
          <div class="metric-value" style="color: ${displayValueColor(displayValue, m.emphasis)};">
            ${esc(displayValue)}
          </div>
        </div>
      `;
        })
        .join("")}
    </div>
  `;
}

function buildAnalysisTable(table: AnalysisTable, currency: string): string {
  const columnsByKey = new Map(table.columns.map((column) => [column.key, column]));

  return `
    <table class="data-table">
      <caption>${esc(table.title)}</caption>
      <thead>
        <tr>
          ${table.columns
            .map((col) => {
              const cellClass = isNumericUnit(col.unit) ? "numeric-cell" : "text-cell";
              return `<th class="${cellClass}">${esc(col.label)}</th>`;
            })
            .join("")}
        </tr>
      </thead>
      <tbody>
        ${table.rows
          .map(
            (row) => `
          <tr>
            ${row.cells
              .map((cell) => {
                const column = columnsByKey.get(cell.columnKey);
                const cellClass = isNumericUnit(column?.unit) ? "numeric-cell" : "text-cell";
                const display =
                  (column?.unit === "text" || column?.unit === undefined
                    ? cell.displayValue
                    : undefined) ??
                  formatReportValue(cell.value, column?.unit, {
                    currency
                  });
                return `<td class="${cellClass}">${esc(display)}</td>`;
              })
              .join("")}
          </tr>
        `
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function findNarrativeSection(
  narrativeOutput: NarrativeOutput,
  sectionKey: string
): NarrativeSection | undefined {
  return narrativeOutput.sections.find((s) => s.sectionKey === sectionKey);
}

function buildNarrativeBlock(
  narrative: NarrativeSection | undefined,
  unavailableMetrics: Set<string> = new Set()
): string {
  if (!narrative) return "";
  const sectionTakeaways = renderedTakeaways(narrative.keyTakeaways);

  return `
    <div class="narrative-block">
      <p>${esc(renderedSectionNarrative(narrative.summaryNarrative))}</p>
      ${
        sectionTakeaways.length > 0
          ? `
        <ul class="takeaway-list">
          ${sectionTakeaways.map((t) => `<li>${esc(t)}</li>`).join("\n          ")}
        </ul>
      `
          : ""
      }
    </div>
    ${
      narrative.metrics.length > 0
        ? narrative.metrics
            .map((m) => {
              const metricTakeaways = unavailableMetrics.has(m.name)
                ? []
                : renderedTakeaways(m.takeaways);
              return `
      <h4>${esc(m.displayName)}</h4>
      <p style="margin-bottom: 4pt;">${esc(renderedMetricNarrative(m.narrative))}</p>
      ${
        metricTakeaways.length > 0
          ? `<ul class="takeaway-list">${metricTakeaways.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>`
          : ""
      }
    `;
            })
            .join("")
        : ""
    }
  `;
}

function buildAnalysisSections(report: ReportDocument): string {
  const sorted = [...report.analysis.sections].sort((a, b) => a.order - b.order);
  const currency = report.portfolio.reportingCurrency;

  return sorted
    .map((section, index) => {
      const sectionNumber = String(index + 2).padStart(2, "0");
      const narrativeSection = findNarrativeSection(report.narrative, section.sectionKey);
      const unavailableMetrics = unavailableMetricNames(section.metrics, currency);

      return `
      <div class="section-block">
        <div class="section-header">
          <h2><span class="accent">${sectionNumber}</span> ${esc(section.sectionTitle)}</h2>
        </div>
        ${section.summary ? `<p style="margin-bottom: 10pt;">${esc(section.summary)}</p>` : ""}
        ${buildMetricsGrid(section.metrics, currency)}
        ${buildDataQualityFlags(section.dataQualityFlags)}
        ${section.tables.map((table) => buildAnalysisTable(table, currency)).join("")}
        ${
          section.findings.length > 0
            ? `
          <h3>Findings</h3>
          <ul class="findings-list">
            ${section.findings.map((f) => `<li>${esc(f)}</li>`).join("\n            ")}
          </ul>
        `
            : ""
        }
        ${buildNarrativeBlock(narrativeSection, unavailableMetrics)}
      </div>
    `;
    })
    .join("");
}

// ---------------------------------------------------------------------------
// Data quality flags
// ---------------------------------------------------------------------------

const DATA_QUALITY_FLAG_LABELS: Record<string, string> = {
  benchmark_metrics_incomplete: "Internal benchmark metrics incomplete",
  concentration_metrics_incomplete: "Diversification metrics incomplete",
  contains_delayed_quotes: "Contains delayed quotes",
  contains_partial_market_data: "Some holdings have incomplete market data",
  currency_inferred_from_symbol: "Security currency inferred from ticker",
  delayed_quote: "Delayed quote",
  fx_rate_unavailable: "Currency conversion rate unavailable",
  market_data_missing: "Market data missing",
  market_value_unavailable: "Market value unavailable",
  no_priced_holdings: "No priced holdings available",
  quote_not_found: "Quote not found",
  reporting_currency_differs_from_portfolio_base_currency:
    "Reporting currency differs from portfolio base currency",
  risk_proxy_metrics_incomplete: "Downside risk metrics incomplete",
  scenario_metrics_incomplete: "What-if stress-test metrics incomplete",
  security_currency_mismatch_with_provider: "Security currency mismatch with provider",
  unsupported_security_currency: "Unsupported security currency",
  zero_cost_basis: "Zero cost basis"
};

function uniqueDataQualityFlags(flags: string[]): string[] {
  return [...new Set(flags.filter((flag) => flag.trim().length > 0))];
}

function fallbackDataQualityLabel(flag: string): string {
  const readable = flag.replace(/[_-]+/g, " ").trim();
  return readable.length === 0 ? flag : readable.charAt(0).toUpperCase() + readable.slice(1);
}

function formatDataQualityFlag(flag: string): string {
  return DATA_QUALITY_FLAG_LABELS[flag] ?? fallbackDataQualityLabel(flag);
}

function buildDataQualityFlags(flags: string[]): string {
  const uniqueFlags = uniqueDataQualityFlags(flags);
  if (uniqueFlags.length === 0) return "";

  return `
    <div class="dq-flags">
      <strong>Data Quality Notes</strong>
      <ul>
        ${uniqueFlags.map((f) => `<li>${esc(formatDataQualityFlag(f))}</li>`).join("\n        ")}
      </ul>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Methodology & assumptions
// ---------------------------------------------------------------------------

function buildMethodologySection(report: ReportDocument): string {
  const { metadata, analysis, canonicalSnapshot } = report;
  const sectionNumber = String(analysis.sections.length + 2).padStart(2, "0");

  return `
    <div class="section-block">
      <div class="section-header">
        <h2><span class="accent">${sectionNumber}</span> Methodology &amp; Assumptions</h2>
      </div>
      <table class="methodology-table">
        <tbody>
          <tr><th>Report ID</th><td class="mono">${esc(metadata.runId)}</td></tr>
          <tr><th>Generated At</th><td>${formatDateTime(metadata.generatedAt)}</td></tr>
          <tr><th>Valuation As Of</th><td>${formatDateTime(metadata.valuationAsOf)}</td></tr>
          <tr><th>Reporting Currency</th><td>${esc(metadata.reportingCurrency)}</td></tr>
          <tr><th>Market Data Provider</th><td>${esc(metadata.marketDataProvider)}</td></tr>
          <tr><th>Narrative Provider</th><td>${esc(metadata.narrativeProvider)}</td></tr>
          <tr><th>Narrative Model</th><td>${esc(metadata.narrativeModel)}</td></tr>
          <tr><th>Canonical Schema</th><td class="mono">${esc(metadata.canonicalSchemaVersion)}</td></tr>
          <tr><th>Analysis Schema</th><td class="mono">${esc(metadata.analysisSchemaVersion)}</td></tr>
          <tr><th>Narrative Schema</th><td class="mono">${esc(metadata.narrativeSchemaVersion)}</td></tr>
          <tr><th>Prompt Version</th><td class="mono">${esc(metadata.promptVersion ?? "N/A")}</td></tr>
        </tbody>
      </table>
      ${
        analysis.methodologyNotes.length > 0
          ? `
        <h3>Notes</h3>
        <ul class="findings-list">
          ${analysis.methodologyNotes.map((n) => `<li>${esc(n)}</li>`).join("\n          ")}
        </ul>
      `
          : ""
      }
      ${buildDataQualityFlags([...analysis.dataQualityFlags, ...canonicalSnapshot.dataQualityFlags])}
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Disclaimer
// ---------------------------------------------------------------------------

function buildDisclaimerSection(report: ReportDocument): string {
  const { compliance } = report;
  const sectionNumber = String(report.analysis.sections.length + 3).padStart(2, "0");

  return `
    <div class="section-block">
      <div class="section-header">
        <h2><span class="accent">${sectionNumber}</span> Important Disclaimer</h2>
      </div>
      <div class="disclaimer">
        <div class="disclaimer-title">${esc(compliance.advisoryClassification.replace(/_/g, " "))}</div>
        <p>${esc(compliance.disclaimerText)}</p>
        <p class="muted" style="margin-top: 6pt; font-size: 8pt;">
          Disclaimer version: ${esc(compliance.disclaimerVersion)}
        </p>
      </div>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function buildReportHtml(report: ReportDocument): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Second Act – Portfolio Grading Report</title>
  <style>${buildStyles()}</style>
</head>
<body>
  ${buildCoverPage(report)}
  ${buildExecutiveSummary(report)}
  ${buildAnalysisSections(report)}
  ${buildMethodologySection(report)}
  ${buildDisclaimerSection(report)}
</body>
</html>`;
}
