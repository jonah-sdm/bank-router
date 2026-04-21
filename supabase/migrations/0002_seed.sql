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
   array['FEDWIRE','CUBIX']::settlement_network[],
   'MEDIUM', true, array['GAMING','GAMBLING','ATM_OPERATOR'],
   'BEST', 'INSTANT',
   'USD domestic ONLY. Best pricing for USD. Cubix = instant/free settlements with LP network. Cannot onboard HIGH risk clients.'),

  ('BCB Group', 'T1', 'SDM_INC',
   array['USD','GBP','EUR'], array['USD','GBP','EUR'],
   array['SWIFT','BLINK']::settlement_network[],
   'MEDIUM', false, array['GAMING','GAMBLING','ATM_OPERATOR'],
   'COMPETITIVE', 'INSTANT',
   'Multi-currency. Blink = near-instant/free via Nonco/Flowdesk. Cannot onboard HIGH risk. GBP/EUR available. EDD on individuals.'),

  ('OpenPay', 'T2', 'SDM_INC',
   array['USD','EUR','GBP','CHF','JPY','SGD','HKD','AUD'], array['USD','EUR','GBP'],
   array['SWIFT']::settlement_network[],
   'HIGH', true, array[]::text[],
   'PREMIUM', 'T1',
   'Higher fees. Lenient on risk. SWIFT only. Accepts USD/EUR/GBP from LPs, does FX to other supported currencies.'),

  ('Equals Money', 'T2', 'SDM_INC',
   array['USD','EUR','GBP','CNY','CHF','JPY','SGD','HKD','AUD','AED'], array['USD','EUR','GBP','CNY'],
   array['SWIFT']::settlement_network[],
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
   array['CAD'], array['CAD'],
   array['EFT']::settlement_network[],
   'MEDIUM', true, array[]::text[],
   'STANDARD', 'T1',
   'Deprecated for most clients. Only ~2 clients remain.'),

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
   array['FEDWIRE']::settlement_network[],
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

-- Sample LPs (placeholder — real LP registry owned by trading desk per PRD §5.5.4)
insert into lps (lp_name, supported_currencies, settlement_networks, risk_tolerance, notes) values
  ('Nonco', array['USD','EUR','GBP'], array['BLINK','SWIFT']::settlement_network[], 'MEDIUM',
   'Primary Blink-enabled LP via BCB. Near-instant settlement.'),
  ('Flowdesk', array['USD','EUR','GBP'], array['BLINK','SWIFT']::settlement_network[], 'MEDIUM',
   'Blink-enabled LP via BCB.'),
  ('DV Trading', array['CAD'], array['EFT']::settlement_network[], 'MEDIUM',
   'Required for CAD flows to ConnectFirst via EFT. Limited LP set for CAD.'),
  ('Cumberland', array['USD'], array['CUBIX','FEDWIRE']::settlement_network[], 'MEDIUM',
   'Cubix-enrolled LP for USD flows via Customers Bank.'),
  ('B2C2', array['USD','EUR','GBP'], array['CUBIX','SWIFT']::settlement_network[], 'MEDIUM',
   'Cubix-enrolled LP. USD flows via Customers Bank.'),
  ('Fireblocks (custody)', array['USDT','USDC','BTC','ETH'], array['CRYPTO','RIPPLE_ODL']::settlement_network[], 'MEDIUM',
   'Crypto custody → Ripple ODL for stablecoin-in flows.'),
  ('Grand Pay', array['CNY','USD'], array['SWIFT']::settlement_network[], 'MEDIUM',
   'CNY originator/counterparty per Curtis transcript. CNY → Equals → USD conversion flow.')
on conflict (lp_name) do nothing;
