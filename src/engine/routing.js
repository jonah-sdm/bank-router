// =====================================================================
// SDM Routing Engine — pure function, no I/O.
// Contract per PRD §8.4:
//   computeRouting(profile, banks, lps, weights?) -> RoutingRecommendation[]
//
//   excludeIneligibleBanks(profile, banks, currency) ->
//     { eligible: Bank[], excluded: ExclusionLog[] }
//   scoreBanks(profile, eligible, currency, weights) -> ScoredBank[]
//   selectLPs(profile, bank, network, currency, lps)  -> LP[]
//
// All functions are pure and side-effect-free. DB access is the caller's job.
// =====================================================================

import {
  RIPPLE_CORRIDORS,
  DEFAULT_WEIGHTS,
  DEFAULT_FACTORS,
  TIER_SCORE,
  PRICING_SCORE,
  SPEED_MATCHES,
  BONUS_NETWORKS,
  PROPRIETARY_UPGRADES
} from './constants.js';

// Normalize any incoming weights config into a flat { factor_id: weight } map.
// Accepts:
//   - undefined / null               → use DEFAULT_FACTORS
//   - { factors: [{id, weight, ...}] } (new extensible shape)
//   - { network_bonus_weight: 50, tier_weight: 30, ... } (legacy flat shape)
//   - mixed (factors[] takes precedence; legacy keys fill gaps)
//
// New scoring factors can be introduced over time by adding entries to
// DEFAULT_FACTORS — they will appear automatically with their default weight
// unless an admin overrides them in the registry.
function normalizeWeights(weights) {
  const out = {};
  // Start with defaults so missing factors fall back gracefully
  for (const f of DEFAULT_FACTORS) out[f.id] = f.weight;

  if (weights && Array.isArray(weights.factors)) {
    for (const f of weights.factors) {
      if (f && typeof f.id === 'string') out[f.id] = Number(f.weight) || 0;
    }
  }
  // Legacy keys (`<id>_weight`) override or supplement the factor list
  if (weights && typeof weights === 'object') {
    for (const f of DEFAULT_FACTORS) {
      const legacy = weights[`${f.id}_weight`];
      if (legacy !== undefined) out[f.id] = Number(legacy) || 0;
    }
  }
  return out;
}

// --------------------------- helpers ---------------------------

const arr = v => (Array.isArray(v) ? v : []);
const has = (list, x) => arr(list).includes(x);

function entityCompatible(profile, bank) {
  if (bank.sdm_entity === 'BOTH') return true;
  return bank.sdm_entity === profile.sdm_entity;
}

function riskCompatible(profile, bank) {
  const rank = { LOW: 1, MEDIUM: 2, HIGH: 3 };
  return rank[profile.risk_rating] <= rank[bank.max_client_risk];
}

function rippleEligible(profile, currency) {
  if (!profile.uses_stablecoins) return false;
  const countries = RIPPLE_CORRIDORS[currency];
  if (!countries) return false;
  return countries.includes(profile.beneficiary_country);
}

// Pick the best settlement network on a bank that matches what the client wants.
//
// Rules (in order):
//   1. If bank has a proprietary upgrade that substitutes for a client-requested
//      industry rail (e.g. client asked FEDWIRE, bank has CUBIX which upgrades
//      FEDWIRE), use the proprietary rail — strictly better outcome.
//   2. If bank and client share an industry rail directly, use it.
//   3. If client expressed no preference, prefer a proprietary rail, else first
//      supported network.
//   4. Otherwise null — bank cannot service the client's method.
function pickNetwork(profile, bank) {
  const requested = arr(profile.settlement_methods);
  const supported = arr(bank.settlement_networks);

  // 1. Proprietary-over-industry upgrade (e.g. Customers Bank: client asked
  //    FEDWIRE, bank supports CUBIX which upgrades FEDWIRE → route via CUBIX)
  if (requested.length) {
    for (const prop of supported) {
      const substitutes = PROPRIETARY_UPGRADES[prop];
      if (substitutes && requested.includes(substitutes)) {
        return prop;
      }
    }
    // 2. Direct overlap on an industry rail
    const overlap = supported.filter(n => requested.includes(n));
    if (overlap.length) {
      const bonus = overlap.find(n => BONUS_NETWORKS.has(n));
      return bonus ?? overlap[0];
    }
    // 3. No match — client requested something bank can't do
    return null;
  }

  // 4. No explicit client preference — prefer a proprietary/bonus rail
  if (supported.length) {
    return supported.find(n => BONUS_NETWORKS.has(n)) ?? supported[0];
  }

  return null;
}

// --------------------------- exclusion filters (PRD §5.2) ---------------------------

export function excludeIneligibleBanks(profile, banks, currency) {
  const eligible = [];
  const excluded = [];

  for (const bank of banks) {
    if (!bank.is_active) {
      excluded.push({ bank_id: bank.bank_id, bank_name: bank.bank_name, reason: 'Inactive' });
      continue;
    }

    // 5.2.1 entity mismatch
    if (!entityCompatible(profile, bank)) {
      excluded.push({
        bank_id: bank.bank_id, bank_name: bank.bank_name,
        reason: `Entity mismatch (client ${profile.sdm_entity}, bank ${bank.sdm_entity})`
      });
      continue;
    }

    // 5.2.2 currency not supported
    if (!has(bank.supported_currencies, currency)) {
      excluded.push({
        bank_id: bank.bank_id, bank_name: bank.bank_name,
        reason: `${currency} not in supported_currencies`
      });
      continue;
    }

    // 5.2.3 settlement method incompatible
    const requested = arr(profile.settlement_methods);
    if (requested.length) {
      const anyMatch = requested.some(m => has(bank.settlement_networks, m));
      if (!anyMatch) {
        excluded.push({
          bank_id: bank.bank_id, bank_name: bank.bank_name,
          reason: `Does not support requested methods [${requested.join(', ')}]`
        });
        continue;
      }
    }

    // 5.2.4 risk rating exceeded
    if (!riskCompatible(profile, bank)) {
      excluded.push({
        bank_id: bank.bank_id, bank_name: bank.bank_name,
        reason: `Risk ${profile.risk_rating} exceeds bank max ${bank.max_client_risk}`
      });
      continue;
    }

    // 5.2.5 individual blocked
    if (profile.entity_type === 'INDIVIDUAL' && !bank.accepts_individuals) {
      excluded.push({
        bank_id: bank.bank_id, bank_name: bank.bank_name,
        reason: 'Bank does not accept individuals'
      });
      continue;
    }

    // 5.2.6 vertical-based exclusion REMOVED per Curtis/Jim product call —
    // vertical no longer drives routing. The blocked_verticals[] / accepted_verticals[]
    // fields stay on banks as informational / cross-trade-signal context but
    // do not filter eligibility. Routing is driven by jurisdiction, currency,
    // risk, and entity type only.

    // 5.2.7 Ripple-specific constraints
    if (has(bank.settlement_networks, 'RIPPLE_ODL') &&
        arr(bank.settlement_networks).length === 1 &&
        !rippleEligible(profile, currency)) {
      excluded.push({
        bank_id: bank.bank_id, bank_name: bank.bank_name,
        reason: `Ripple ODL ineligible: stables_in=${!!profile.uses_stablecoins}, beneficiary=${profile.beneficiary_country || '—'}, currency=${currency}`
      });
      continue;
    }

    eligible.push(bank);
  }

  return { eligible, excluded };
}

// --------------------------- affinity (Layer 3 — preferred bank map) ---------------------------

// A rule matches when every specified condition is satisfied on the profile+currency.
// Unspecified (null) fields on the rule act as wildcards.
function ruleMatches(rule, profile, currency) {
  if (rule.is_active === false) return false;
  if (rule.currency && rule.currency !== '*' && rule.currency !== currency) return false;
  if (rule.beneficiary_country && rule.beneficiary_country !== profile.beneficiary_country) return false;
  if (rule.requires_stables_in === true  && profile.uses_stablecoins !== true)  return false;
  if (rule.requires_stables_in === false && profile.uses_stablecoins === true)  return false;
  if (rule.required_sdm_entity && rule.required_sdm_entity !== profile.sdm_entity) return false;
  if (rule.required_risk && rule.required_risk !== profile.risk_rating) return false;
  return true;
}

// Returns { bonus, applied: [rule...] } — bonus is the MAX applicable boost,
// not sum, so rules don't stack accidentally. Ops can add a higher-boost rule
// to override a lower one.
export function computeAffinity(profile, bank, currency, rules = []) {
  let bonus = 0;
  const applied = [];
  for (const rule of rules) {
    if (rule.bank_id !== bank.bank_id) continue;
    if (!ruleMatches(rule, profile, currency)) continue;
    applied.push({ label: rule.label, boost: rule.boost, rationale: rule.rationale });
    if (rule.boost > bonus) bonus = rule.boost;
  }
  return { bonus, applied };
}

// --------------------------- scoring (PRD §5.3 + affinity layer) ---------------------------

export function scoreBanks(profile, eligible, currency, weights = DEFAULT_WEIGHTS, affinityRules = []) {
  // Normalize incoming weights (factors[] OR flat shape) → { factor_id: weight }
  const w = normalizeWeights(weights);
  const sum = Object.values(w).reduce((s, v) => s + (Number(v) || 0), 0);
  const norm = id => (sum > 0 ? (w[id] || 0) / sum : 0);

  return eligible.map(bank => {
    // ---- per-factor raw scores (0-100) ----
    // Each factor has a stable id matching DEFAULT_FACTORS[].id. To add a new
    // scoring factor, register it in DEFAULT_FACTORS and compute its score here.
    const tierS = TIER_SCORE[bank.tier] ?? 0;

    const allowedSpeeds = SPEED_MATCHES[profile.settlement_speed_sla] ?? [];
    const speedS = allowedSpeeds.includes(bank.settlement_speed) ? 100 : 0;

    const pricingS = PRICING_SCORE[bank.pricing_tier] ?? 0;

    const network = pickNetwork(profile, bank);
    const networkS = network && BONUS_NETWORKS.has(network) ? 100 : 0;

    const priorityS =
      profile.priority_tier === 'P1' &&
      (bank.settlement_speed === 'INSTANT' || bank.settlement_speed === 'SAME_DAY')
        ? 100 : 0;

    const factorScores = {
      network_bonus:    networkS,
      tier:             tierS,
      settlement_speed: speedS,
      pricing:          pricingS,
      priority:         priorityS
    };

    // Weighted sum across whatever factors are configured
    const baseScore =
      factorScores.tier             * norm('tier') +
      factorScores.settlement_speed * norm('settlement_speed') +
      factorScores.pricing          * norm('pricing') +
      factorScores.network_bonus    * norm('network_bonus') +
      factorScores.priority         * norm('priority');

    const { bonus: affinityS, applied: affinityApplied } =
      computeAffinity(profile, bank, currency, affinityRules);

    const score = baseScore + affinityS;

    return {
      bank,
      network,
      score: Math.round(score * 100) / 100,
      base_score: Math.round(baseScore * 100) / 100,
      affinity_bonus: affinityS,
      affinity_applied: affinityApplied,
      breakdown: {
        ...factorScores,
        affinityS,
        // Legacy aliases retained for any existing UI consumers
        tierS, speedS, pricingS, networkS, priorityS
      }
    };
  }).sort((a, b) => b.score - a.score);
}

// --------------------------- LP selection (PRD §5.5) ---------------------------

// LP selection — LPs supply liquidity FEEDSTOCK to the bank, not the target
// payout currency. A match requires:
//   1. LP provides at least one currency the bank accepts as input
//      (bank.accepts_lp_currencies, falling back to bank.supported_currencies
//      if that field is unset on an older bank record)
//   2. LP can settle on the same network the bank will use (or shares any
//      network with the bank if the LP has no network preferences)
//   3. LP's preferred_banks whitelist includes this bank (or is empty)
export function selectLPs(profile, bank, network, currency, lps) {
  if (!bank || !network) return { lps: [], reason: 'NO_BANK_OR_NETWORK' };
  const active = arr(lps).filter(lp => lp.is_active !== false);
  if (active.length === 0) return { lps: [], reason: 'EMPTY_REGISTRY' };

  const accepted = arr(bank.accepts_lp_currencies).length
    ? bank.accepts_lp_currencies
    : bank.supported_currencies;     // back-compat for older bank records

  const byCurrency = active.filter(lp =>
    arr(lp.supported_currencies).some(c => accepted.includes(c))
  );
  if (byCurrency.length === 0) return { lps: [], reason: 'NO_LP_FOR_BANK_FEEDSTOCK' };

  const byNetwork = byCurrency.filter(lp => has(lp.settlement_networks, network));
  if (byNetwork.length === 0) return { lps: [], reason: 'NO_LP_FOR_NETWORK' };

  const byBank = byNetwork.filter(lp => {
    if (!lp.preferred_banks || lp.preferred_banks.length === 0) return true;
    return lp.preferred_banks.includes(bank.bank_id);
  });
  if (byBank.length === 0) return { lps: [], reason: 'NO_LP_FOR_BANK' };

  return { lps: byBank, reason: null };
}

// --------------------------- confidence ---------------------------
// Simplified: ties between banks are handled by the per-bank Match% shown
// on alternatives. Confidence is only meaningfully LOW when data is
// genuinely ambiguous (OTHER vertical, or no eligible banks at all).

function computeConfidence(profile, scored) {
  // Vertical no longer affects engine — only "no eligible bank" triggers LOW.
  if (scored.length === 0) return 'LOW';
  return 'HIGH';
}

// Bucket a ratio into crude 5-tier match percentages: 0 / 25 / 50 / 75 / 100.
// 100 means the alternative is essentially tied with the primary recommendation.
function matchPctFromRatio(ratio) {
  if (!isFinite(ratio) || ratio <= 0) return 0;
  if (ratio >= 0.95) return 100;
  if (ratio >= 0.75) return 75;
  if (ratio >= 0.50) return 50;
  if (ratio >= 0.25) return 25;
  return 0;
}

// =====================================================================
// Settlement-flow builder — 5/6-step buy & sell flows per Curtis/Jim spec.
//
// SDM is non-custodial — every flow goes Client → SDM (Bank or Fireblocks) →
// LP → SDM (the other one) → Client. There is no direct LP-to-client hop.
//
// Buy (client buying crypto, sending fiat):
//   Client → SDM Bank → LP → SDM Fireblocks → Client Wallet
//
// Sell (client selling crypto, receiving fiat):
//   Client → SDM Fireblocks → LP → SDM Bank → [intra-bank?] → Client Bank
//
// Intra-bank transfer is conditional: HIGH risk client + primary bank is
// BCB or Customers Bank → bounce through Openpayd or Equals before the
// final client wire (avoids the source bank flagging the high-risk flow).
// =====================================================================

const HIGH_RISK_INTRA_BANK_TRIGGERS = new Set(['BCB Group', 'Customers Bank']);
const INTRA_BANK_PREFERENCE = ['Openpayd', 'Equals Money'];

function pickIntraBank(banks, currency) {
  if (!Array.isArray(banks)) return null;
  for (const name of INTRA_BANK_PREFERENCE) {
    const candidate = banks.find(b =>
      b.bank_name === name &&
      b.is_active !== false &&
      arr(b.supported_currencies).includes(currency)
    );
    if (candidate) return candidate;
  }
  return null;
}

// Returns { has_intra_bank, intra_bank: {bank_name, reason} | null, buy, sell }
// where each direction has a steps[] array describing the entities + values.
export function buildSettlementFlow(profile, scoredBank, currency, lps, allBanks) {
  if (!scoredBank?.bank) return null;
  const bank = scoredBank.bank;
  const network = scoredBank.network;
  const inner = buildBankFlow(profile, scoredBank, currency, lps);
  const feedstock = inner.feedstock_currency;
  const primaryLp = (inner.recommended_lps || [])[0];
  const lpName = primaryLp?.lp_name ?? 'LP';

  // Intra-bank transfer needed?
  const needsIntraBank =
    profile.risk_rating === 'HIGH' &&
    HIGH_RISK_INTRA_BANK_TRIGGERS.has(bank.bank_name);
  const intraBank = needsIntraBank ? pickIntraBank(allBanks, currency) : null;

  // ---------- BUY flow ----------
  // Client deposits fiat, SDM trades it for crypto with LP, Fireblocks holds,
  // client wallet receives crypto. Bank may FX from the client's deposit
  // currency into the LP's accepted feedstock if they differ.
  const buyBankInbound  = currency;          // client deposits in the leg currency
  const buyBankOutbound = feedstock || currency;
  const buyFxNeeded     = Boolean(buyBankOutbound && buyBankInbound && buyBankInbound !== buyBankOutbound);

  const buy = {
    steps: [
      { kind: 'client',           label: 'Client',          value: `${currency} in`,                role: 'external' },
      { kind: 'sdm_bank',         label: bank.bank_name,    value: buyFxNeeded
                                                                    ? `FX: ${buyBankInbound} → ${buyBankOutbound}`
                                                                    : 'passthrough',
                                                            role: 'sdm',
                                                            fx: buyFxNeeded,
                                                            tier: bank.tier,
                                                            network },
      { kind: 'lp',               label: lpName,            value: buyBankOutbound,                 role: 'lp',
                                                            note: 'fiat → crypto trade' },
      { kind: 'sdm_fireblocks',   label: 'SDM Fireblocks',  value: 'crypto',                        role: 'sdm' },
      { kind: 'client_wallet',    label: 'Client Wallet',   value: 'crypto out',                    role: 'external' }
    ]
  };

  // ---------- SELL flow ----------
  // Client sends crypto, Fireblocks receives, LP delivers feedstock fiat to
  // SDM bank, bank FXes to payout currency if needed, [optional intra-bank
  // hop], client bank receives.
  const sellBankInbound  = feedstock || currency;
  const sellBankOutbound = currency;
  const sellFxNeeded     = Boolean(sellBankInbound !== sellBankOutbound);

  const sellSteps = [
    { kind: 'client',           label: 'Client',          value: 'crypto in',                       role: 'external' },
    { kind: 'sdm_fireblocks',   label: 'SDM Fireblocks',  value: 'crypto',                          role: 'sdm' },
    { kind: 'lp',               label: lpName,            value: sellBankInbound,                   role: 'lp',
                                                          note: 'crypto → fiat trade' },
    { kind: 'sdm_bank',         label: bank.bank_name,    value: sellFxNeeded
                                                                  ? `FX: ${sellBankInbound} → ${sellBankOutbound}`
                                                                  : 'passthrough',
                                                          role: 'sdm',
                                                          fx: sellFxNeeded,
                                                          tier: bank.tier,
                                                          network }
  ];

  if (intraBank) {
    sellSteps.push({
      kind: 'sdm_intra_bank',
      label: intraBank.bank_name,
      value: 'transit',
      role: 'sdm',
      tier: intraBank.tier,
      conditional: true,
      reason: `HIGH-risk flow rerouted through ${intraBank.bank_name} to avoid source-bank flagging at ${bank.bank_name}`
    });
  }

  sellSteps.push({
    kind: 'client_bank',
    label: 'Client Bank',
    value: `${currency} out`,
    role: 'external'
  });

  return {
    has_intra_bank: Boolean(intraBank),
    intra_bank: intraBank ? {
      bank_name: intraBank.bank_name,
      tier:      intraBank.tier,
      reason:    `HIGH-risk client routed through ${intraBank.bank_name} (${bank.bank_name} would flag a HIGH-risk wire as the source bank).`
    } : null,
    buy,
    sell: { steps: sellSteps },
    // Echo the FX info so callers (UI, analytics) can read it without
    // recomputing — primary direction (sell) is what the legacy flow box
    // showed, so we surface those fields at the top level.
    feedstock_currency: feedstock,
    fx_needed: sellFxNeeded
  };
}

// Build the full flow details (feedstock, FX, recommended LPs, network) for a
// specific scored bank on a currency leg. Used for both the primary
// recommendation and the alternatives so swapping between them produces
// a fully-realized flow display.
function buildBankFlow(profile, scoredBank, currency, lps) {
  const bank = scoredBank.bank;
  const network = scoredBank.network;
  const lpResult = selectLPs(profile, bank, network, currency, lps);

  const accepted = arr(bank?.accepts_lp_currencies).length
    ? bank.accepts_lp_currencies
    : arr(bank?.supported_currencies);
  const clientTraded = arr(profile.currencies_traded);

  let feedstock = null;
  if (accepted.length) {
    const lpProvided = new Set((lpResult.lps || []).flatMap(lp => arr(lp.supported_currencies)));
    const canPassthrough = accepted.includes(currency) &&
      (clientTraded.length === 0 || clientTraded.includes(currency));

    if (canPassthrough) {
      feedstock = currency;
    } else {
      const onlyStables = accepted.every(c => c === 'USDT' || c === 'USDC');
      if (onlyStables) {
        if (lpProvided.has('USDC') && accepted.includes('USDC'))      feedstock = 'USDC';
        else if (lpProvided.has('USDT') && accepted.includes('USDT')) feedstock = 'USDT';
        else feedstock = accepted[0];
      } else if (accepted.includes('USD')) {
        feedstock = 'USD';
      } else {
        const clientMatch = clientTraded.find(c => accepted.includes(c) && lpProvided.has(c));
        feedstock = clientMatch
          ?? accepted.find(c => lpProvided.has(c))
          ?? accepted[0];
      }
    }
  }

  return {
    bank,
    network,
    feedstock_currency: feedstock,
    fx_needed: Boolean(feedstock && feedstock !== currency),
    recommended_lps: lpResult.lps,
    lp_gap_reason: lpResult.reason
  };
}

// --------------------------- public entry point (PRD §8.4) ---------------------------

export function computeRouting(profile, banks, lps, weights = DEFAULT_WEIGHTS, affinityRules = []) {
  const legs = arr(profile.settlement_currencies).length
    ? profile.settlement_currencies
    : arr(profile.currencies_traded).filter(c => c.length === 3);

  return legs.map(currency => {
    const { eligible, excluded } = excludeIneligibleBanks(profile, banks, currency);
    const scored = scoreBanks(profile, eligible, currency, weights, affinityRules);
    const top = scored[0] ?? null;
    const fallback = scored[1] ?? null;
    const network = top?.network ?? null;
    const lpResult = top
      ? selectLPs(profile, top.bank, network, currency, lps)
      : { lps: [], reason: null };

    // Whether the user asked for this network, or engine picked it for them
    const networkWasRequested = arr(profile.settlement_methods).includes(network);

    // Feedstock = what the bank will receive from the LP.
    //
    // SDM's operational default (per Curtis): route through USD whenever FX
    // is needed. Cubix LPs all trade in USD, BCB/Customers/Openpayd/Equals
    // all accept USD feedstock — it's the universal on-ramp.
    //
    // Priority:
    //   1. PASSTHROUGH — bank accepts payout AND client trades payout
    //      (or client hasn't declared any trades).
    //   2. STABLES-IN — bank only accepts stables (Ripple ODL): use USDC/USDT.
    //   3. USD — universal FX default.
    //   4. Fallback — if bank doesn't accept USD, pick any traded currency
    //      or the first accepted.
    const accepted = arr(top?.bank?.accepts_lp_currencies).length
      ? top.bank.accepts_lp_currencies
      : arr(top?.bank?.supported_currencies);
    const clientTraded = arr(profile.currencies_traded);
    let feedstock = null;
    if (top && accepted.length) {
      const lpProvided = new Set((lpResult.lps || []).flatMap(lp => arr(lp.supported_currencies)));
      const canPassthrough = accepted.includes(currency) &&
        (clientTraded.length === 0 || clientTraded.includes(currency));

      if (canPassthrough) {
        feedstock = currency;
      } else {
        // Stables-in: bank only takes stables (e.g. Ripple ODL)
        const onlyStables = accepted.every(c => c === 'USDT' || c === 'USDC');
        if (onlyStables) {
          if (lpProvided.has('USDC') && accepted.includes('USDC'))      feedstock = 'USDC';
          else if (lpProvided.has('USDT') && accepted.includes('USDT')) feedstock = 'USDT';
          else feedstock = accepted[0];
        } else if (accepted.includes('USD')) {
          // Canonical SDM default: route FX through USD
          feedstock = 'USD';
        } else {
          // Bank doesn't take USD — honor client's traded list, else any match
          const clientMatch = clientTraded.find(c => accepted.includes(c) && lpProvided.has(c));
          feedstock = clientMatch
            ?? accepted.find(c => lpProvided.has(c))
            ?? accepted[0];
        }
      }
    }
    const fxNeeded = Boolean(feedstock && feedstock !== currency);

    // Alternatives: up to 3 other eligible banks, each with FULL flow detail
    // (network, feedstock, FX status, LPs, settlement flow) so the UI can swap
    // any alternative into the primary slot and re-render accurately.
    const topScore = top?.score ?? 0;
    const alternatives = scored.slice(1, 4).map(s => {
      const flow = buildBankFlow(profile, s, currency, lps);
      const settlementFlow = buildSettlementFlow(profile, s, currency, lps, banks);
      return {
        bank_id: s.bank.bank_id,
        bank_name: s.bank.bank_name,
        tier: s.bank.tier,
        pricing_tier: s.bank.pricing_tier,
        settlement_speed: s.bank.settlement_speed,
        network: flow.network,
        feedstock_currency: flow.feedstock_currency,
        fx_needed: flow.fx_needed,
        recommended_lps: flow.recommended_lps,
        lp_gap_reason: flow.lp_gap_reason,
        settlement_flow: settlementFlow,
        bank: s.bank,
        score: s.score,
        match_pct: matchPctFromRatio(topScore > 0 ? s.score / topScore : 0)
      };
    });

    // Buy/Sell settlement flow for the primary recommendation, including the
    // conditional intra-bank transfer when HIGH risk meets BCB / Customers.
    const settlementFlow = top
      ? buildSettlementFlow(profile, top, currency, lps, banks)
      : null;

    return {
      currency_leg: currency,
      recommended_bank: top?.bank ?? null,
      settlement_network: network,
      network_auto_selected: !networkWasRequested,
      fallback_bank: fallback?.bank ?? null,
      alternatives,
      recommended_lps: lpResult.lps,
      lp_gap_reason: lpResult.reason,
      feedstock_currency: feedstock,
      fx_needed: fxNeeded,
      settlement_flow: settlementFlow,
      score: top?.score ?? 0,
      base_score: top?.base_score ?? 0,
      affinity_bonus: top?.affinity_bonus ?? 0,
      affinity_applied: top?.affinity_applied ?? [],
      score_breakdown: top?.breakdown ?? null,
      all_scored: scored.map(s => ({
        bank_id: s.bank.bank_id,
        bank_name: s.bank.bank_name,
        score: s.score,
        base_score: s.base_score,
        affinity_bonus: s.affinity_bonus,
        network: s.network
      })),
      exclusion_log: excluded,
      confidence: computeConfidence(profile, scored),
      manual_review_flag: scored.length === 0
    };
  });
}
