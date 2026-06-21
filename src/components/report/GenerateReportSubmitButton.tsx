"use client";

import { useFormStatus } from "react-dom";

export function GenerateReportSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending}>
      {pending ? "Starting report..." : "Generate report"}
    </button>
  );
}
