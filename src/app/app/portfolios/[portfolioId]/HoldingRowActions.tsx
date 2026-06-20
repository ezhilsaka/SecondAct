"use client";

import { useId, useState } from "react";

import { HoldingForm, type HoldingFormValues } from "@/components/portfolio/HoldingForm";
import type { PortfolioHoldingResult } from "@/server/services/portfolio-service";

import styles from "./page.module.css";

type HoldingMutationAction = (formData: FormData) => Promise<void>;
type ExpandedAction = "edit" | "remove" | null;

type HoldingRowActionsProps = {
  portfolioId: string;
  holding: PortfolioHoldingResult;
  defaultValues: HoldingFormValues;
  updateAction: HoldingMutationAction;
  removeAction: HoldingMutationAction;
};

type RemoveHoldingFormProps = {
  portfolioId: string;
  holding: PortfolioHoldingResult;
  action: HoldingMutationAction;
};

export function RemoveHoldingForm({ portfolioId, holding, action }: RemoveHoldingFormProps) {
  return (
    <form className={styles.removeForm} action={action}>
      <input type="hidden" name="portfolioId" value={portfolioId} />
      <input type="hidden" name="holdingId" value={holding.id} />
      <label>
        <input type="checkbox" name="confirmRemove" required />
        <span>Remove {holding.ticker} from this portfolio</span>
      </label>
      <button type="submit">Remove Holding</button>
    </form>
  );
}

export function HoldingRowActions({
  portfolioId,
  holding,
  defaultValues,
  updateAction,
  removeAction
}: HoldingRowActionsProps) {
  const panelBaseId = useId();
  const [expandedAction, setExpandedAction] = useState<ExpandedAction>(null);
  const editPanelId = `${panelBaseId}-edit`;
  const removePanelId = `${panelBaseId}-remove`;

  function toggleAction(action: Exclude<ExpandedAction, null>) {
    setExpandedAction((current) => (current === action ? null : action));
  }

  return (
    <div className={styles.rowActions}>
      <button
        type="button"
        className={styles.rowActionToggle}
        aria-expanded={expandedAction === "edit"}
        aria-controls={editPanelId}
        onClick={() => toggleAction("edit")}
      >
        Edit
      </button>
      {expandedAction === "edit" ? (
        <div id={editPanelId} className={styles.rowActionPanel}>
          <HoldingForm
            mode="edit"
            action={updateAction}
            portfolioId={portfolioId}
            holdingId={holding.id}
            defaultValues={defaultValues}
          />
        </div>
      ) : null}

      <button
        type="button"
        className={styles.rowActionToggle}
        aria-expanded={expandedAction === "remove"}
        aria-controls={removePanelId}
        onClick={() => toggleAction("remove")}
      >
        Remove
      </button>
      {expandedAction === "remove" ? (
        <div id={removePanelId} className={styles.rowActionPanel}>
          <RemoveHoldingForm portfolioId={portfolioId} holding={holding} action={removeAction} />
        </div>
      ) : null}
    </div>
  );
}
