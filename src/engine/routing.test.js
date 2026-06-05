// Validates the engine against PRD Appendix A worked examples.
// Banks below mirror supabase/migrations/0002_seed.sql.

import { describe, it, expect } from 'vitest';
import { computeRouting, excludeIneligibleBanks, scoreBanks } from './routing.js';

const BANKS = [
  {
    bank_id: 'b1', bank_name: 'Customers Bank', tier: 'T1', sdm_entity: 'SDM_INC',
    supported_currencies: ['USD'], settlement_networks: ['FEDWIRE','CUBIX'],
    max_client_risk: 'MEDIUM', accepts_individuals: true,
    blocked_verticals: ['GAMING','GAMBLING','ATM_OPERATOR'],
    pricing_tier: 'BEST', settlement_speed: 'INSTANT', is_active: true
  },
  {
    bank_id: 'b2', bank_name: 'BCB Group', tier: 'T1', sdm_entity: 'SDM_INC',
    supported_currencies: ['USD','GBP','EUR'], settlement_networks: ['SWIFT','BLINK'],
    max_client_risk: 'MEDIUM', accepts_individuals: false,
    blocked_verticals: ['GAMING','GAMBLING','ATM_OPERATOR'],
    pricing_tier: 'COMPETITIVE', settlement_speed: 'INSTANT', is_active: true
  },
  {
    bank_id: 'b3', bank_name: 'Openpayd', tier: 'T2', sdm_entity: 'SDM_INC',
    supported_currencies: ['USD','EUR','GBP'], settlement_networks: ['SWIFT'],
    max_client_risk: 'HIGH', accepts_individuals: true, blocked_verticals: [],
    pricing_tier: 'PREMIUM', settlement_speed: 'T1', is_active: true
  },
  {
    bank_id: 'b4', bank_name: 'Equals Money', tier: 'T2', sdm_entity: 'SDM_INC',
    supported_currencies: ['USD','EUR','GBP','CNY','AED'], settlement_networks: ['SWIFT'],
    max_client_risk: 'HIGH', accepts_individuals: true, blocked_verticals: [],
    pricing_tier: 'PREMIUM', settlement_speed: 'T1', is_active: true
  },
  {
    bank_id: 'b5', bank_name: 'Ripple (ODL)', tier: 'T2_SPECIALIST', sdm_entity: 'SDM_INC',
    supported_currencies: ['EUR','GBP','USD','AED'], settlement_networks: ['RIPPLE_ODL'],
    max_client_risk: 'MEDIUM', accepts_individuals: true, blocked_verticals: [],
    pricing_tier: 'BEST', settlement_speed: 'INSTANT', is_active: true
  },
  {
    bank_id: 'b6', bank_name: 'ConnectFirst CU', tier: 'T1_CAD', sdm_entity: 'SDM_INC',
    supported_currencies: ['CAD'], settlement_networks: ['EFT'],
    max_client_risk: 'MEDIUM', accepts_individuals: true,
    blocked_verticals: ['GAMING','GAMBLING','ATM_OPERATOR'],
    pricing_tier: 'BEST', settlement_speed: 'SAME_DAY', is_active: true
  },
  {
    bank_id: 'b7', bank_name: 'Neo Financial', tier: 'T2', sdm_entity: 'SDM_INC',
    supported_currencies: ['CAD'], settlement_networks: ['EFT'],
    max_client_risk: 'MEDIUM', accepts_individuals: true, blocked_verticals: [],
    pricing_tier: 'STANDARD', settlement_speed: 'T1', is_active: true
  },
  {
    bank_id: 'b8', bank_name: 'Old Glory Bank', tier: 'T3', sdm_entity: 'SDM_USA',
    supported_currencies: ['USD'], settlement_networks: ['FEDWIRE'],
    max_client_risk: 'LOW', accepts_individuals: true,
    blocked_verticals: ['GAMING','GAMBLING','ATM_OPERATOR'],
    pricing_tier: 'STANDARD', settlement_speed: 'SAME_DAY', is_active: true
  }
];

const LPS = [
  { lp_id: 'l1', lp_name: 'Nonco', supported_currencies: ['USD','EUR','GBP'],
    settlement_networks: ['BLINK','SWIFT'], preferred_banks: [], risk_tolerance: 'MEDIUM', is_active: true },
  { lp_id: 'l2', lp_name: 'Flowdesk', supported_currencies: ['USD','EUR','GBP'],
    settlement_networks: ['BLINK','SWIFT'], preferred_banks: [], risk_tolerance: 'MEDIUM', is_active: true },
  { lp_id: 'l3', lp_name: 'DV Trading', supported_currencies: ['CAD'],
    settlement_networks: ['EFT'], preferred_banks: [], risk_tolerance: 'MEDIUM', is_active: true },
  { lp_id: 'l4', lp_name: 'Cumberland', supported_currencies: ['USD'],
    settlement_networks: ['CUBIX','FEDWIRE'], preferred_banks: [], risk_tolerance: 'MEDIUM', is_active: true },
  { lp_id: 'l5', lp_name: 'Fireblocks', supported_currencies: ['USDT','USDC'],
    settlement_networks: ['CRYPTO','RIPPLE_ODL'], preferred_banks: [], risk_tolerance: 'MEDIUM', is_active: true }
];

// ------------------------- Appendix A.1 — Simple CAD -------------------------
describe('PRD Appendix A.1 — Simple CAD routing', () => {
  const profile = {
    client_name: 'CAD Test Corp',
    entity_type: 'CORPORATION',
    business_vertical: 'FINTECH',
    jurisdiction_country: 'CA',
    sdm_entity: 'SDM_INC',
    risk_rating: 'LOW',
    currencies_traded: ['CAD'],
    settlement_currencies: ['CAD'],
    settlement_methods: ['EFT'],
    settlement_speed_sla: 'T1_NEXT_DAY',
    beneficiary_country: 'CA',
    uses_stablecoins: false,
    priority_tier: 'P2'
  };

  it('routes CAD leg to ConnectFirst via EFT', () => {
    const [cad] = computeRouting(profile, BANKS, LPS);
    expect(cad.currency_leg).toBe('CAD');
    expect(cad.recommended_bank?.bank_name).toBe('ConnectFirst CU');
    expect(cad.settlement_network).toBe('EFT');
    expect(cad.confidence).toBe('HIGH');
  });

  it('recommends DV Trading as LP for CAD', () => {
    const [cad] = computeRouting(profile, BANKS, LPS);
    expect(cad.recommended_lps.map(l => l.lp_name)).toContain('DV Trading');
  });
});

// ------------------------- Appendix A.2 — Multi-currency HIGH risk -------------------------
describe('PRD Appendix A.2 — High-risk gaming (Paktra/Raw pattern)', () => {
  const profile = {
    client_name: 'Paktra',
    entity_type: 'CORPORATION',
    business_vertical: 'GAMING',
    jurisdiction_country: 'MT',
    sdm_entity: 'SDM_INC',
    risk_rating: 'HIGH',
    currencies_traded: ['USD','EUR'],
    settlement_currencies: ['USD','EUR'],
    settlement_methods: ['SWIFT'],
    settlement_speed_sla: 'T0_SAME_DAY',
    beneficiary_country: 'MT',
    uses_stablecoins: false,
    priority_tier: 'P1'
  };

  it('excludes Customers Bank and BCB for USD leg (risk only — vertical no longer filters)', () => {
    const { excluded } = excludeIneligibleBanks(profile, BANKS, 'USD');
    const names = excluded.map(e => e.bank_name);
    // Both excluded because max_client_risk is MEDIUM and client is HIGH.
    // Vertical-based exclusion was removed per the Curtis/Jim spec.
    expect(names).toContain('Customers Bank');
    expect(names).toContain('BCB Group');
  });

  it('routes USD leg to Openpayd via SWIFT', () => {
    const recs = computeRouting(profile, BANKS, LPS);
    const usd = recs.find(r => r.currency_leg === 'USD');
    expect(usd.recommended_bank?.bank_name).toBe('Openpayd');
    expect(usd.settlement_network).toBe('SWIFT');
  });

  it('routes EUR leg to Openpayd or Equals via SWIFT', () => {
    const recs = computeRouting(profile, BANKS, LPS);
    const eur = recs.find(r => r.currency_leg === 'EUR');
    expect(['Openpayd', 'Equals Money']).toContain(eur.recommended_bank?.bank_name);
    expect(eur.settlement_network).toBe('SWIFT');
  });
});

// ------------------------- Appendix A.3 — Ripple ODL AED -------------------------
describe('PRD Appendix A.3 — Ripple AED corridor (Toofan pattern)', () => {
  const profile = {
    client_name: 'Toofan Real Estate',
    entity_type: 'CORPORATION',
    business_vertical: 'REAL_ESTATE',
    jurisdiction_country: 'AE',
    sdm_entity: 'SDM_INC',
    risk_rating: 'MEDIUM',
    currencies_traded: ['USDT','AED'],
    settlement_currencies: ['AED'],
    settlement_methods: [],  // no specific client preference
    settlement_speed_sla: 'T0_SAME_DAY',
    beneficiary_country: 'AE',
    uses_stablecoins: true,
    priority_tier: 'P1'
  };

  it('routes AED leg to Ripple ODL', () => {
    const [aed] = computeRouting(profile, BANKS, LPS);
    expect(aed.currency_leg).toBe('AED');
    expect(aed.recommended_bank?.bank_name).toBe('Ripple (ODL)');
    expect(aed.settlement_network).toBe('RIPPLE_ODL');
  });

  it('provides Equals as AED fallback', () => {
    const [aed] = computeRouting(profile, BANKS, LPS);
    expect(aed.fallback_bank?.bank_name).toBe('Equals Money');
  });

  it('excludes Ripple when stables_in is false', () => {
    const p2 = { ...profile, uses_stablecoins: false };
    const { excluded } = excludeIneligibleBanks(p2, BANKS, 'AED');
    expect(excluded.some(e => e.bank_name === 'Ripple (ODL)')).toBe(true);
  });
});

// ------------------------- SDM USA routing -------------------------
describe('SDM USA entity routing', () => {
  const profile = {
    client_name: 'US Client LLC',
    entity_type: 'CORPORATION',
    business_vertical: 'CORPORATE_TREASURY',
    jurisdiction_country: 'US',
    sdm_entity: 'SDM_USA',
    risk_rating: 'LOW',
    currencies_traded: ['USD'],
    settlement_currencies: ['USD'],
    settlement_methods: ['FEDWIRE'],
    settlement_speed_sla: 'T1_NEXT_DAY',
    beneficiary_country: 'US',
    uses_stablecoins: false,
    priority_tier: 'P2'
  };

  it('routes SDM_USA client to Old Glory Bank (Customers Bank excluded: wrong entity)', () => {
    const [usd] = computeRouting(profile, BANKS, LPS);
    expect(usd.recommended_bank?.bank_name).toBe('Old Glory Bank');
    expect(usd.settlement_network).toBe('FEDWIRE');
  });

  it('lists Customers Bank in exclusion log for SDM_USA client', () => {
    const { excluded } = excludeIneligibleBanks(profile, BANKS, 'USD');
    expect(excluded.some(e => e.bank_name === 'Customers Bank')).toBe(true);
  });
});

// ------------------------- Individual blocked at BCB -------------------------
describe('Individual client routing', () => {
  const profile = {
    client_name: 'Jane HNWI',
    entity_type: 'INDIVIDUAL',
    business_vertical: 'INDIVIDUAL',
    jurisdiction_country: 'GB',
    sdm_entity: 'SDM_INC',
    risk_rating: 'MEDIUM',
    currencies_traded: ['GBP'],
    settlement_currencies: ['GBP'],
    settlement_methods: ['SWIFT'],
    settlement_speed_sla: 'T1_NEXT_DAY',
    beneficiary_country: 'GB',
    uses_stablecoins: false,
    priority_tier: 'P2'
  };

  it('excludes BCB for individual clients', () => {
    const { excluded } = excludeIneligibleBanks(profile, BANKS, 'GBP');
    expect(excluded.some(e => e.bank_name === 'BCB Group')).toBe(true);
  });
});

// ------------------------- AFFINITY RULES -------------------------
describe('Affinity rules (Layer 3)', () => {
  const RULES = [
    { rule_id: 'r1', label: 'CNY → Equals', currency: 'CNY', bank_id: 'b4', boost: 100, is_active: true },
    { rule_id: 'r2', label: 'CAD → ConnectFirst', currency: 'CAD', beneficiary_country: 'CA', bank_id: 'b6', boost: 100, is_active: true },
    { rule_id: 'r3', label: 'USD push Customers', currency: 'USD', required_sdm_entity: 'SDM_INC', required_risk: 'MEDIUM', bank_id: 'b1', boost: 100, is_active: true },
    { rule_id: 'r4', label: 'USD HIGH → Openpayd', currency: 'USD', required_risk: 'HIGH', bank_id: 'b3', boost: 100, is_active: true },
    { rule_id: 'r5', label: 'AED UAE stables → Ripple', currency: 'AED', beneficiary_country: 'AE', requires_stables_in: true, bank_id: 'b5', boost: 100, is_active: true },
    { rule_id: 'r6', label: 'USD + SDM_USA → Old Glory', currency: 'USD', required_sdm_entity: 'SDM_USA', bank_id: 'b8', boost: 100, is_active: true }
  ];

  it('CNY client routes to Equals even though Openpayd also supports CNY', () => {
    const profile = {
      entity_type: 'CORPORATION', business_vertical: 'PSP',
      sdm_entity: 'SDM_INC', risk_rating: 'MEDIUM',
      settlement_currencies: ['CNY'], settlement_methods: ['SWIFT'],
      settlement_speed_sla: 'T1_NEXT_DAY', priority_tier: 'P2',
      uses_stablecoins: false
    };
    const [leg] = computeRouting(profile, BANKS, LPS, undefined, RULES);
    expect(leg.recommended_bank?.bank_name).toBe('Equals Money');
    expect(leg.affinity_bonus).toBe(100);
    expect(leg.affinity_applied.map(r => r.label)).toContain('CNY → Equals');
  });

  it('Customers Bank wins over BCB for USD MEDIUM-risk SDM_INC via strategic affinity', () => {
    const profile = {
      entity_type: 'CORPORATION', business_vertical: 'FINTECH',
      sdm_entity: 'SDM_INC', risk_rating: 'MEDIUM',
      settlement_currencies: ['USD'], settlement_methods: [],
      settlement_speed_sla: 'T1_NEXT_DAY', priority_tier: 'P2',
      uses_stablecoins: false
    };
    const [leg] = computeRouting(profile, BANKS, LPS, undefined, RULES);
    expect(leg.recommended_bank?.bank_name).toBe('Customers Bank');
    expect(leg.affinity_bonus).toBe(100);
  });

  it('USD HIGH-risk client still routes to Openpayd via affinity (Customers/BCB excluded anyway)', () => {
    const profile = {
      entity_type: 'CORPORATION', business_vertical: 'GAMING',
      sdm_entity: 'SDM_INC', risk_rating: 'HIGH',
      settlement_currencies: ['USD'], settlement_methods: ['SWIFT'],
      settlement_speed_sla: 'T0_SAME_DAY', priority_tier: 'P1',
      uses_stablecoins: false
    };
    const [leg] = computeRouting(profile, BANKS, LPS, undefined, RULES);
    expect(leg.recommended_bank?.bank_name).toBe('Openpayd');
    expect(leg.affinity_bonus).toBe(100);
  });

  it('Toofan AED pattern gets massive Ripple boost', () => {
    const profile = {
      entity_type: 'CORPORATION', business_vertical: 'REAL_ESTATE',
      sdm_entity: 'SDM_INC', risk_rating: 'MEDIUM',
      settlement_currencies: ['AED'], settlement_methods: [],
      settlement_speed_sla: 'T0_SAME_DAY', priority_tier: 'P1',
      beneficiary_country: 'AE', uses_stablecoins: true
    };
    const [leg] = computeRouting(profile, BANKS, LPS, undefined, RULES);
    expect(leg.recommended_bank?.bank_name).toBe('Ripple (ODL)');
    expect(leg.affinity_bonus).toBe(100);
  });

  it('SDM_USA entity forces Old Glory via affinity', () => {
    const profile = {
      entity_type: 'CORPORATION', business_vertical: 'CORPORATE_TREASURY',
      sdm_entity: 'SDM_USA', risk_rating: 'LOW',
      settlement_currencies: ['USD'], settlement_methods: ['FEDWIRE'],
      settlement_speed_sla: 'T1_NEXT_DAY', priority_tier: 'P2',
      uses_stablecoins: false
    };
    const [leg] = computeRouting(profile, BANKS, LPS, undefined, RULES);
    expect(leg.recommended_bank?.bank_name).toBe('Old Glory Bank');
    expect(leg.affinity_bonus).toBe(100);
  });

  it('requires_stables_in=true blocks rule when client does not use stables', () => {
    const profile = {
      entity_type: 'CORPORATION', business_vertical: 'REAL_ESTATE',
      sdm_entity: 'SDM_INC', risk_rating: 'MEDIUM',
      settlement_currencies: ['AED'], settlement_methods: [],
      settlement_speed_sla: 'T1_NEXT_DAY', priority_tier: 'P2',
      beneficiary_country: 'AE', uses_stablecoins: false
    };
    const [leg] = computeRouting(profile, BANKS, LPS, undefined, RULES);
    // Ripple auto-excluded (no stables), affinity doesn't matter
    expect(leg.recommended_bank?.bank_name).not.toBe('Ripple (ODL)');
    expect(leg.affinity_bonus).toBe(0);
  });

  it('empty rule list = pure scoring (backwards compatible)', () => {
    const profile = {
      entity_type: 'CORPORATION', business_vertical: 'FINTECH',
      jurisdiction_country: 'CA',
      sdm_entity: 'SDM_INC', risk_rating: 'LOW',
      settlement_currencies: ['CAD'], settlement_methods: ['EFT'],
      settlement_speed_sla: 'T1_NEXT_DAY', priority_tier: 'P2',
      beneficiary_country: 'CA', uses_stablecoins: false
    };
    const [leg] = computeRouting(profile, BANKS, LPS, undefined, []);
    expect(leg.recommended_bank?.bank_name).toBe('ConnectFirst CU');
    expect(leg.affinity_bonus).toBe(0);
  });
});

// ------------------------- proprietary network upgrades -------------------------
describe('Proprietary network upgrades', () => {
  it('Customers Bank uses CUBIX when client requested FEDWIRE', () => {
    const profile = {
      entity_type: 'CORPORATION', business_vertical: 'FINTECH',
      sdm_entity: 'SDM_INC', risk_rating: 'LOW',
      settlement_currencies: ['USD'], settlement_methods: ['FEDWIRE'],
      settlement_speed_sla: 'T0_SAME_DAY', priority_tier: 'P1',
      uses_stablecoins: false
    };
    const [leg] = computeRouting(profile, BANKS, LPS);
    expect(leg.recommended_bank?.bank_name).toBe('Customers Bank');
    expect(leg.settlement_network).toBe('CUBIX');  // upgraded from FEDWIRE
  });

  it('BCB uses BLINK when client requested SWIFT', () => {
    const profile = {
      entity_type: 'CORPORATION', business_vertical: 'EXCHANGE',
      sdm_entity: 'SDM_INC', risk_rating: 'MEDIUM',
      settlement_currencies: ['GBP'], settlement_methods: ['SWIFT'],
      settlement_speed_sla: 'T0_SAME_DAY', priority_tier: 'P1',
      beneficiary_country: 'GB', uses_stablecoins: false
    };
    const [leg] = computeRouting(profile, BANKS, LPS);
    expect(leg.recommended_bank?.bank_name).toBe('BCB Group');
    expect(leg.settlement_network).toBe('BLINK');  // upgraded from SWIFT
  });

  it('Openpayd stays on SWIFT for HIGH-risk since it has no proprietary rail', () => {
    const profile = {
      entity_type: 'CORPORATION', business_vertical: 'GAMING',
      sdm_entity: 'SDM_INC', risk_rating: 'HIGH',
      settlement_currencies: ['USD'], settlement_methods: ['SWIFT'],
      settlement_speed_sla: 'T0_SAME_DAY', priority_tier: 'P1',
      uses_stablecoins: false
    };
    const [leg] = computeRouting(profile, BANKS, LPS);
    expect(leg.recommended_bank?.bank_name).toBe('Openpayd');
    expect(leg.settlement_network).toBe('SWIFT');
  });
});

// ------------------------- settlement flow (Phase B) -------------------------
describe('Settlement flow — 5-step buy / sell + intra-bank transfer', () => {
  const baseProfile = {
    entity_type: 'CORPORATION', business_vertical: 'FINTECH',
    sdm_entity: 'SDM_INC',
    settlement_currencies: ['USD'], settlement_methods: [],
    settlement_speed_sla: 'T1_NEXT_DAY', priority_tier: 'P2',
    currencies_traded: ['USD'], beneficiary_country: 'US',
    uses_stablecoins: false
  };

  it('buy flow has 5 steps: Client → SDM Bank → LP → SDM Fireblocks → Client Wallet', () => {
    const profile = { ...baseProfile, risk_rating: 'LOW' };
    const [leg] = computeRouting(profile, BANKS, LPS);
    const buy = leg.settlement_flow.buy.steps.map(s => s.kind);
    expect(buy).toEqual([
      'client', 'sdm_bank', 'lp', 'sdm_fireblocks', 'client_wallet'
    ]);
  });

  it('sell flow has 5 steps when no intra-bank transfer is needed', () => {
    const profile = { ...baseProfile, risk_rating: 'LOW' };
    const [leg] = computeRouting(profile, BANKS, LPS);
    expect(leg.settlement_flow.has_intra_bank).toBe(false);
    const sell = leg.settlement_flow.sell.steps.map(s => s.kind);
    expect(sell).toEqual([
      'client', 'sdm_fireblocks', 'lp', 'sdm_bank', 'client_bank'
    ]);
  });

  it('HIGH-risk client routed to OpenpaydEquals does NOT trigger intra-bank (only BCB/Customers do)', () => {
    // Paktra-style: HIGH risk USD → Openpayd (not BCB/Customers because risk excludes them)
    const profile = {
      ...baseProfile,
      risk_rating: 'HIGH',
      business_vertical: 'GAMING'
    };
    const [leg] = computeRouting(profile, BANKS, LPS);
    expect(leg.recommended_bank.bank_name).toBe('Openpayd');
    expect(leg.settlement_flow.has_intra_bank).toBe(false);
  });

  it('HIGH risk + primary bank = BCB triggers intra-bank transfer to Openpayd', () => {
    // Force BCB to win by giving it a strong affinity boost
    const RULES = [
      { rule_id: 'force-bcb', label: 'force BCB', currency: 'USD',
        bank_id: 'b2', boost: 200, is_active: true }
    ];
    // Use a MEDIUM-risk-tolerant version of BCB (already configured) AND
    // a profile that BCB accepts. Tweak risk via fixture: BCB.max_client_risk=HIGH
    const banksWithBCBHigh = BANKS.map(b =>
      b.bank_id === 'b2' ? { ...b, max_client_risk: 'HIGH' } : b
    );
    const profile = { ...baseProfile, risk_rating: 'HIGH' };
    const [leg] = computeRouting(profile, banksWithBCBHigh, LPS, undefined, RULES);
    expect(leg.recommended_bank.bank_name).toBe('BCB Group');
    expect(leg.settlement_flow.has_intra_bank).toBe(true);
    expect(leg.settlement_flow.intra_bank.bank_name).toBe('Openpayd');
    const sellKinds = leg.settlement_flow.sell.steps.map(s => s.kind);
    expect(sellKinds).toEqual([
      'client', 'sdm_fireblocks', 'lp', 'sdm_bank', 'sdm_intra_bank', 'client_bank'
    ]);
  });

  it('Customers Bank for HIGH-risk also triggers intra-bank (when both fixture-allowed)', () => {
    const banksHigh = BANKS.map(b =>
      b.bank_id === 'b1' ? { ...b, max_client_risk: 'HIGH' } : b
    );
    const RULES = [
      { rule_id: 'force-cust', label: 'force Customers', currency: 'USD',
        bank_id: 'b1', boost: 200, is_active: true }
    ];
    const profile = { ...baseProfile, risk_rating: 'HIGH' };
    const [leg] = computeRouting(profile, banksHigh, LPS, undefined, RULES);
    expect(leg.recommended_bank.bank_name).toBe('Customers Bank');
    expect(leg.settlement_flow.has_intra_bank).toBe(true);
    expect(['Openpayd', 'Equals Money']).toContain(leg.settlement_flow.intra_bank.bank_name);
  });

  it('alternatives carry their own settlement flow (so swap re-renders correctly)', () => {
    const profile = { ...baseProfile, risk_rating: 'LOW' };
    const [leg] = computeRouting(profile, BANKS, LPS);
    expect(leg.alternatives.length).toBeGreaterThan(0);
    for (const alt of leg.alternatives) {
      expect(alt.settlement_flow).toBeTruthy();
      expect(alt.settlement_flow.buy.steps).toBeInstanceOf(Array);
      expect(alt.settlement_flow.sell.steps).toBeInstanceOf(Array);
    }
  });
});

describe('SDM_USA intercompany flow (Curtis Apr-23)', () => {
  const baseProfile = {
    entity_type: 'CORPORATION', business_vertical: 'FINTECH',
    sdm_entity: 'SDM_USA',
    settlement_currencies: ['USD'], settlement_methods: [],
    settlement_speed_sla: 'T1_NEXT_DAY', priority_tier: 'P2',
    currencies_traded: ['USD'], beneficiary_country: 'US',
    uses_stablecoins: false, risk_rating: 'LOW'
  };

  it('SDM_USA sell flow inserts SDM_INC intercompany step between LP and bank', () => {
    const [leg] = computeRouting(baseProfile, BANKS, LPS);
    expect(leg.settlement_flow.has_intercompany).toBe(true);
    expect(leg.settlement_flow.intercompany.via_entity).toBe('SDM_INC');
    const sellKinds = leg.settlement_flow.sell.steps.map(s => s.kind);
    expect(sellKinds).toEqual([
      'client', 'sdm_fireblocks', 'lp', 'sdm_intercompany', 'sdm_bank', 'client_bank'
    ]);
  });

  it('SDM_USA buy flow inserts SDM_INC intercompany step between bank and LP', () => {
    const [leg] = computeRouting(baseProfile, BANKS, LPS);
    const buyKinds = leg.settlement_flow.buy.steps.map(s => s.kind);
    expect(buyKinds).toEqual([
      'client', 'sdm_bank', 'sdm_intercompany', 'lp', 'sdm_fireblocks', 'client_wallet'
    ]);
  });

  it('SDM_INC clients do NOT get the intercompany hop', () => {
    const profile = { ...baseProfile, sdm_entity: 'SDM_INC' };
    const [leg] = computeRouting(profile, BANKS, LPS);
    expect(leg.settlement_flow.has_intercompany).toBe(false);
    const sellKinds = leg.settlement_flow.sell.steps.map(s => s.kind);
    expect(sellKinds).not.toContain('sdm_intercompany');
  });
});

describe('Greenline + HTX crypto bridge flow (Curtis Apr-23)', () => {
  const baseProfile = {
    entity_type: 'CORPORATION', business_vertical: 'FINTECH',
    sdm_entity: 'SDM_INC',
    settlement_currencies: ['USD'], settlement_methods: [],
    settlement_speed_sla: 'T1_NEXT_DAY', priority_tier: 'P2',
    currencies_traded: ['USD'], beneficiary_country: 'US',
    uses_stablecoins: true, risk_rating: 'LOW'
  };

  it('clients without crypto_bridge_required get a null bridge_flow', () => {
    const [leg] = computeRouting(baseProfile, BANKS, LPS);
    expect(leg.bridge_flow).toBe(null);
  });

  it('crypto_bridge_required client gets the Greenline + HTX chain', () => {
    const profile = {
      ...baseProfile,
      crypto_bridge_required: true,
      crypto_origin_network: 'SOL',
      crypto_target_network: 'TRC20'
    };
    const [leg] = computeRouting(profile, BANKS, LPS);
    expect(leg.bridge_flow).toBeTruthy();
    expect(leg.bridge_flow.via_entity).toBe('Greenline');
    expect(leg.bridge_flow.exchange).toBe('HTX');
    expect(leg.bridge_flow.origin_network).toBe('SOL');
    expect(leg.bridge_flow.target_network).toBe('TRC20');
    const kinds = leg.bridge_flow.steps.map(s => s.kind);
    expect(kinds).toEqual([
      'client', 'sdm_fireblocks', 'sdm_bridge_vault',
      'bridge_exchange',
      'sdm_bridge_vault', 'sdm_fireblocks', 'client_wallet'
    ]);
  });

  it('bridge step values mention both origin and target chains', () => {
    const profile = {
      ...baseProfile,
      crypto_bridge_required: true,
      crypto_origin_network: 'SOL',
      crypto_target_network: 'TRC20'
    };
    const [leg] = computeRouting(profile, BANKS, LPS);
    const exchangeStep = leg.bridge_flow.steps.find(s => s.kind === 'bridge_exchange');
    expect(exchangeStep.value).toContain('SOL');
    expect(exchangeStep.value).toContain('TRC20');
  });
});

// ------------------------- scoring sanity -------------------------
describe('scoring normalization', () => {
  it('respects weight changes (pricing_weight dominates)', () => {
    const profile = {
      entity_type: 'CORPORATION', business_vertical: 'FINTECH',
      sdm_entity: 'SDM_INC', risk_rating: 'LOW',
      settlement_currencies: ['USD'], settlement_methods: [],
      settlement_speed_sla: 'T1_NEXT_DAY', priority_tier: 'P3',
      uses_stablecoins: false
    };
    const { eligible } = excludeIneligibleBanks(profile, BANKS, 'USD');
    const customWeights = { tier_weight: 0, settlement_speed_weight: 0, pricing_weight: 100, network_bonus_weight: 0, priority_bonus_weight: 0 };
    const scored = scoreBanks(profile, eligible, 'USD', customWeights);
    // With pricing-only weighting, BEST pricing (Customers Bank) should top
    expect(scored[0].bank.pricing_tier).toBe('BEST');
  });
});
