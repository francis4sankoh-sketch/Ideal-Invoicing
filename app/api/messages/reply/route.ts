import { NextRequest } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { postBusinessReply } from '@/lib/messages/thread';
import { getSignedInOrgId } from '@/lib/org/server';

// Dashboard only: reply to a customer on one of this business's quotes or invoices, and email them.
export async function POST(request: NextRequest) {
  const me = await getSignedInOrgId();
  if (!me?.orgId) return Response.json({ error: 'Not signed in' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const kind = body.kind === 'quote' || body.kind === 'invoice' ? body.kind : null;
  if (!kind || typeof body.id !== 'string' || typeof body.message !== 'string') {
    return Response.json({ error: 'Bad request' }, { status: 400 });
  }
  const supabase = await createServiceRoleClient();
  const result = await postBusinessReply(supabase, me.orgId, kind, body.id, body.message);
  if (!result.ok) return Response.json({ error: result.error }, { status: 400 });
  return Response.json(result);
}
