import type { Instrumentation } from 'next';

// Any server error Next.js catches (pages, API routes, the login proxy) gets a Telegram alert.
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { reportError } = await import('./lib/notify/report-error');
  // Portal links and the calendar feed carry secrets in the path, so long tokens are masked.
  const path = request.path.split('?')[0].replace(/[0-9a-f-]{20,}/gi, '…');
  await reportError(`${request.method} ${path} (${context.routeType})`, err);
};
