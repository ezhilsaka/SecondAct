"use client";

import type { MouseEvent } from "react";
import { useFormStatus } from "react-dom";

type ReportFormSubmitButtonProps = {
  children: string;
  pendingLabel: string;
  className?: string;
  confirmMessage?: string;
};

export function ReportFormSubmitButton({
  children,
  pendingLabel,
  className,
  confirmMessage
}: ReportFormSubmitButtonProps) {
  const { pending } = useFormStatus();

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    if (confirmMessage && !window.confirm(confirmMessage)) {
      event.preventDefault();
    }
  }

  return (
    <button type="submit" className={className} disabled={pending} onClick={handleClick}>
      {pending ? pendingLabel : children}
    </button>
  );
}
