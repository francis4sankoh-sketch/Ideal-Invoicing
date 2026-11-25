import { NextRequest } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getSignedInOrgId, loadBrand } from '@/lib/org/server';
import { sendReviewRequest } from '@/lib/resend/emails';
import { isReviewUrl } from '@/lib/utils/review-request';

// Dashboard only: emails one customer a Google review request. Nothing calls this on a schedule;
// it runs only when someone presses Send. The address and link come from the database, not the browser.
export async function POST(request: NextRequest) {
  const me = await getSignedInOrgId();
  if (!me?.orgId) return Response.json({ error: 'Not signed in' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const subject = typeof body?.subject === 'string' ? body.subject.trim().replace(/\s+/g, ' ').slice(0, 200) : '';
  const message = typeof body?.message === 'string' ? body.message.trim().slice(0, 5000) : '';
  if (typeof body?.customerId !== 'string') return Response.json({ error: 'Bad request' }, { status: 400 });
  if (!subject || !message) return Response.json({ error: 'Add a subject and a message first' }, { status: 400 });

  try {
    const supabase = await createServiceRoleClient();
    const [customerRes, settingsRes] = await Promise.all([
      supabase
        .from('customers')
        .select('id, email')
        .eq('id', body.customerId)
        .eq('organization_id', me.orgId)
        .maybeSingle(),
      supabase.from('business_settings').select('google_review_url').eq('organization_id', me.orgId).maybeSingle(),
    ]);
    const customer = customerRes.data;
    const reviewUrl = settingsRes.data?.google_review_url;
    if (!customer) return Response.json({ error: 'Customer not found' }, { status: 404 });
    if (!customer.email) return Response.json({ error: 'This customer has no email address' }, { status: 400 });
    if (!isReviewUrl(reviewUrl)) {
      return Response.json({ error: 'Add your Google review link in Settings first' }, { status: 400 });
    }

    const brand = await loadBrand(supabase, me.orgId);
    await sendReviewRequest(brand, { customerEmail: customer.email, subject, message, reviewUrl: reviewUrl.trim() });

    const requestedAt = new Date().toISOString();
    const { error } = await supabase
      .from('customers')
      .update({ review_requested_at: requestedAt })
      .eq('id', customer.id)
      .eq('organization_id', me.orgId);
    // The email has gone, so don't report a failure that would prompt a second send.
    if (error) console.error('Could not record review request:', error.message);
    return Response.json({ success: true, review_requested_at: requestedAt });
  } catch (err) {
    console.error('Review request failed:', err);
    const reason =
      err && typeof err === 'object' && 'message' in err && typeof err.message === 'string'
        ? err.message
        : 'The email could not be sent';
    return Response.json({ error: reason }, { status: 500 });
  }
}
