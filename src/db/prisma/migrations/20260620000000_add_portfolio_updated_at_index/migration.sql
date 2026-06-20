-- Add a covering order index for active portfolio list/dashboard queries.
CREATE INDEX "portfolios_user_id_archived_at_updated_at_desc_idx"
    ON "portfolios"("user_id", "archived_at", "updated_at" DESC);
