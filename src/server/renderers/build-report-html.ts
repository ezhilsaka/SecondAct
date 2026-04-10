import type {
    AnalysisMetric,
    AnalysisOutput,
    AnalysisSection,
    AnalysisTable,
    CanonicalPortfolioSnapshot,
    NarrativeOutput,
    NarrativeSection,
    ReportDocument
} from "@/server/contracts";

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

function formatCurrency(value: string | null, currency: string): string {
    if (value === null) return "N/A";
    const num = Number(value);
    if (Number.isNaN(num)) return "N/A";
    const sign = num < 0 ? "-" : "";
    const formatted = Math.abs(num).toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
    return `${sign}${currency} ${formatted}`;
}

function formatPercent(value: string | null): string {
    if (value === null) return "N/A";
    const num = Number(value);
    if (Number.isNaN(num)) return "N/A";
    return `${num >= 0 ? "+" : ""}${num.toFixed(2)}%`;
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

function metricDisplayValue(metric: AnalysisMetric): string {
    if (metric.displayValue) return metric.displayValue;
    if (metric.value === null) return "N/A";
    if (typeof metric.value === "number") return String(metric.value);
    return metric.value;
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
      font-family: 'Courier New', Courier, monospace;
      font-size: 14pt;
      font-weight: 700;
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
      font-family: 'Courier New', Courier, monospace;
      font-size: 11pt;
      font-weight: 700;
      margin-top: 2pt;
    }

    /* Tables */
    .data-table {
      width: 100%;
      border-collapse: collapse;
      margin: 10pt 0;
      font-size: 9pt;
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

function buildExecutiveSummary(report: ReportDocument): string {
    const { analysis, canonicalSnapshot } = report;
    const totals = canonicalSnapshot.portfolioTotals;
    const summary = analysis.summary;
    const currency = report.portfolio.reportingCurrency;

    const pnlColor = emphasisColor(
        summary.totalUnrealizedPnL !== null && Number(summary.totalUnrealizedPnL) >= 0
            ? "positive"
            : "negative"
    );

    const topFindings = analysis.sections.flatMap((s) => s.findings.slice(0, 1)).slice(0, 4);

    return `
    <div class="page-break"></div>
    <div class="section-block">
      <div class="section-header">
        <h2><span class="accent">01</span> Executive Summary</h2>
      </div>
      <div class="exec-grid">
        <div class="exec-card">
          <div class="exec-card-label">Total Market Value</div>
          <div class="exec-card-value">${formatCurrency(totals.totalMarketValue, currency)}</div>
        </div>
        <div class="exec-card">
          <div class="exec-card-label">Total Cost Basis</div>
          <div class="exec-card-value">${formatCurrency(totals.totalCostBasis, currency)}</div>
        </div>
        <div class="exec-card">
          <div class="exec-card-label">Unrealized P&amp;L</div>
          <div class="exec-card-value" style="color: ${pnlColor};">
            ${formatCurrency(summary.totalUnrealizedPnL, currency)}
            (${formatPercent(summary.totalUnrealizedPnLPercent)})
          </div>
        </div>
        <div class="exec-card">
          <div class="exec-card-label">Holdings</div>
          <div class="exec-card-value">${totals.holdingCount}</div>
        </div>
      </div>
      <div class="exec-grid">
        <div class="exec-card">
          <div class="exec-card-label">Gainers / Losers</div>
          <div class="exec-card-value">${summary.gainersCount} / ${summary.losersCount}</div>
        </div>
        <div class="exec-card">
          <div class="exec-card-label">Concentration (HHI)</div>
          <div class="exec-card-value mono">${summary.concentrationHhi ?? "N/A"}</div>
        </div>
      </div>
      ${topFindings.length > 0
            ? `
        <h3>Key Findings</h3>
        <ul class="findings-list">
          ${topFindings.map((f) => `<li>${esc(f)}</li>`).join("\n          ")}
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

function buildMetricsGrid(metrics: AnalysisMetric[]): string {
    if (metrics.length === 0) return "";
    return `
    <div class="metrics-grid">
      ${metrics
            .map(
                (m) => `
        <div class="metric-item">
          <div class="metric-label">${esc(m.label)}</div>
          <div class="metric-value" style="color: ${emphasisColor(m.emphasis)};">
            ${esc(metricDisplayValue(m))}
          </div>
        </div>
      `
            )
            .join("")}
    </div>
  `;
}

function buildAnalysisTable(table: AnalysisTable): string {
    return `
    <table class="data-table">
      <caption>${esc(table.title)}</caption>
      <thead>
        <tr>
          ${table.columns.map((col) => `<th>${esc(col.label)}</th>`).join("")}
        </tr>
      </thead>
      <tbody>
        ${table.rows
            .map(
                (row) => `
          <tr>
            ${row.cells
                        .map((cell) => {
                            const display =
                                cell.displayValue ?? (cell.value !== null ? String(cell.value) : "N/A");
                            return `<td>${esc(display)}</td>`;
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
      ${narrative.keyTakeaways.length > 0
            ? `
        <ul class="takeaway-list">
          ${narrative.keyTakeaways.map((t) => `<li>${esc(t)}</li>`).join("\n          ")}
        </ul>
      `
            : ""
        }
    </div>
    ${narrative.metrics.length > 0
            ? narrative.metrics
                .map(
                    (m) => `
      <h4>${esc(m.displayName)}</h4>
      <p style="margin-bottom: 4pt;">${esc(m.narrative)}</p>
      ${m.takeaways.length > 0
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
        ${buildMetricsGrid(section.metrics)}
        ${section.tables.map(buildAnalysisTable).join("")}
        ${section.findings.length > 0
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
      ${analysis.methodologyNotes.length > 0
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
