import { NextRequest } from 'next/server';
import { checkEmailHealth } from '@/lib/resend/health';

export async function GET(request: NextRequest) {
  const force = request.nextUrl.searchParams.get('refresh') === '1';
  const health = await checkEmailHealth({ force });
  return Response.json(health, { headers: { 'Cache-Control': 'no-store' } });
}
