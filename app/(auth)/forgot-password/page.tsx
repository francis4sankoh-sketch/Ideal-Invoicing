'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Loader2, MailCheck } from 'lucide-react';
import { AuthCard, Field, authButtonClass, authInputClass } from '@/components/shared/auth-card';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error(data?.error);
      setSent(true);
    } catch (err) {
      setError((err instanceof Error && err.message) || 'Something went wrong. Please try again.');
    }
    setLoading(false);
  };

  const back = (
    <Link href="/login" className="font-medium text-[var(--color-primary)] hover:underline">
      Back to sign in
    </Link>
  );

  if (sent) {
    return (
      <AuthCard footer={back}>
        <div className="text-center space-y-3">
          <MailCheck className="w-10 h-10 mx-auto text-[var(--color-primary)]" />
          <h2 className="text-lg font-semibold text-[var(--color-text)]">Check your email</h2>
          <p className="text-sm text-[var(--color-text-muted)]">
            If <strong>{email.trim()}</strong> has an account, we&apos;ve sent a link to set a new password. Check your
            junk folder if it isn&apos;t there in a few minutes.
          </p>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard footer={back}>
      <p className="text-sm text-[var(--color-text-muted)] mb-4">
        Enter your email and we&apos;ll send you a link to set a new password.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Email">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={authInputClass}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
        </Field>
        {error && <div className="bg-red-50 text-red-700 text-sm p-3 rounded-md">{error}</div>}
        <button type="submit" disabled={loading} className={authButtonClass}>
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {loading ? 'Sending...' : 'Send reset link'}
        </button>
      </form>
    </AuthCard>
  );
}
