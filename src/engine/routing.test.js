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
    bank_id: 'b3', bank_name: 'OpenPay', tier: 'T2', sdm_entity: 'SDM_INC',
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

  it('excludes Customers Bank and BCB for USD leg (risk + vertical)', () => {
    const { excluded } = excludeIneligibleBanks(profile, BANKS, 'USD');
    const names = excluded.map(e => e.bank_name);
    expect(names).toContain('Customers Bank');
    expect(names).toContain('BCB Group');
  });

  it('routes USD leg to OpenPay via SWIFT', () => {
    const recs = computeRouting(profile, BANKS, LPS);
    const usd = recs.find(r => r.currency_leg === 'USD');
    expect(usd.recommended_bank?.bank_name).toBe('OpenPay');
    expect(usd.settlement_network).toBe('SWIFT');
  });

  it('routes EUR leg to OpenPay or Equals via SWIFT', () => {
    const recs = computeRouting(profile, BANKS, LPS);
    const eur = recs.find(r => r.currency_leg === 'EUR');
    expect(['OpenPay', 'Equals Money']).toContain(eur.recommended_bank?.bank_name);
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
    { rule_id: 'r4', label: 'USD HIGH → OpenPay', currency: 'USD', required_risk: 'HIGH', bank_id: 'b3', boost: 100, is_active: true },
    { rule_id: 'r5', label: 'AED UAE stables → Ripple', currency: 'AED', beneficiary_country: 'AE', requires_stables_in: true, bank_id: 'b5', boost: 100, is_active: true },
    { rule_id: 'r6', label: 'USD + SDM_USA → Old Glory', currency: 'USD', required_sdm_entity: 'SDM_USA', bank_id: 'b8', boost: 100, is_active: true }
  ];

  it('CNY client routes to Equals even though OpenPay also supports CNY', () => {
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

  it('USD HIGH-risk client still routes to OpenPay via affinity (Customers/BCB excluded anyway)', () => {
    const profile = {
      entity_type: 'CORPORATION', business_vertical: 'GAMING',
      sdm_entity: 'SDM_INC', risk_rating: 'HIGH',
      settlement_currencies: ['USD'], settlement_methods: ['SWIFT'],
      settlement_speed_sla: 'T0_SAME_DAY', priority_tier: 'P1',
      uses_stablecoins: false
    };
    const [leg] = computeRouting(profile, BANKS, LPS, undefined, RULES);
    expect(leg.recommended_bank?.bank_name).toBe('OpenPay');
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

  it('OpenPay stays on SWIFT for HIGH-risk since it has no proprietary rail', () => {
    const profile = {
      entity_type: 'CORPORATION', business_vertical: 'GAMING',
      sdm_entity: 'SDM_INC', risk_rating: 'HIGH',
      settlement_currencies: ['USD'], settlement_methods: ['SWIFT'],
      settlement_speed_sla: 'T0_SAME_DAY', priority_tier: 'P1',
      uses_stablecoins: false
    };
    const [leg] = computeRouting(profile, BANKS, LPS);
    expect(leg.recommended_bank?.bank_name).toBe('OpenPay');
    expect(leg.settlement_network).toBe('SWIFT');
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
