import styles from "./PortfolioForm.module.css";

export type PortfolioFormValues = {
  name: string;
  baseCurrency: "USD" | "CAD";
  description: string;
};

type PortfolioFormProps = {
  mode: "create" | "edit";
  action: (formData: FormData) => Promise<void>;
  defaultValues: PortfolioFormValues;
  errorMessage: string | null;
  portfolioId?: string;
};

export const PORTFOLIO_FORM_ERROR_MESSAGES: Record<string, string> = {
  missing_name: "Enter a portfolio name.",
  name_too_long: "Portfolio name must be 80 characters or fewer.",
  invalid_currency: "Choose USD or CAD as the base currency.",
  description_too_long: "Description must be 500 characters or fewer.",
  validation_error: "Check the portfolio details and try again.",
  save_failed: "We could not save the portfolio. Please try again."
};

export function PortfolioForm({
  mode,
  action,
  defaultValues,
  errorMessage,
  portfolioId
}: PortfolioFormProps) {
  const isEdit = mode === "edit";

  return (
    <form className={styles.form} action={action}>
      {portfolioId ? <input type="hidden" name="portfolioId" value={portfolioId} /> : null}

      {errorMessage ? (
        <p className={styles.errorMessage} role="alert">
          {errorMessage}
        </p>
      ) : null}

      <div className={styles.fieldGroup}>
        <label className={styles.fieldLabel} htmlFor="portfolio-name">
          Portfolio name
        </label>
        <input
          id="portfolio-name"
          className={styles.textInput}
          type="text"
          name="name"
          defaultValue={defaultValues.name}
          maxLength={80}
          required
        />
      </div>

      <fieldset className={styles.currencyField}>
        <legend>Base currency</legend>
        <label>
          <input
            type="radio"
            name="baseCurrency"
            value="CAD"
            defaultChecked={defaultValues.baseCurrency === "CAD"}
          />
          <span>CAD</span>
        </label>
        <label>
          <input
            type="radio"
            name="baseCurrency"
            value="USD"
            defaultChecked={defaultValues.baseCurrency === "USD"}
          />
          <span>USD</span>
        </label>
      </fieldset>

      <div className={styles.fieldGroup}>
        <label className={styles.fieldLabel} htmlFor="portfolio-description">
          Description
        </label>
        <textarea
          id="portfolio-description"
          className={styles.textarea}
          name="description"
          defaultValue={defaultValues.description}
          maxLength={500}
          rows={5}
        />
      </div>

      <div className={styles.formActions}>
        <a className={styles.secondaryLink} href="/app/portfolios">
          Cancel
        </a>
        <button className={styles.primaryButton} type="submit">
          {isEdit ? "Save Portfolio" : "Create Portfolio"}
        </button>
      </div>
    </form>
  );
}
