CREATE INDEX "report_runs_user_id_requested_at_desc_idx"
  ON "report_runs"("user_id", "requested_at" DESC);

CREATE INDEX "report_runs_user_id_portfolio_id_requested_at_desc_idx"
  ON "report_runs"("user_id", "portfolio_id", "requested_at" DESC);
