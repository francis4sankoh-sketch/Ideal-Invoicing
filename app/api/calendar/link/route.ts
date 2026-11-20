import { createServiceRoleClient } from '@/lib/supabase/server';
import { getOrg, getSignedInOrgId } from '@/lib/org/server';
import type { NextRequest } from 'next/server';

// Dashboard only: hands the signed-in business its private calendar feed address.
// The original business keeps its old address (CALENDAR_FEED_KEY) so existing subscriptions keep working.
export async function GET(request: NextRequest) {
  const me = await getSignedInOrgId();
  if (!me?.orgId) return Response.json({ error: 'Not signed in' }, { status: 401 });
  const org = await getOrg(await createServiceRoleClient(), me.orgId);
  if (!org) return Response.json({ error: 'Business not found' }, { status: 404 });
  const key = org.is_default && process.env.CALENDAR_FEED_KEY ? process.env.CALENDAR_FEED_KEY : org.calendar_feed_key;
  return Response.json({ url: `${request.nextUrl.origin}/api/calendar/feed/${key}.ics` }, { headers: { 'Cache-Control': 'no-store' } });
}
