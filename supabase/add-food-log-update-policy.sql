-- ============================================================
-- food_logs never had an UPDATE policy — only select/insert/delete.
-- Needed now that logged entries are editable (quantity, meal type).
-- ============================================================

create policy "Users can update own food logs"
  on food_logs for update
  using (auth.uid() = user_id);
