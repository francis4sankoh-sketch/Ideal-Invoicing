import type { SupabaseClient } from '@supabase/supabase-js';
import { cached, TTL } from '@/lib/utils/cache';

// The signed-in user's business id (null until they've set one up). Cached for the tab, and
// cleared on sign-out along with the rest of the cache.
export function getMyOrgId(supabase: SupabaseClient): Promise<string | null> {
  return cached('my_org_id', TTL.long, async () => {
    const { data, error } = await supabase.rpc('current_org_id');
    if (error) throw error;
    return typeof data === 'string' ? data : null;
  });
}

// Storage folder for this business's uploads. The database only lets a business change files
// inside its own folder.
export async function orgFolder(supabase: SupabaseClient): Promise<string> {
  const orgId = await getMyOrgId(supabase);
  if (!orgId) throw new Error('Finish setting up your business before uploading files');
  return orgId;
}
