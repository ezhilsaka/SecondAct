"use client";

import { useEffect, useState } from "react";

import styles from "./HoldingForm.module.css";

export type HoldingFormValues = {
  ticker: string;
  securityName: string;
  securityCurrency: "USD" | "CAD";
  quantity: string;
  averageCost: string;
  notes: string;
};

export type SecuritySearchOption = {
  symbol: string;
  name?: string | null;
  exchange?: string | null;
  region?: string | null;
  currency?: "USD" | "CAD";
  matchScore?: string;
  provider: string;
};

type SearchState =
  | { status: "idle"; results: SecuritySearchOption[] }
  | { status: "loading"; results: SecuritySearchOption[] }
  | { status: "success"; results: SecuritySearchOption[] }
  | { status: "empty"; results: SecuritySearchOption[] }
  | { status: "error"; results: SecuritySearchOption[] };

type HoldingFormProps = {
  mode: "create" | "edit";
  action: (formData: FormData) => Promise<void>;
  portfolioId: string;
  defaultValues: HoldingFormValues;
  holdingId?: string;
};

const EMPTY_SEARCH_STATE: SearchState = { status: "idle", results: [] };

function isSecuritySearchOption(value: unknown): value is SecuritySearchOption {
  if (!value || typeof value !== "object") {
    return false;
  }

  const maybeResult = value as Record<string, unknown>;

  return typeof maybeResult.symbol === "string" && typeof maybeResult.provider === "string";
}

function readSearchResults(payload: unknown): SecuritySearchOption[] {
  if (!payload || typeof payload !== "object" || !("results" in payload)) {
    return [];
  }

  const results = (payload as { results: unknown }).results;

  return Array.isArray(results) ? results.filter(isSecuritySearchOption) : [];
}

export function applySecuritySearchResult(
  values: HoldingFormValues,
  result: SecuritySearchOption
): HoldingFormValues {
  return {
    ...values,
    ticker: result.symbol,
    securityName: result.name ?? values.securityName,
    securityCurrency:
      result.currency === "USD" || result.currency === "CAD"
        ? result.currency
        : values.securityCurrency
  };
}

export function HoldingForm({
  mode,
  action,
  portfolioId,
  defaultValues,
  holdingId
}: HoldingFormProps) {
  const [values, setValues] = useState<HoldingFormValues>(defaultValues);
  const [searchState, setSearchState] = useState<SearchState>(EMPTY_SEARCH_STATE);
  const [searchEnabled, setSearchEnabled] = useState(false);
  const isEdit = mode === "edit";
  const formId = `${mode}-${holdingId ?? "new"}-holding`;

  useEffect(() => {
    const query = values.ticker.trim();

    if (!searchEnabled || query.length < 2) {
      setSearchState(EMPTY_SEARCH_STATE);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setSearchState({ status: "loading", results: [] });

      try {
        const response = await fetch(
          `/api/v1/securities/search?query=${encodeURIComponent(query)}`,
          {
            headers: {
              Accept: "application/json"
            },
            signal: controller.signal
          }
        );

        if (!response.ok) {
          throw new Error("Security search failed.");
        }

        const results = readSearchResults(await response.json());
        setSearchState({
          status: results.length > 0 ? "success" : "empty",
          results
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setSearchState({ status: "error", results: [] });
      }
    }, 300);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [searchEnabled, values.ticker]);

  function updateField(
    field: Exclude<keyof HoldingFormValues, "securityCurrency">,
    value: string
  ) {
    setValues((current) => ({
      ...current,
      [field]: value
    }));
  }

  function selectSearchResult(result: SecuritySearchOption) {
    setValues((current) => applySecuritySearchResult(current, result));
    setSearchEnabled(false);
    setSearchState(EMPTY_SEARCH_STATE);
  }

  return (
    <form className={styles.form} action={action}>
      <input type="hidden" name="portfolioId" value={portfolioId} />
      {holdingId ? <input type="hidden" name="holdingId" value={holdingId} /> : null}

      <div className={styles.formGrid}>
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel} htmlFor={`${formId}-ticker`}>
            Ticker
          </label>
          <input
            id={`${formId}-ticker`}
            className={styles.textInput}
            type="text"
            name="ticker"
            value={values.ticker}
            onChange={(event) => {
              updateField("ticker", event.target.value);
              setSearchEnabled(true);
            }}
            autoComplete="off"
            maxLength={40}
            required
          />

          {searchState.status === "loading" ? (
            <p className={styles.searchMessage} role="status">
              Searching symbols...
            </p>
          ) : null}

          {searchState.status === "success" ? (
            <ul className={styles.searchResults} aria-label="Ticker search results">
              {searchState.results.map((result) => (
                <li key={`${result.provider}-${result.symbol}`}>
                  <button type="button" onClick={() => selectSearchResult(result)}>
                    <span className={styles.resultSymbol}>{result.symbol}</span>
                    <span>{result.name ?? "Security"}</span>
                    {result.currency ? <span>{result.currency}</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {searchState.status === "empty" ? (
            <p className={styles.searchMessage}>No matches found. Manual ticker entry is okay.</p>
          ) : null}

          {searchState.status === "error" ? (
            <p className={styles.searchMessage}>
              Symbol search is unavailable. Manual ticker entry is okay.
            </p>
          ) : null}
        </div>

        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel} htmlFor={`${formId}-name`}>
            Name
          </label>
          <input
            id={`${formId}-name`}
            className={styles.textInput}
            type="text"
            name="securityName"
            value={values.securityName}
            onChange={(event) => updateField("securityName", event.target.value)}
            maxLength={120}
          />
        </div>

        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel} htmlFor={`${formId}-currency`}>
            Currency for this holding
          </label>
          <select
            id={`${formId}-currency`}
            className={styles.selectInput}
            name="securityCurrency"
            value={values.securityCurrency}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                securityCurrency: event.target.value === "CAD" ? "CAD" : "USD"
              }))
            }
          >
            <option value="USD">USD</option>
            <option value="CAD">CAD</option>
          </select>
        </div>

        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel} htmlFor={`${formId}-quantity`}>
            Shares / units
          </label>
          <input
            id={`${formId}-quantity`}
            className={styles.textInput}
            type="text"
            inputMode="decimal"
            name="quantity"
            value={values.quantity}
            onChange={(event) => updateField("quantity", event.target.value)}
            required
          />
        </div>

        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel} htmlFor={`${formId}-average-cost`}>
            Average cost per share
          </label>
          <input
            id={`${formId}-average-cost`}
            className={styles.textInput}
            type="text"
            inputMode="decimal"
            name="averageCost"
            value={values.averageCost}
            onChange={(event) => updateField("averageCost", event.target.value)}
            required
          />
        </div>

        <div className={styles.fieldGroupWide}>
          <label className={styles.fieldLabel} htmlFor={`${formId}-notes`}>
            Notes
          </label>
          <textarea
            id={`${formId}-notes`}
            className={styles.textarea}
            name="notes"
            value={values.notes}
            onChange={(event) => updateField("notes", event.target.value)}
            maxLength={500}
            rows={3}
          />
        </div>
      </div>

      <div className={styles.formActions}>
        <button className={styles.primaryButton} type="submit">
          {isEdit ? "Save Holding" : "Add Holding"}
        </button>
      </div>
    </form>
  );
}
