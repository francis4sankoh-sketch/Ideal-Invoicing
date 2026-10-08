import { NextRequest } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { postBusinessReply } from '@/lib/messages/thread';

// Dashboard-only (login enforced by middleware): reply to a customer and email them.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const kind = body.kind === 'quote' || body.kind === 'invoice' ? body.kind : null;
  if (!kind || typeof body.id !== 'string' || typeof body.message !== 'string') {
    return Response.json({ error: 'Bad request' }, { status: 400 });
  }
  const supabase = await createServiceRoleClient();
  const result = await postBusinessReply(supabase, kind, body.id, body.message);
  if (!result.ok) return Response.json({ error: result.error }, { status: 400 });
  return Response.json(result);
}
