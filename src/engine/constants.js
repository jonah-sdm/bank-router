// Routing engine constants — PRD §3, §4, §5
// Mirrors SQL enums in supabase/migrations/0001_init.sql.

export const BUSINESS_VERTICALS = [
  { code: 'MINER',              label: 'Crypto mining operation',               risk: 'LOW' },
  { code: 'EXCHANGE',           label: 'Crypto exchange (CEX/DEX)',             risk: 'MEDIUM' },
  { code: 'PSP',                label: 'Payment service provider',              risk: 'MEDIUM' },
  { code: 'BROKER',             label: 'FX/crypto brokerage',                   risk: 'MEDIUM' },
  { code: 'REAL_ESTATE',        label: 'Real estate firm',                      risk: 'LOW_MEDIUM' },
  { code: 'GAMING',             label: 'Online gaming / iGaming / casino',      risk: 'HIGH' },
  { code: 'GAMBLING',           label: 'Licensed gambling operator',            risk: 'HIGH' },
  { code: 'ATM_OPERATOR',       label: 'Crypto ATM network operator',           risk: 'HIGH' },
  { code: 'FINTECH',            label: 'Fintech startup / neobank',             risk: 'MEDIUM' },
  { code: 'CORPORATE_TREASURY', label: 'Corp treasury (DAT/stablecoins)',       risk: 'LOW' },
  { code: 'INDIVIDUAL',         label: 'Individual / HNWI / sole trader',       risk: 'HIGH' },
  { code: 'OTHER',              label: 'Other — manual review',                 risk: 'MANUAL_REVIEW' }
];

export const SDM_ENTITIES = ['SDM_INC', 'SDM_USA'];
export const ENTITY_TYPES = ['INDIVIDUAL', 'CORPORATION'];
export const RISK_RATINGS = ['LOW', 'MEDIUM', 'HIGH'];
export const KYC_STATUSES = ['PENDING', 'APPROVED', 'EDD_REQUIRED'];

export const SETTLEMENT_NETWORKS = [
  'FEDWIRE', 'SWIFT', 'EFT', 'BLINK', 'CUBIX', 'RIPPLE_ODL', 'CRYPTO'
];

// Industry-standard rails that a client can explicitly request.
// Proprietary/instant networks (BLINK/CUBIX/RIPPLE_ODL) are NOT in this list —
// they are bank-internal rails declared on the bank profile and auto-selected
// by the engine when eligible.
export const CLIENT_REQUESTABLE_NETWORKS = ['FEDWIRE', 'SWIFT', 'EFT'];

// Bank-proprietary instant/free networks. A bank with one of these is
// effectively "upgraded" from the industry rail it covers.
export const PROPRIETARY_NETWORKS = ['BLINK', 'CUBIX', 'RIPPLE_ODL'];

// Which industry rail each proprietary network substitutes for. The engine uses
// this to auto-select the proprietary rail when a client requested the
// equivalent industry rail and the bank offers both.
//   Customers Bank supports FEDWIRE + CUBIX  → client asked for FEDWIRE → CUBIX wins.
//   BCB supports SWIFT + BLINK              → client asked for SWIFT   → BLINK wins.
export const PROPRIETARY_UPGRADES = {
  CUBIX:      'FEDWIRE',
  BLINK:      'SWIFT',
  RIPPLE_ODL: 'SWIFT'     // Ripple competes with SWIFT for cross-border stables-in flows
};

export const SETTLEMENT_SLA = ['T0_SAME_DAY', 'T1_NEXT_DAY', 'T2_TWO_DAY'];
export const SETTLEMENT_SPEED = ['INSTANT', 'SAME_DAY', 'T1', 'T2'];

export const PRICING_TIERS = ['BEST', 'COMPETITIVE', 'STANDARD', 'PREMIUM'];
export const BANK_TIERS = ['T1', 'T1_CAD', 'T2', 'T2_SPECIALIST', 'T3', 'T3_DEDICATED'];
export const PRIORITY_TIERS = ['P1', 'P2', 'P3'];

// Ripple ODL eligible corridors — PRD §5.2.7
// Keys: settlement currency. Values: allowed beneficiary countries.
export const RIPPLE_CORRIDORS = {
  EUR: ['DE','FR','IT','ES','NL','BE','IE','PT','AT','FI','GR','LU','SI','SK','EE','LV','LT','MT','CY'],  // SEPA
  GBP: ['GB'],
  USD: ['CN'],
  AED: ['AE']
};

// Scoring factor defaults — PRD §5.3
export const DEFAULT_WEIGHTS = {
  tier_weight: 30,
  settlement_speed_weight: 25,
  pricing_weight: 20,
  network_bonus_weight: 15,
  priority_bonus_weight: 10
};

// Tier → base score (PRD §5.3)
export const TIER_SCORE = {
  T1:            100,
  T1_CAD:        100,
  T2:             60,
  T2_SPECIALIST:  50,
  T3:             30,
  T3_DEDICATED:   30
};

// Pricing tier → score (PRD §5.3)
export const PRICING_SCORE = {
  BEST:        100,
  COMPETITIVE:  80,
  STANDARD:     50,
  PREMIUM:      20
};

// Settlement speed score — used for speed match
export const SPEED_MATCHES = {
  T0_SAME_DAY: ['INSTANT', 'SAME_DAY'],
  T1_NEXT_DAY: ['INSTANT', 'SAME_DAY', 'T1'],
  T2_TWO_DAY:  ['INSTANT', 'SAME_DAY', 'T1', 'T2']
};

// Networks considered "bonus" (instant/free rails) — PRD §5.3
export const BONUS_NETWORKS = new Set(['BLINK', 'CUBIX', 'RIPPLE_ODL']);
