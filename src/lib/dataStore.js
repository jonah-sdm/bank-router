// Data access layer. Prefers Supabase; falls back to in-memory mock when unconfigured.
// Same interface either way so the rest of the app doesn't care.

import { HAS_SUPABASE, supabase, sb } from './supabase.js';
import { MOCK_BANKS, MOCK_LPS, MOCK_CLIENTS, MOCK_WEIGHTS, MOCK_AFFINITY_RULES } from './mockData.js';
import { emit } from './dataEvents.js';

// -------- in-memory fallback state --------
const mem = {
  banks: structuredClone(MOCK_BANKS),
  lps: structuredClone(MOCK_LPS),
  clients: structuredClone(MOCK_CLIENTS),
  weights: { ...MOCK_WEIGHTS },
  affinity: structuredClone(MOCK_AFFINITY_RULES),
  audit: []
};

function uuid() { return 'mem-' + Math.random().toString(36).slice(2, 10); }

function logAudit(table, record_id, action, old_values, new_values) {
  mem.audit.unshift({
    audit_id: uuid(), table_name: table, record_id, action,
    old_values, new_values, changed_at: new Date().toISOString(), changed_by: null
  });
}

// -------- banks --------
export async function listBanks() {
  if (HAS_SUPABASE) return await sb(supabase.from('banks').select('*').order('bank_name'));
  return [...mem.banks];
}
export async function upsertBank(row) {
  let result;
  if (HAS_SUPABASE) {
    const { data, error } = row.bank_id
      ? await supabase.from('banks').update(row).eq('bank_id', row.bank_id).select().single()
      : await supabase.from('banks').insert(row).select().single();
    if (error) throw error;
    result = data;
  } else if (row.bank_id) {
    const idx = mem.banks.findIndex(b => b.bank_id === row.bank_id);
    const old = mem.banks[idx];
    mem.banks[idx] = { ...old, ...row };
    logAudit('banks', row.bank_id, 'UPDATE', old, mem.banks[idx]);
    result = mem.banks[idx];
  } else {
    const created = { ...row, bank_id: uuid() };
    mem.banks.push(created);
    logAudit('banks', created.bank_id, 'INSERT', null, created);
    result = created;
  }
  emit('banks');
  return result;
}
export async function deleteBank(bank_id) {
  if (HAS_SUPABASE) {
    const r = await sb(supabase.from('banks').delete().eq('bank_id', bank_id));
    emit('banks');
    return r;
  }
  const idx = mem.banks.findIndex(b => b.bank_id === bank_id);
  if (idx >= 0) {
    logAudit('banks', bank_id, 'DELETE', mem.banks[idx], null);
    mem.banks.splice(idx, 1);
    emit('banks');
  }
}

// -------- lps --------
export async function listLPs() {
  if (HAS_SUPABASE) return await sb(supabase.from('lps').select('*').order('lp_name'));
  return [...mem.lps];
}
export async function upsertLP(row) {
  let result;
  if (HAS_SUPABASE) {
    const { data, error } = row.lp_id
      ? await supabase.from('lps').update(row).eq('lp_id', row.lp_id).select().single()
      : await supabase.from('lps').insert(row).select().single();
    if (error) throw error;
    result = data;
  } else if (row.lp_id) {
    const idx = mem.lps.findIndex(b => b.lp_id === row.lp_id);
    const old = mem.lps[idx];
    mem.lps[idx] = { ...old, ...row };
    logAudit('lps', row.lp_id, 'UPDATE', old, mem.lps[idx]);
    result = mem.lps[idx];
  } else {
    const created = { ...row, lp_id: uuid() };
    mem.lps.push(created);
    logAudit('lps', created.lp_id, 'INSERT', null, created);
    result = created;
  }
  emit('lps');
  return result;
}
export async function deleteLP(lp_id) {
  if (HAS_SUPABASE) {
    const r = await sb(supabase.from('lps').delete().eq('lp_id', lp_id));
    emit('lps');
    return r;
  }
  const idx = mem.lps.findIndex(b => b.lp_id === lp_id);
  if (idx >= 0) {
    logAudit('lps', lp_id, 'DELETE', mem.lps[idx], null);
    mem.lps.splice(idx, 1);
    emit('lps');
  }
}

// -------- clients --------
export async function listClients() {
  if (HAS_SUPABASE) return await sb(supabase.from('clients').select('*').order('client_name'));
  return [...mem.clients];
}
export async function upsertClient(row) {
  let result;
  if (HAS_SUPABASE) {
    const { data, error } = row.client_id
      ? await supabase.from('clients').update(row).eq('client_id', row.client_id).select().single()
      : await supabase.from('clients').insert(row).select().single();
    if (error) throw error;
    result = data;
  } else if (row.client_id) {
    const idx = mem.clients.findIndex(b => b.client_id === row.client_id);
    const old = mem.clients[idx];
    mem.clients[idx] = { ...old, ...row };
    logAudit('clients', row.client_id, 'UPDATE', old, mem.clients[idx]);
    result = mem.clients[idx];
  } else {
    const created = { ...row, client_id: uuid() };
    mem.clients.push(created);
    logAudit('clients', created.client_id, 'INSERT', null, created);
    result = created;
  }
  emit('clients');
  return result;
}
export async function deleteClient(client_id) {
  if (HAS_SUPABASE) {
    const r = await sb(supabase.from('clients').delete().eq('client_id', client_id));
    emit('clients');
    return r;
  }
  const idx = mem.clients.findIndex(b => b.client_id === client_id);
  if (idx >= 0) {
    logAudit('clients', client_id, 'DELETE', mem.clients[idx], null);
    mem.clients.splice(idx, 1);
    emit('clients');
  }
}

// -------- weights --------
export async function getWeights() {
  if (HAS_SUPABASE) {
    const rows = await sb(supabase.from('scoring_weights').select('*').eq('id', 1));
    return rows[0] ?? { ...MOCK_WEIGHTS };
  }
  return { ...mem.weights };
}
export async function updateWeights(row) {
  let result;
  if (HAS_SUPABASE) {
    result = await sb(supabase.from('scoring_weights').update(row).eq('id', 1).select().single());
  } else {
    const old = { ...mem.weights };
    mem.weights = { ...mem.weights, ...row };
    logAudit('scoring_weights', '1', 'UPDATE', old, mem.weights);
    result = mem.weights;
  }
  emit('weights');
  return result;
}

// -------- affinity rules --------
export async function listAffinity() {
  if (HAS_SUPABASE) return await sb(supabase.from('affinity_rules').select('*').order('sort_order'));
  return [...mem.affinity].sort((a, b) => a.sort_order - b.sort_order);
}
export async function upsertAffinity(row) {
  let result;
  if (HAS_SUPABASE) {
    const { data, error } = row.rule_id
      ? await supabase.from('affinity_rules').update(row).eq('rule_id', row.rule_id).select().single()
      : await supabase.from('affinity_rules').insert(row).select().single();
    if (error) throw error;
    result = data;
  } else if (row.rule_id) {
    const idx = mem.affinity.findIndex(r => r.rule_id === row.rule_id);
    const old = mem.affinity[idx];
    mem.affinity[idx] = { ...old, ...row };
    logAudit('affinity_rules', row.rule_id, 'UPDATE', old, mem.affinity[idx]);
    result = mem.affinity[idx];
  } else {
    const created = { ...row, rule_id: uuid() };
    mem.affinity.push(created);
    logAudit('affinity_rules', created.rule_id, 'INSERT', null, created);
    result = created;
  }
  emit('affinity');
  return result;
}
export async function deleteAffinity(rule_id) {
  if (HAS_SUPABASE) {
    const r = await sb(supabase.from('affinity_rules').delete().eq('rule_id', rule_id));
    emit('affinity');
    return r;
  }
  const idx = mem.affinity.findIndex(r => r.rule_id === rule_id);
  if (idx >= 0) {
    logAudit('affinity_rules', rule_id, 'DELETE', mem.affinity[idx], null);
    mem.affinity.splice(idx, 1);
    emit('affinity');
  }
}

// -------- audit --------
export async function listAudit(limit = 100) {
  if (HAS_SUPABASE) {
    return await sb(supabase.from('audit_log').select('*').order('changed_at', { ascending: false }).limit(limit));
  }
  return mem.audit.slice(0, limit);
}
