import { NextRequest, after } from 'next/server';
import { createHash } from 'crypto';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getDefaultOrg } from '@/lib/org/server';
import { sendPasswordReset } from '@/lib/resend/emails';
import { APP_URL } from '@/lib/app-config';

const WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_EMAIL = 3;
const MAX_PER_IP = 10;

const hash = (s: string) => createHash('sha256').update(`reset:${s}`).digest('hex');

// Public. Always gives the same answer, whether or not the email has an account, and does the work
// after replying so the timing doesn't give it away either.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return Response.json({ error: 'Please enter your email address' }, { status: 400 });
  }
  const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim();
  after(() => sendReset(email, ip).catch((err) => console.error('Password reset failed:', err)));
  return Response.json({ success: true });
}

async function sendReset(email: string, ip: string) {
  const supabase = await createServiceRoleClient();
  const since = new Date(Date.now() - WINDOW_MS).toISOString();
  const emailHash = hash(email);
  const ipHash = ip ? hash(ip) : null;

  // Recorded before counting, so requests sent at the same moment count against each other.
  const { error: insertError } = await supabase
    .from('password_reset_requests')
    .insert({ email_hash: emailHash, ip_hash: ipHash });
  if (insertError) throw new Error(insertError.message);

  const count = async (column: 'email_hash' | 'ip_hash', value: string) => {
    const { count, error } = await supabase
      .from('password_reset_requests')
      .select('id', { count: 'exact', head: true })
      .eq(column, value)
      .gte('created_at', since);
    if (error) throw new Error(error.message);
    return count ?? 0;
  };
  if ((await count('email_hash', emailHash)) > MAX_PER_EMAIL) return;
  if (ipHash && (await count('ip_hash', ipHash)) > MAX_PER_IP) return;

  await supabase
    .from('password_reset_requests')
    .delete()
    .lt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  const { data, error } = await supabase.auth.admin.generateLink({ type: 'recovery', email });
  const token = data?.properties?.hashed_token;
  if (error || !token) return; // No account with that email.

  // After the # so the token never reaches server logs, and only used once the new password is
  // submitted, so email scanners that open links can't use it up.
  const from = (await getDefaultOrg(supabase))?.email_from ?? null;
  await sendPasswordReset({ to: email, from, resetUrl: `${APP_URL}/reset-password#token=${token}` });
}
