// Sends a plain-text Telegram message to the business owner's chat.
// Quietly does nothing when TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID aren't set.
export async function sendTelegram(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: text.slice(0, 4000), disable_web_page_preview: true }),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Telegram returned ${res.status}: ${body.slice(0, 200)}`);
  }
}

export function enquiryAlertText(e: {
  name: string;
  email: string;
  phone?: string | null;
  event_type?: string | null;
  event_date?: string | null;
  event_location?: string | null;
  guest_count?: string | null;
  budget_range?: string | null;
  items?: Array<{ name: string; quantity: number }>;
  notes?: string | null;
  appUrl: string;
}): string {
  const lines = [`New enquiry: ${e.name}`];
  const event = [e.event_type, e.event_date, e.event_location].filter(Boolean).join(', ');
  if (event) lines.push(event);
  const size = [e.guest_count && `${e.guest_count} guests`, e.budget_range && `budget ${e.budget_range}`]
    .filter(Boolean)
    .join(', ');
  if (size) lines.push(size);
  if (e.items && e.items.length > 0) {
    lines.push(`Items: ${e.items.map((i) => `${i.name} x${i.quantity}`).join(', ')}`);
  }
  if (e.notes) lines.push(`Notes: ${e.notes.slice(0, 300)}`);
  lines.push('', [e.phone, e.email].filter(Boolean).join(' · '), `${e.appUrl}/enquiries`);
  return lines.join('\n');
}
