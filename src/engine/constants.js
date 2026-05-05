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
  // Public industry rails
  'FEDWIRE',          // USD domestic (US)
  'SEPA',             // EUR domestic (EU) — instant, daily-use
  'FASTER_PAYMENTS',  // GBP domestic (UK) — instant, daily-use
  'ACH',              // USD domestic (US) — slower, low-priority, rarely used
  'SWIFT',            // International multi-currency
  'EFT',              // CAD domestic
  // Bank-proprietary instant networks (auto-selected, not user-requested)
  'BLINK',
  'CUBIX',
  'RIPPLE_ODL',
  // Crypto/custody settlement
  'CRYPTO'
];

// Industry-standard rails that a client can explicitly request.
// Proprietary/instant networks (BLINK/CUBIX/RIPPLE_ODL) are NOT in this list —
// they are bank-internal rails declared on the bank profile and auto-selected
// by the engine when eligible.
export const CLIENT_REQUESTABLE_NETWORKS = [
  'FEDWIRE', 'SEPA', 'FASTER_PAYMENTS', 'SWIFT', 'EFT', 'ACH'
];

// Visual de-emphasis hint for the UI — these rails should be sorted last
// and rendered with reduced visual weight (rarely used).
export const LOW_PRIORITY_NETWORKS = new Set(['ACH']);

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

// Scoring factor defaults — extensible factor list.
// Each factor has a stable `id` (engine knows how to compute its per-bank score),
// a human label, a description for the admin UI, and a weight. Order in this
// array is the display order on the Weights admin page; ops can reorder/edit.
//
// Per Curtis/Jim: network bonus is #1 (intra-system Cubix/Blink/Ripple settle
// instantly and free with our LPs — should dominate routing decisions).
export const DEFAULT_FACTORS = [
  {
    id: 'network_bonus',
    label: 'Network Bonus',
    weight: 50,
    description: 'Intra-system rails (Blink / Cubix / Ripple ODL) settle instantly and free with our LPs. Dominates routing when both client and LP are on the same network.'
  },
  {
    id: 'tier',
    label: 'Bank Tier',
    weight: 30,
    description: 'T1=100 (preferred), T2=60, T2_SPECIALIST=50, T1_CAD=100, T3=30, T3_DEDICATED=30. Reflects fee, speed, and reliability profile.'
  },
  {
    id: 'settlement_speed',
    label: 'Settlement Speed',
    weight: 25,
    description: 'Full 100 if the bank can meet the client SLA (e.g. T0_SAME_DAY needs INSTANT or SAME_DAY bank speed). Zero on mismatch.'
  },
  {
    id: 'pricing',
    label: 'Pricing Tier',
    weight: 20,
    description: 'BEST=100, COMPETITIVE=80, STANDARD=50, PREMIUM=20.'
  },
  {
    id: 'priority',
    label: 'Priority Client Bonus',
    weight: 10,
    description: 'P1 client × INSTANT/SAME_DAY bank: +100. Otherwise 0. Bumps T+0 SLA clients toward instant rails.'
  }
];

// Legacy flat shape — DEFAULT_WEIGHTS — kept for back-compat with old engine
// callers. New code should use DEFAULT_FACTORS. Both shapes resolve to the
// same values via the engine's normalizeFactors() helper.
export const DEFAULT_WEIGHTS = Object.fromEntries(
  DEFAULT_FACTORS.map(f => [`${f.id}_weight`, f.weight])
);

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
