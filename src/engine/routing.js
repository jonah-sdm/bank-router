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
  TIER_SCORE,
  PRICING_SCORE,
  SPEED_MATCHES,
  BONUS_NETWORKS,
  PROPRIETARY_UPGRADES
} from './constants.js';

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

    // 5.2.6 vertical blocked / not whitelisted
    if (has(bank.blocked_verticals, profile.business_vertical)) {
      excluded.push({
        bank_id: bank.bank_id, bank_name: bank.bank_name,
        reason: `Vertical ${profile.business_vertical} is blocked`
      });
      continue;
    }
    if (bank.accepted_verticals && bank.accepted_verticals.length > 0 &&
        !has(bank.accepted_verticals, profile.business_vertical)) {
      excluded.push({
        bank_id: bank.bank_id, bank_name: bank.bank_name,
        reason: `Vertical ${profile.business_vertical} not in accepted_verticals`
      });
      continue;
    }

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
  const w = { ...DEFAULT_WEIGHTS, ...weights };
  const sum = w.tier_weight + w.settlement_speed_weight + w.pricing_weight +
              w.network_bonus_weight + w.priority_bonus_weight;

  // Normalize so weights sum to 1 even if admin set them to arbitrary numbers
  const norm = k => (sum > 0 ? w[k] / sum : 0);

  return eligible.map(bank => {
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

    const baseScore =
      tierS     * norm('tier_weight') +
      speedS    * norm('settlement_speed_weight') +
      pricingS  * norm('pricing_weight') +
      networkS  * norm('network_bonus_weight') +
      priorityS * norm('priority_bonus_weight');

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
      breakdown: { tierS, speedS, pricingS, networkS, priorityS, affinityS }
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

function computeConfidence(profile, scored) {
  if (scored.length === 0) return 'LOW';
  if (profile.business_vertical === 'OTHER') return 'LOW';
  if (scored.length === 1) return 'HIGH';
  const top = scored[0].score;
  const second = scored[1].score;
  if (top - second >= 15) return 'HIGH';
  if (top - second >= 5)  return 'MEDIUM';
  return 'LOW';
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

    // Feedstock = what the bank will receive from the LP. If the payout
    // currency itself is acceptable to the bank, use that (no FX). Else prefer
    // USD (most liquid), else pick the first accepted LP currency an eligible
    // LP can actually supply, else the bank's first accepted feedstock.
    const accepted = arr(top?.bank?.accepts_lp_currencies).length
      ? top.bank.accepts_lp_currencies
      : arr(top?.bank?.supported_currencies);
    let feedstock = null;
    if (top && accepted.length) {
      if (accepted.includes(currency)) {
        feedstock = currency;
      } else if (lpResult.lps?.length) {
        const lpProvided = new Set(lpResult.lps.flatMap(lp => arr(lp.supported_currencies)));
        if (lpProvided.has('USD') && accepted.includes('USD'))      feedstock = 'USD';
        else if (lpProvided.has('USDC') && accepted.includes('USDC')) feedstock = 'USDC';
        else if (lpProvided.has('USDT') && accepted.includes('USDT')) feedstock = 'USDT';
        else feedstock = accepted.find(c => lpProvided.has(c)) ?? accepted[0];
      } else {
        feedstock = accepted.includes('USD') ? 'USD' : accepted[0];
      }
    }
    const fxNeeded = Boolean(feedstock && feedstock !== currency);

    return {
      currency_leg: currency,
      recommended_bank: top?.bank ?? null,
      settlement_network: network,
      network_auto_selected: !networkWasRequested,
      fallback_bank: fallback?.bank ?? null,
      recommended_lps: lpResult.lps,
      lp_gap_reason: lpResult.reason,
      feedstock_currency: feedstock,
      fx_needed: fxNeeded,
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
      manual_review_flag:
        profile.business_vertical === 'OTHER' ||
        scored.length === 0 ||
        (scored.length > 1 && (scored[0].score - scored[1].score) < 5)
    };
  });
}
