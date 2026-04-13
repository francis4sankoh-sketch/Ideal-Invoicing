import { NextRequest } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { sendNewEnquiryNotification } from '@/lib/resend/emails';

export async function POST(request: NextRequest) {
  try {
    // Verify API secret
    const apiSecret = request.headers.get('x-api-secret');
    if (apiSecret !== process.env.ENQUIRY_API_SECRET) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, email, phone, event_type, event_date, event_location, guest_count, selected_items, additional_notes } = body;

    if (!name || !email) {
      return Response.json({ error: 'Name and email are required' }, { status: 400 });
    }

    const supabase = await createServiceRoleClient();

    // Check if customer exists
    const { data: existingCustomer } = await supabase
      .from('customers')
      .select('*')
      .eq('email', email.toLowerCase().trim())
      .single();

    let customerId: string;

    if (existingCustomer) {
      customerId = existingCustomer.id;
    } else {
      const { data: newCustomer, error: custError } = await supabase
        .from('customers')
        .insert({
          contact_name: name,
          email: email.toLowerCase().trim(),
          phone: phone || null,
          notes: event_type ? `From website. Event type: ${event_type}` : 'From website enquiry',
        })
        .select()
        .single();

      if (custError || !newCustomer) {
        return Response.json({ error: 'Failed to create customer' }, { status: 500 });
      }
      customerId = newCustomer.id;
    }

    // Create enquiry record
    const { data: enquiry, error: enqError } = await supabase
      .from('website_enquiries')
      .insert({
        customer_id: customerId,
        name,
        email: email.toLowerCase().trim(),
        phone: phone || null,
        event_type: event_type || null,
        event_date: event_date || null,
        event_location: event_location || null,
        guest_count: guest_count || null,
        selected_items: selected_items || [],
        additional_notes: additional_notes || null,
        source: 'website',
      })
      .select()
      .single();

    if (enqError || !enquiry) {
      return Response.json({ error: 'Failed to create enquiry' }, { status: 500 });
    }

    // Send notification email
    try {
      await sendNewEnquiryNotification({
        name,
        email,
        event_type,
        event_date,
        selected_items,
      });
    } catch (emailErr) {
      console.error('Failed to send notification email:', emailErr);
    }

    return Response.json({
      success: true,
      enquiry_id: enquiry.id,
      message: 'Enquiry received successfully',
    });
  } catch (error) {
    console.error('Enquiry API error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
