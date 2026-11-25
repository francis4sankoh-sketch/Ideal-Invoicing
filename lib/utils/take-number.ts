import type { SupabaseClient } from '@supabase/supabase-js';
import { invalidate } from './cache';

// Gets the next invoice or quote number from the database, which makes sure nobody else gets the
// same one. Call it at the moment of saving: a number that's taken isn't handed out again.
export async function takeNumber(
  supabase: SupabaseClient,
  kind: 'invoice' | 'quote'
): Promise<{ number: string } | { error: string }> {
  const { data, error } = await supabase.rpc('take_number', { p_kind: kind });
  // The cached settings hold the old next number.
  invalidate('business_settings');
  if (error || typeof data !== 'string') return { error: error?.message || `Couldn't get the next ${kind} number` };
  return { number: data };
}
