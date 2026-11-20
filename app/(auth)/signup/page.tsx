'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, MailCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { AuthCard, Field, authButtonClass, authInputClass } from '@/components/shared/auth-card';

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState('');

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const name = businessName.trim().replace(/\s+/g, ' ');
    if (name.length < 2) return setError('Please enter your business name');
    if (password.length < 8) return setError('Your password needs at least 8 characters');

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        // Kept on the account so business setup can fill it in after the email is confirmed.
        data: { business_name: name },
        emailRedirectTo: `${window.location.origin}/auth/confirm?next=/onboarding`,
      },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    if (data.session) {
      // Email confirmation is off, so they're already signed in.
      router.push('/onboarding');
      router.refresh();
      return;
    }
    setSentTo(email.trim());
    setLoading(false);
  };

  if (sentTo) {
    return (
      <AuthCard footer={<Link href="/login" className="font-medium text-[var(--color-primary)] hover:underline">Back to sign in</Link>}>
        <div className="text-center space-y-3">
          <MailCheck className="w-10 h-10 mx-auto text-[var(--color-primary)]" />
          <h2 className="text-lg font-semibold text-[var(--color-text)]">Check your email</h2>
          <p className="text-sm text-[var(--color-text-muted)]">
            We sent a link to <strong>{sentTo}</strong>. Open it to confirm your email and finish setting up your business.
          </p>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      footer={
        <>
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-[var(--color-primary)] hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSignup} className="space-y-4">
        <Field label="Business name">
          <input
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            className={authInputClass}
            placeholder="e.g. Sunrise Party Hire"
            autoComplete="organization"
            maxLength={120}
            required
          />
        </Field>
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
        <Field label="Password">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={authInputClass}
            placeholder="At least 8 characters"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </Field>

        {error && <div className="bg-red-50 text-red-700 text-sm p-3 rounded-md">{error}</div>}

        <button type="submit" disabled={loading} className={authButtonClass}>
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {loading ? 'Creating your account...' : 'Create account'}
        </button>
      </form>
    </AuthCard>
  );
}
