// The wording a review request starts with. The owner can change it before sending.
export function defaultReviewSubject(businessName: string) {
  return `How did we do? A quick review for ${businessName}`;
}

export function defaultReviewMessage(contactName: string, businessName: string) {
  const first = contactName.trim().split(/\s+/)[0] || 'there';
  return `Hi ${first},

Thank you for choosing ${businessName} for your event. We hope you had a great day.

If you have a minute, would you leave us a Google review? It helps other people planning an event find us.`;
}

// The link goes into an email button, so only accept a normal secure web address.
export function isReviewUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    return new URL(value.trim()).protocol === 'https:';
  } catch {
    return false;
  }
}
