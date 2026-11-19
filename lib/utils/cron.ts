import type { NextRequest } from 'next/server';

// Vercel Cron sends "Authorization: Bearer <CRON_SECRET>". With no secret set, nothing is allowed through.
export function isCronRequest(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  return !!secret && request.headers.get('authorization') === `Bearer ${secret}`;
}
