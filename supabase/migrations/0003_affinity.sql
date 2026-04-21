-- =====================================================================
-- Affinity Rules — Layer 3 preferred-bank-per-context map
-- Encodes hard-won operational knowledge that can't be derived from
-- bank capability fields alone.
-- =====================================================================

create table affinity_rules (
  rule_id              uuid primary key default gen_random_uuid(),
  label                text,                     -- human label "CAD → ConnectFirst"
  currency             text not null,            -- 'USD', 'CAD', '*' for any
  beneficiary_country  text,                     -- ISO-2 or null for any
  requires_stables_in  boolean,                  -- null=any; true=must; false=must-not
  required_sdm_entity  sdm_entity,               -- null=any; else filter
  required_risk        risk_rating,              -- null=any; else filter
  bank_id              uuid not null references banks(bank_id) on delete cascade,
  boost                integer not null default 100 check (boost between -200 and 200),
  rationale            text,
  is_active            boolean not null default true,
  sort_order           integer not null default 100,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index affinity_active_idx  on affinity_rules(is_active) where is_active;
create index affinity_ccy_idx     on affinity_rules(currency);
create index affinity_bank_idx    on affinity_rules(bank_id);

create trigger affinity_audit
  after insert or update or delete on affinity_rules
  for each row execute function log_audit('rule_id');
create trigger affinity_touch
  before update on affinity_rules
  for each row execute function touch_updated_at();

alter table affinity_rules enable row level security;

create policy "authenticated read affinity" on affinity_rules for select to authenticated using (true);
create policy "authenticated write affinity" on affinity_rules for all to authenticated using (true) with check (true);
create policy "anon read affinity" on affinity_rules for select to anon using (true);
create policy "anon write affinity" on affinity_rules for all to anon using (true) with check (true);

-- =====================================================================
-- Seed rules — directly from Curtis + Jonah transcript (2026-04-15)
-- Each rule has a rationale quoting the source.
-- =====================================================================

insert into affinity_rules (label, currency, beneficiary_country, requires_stables_in, required_sdm_entity, required_risk, bank_id, boost, rationale) values

  -- CAD
  ('CAD → ConnectFirst', 'CAD', 'CA', null, null, null,
   (select bank_id from banks where bank_name = 'ConnectFirst CU'),
   100, 'Canadian-based client trading CAD is "easy to route" per Curtis — ConnectFirst is the default CAD rail.'),
  ('CAD any-beneficiary → ConnectFirst', 'CAD', null, null, null, null,
   (select bank_id from banks where bank_name = 'ConnectFirst CU'),
   80, 'ConnectFirst is the primary CAD bank across all CAD flows. Neo is deprecated (~2 clients remain).'),

  -- CNY / Grand Pay flow
  ('CNY → Equals (Grand Pay flow)', 'CNY', null, null, null, null,
   (select bank_id from banks where bank_name = 'Equals Money'),
   100, 'Curtis: "We have CNY trades from Grand Pay pretty frequently. We have them settle directly to Equals, convert to USD, and wire it back out to them."'),

  -- AED
  ('AED + UAE + stables-in → Ripple ODL', 'AED', 'AE', true, null, null,
   (select bank_id from banks where bank_name = 'Ripple (ODL)'),
   100, 'Toofan pattern: stables → Fireblocks → Ripple → AED to UAE beneficiary. Much cheaper than Equals for this corridor.'),
  ('AED fallback → Equals', 'AED', null, false, null, null,
   (select bank_id from banks where bank_name = 'Equals Money'),
   60, 'When Ripple ODL not eligible (no stables, or non-UAE beneficiary), fall back to Equals.'),

  -- EUR
  ('EUR + SEPA + stables-in → Ripple ODL', 'EUR', 'DE', true, null, null,
   (select bank_id from banks where bank_name = 'Ripple (ODL)'),
   100, 'Ripple has great pricing for Euro-SEPA. Repeat this rule per SEPA country (DE, FR, IT, ES, NL, BE, IE, PT, AT, FI, GR, LU, SI, SK, EE, LV, LT, MT, CY).'),
  ('EUR (non-HIGH risk) → BCB', 'EUR', null, null, 'SDM_INC', 'MEDIUM',
   (select bank_id from banks where bank_name = 'BCB Group'),
   70, 'BCB is the primary EUR/GBP bank for non-high-risk SDM Inc. clients.'),
  ('EUR (HIGH risk) → OpenPay', 'EUR', null, null, null, 'HIGH',
   (select bank_id from banks where bank_name = 'OpenPay'),
   80, 'HIGH-risk clients cannot use BCB for EUR. OpenPay is lenient. Confirmed by Maple Wave pattern.'),

  -- GBP
  ('GBP + UK + stables-in → Ripple ODL', 'GBP', 'GB', true, null, null,
   (select bank_id from banks where bank_name = 'Ripple (ODL)'),
   100, 'Ripple enabled for GBP to UK beneficiaries. Stables-in flow.'),
  ('GBP (non-HIGH risk) → BCB', 'GBP', null, null, 'SDM_INC', 'MEDIUM',
   (select bank_id from banks where bank_name = 'BCB Group'),
   70, 'BCB primary for GBP when not HIGH risk.'),
  ('GBP (HIGH risk) → OpenPay', 'GBP', null, null, null, 'HIGH',
   (select bank_id from banks where bank_name = 'OpenPay'),
   80, 'HIGH-risk clients cannot use BCB. OpenPay lenient on risk.'),

  -- USD
  ('USD → Customers Bank (strategic push)', 'USD', null, null, 'SDM_INC', 'MEDIUM',
   (select bank_id from banks where bank_name = 'Customers Bank'),
   100, 'Curtis: "We''re trying to push as many USD clients to [Customers Bank]" — Cubix network means instant/free settlements with all our LPs. Best USD pricing.'),
  ('USD + SDM_INC + LOW risk → Customers Bank', 'USD', null, null, 'SDM_INC', 'LOW',
   (select bank_id from banks where bank_name = 'Customers Bank'),
   100, 'Same as above for LOW-risk clients.'),
  ('USD fallback → BCB', 'USD', null, null, 'SDM_INC', 'MEDIUM',
   (select bank_id from banks where bank_name = 'BCB Group'),
   60, 'BCB has next-best USD pricing after Customers. Blink via Nonco/Flowdesk = near-instant. Used for Braza-style flows.'),
  ('USD + HIGH risk → OpenPay', 'USD', null, null, null, 'HIGH',
   (select bank_id from banks where bank_name = 'OpenPay'),
   100, 'Curtis: "Paktra/Raw are high-risk — we have no choice but to use banking partners relatively lenient — OpenPay, Equals." Customers/BCB would flag and risk shutdown.'),
  ('USD + China + stables-in → Ripple ODL', 'USD', 'CN', true, null, null,
   (select bank_id from banks where bank_name = 'Ripple (ODL)'),
   100, 'Only Ripple corridor outside normal-jurisdiction rule: USD to China when client sends stables in.'),
  ('USD + SDM_USA entity → Old Glory', 'USD', null, null, 'SDM_USA', null,
   (select bank_id from banks where bank_name = 'Old Glory Bank'),
   100, 'SDM USA clients default to Old Glory until Customers Bank USA onboards. Curtis: "an SDM USA client signs into the hub — they automatically get Old Glory."');
