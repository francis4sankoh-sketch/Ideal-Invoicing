'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { clearCache } from '@/lib/utils/cache';
import { AuthCard, Field, authButtonClass, authInputClass } from '@/components/shared/auth-card';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [supabase] = useState(createClient);
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [verified, setVerified] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // The token sits after the #, which only the browser can read.
    const value = new URLSearchParams(window.location.hash.slice(1)).get('token');
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToken(value);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) return setError('Your password needs at least 8 characters');
    if (password !== confirm) return setError("The two passwords don't match");
    setSaving(true);

    // The link works once, so don't check it again if only the password was refused.
    if (!verified) {
      const { error } = await supabase.auth.verifyOtp({ type: 'recovery', token_hash: token || '' });
      if (error) {
        setToken(null);
        setSaving(false);
        return;
      }
      setVerified(true);
    }
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(error.message);
      setSaving(false);
      return;
    }
    // Sign out anywhere else that was using the old password.
    await supabase.auth.signOut({ scope: 'others' });
    clearCache();
    router.replace('/');
    router.refresh();
  };

  if (token === undefined) return <AuthCard><div className="h-32" /></AuthCard>;

  if (token === null) {
    return (
      <AuthCard>
        <div className="text-center space-y-4">
          <p className="text-sm text-[var(--color-text)]">
            This reset link isn&apos;t valid. It may have expired or already been used.
          </p>
          <Link href="/forgot-password" className={authButtonClass}>
            Get a new link
          </Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard>
      <h2 className="text-lg font-semibold text-[var(--color-text)] text-center mb-4">Set a new password</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="New password">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={authInputClass}
            placeholder="At least 8 characters"
            autoComplete="new-password"
            required
          />
        </Field>
        <Field label="Type it again">
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={authInputClass}
            autoComplete="new-password"
            required
          />
        </Field>
        {error && <div className="bg-red-50 text-red-700 text-sm p-3 rounded-md">{error}</div>}
        <button type="submit" disabled={saving} className={authButtonClass}>
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {saving ? 'Saving...' : 'Save new password'}
        </button>
      </form>
    </AuthCard>
  );
}
