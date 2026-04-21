import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const HAS_SUPABASE = Boolean(url && anon && !url.includes('YOUR_PROJECT'));

export const supabase = HAS_SUPABASE
  ? createClient(url, anon, { auth: { persistSession: true } })
  : null;

// Tiny helper: throw on error so components can just .then/await
export async function sb(query) {
  const { data, error } = await query;
  if (error) throw error;
  return data;
}
