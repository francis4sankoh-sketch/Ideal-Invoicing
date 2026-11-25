'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Star, Send } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { BusinessSettings, Customer } from '@/types';
import { cached, TTL } from '@/lib/utils/cache';
import { formatDateAU } from '@/lib/utils/format';
import { defaultReviewMessage, defaultReviewSubject, isReviewUrl } from '@/lib/utils/review-request';

// Opens an editable email asking for a Google review. Nothing is sent until Send is pressed.
export function ReviewRequestButton({
  customer,
  onSent,
}: {
  customer: Pick<Customer, 'id' | 'contact_name' | 'email' | 'review_requested_at'>;
  onSent: (requestedAt: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [opening, setOpening] = useState(false);
  const [hasLink, setHasLink] = useState(false);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const asked = customer.review_requested_at;

  const handleOpen = async () => {
    setError('');
    setOpening(true);
    const supabase = createClient();
    const { data } = await cached('business_settings', TTL.long, async () =>
      supabase.from('business_settings').select('*').limit(1).single()
    );
    const settings = data as BusinessSettings | null;
    const name = settings?.business_name || 'us';
    setHasLink(isReviewUrl(settings?.google_review_url));
    setSubject(defaultReviewSubject(name));
    setMessage(defaultReviewMessage(customer.contact_name, name));
    setOpening(false);
    setOpen(true);
  };

  const handleSend = async () => {
    setSending(true);
    setError('');
    try {
      const res = await fetch('/api/review-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: customer.id, subject, message }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error(data?.error || "The email didn't send. Please try again.");
      onSent(data.review_requested_at);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The email didn't send. Please try again.");
    }
    setSending(false);
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={handleOpen}
        loading={opening}
        title={asked ? `Last asked ${formatDateAU(asked)}` : undefined}
      >
        <Star className="w-3.5 h-3.5" /> {asked ? `Review requested ${formatDateAU(asked)}` : 'Request Review'}
      </Button>

      <Modal open={open} onClose={() => !sending && setOpen(false)} title="Request a Google Review">
        {!hasLink ? (
          <>
            <p className="text-sm text-[var(--color-text)]">Add your Google review link in Settings first.</p>
            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Link href="/settings"><Button>Open Settings</Button></Link>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-4">
              {asked && (
                <div className="rounded-md bg-amber-50 text-amber-800 text-sm p-3">
                  You already asked {customer.contact_name} for a review on {formatDateAU(asked)}.
                </div>
              )}
              <p className="text-sm text-[var(--color-text-muted)]">
                Sending to: <strong>{customer.email}</strong>
              </p>
              <Input label="Subject" value={subject} maxLength={200} onChange={(e) => setSubject(e.target.value)} />
              <Textarea label="Message" rows={8} maxLength={5000} value={message} onChange={(e) => setMessage(e.target.value)} />
              <p className="text-xs text-[var(--color-text-muted)]">
                A &quot;Leave a Google Review&quot; button and your sign-off are added under the message.
              </p>
              {error && <div className="rounded-md bg-red-50 text-red-700 text-sm p-3">{error}</div>}
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={() => setOpen(false)} disabled={sending}>Cancel</Button>
              <Button onClick={handleSend} loading={sending} disabled={sending || !subject.trim() || !message.trim()}>
                <Send className="w-4 h-4" /> {asked ? 'Send Again' : 'Send Request'}
              </Button>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
