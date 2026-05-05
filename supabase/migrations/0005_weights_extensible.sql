-- =====================================================================
-- Scoring weights — extensibility refactor per Curtis/Jim product call.
--
-- Move from 5 fixed columns to a JSONB factor list so:
--   - new factors can be added in code (DEFAULT_FACTORS) without schema work
--   - admins can reorder, rename, and change weights via the UI
--   - the engine reads a single normalized shape
--
-- The legacy typed columns are kept in place for back-compat — existing
-- callers can still read them. New code should use `weights jsonb`.
-- =====================================================================

alter table scoring_weights
  add column if not exists weights jsonb;

-- Backfill the JSONB from existing typed values, with the new defaults
-- per the product call (network_bonus = 50 #1, tier = 30 #2).
update scoring_weights
set weights = jsonb_build_object(
  'factors', jsonb_build_array(
    jsonb_build_object(
      'id', 'network_bonus',
      'label', 'Network Bonus',
      'weight', 50,
      'description', 'Intra-system rails (Blink / Cubix / Ripple ODL) settle instantly and free with our LPs. Dominates routing when both sides are on the same network.'
    ),
    jsonb_build_object(
      'id', 'tier',
      'label', 'Bank Tier',
      'weight', coalesce(tier_weight, 30),
      'description', 'T1=100 (preferred), T2=60, T2_SPECIALIST=50, T1_CAD=100, T3=30, T3_DEDICATED=30.'
    ),
    jsonb_build_object(
      'id', 'settlement_speed',
      'label', 'Settlement Speed',
      'weight', coalesce(settlement_speed_weight, 25),
      'description', 'Full 100 if bank speed matches client SLA. Zero on mismatch.'
    ),
    jsonb_build_object(
      'id', 'pricing',
      'label', 'Pricing Tier',
      'weight', coalesce(pricing_weight, 20),
      'description', 'BEST=100, COMPETITIVE=80, STANDARD=50, PREMIUM=20.'
    ),
    jsonb_build_object(
      'id', 'priority',
      'label', 'Priority Client Bonus',
      'weight', coalesce(priority_bonus_weight, 10),
      'description', 'P1 client x INSTANT/SAME_DAY bank: +100.'
    )
  )
)
where weights is null;

-- Default for any newly inserted rows
alter table scoring_weights
  alter column weights set default jsonb_build_object(
    'factors', jsonb_build_array(
      jsonb_build_object('id', 'network_bonus',    'label', 'Network Bonus',         'weight', 50, 'description', 'Intra-system rails settle instantly and free.'),
      jsonb_build_object('id', 'tier',             'label', 'Bank Tier',             'weight', 30, 'description', 'T1 / T2 / T3 ranking.'),
      jsonb_build_object('id', 'settlement_speed', 'label', 'Settlement Speed',      'weight', 25, 'description', 'Speed match against client SLA.'),
      jsonb_build_object('id', 'pricing',          'label', 'Pricing Tier',          'weight', 20, 'description', 'BEST / COMPETITIVE / STANDARD / PREMIUM.'),
      jsonb_build_object('id', 'priority',         'label', 'Priority Client Bonus', 'weight', 10, 'description', 'P1 client + instant bank bonus.')
    )
  );
