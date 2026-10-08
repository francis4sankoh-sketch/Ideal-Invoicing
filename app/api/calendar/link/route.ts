import { NextRequest } from 'next/server';

// Login-protected (middleware): hands the dashboard the private calendar feed address.
export async function GET(request: NextRequest) {
  const key = process.env.CALENDAR_FEED_KEY;
  if (!key) return Response.json({ error: 'Calendar feed is not set up' }, { status: 404 });
  const url = `${request.nextUrl.origin}/api/calendar/feed/${key}.ics`;
  return Response.json({ url }, { headers: { 'Cache-Control': 'no-store' } });
}
