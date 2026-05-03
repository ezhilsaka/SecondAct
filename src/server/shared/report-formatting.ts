export type ReportDisplayUnit = "currency" | "percentage" | "count" | "ratio" | "text";

type FormatReportValueOptions = {
  currency?: string;
  showPositiveSign?: boolean;
};

const NUMBER_FORMATTER = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2
});

const CURRENCY_NUMBER_FORMATTER = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

function parseDisplayNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function signPrefix(value: number, showPositiveSign: boolean): string {
  if (value < 0) {
    return "-";
  }

  return showPositiveSign && value > 0 ? "+" : "";
}

export function formatReportCurrency(
  value: string | number | null | undefined,
  currency: string
): string {
  const parsed = parseDisplayNumber(value);
  if (parsed === null) {
    return "N/A";
  }

  const sign = parsed < 0 ? "-" : "";
  return `${sign}${currency} ${CURRENCY_NUMBER_FORMATTER.format(Math.abs(parsed))}`;
}

export function formatReportPercentage(
  value: string | number | null | undefined,
  options: Pick<FormatReportValueOptions, "showPositiveSign"> = {}
): string {
  const parsed = parseDisplayNumber(value);
  if (parsed === null) {
    return "N/A";
  }

  return `${signPrefix(parsed, options.showPositiveSign ?? false)}${NUMBER_FORMATTER.format(
    Math.abs(parsed)
  )}%`;
}

export function formatReportCount(value: string | number | null | undefined): string {
  const parsed = parseDisplayNumber(value);
  if (parsed === null) {
    return "N/A";
  }

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0
  }).format(parsed);
}

export function formatReportRatio(value: string | number | null | undefined): string {
  const parsed = parseDisplayNumber(value);
  if (parsed === null) {
    return "N/A";
  }

  return NUMBER_FORMATTER.format(parsed);
}

export function formatReportNumber(value: string | number | null | undefined): string {
  const parsed = parseDisplayNumber(value);
  if (parsed === null) {
    return "N/A";
  }

  return NUMBER_FORMATTER.format(parsed);
}

export function formatReportValue(
  value: string | number | null | undefined,
  unit: ReportDisplayUnit | undefined,
  options: FormatReportValueOptions = {}
): string {
  if (unit === "text" || unit === undefined) {
    return value === null || value === undefined ? "N/A" : String(value);
  }

  switch (unit) {
    case "currency":
      return formatReportCurrency(value, options.currency ?? "");
    case "percentage":
      return formatReportPercentage(value, { showPositiveSign: options.showPositiveSign });
    case "count":
      return formatReportCount(value);
    case "ratio":
      return formatReportRatio(value);
    default:
      return value === null || value === undefined ? "N/A" : String(value);
  }
}
