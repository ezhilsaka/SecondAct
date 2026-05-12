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
      return "#1a7f37";
    case "negative":
      return "#cf222e";
    case "cautionary":
      return "#bf6a00";
    default:
      return "#24292f";
  }
}

function displayValueColor(displayValue: string, emphasis: string | undefined): string {
  return displayValue === "N/A" ? "#24292f" : emphasisColor(emphasis);
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
  const amountText = formatReportCurrency(amount, currency);
  return parseReportNumber(percent) === null
    ? amountText
    : `${amountText} (${formatReportPercentage(percent, { showPositiveSign: true })})`;
}

function metricDisplayValue(metric: AnalysisMetric, currency: string): string {
  if (metric.displayValue && (metric.unit === "text" || metric.unit === undefined)) {
    return metric.displayValue;
  }

  return formatReportValue(metric.value, metric.unit, { currency });
}

// ---------------------------------------------------------------------------
// CSS
// ---------------------------------------------------------------------------

function buildStyles(): string {
  return `
    @page {
      size: A4;
      margin: 24mm 20mm 24mm 20mm;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: Helvetica, Arial, sans-serif;
      font-size: 10pt;
      line-height: 1.55;
      color: #24292f;
      background: #ffffff;
    }

    h1, h2, h3, h4 {
      font-family: Georgia, 'Times New Roman', serif;
      color: #24292f;
    }

    h1 { font-size: 26pt; font-weight: 700; }
    h2 { font-size: 16pt; font-weight: 700; margin-bottom: 8pt; }
    h3 { font-size: 12pt; font-weight: 600; margin-bottom: 6pt; }
    h4 { font-size: 10pt; font-weight: 600; margin-bottom: 4pt; }

    .accent { color: #f96b2a; }
    .muted { color: #656d76; }
    .mono { font-family: 'Courier New', Courier, monospace; }

    .page-break { page-break-before: always; }

    /* Cover page */
    .cover {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: flex-start;
      min-height: 100vh;
      padding: 40pt 0;
    }
    .cover-brand {
      font-size: 11pt;
      font-weight: 700;
      letter-spacing: 2pt;
      text-transform: uppercase;
      color: #f96b2a;
      margin-bottom: 16pt;
    }
    .cover h1 {
      margin-bottom: 12pt;
      line-height: 1.2;
    }
    .cover-meta {
      font-size: 10pt;
      color: #656d76;
      margin-top: 24pt;
      line-height: 1.8;
    }
    .cover-divider {
      width: 60pt;
      height: 3pt;
      background: #f96b2a;
      margin: 24pt 0;
      border: none;
    }

    /* Executive summary */
    .exec-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10pt;
      margin: 12pt 0 16pt;
    }
    .exec-overview {
      margin: 0 0 12pt;
      font-size: 10.5pt;
      color: #24292f;
    }
    .exec-card {
      background: #f6f8fa;
      border: 1pt solid #d0d7de;
      border-radius: 4pt;
      padding: 10pt 12pt;
    }
    .exec-card-label {
      font-size: 8pt;
      text-transform: uppercase;
      letter-spacing: 0.5pt;
      color: #656d76;
      margin-bottom: 4pt;
    }
    .exec-card-value {
      font-size: 14pt;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }

    /* Section blocks */
    .section-block {
      margin-bottom: 20pt;
    }
    .section-header {
      border-bottom: 2pt solid #f96b2a;
      padding-bottom: 4pt;
      margin-bottom: 12pt;
    }

    /* Metrics list */
    .metrics-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 8pt;
      margin: 10pt 0;
    }
    .metric-item {
      background: #f6f8fa;
      border-radius: 3pt;
      padding: 6pt 8pt;
    }
    .metric-label {
      font-size: 8pt;
      color: #656d76;
      text-transform: uppercase;
      letter-spacing: 0.3pt;
    }
    .metric-value {
      font-size: 11pt;
      font-weight: 700;
      margin-top: 2pt;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }

    /* Tables */
    .data-table {
      width: 100%;
      border-collapse: collapse;
      margin: 10pt 0;
      font-size: 8.75pt;
    }
    .data-table caption {
      text-align: left;
      font-weight: 600;
      font-size: 9pt;
      margin-bottom: 4pt;
      color: #656d76;
    }
    .data-table th {
      text-align: left;
      font-size: 8pt;
      text-transform: uppercase;
      letter-spacing: 0.3pt;
      color: #656d76;
      padding: 6pt 8pt;
      border-bottom: 1.5pt solid #d0d7de;
      background: #f6f8fa;
    }
    .data-table td {
      padding: 5pt 8pt;
      border-bottom: 0.5pt solid #d0d7de;
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
      background: #fffbf0;
      border-left: 3pt solid #f96b2a;
      padding: 10pt 14pt;
      margin: 10pt 0;
      border-radius: 0 4pt 4pt 0;
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
      color: #24292f;
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
      background: #fff8c5;
      border: 1pt solid #d4a72c;
      border-radius: 3pt;
      font-size: 9pt;
    }
    .dq-flags strong {
      font-size: 8pt;
      text-transform: uppercase;
      letter-spacing: 0.3pt;
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
      background: #f6f8fa;
      border-bottom: 0.5pt solid #d0d7de;
      color: #656d76;
      font-size: 8pt;
      text-transform: uppercase;
    }
    .methodology-table td {
      padding: 5pt 8pt;
      border-bottom: 0.5pt solid #d0d7de;
    }

    /* Disclaimer */
    .disclaimer {
      margin-top: 24pt;
      padding: 14pt 16pt;
      background: #f6f8fa;
      border: 1pt solid #d0d7de;
      border-radius: 4pt;
      font-size: 8.5pt;
      line-height: 1.5;
      color: #656d76;
    }
    .disclaimer-title {
      font-size: 9pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5pt;
      color: #24292f;
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
      <div style="font-size: 14pt; font-weight: 600; margin-bottom: 4pt;">
        ${esc(portfolio.name)}
      </div>
      ${portfolio.description ? `<div class="muted" style="font-size: 10pt;">${esc(portfolio.description)}</div>` : ""}
      <div class="cover-meta">
        <div><strong>Report ID:</strong> <span class="mono">${esc(metadata.runId)}</span></div>
        <div><strong>Generated:</strong> ${formatDate(metadata.generatedAt)}</div>
        <div><strong>Valuation As Of:</strong> ${formatDateTime(metadata.valuationAsOf)}</div>
        <div><strong>Reporting Currency:</strong> ${esc(metadata.reportingCurrency)}</div>
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
      "Portfolio-level paper profit/loss is unavailable because market-value coverage is incomplete."
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
      `A uniform -20% market shock would imply an estimated portfolio move of ${formatReportCurrency(drawdownMetric.value, currency)}.`
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
    <div class="page-break"></div>
    <div class="section-block">
      <div class="section-header">
        <h2><span class="accent">01</span> Executive Summary</h2>
      </div>
      <p class="exec-overview">${esc(executiveOverview)}</p>
      <div class="exec-grid">
        <div class="exec-card">
          <div class="exec-card-label">Total Market Value</div>
          <div class="exec-card-value">${formatReportCurrency(totals.totalMarketValue, currency)}</div>
        </div>
        <div class="exec-card">
          <div class="exec-card-label">Total Cost Basis</div>
          <div class="exec-card-value">${formatReportCurrency(totals.totalCostBasis, currency)}</div>
        </div>
        <div class="exec-card">
          <div class="exec-card-label">Unrealized P&amp;L</div>
          <div class="exec-card-value" style="color: ${pnlColor};">
            ${formatPnlWithOptionalPercent(summary.totalUnrealizedPnL, summary.totalUnrealizedPnLPercent, currency)}
          </div>
        </div>
        <div class="exec-card">
          <div class="exec-card-label">Holdings</div>
          <div class="exec-card-value">${formatReportCount(totals.holdingCount)}</div>
        </div>
      </div>
      <div class="exec-grid">
        <div class="exec-card">
          <div class="exec-card-label">Gainers / Losers</div>
          <div class="exec-card-value">${formatReportCount(summary.gainersCount)} / ${formatReportCount(summary.losersCount)}</div>
        </div>
        <div class="exec-card">
          <div class="exec-card-label">Concentration (HHI)</div>
          <div class="exec-card-value">${formatReportRatio(summary.concentrationHhi)}</div>
        </div>
      </div>
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

function buildNarrativeBlock(narrative: NarrativeSection | undefined): string {
  if (!narrative) return "";
  return `
    <div class="narrative-block">
      <p>${esc(narrative.summaryNarrative)}</p>
      ${
        narrative.keyTakeaways.length > 0
          ? `
        <ul class="takeaway-list">
          ${narrative.keyTakeaways.map((t) => `<li>${esc(t)}</li>`).join("\n          ")}
        </ul>
      `
          : ""
      }
    </div>
    ${
      narrative.metrics.length > 0
        ? narrative.metrics
            .map(
              (m) => `
      <h4>${esc(m.displayName)}</h4>
      <p style="margin-bottom: 4pt;">${esc(m.narrative)}</p>
      ${
        m.takeaways.length > 0
          ? `<ul class="takeaway-list">${m.takeaways.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>`
          : ""
      }
    `
            )
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

      return `
      <div class="page-break"></div>
      <div class="section-block">
        <div class="section-header">
          <h2><span class="accent">${sectionNumber}</span> ${esc(section.sectionTitle)}</h2>
        </div>
        ${section.summary ? `<p style="margin-bottom: 10pt;">${esc(section.summary)}</p>` : ""}
        ${buildMetricsGrid(section.metrics, currency)}
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
        ${buildNarrativeBlock(narrativeSection)}
        ${buildDataQualityFlags(section.dataQualityFlags)}
      </div>
    `;
    })
    .join("");
}

// ---------------------------------------------------------------------------
// Data quality flags
// ---------------------------------------------------------------------------

function buildDataQualityFlags(flags: string[]): string {
  if (flags.length === 0) return "";
  return `
    <div class="dq-flags">
      <strong>Data Quality Notes</strong>
      <ul style="margin: 4pt 0 0 16pt; padding: 0;">
        ${flags.map((f) => `<li>${esc(f.replace(/_/g, " "))}</li>`).join("\n        ")}
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
    <div class="page-break"></div>
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
    <div class="page-break"></div>
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
