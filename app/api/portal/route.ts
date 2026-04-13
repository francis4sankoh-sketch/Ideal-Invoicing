import { NextRequest } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, token, quoteId, message, senderName } = body;

    const supabase = await createServiceRoleClient();

    // Verify token
    const { data: customer } = await supabase
      .from('customers')
      .select('*')
      .eq('portal_token', token)
      .single();

    if (!customer) {
      return Response.json({ error: 'Invalid token' }, { status: 401 });
    }

    switch (action) {
      case 'send_message': {
        const { error } = await supabase.from('quote_messages').insert({
          quote_id: quoteId,
          sender_type: 'customer',
          sender_name: senderName || customer.contact_name,
          message,
        });
        if (error) return Response.json({ error: error.message }, { status: 500 });
        return Response.json({ success: true });
      }

      case 'record_view': {
        const { table, id } = body;
        if (table && id) {
          await supabase.from(table).update({ last_viewed: new Date().toISOString() }).eq('id', id);
        }
        return Response.json({ success: true });
      }

      default:
        return Response.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Portal API error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
