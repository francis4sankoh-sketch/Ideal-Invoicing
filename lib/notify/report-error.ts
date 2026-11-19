import { sendTelegram } from './telegram';

// Sends a short Telegram alert when something breaks on the server. The same error is only
// reported once every 10 minutes per server instance, so a crash loop can't flood the chat.
const recent = new Map<string, number>();
const QUIET_MS = 10 * 60 * 1000;

export async function reportError(where: string, err: unknown): Promise<void> {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`${where}:`, err);
  const key = `${where}|${message}`;
  const now = Date.now();
  if ((recent.get(key) || 0) > now - QUIET_MS) return;
  recent.set(key, now);
  try {
    await sendTelegram(`App error: ${where}\n${message.slice(0, 500)}`);
  } catch {
    // Alerting must never cause a second failure.
  }
}
