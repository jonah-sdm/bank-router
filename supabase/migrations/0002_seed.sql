-- =====================================================================
-- Seed data — banks from PRD §4.2
-- Idempotent: safe to re-run.
-- =====================================================================

insert into banks (
  bank_name, tier, sdm_entity, supported_currencies, accepts_lp_currencies, settlement_networks,
  max_client_risk, accepts_individuals, blocked_verticals,
  pricing_tier, settlement_speed, notes
) values
  ('Customers Bank', 'T1', 'SDM_INC',
   array['USD'], array['USD'],
   array['FEDWIRE','CUBIX','ACH']::settlement_network[],
   'MEDIUM', true, array['GAMING','GAMBLING','ATM_OPERATOR'],
   'BEST', 'INSTANT',
   'USD domestic ONLY. Best pricing for USD. Cubix = instant/free settlements with LP network. Cannot onboard HIGH risk clients.'),

  ('BCB Group', 'T1', 'SDM_INC',
   array['USD','GBP','EUR'], array['USD','GBP','EUR'],
   array['SWIFT','BLINK','SEPA','FASTER_PAYMENTS']::settlement_network[],
   'MEDIUM', false, array['GAMING','GAMBLING','ATM_OPERATOR'],
   'COMPETITIVE', 'INSTANT',
   'Multi-currency. Blink = near-instant/free via Nonco/Flowdesk. Cannot onboard HIGH risk. GBP/EUR available. EDD on individuals.'),

  ('Openpayd', 'T2', 'SDM_INC',
   array['USD','EUR','GBP','CHF','JPY','SGD','HKD','AUD'], array['USD','EUR','GBP'],
   array['SWIFT','SEPA','FASTER_PAYMENTS']::settlement_network[],
   'HIGH', true, array[]::text[],
   'PREMIUM', 'T1',
   'Higher fees. Lenient on risk. SWIFT only. Accepts USD/EUR/GBP from LPs, does FX to other supported currencies.'),

  ('Equals Money', 'T2', 'SDM_INC',
   array['USD','EUR','GBP','CNY','CHF','JPY','SGD','HKD','AUD','AED'], array['USD','EUR','GBP','CNY'],
   array['SWIFT','SEPA','FASTER_PAYMENTS']::settlement_network[],
   'HIGH', true, array[]::text[],
   'PREMIUM', 'T1',
   'Primary FX bank. Accepts USD/EUR/GBP/CNY from LPs, converts to any supported currency including AED.'),

  ('Ripple (ODL)', 'T2_SPECIALIST', 'SDM_INC',
   array['EUR','GBP','USD','AED'], array['USDT','USDC'],
   array['RIPPLE_ODL']::settlement_network[],
   'MEDIUM', true, array[]::text[],
   'BEST', 'INSTANT',
   'SPECIALIST: stables-in, fiat-out ONLY. LP provides USDT/USDC; Ripple does conversion + delivery in target currency.'),

  ('Neo Financial', 'T2', 'SDM_INC',
   array['CAD','USD','EUR','AED','CNY'], array['CAD','USD','EUR'],
   array['SWIFT']::settlement_network[],
   'MEDIUM', true, array[]::text[],
   'STANDARD', 'T1',
   'Multi-currency. SWIFT only — no Fedwire. AED/CNY wallets exist but untested; trading desk to confirm before sending volume.'),

  ('ConnectFirst CU', 'T1_CAD', 'SDM_INC',
   array['CAD'], array['CAD'],
   array['EFT']::settlement_network[],
   'MEDIUM', true, array['GAMING','GAMBLING','ATM_OPERATOR'],
   'BEST', 'SAME_DAY',
   'Best option for CAD-jurisdiction clients. Easy routing decision for CAD-only clients.'),

  ('Hamilton Reserve Bank (HRB)', 'T3_DEDICATED', 'SDM_INC',
   array['USD'], array['USD'],
   array['SWIFT']::settlement_network[],
   'MEDIUM', true, array[]::text[],
   'STANDARD', 'T1',
   'Single-client bank. Not for new client routing.'),

  ('Old Glory Bank', 'T3', 'SDM_USA',
   array['USD'], array['USD'],
   array['FEDWIRE','ACH']::settlement_network[],
   'LOW', true, array['GAMING','GAMBLING','ATM_OPERATOR'],
   'STANDARD', 'SAME_DAY',
   'SDM USA entity bank. Oklahoma-based. Manual wire approval required (phone). All SDM USA clients default here until Customers Bank USA onboarded.')
on conflict (bank_name) do update set
  tier = excluded.tier,
  sdm_entity = excluded.sdm_entity,
  supported_currencies = excluded.supported_currencies,
  accepts_lp_currencies = excluded.accepts_lp_currencies,
  settlement_networks = excluded.settlement_networks,
  max_client_risk = excluded.max_client_risk,
  accepts_individuals = excluded.accepts_individuals,
  blocked_verticals = excluded.blocked_verticals,
  pricing_tier = excluded.pricing_tier,
  settlement_speed = excluded.settlement_speed,
  notes = excluded.notes;

-- LP registry (real LP roster owned by trading desk per PRD §5.5.4)
-- Grand Pay was previously seeded here in error — it is a CLIENT (CNY
-- originator), not an LP. Removed via the explicit delete below.
insert into lps (lp_name, supported_currencies, settlement_networks, risk_tolerance, notes) values
  ('Nonco', array['USD','EUR','GBP'], array['BLINK','SWIFT']::settlement_network[], 'MEDIUM',
   'Primary Blink-enabled LP via BCB. Near-instant settlement.'),
  ('Flowdesk', array['USD','EUR','GBP'], array['BLINK','SWIFT']::settlement_network[], 'MEDIUM',
   'Blink-enabled LP via BCB.'),
  ('DV Trading', array['CAD','USD','EUR','GBP'], array['EFT','SWIFT','CUBIX']::settlement_network[], 'MEDIUM',
   'Multi-currency: CAD primary (EFT to ConnectFirst), plus USD/EUR/GBP via SWIFT or Cubix.'),
  ('Cumberland', array['USD'], array['CUBIX','FEDWIRE']::settlement_network[], 'MEDIUM',
   'Cubix-enrolled LP for USD flows via Customers Bank.'),
  ('B2C2', array['USD','EUR','GBP'], array['CUBIX','SWIFT']::settlement_network[], 'MEDIUM',
   'Cubix-enrolled LP. USD flows via Customers Bank.'),
  ('Fireblocks (custody)', array['USDT','USDC','BTC','ETH'], array['CRYPTO','RIPPLE_ODL']::settlement_network[], 'MEDIUM',
   'Crypto custody → Ripple ODL for stablecoin-in flows.'),
  ('Enigma', array['USD','EUR','GBP'], array['SWIFT']::settlement_network[], 'MEDIUM',
   'OTC desk added per product call. Trading desk to confirm full currency/network coverage.'),
  ('Wintermute', array['USD','EUR','GBP'], array['SWIFT']::settlement_network[], 'MEDIUM',
   'OTC desk added per product call. Trading desk to confirm full currency/network coverage.')
on conflict (lp_name) do update set
  supported_currencies = excluded.supported_currencies,
  settlement_networks  = excluded.settlement_networks,
  notes                = excluded.notes;

-- Remove the legacy Grand Pay LP record (re-modeled as a client elsewhere)
delete from lps where lp_name = 'Grand Pay';
