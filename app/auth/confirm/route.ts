import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/lib/supabase/server';

// The link in the "confirm your email" message lands here. It signs the new user in, then sends
// them on to set up their business. Supports both link styles Supabase can send.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const code = searchParams.get('code');
  // Only ever redirect within this app.
  const nextParam = searchParams.get('next') || '/onboarding';
  const next = nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/onboarding';

  const supabase = await createServerSupabaseClient();
  const { error } = tokenHash && type
    ? await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    : code
      ? await supabase.auth.exchangeCodeForSession(code)
      : { error: new Error('Missing confirmation details') };

  const url = request.nextUrl.clone();
  url.search = '';
  if (error) {
    url.pathname = '/login';
    url.searchParams.set('confirm', 'failed');
    return NextResponse.redirect(url);
  }
  url.pathname = next;
  return NextResponse.redirect(url);
}
