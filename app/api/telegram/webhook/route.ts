import { NextRequest } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { sendTelegram } from '@/lib/notify/telegram';
import { parseThreadRef, postBusinessReply } from '@/lib/messages/thread';

// Telegram calls this for every message sent to the bot. It's public, so it only trusts
// requests carrying the secret registered with setWebhook, and only messages from the owner's chat.
export async function POST(request: NextRequest) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret || request.headers.get('x-telegram-bot-api-secret-token') !== secret) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const update = await request.json().catch(() => null);
  const msg = update?.message;
  // Always 200 from here on, otherwise Telegram keeps retrying the same update.
  if (!msg || typeof msg.text !== 'string' || String(msg.chat?.id) !== process.env.TELEGRAM_CHAT_ID) {
    return Response.json({ ok: true });
  }

  try {
    const ref = parseThreadRef(msg.reply_to_message?.text);
    if (!ref) {
      await sendTelegram(
        'To answer a customer, reply to their message here: press and hold it (or swipe left on it) and choose Reply.'
      );
      return Response.json({ ok: true });
    }

    const supabase = await createServiceRoleClient();
    const result = await postBusinessReply(supabase, ref.kind, ref.id, msg.text);
    await sendTelegram(
      result.ok
        ? `Sent to ${result.customerName} on ${result.label}${result.emailed ? ', and emailed them.' : ". It's in their portal, but the email to them failed."}`
        : `That reply wasn't sent: ${result.error}`
    );
  } catch (err) {
    console.error('Telegram webhook error:', err);
    await sendTelegram("Something went wrong sending that reply. Please try again or reply from the app.").catch(() => {});
  }
  return Response.json({ ok: true });
}
