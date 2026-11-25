'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { AuthCard, Field, authButtonClass, authInputClass } from '@/components/shared/auth-card';

// useSearchParams needs a Suspense boundary so the page can still be built ahead of time.
export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const confirmFailed = useSearchParams().get('confirm') === 'failed';
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push('/');
      router.refresh();
    }
  };

  return (
    <AuthCard
      footer={
        <>
          New here?{' '}
          <Link href="/signup" className="font-medium text-[var(--color-primary)] hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      {confirmFailed && (
        <div className="bg-amber-50 text-amber-800 text-sm p-3 rounded-md mb-4">
          That confirmation link didn&apos;t work or has expired. Try signing in, or sign up again to get a new link.
        </div>
      )}
      <form onSubmit={handleLogin} className="space-y-4">
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
            placeholder="Enter your password"
            autoComplete="current-password"
            required
          />
        </Field>

        <div className="text-right -mt-2">
          <Link href="/forgot-password" className="text-xs text-[var(--color-primary)] hover:underline">
            Forgot password?
          </Link>
        </div>

        {error && <div className="bg-red-50 text-red-700 text-sm p-3 rounded-md">{error}</div>}

        <button type="submit" disabled={loading} className={authButtonClass}>
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
    </AuthCard>
  );
}
