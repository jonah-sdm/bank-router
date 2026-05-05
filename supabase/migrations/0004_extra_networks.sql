-- =====================================================================
-- Add new settlement networks per Curtis/Jim product call:
--   - SEPA            (EUR domestic, instant — daily use)
--   - FASTER_PAYMENTS (GBP domestic, instant — daily use)
--   - ACH             (USD domestic, slower — rarely used / low priority)
--
-- Note: Postgres requires ALTER TYPE ... ADD VALUE to run OUTSIDE a
-- transaction. Run each statement individually if your migration runner
-- wraps the file in a transaction. The IF NOT EXISTS guard makes this
-- file safe to re-run.
-- =====================================================================

alter type settlement_network add value if not exists 'SEPA';
alter type settlement_network add value if not exists 'FASTER_PAYMENTS';
alter type settlement_network add value if not exists 'ACH';
