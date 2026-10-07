// Posts to /api/send-email. Returns null when the email was accepted, otherwise the reason it wasn't.
export async function sendEmail(payload: Record<string, unknown>): Promise<string | null> {
  try {
    const res = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) return null;
    const data = await res.json().catch(() => null);
    return (data && typeof data.error === 'string' && data.error) || `Email service returned ${res.status}`;
  } catch (err) {
    return err instanceof Error ? err.message : 'Could not reach the email service';
  }
}
