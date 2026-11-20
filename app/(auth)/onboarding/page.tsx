'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { invalidate } from '@/lib/utils/cache';
import { getMyOrgId } from '@/lib/org/client';
import { AuthCard, Field, authButtonClass, authInputClass } from '@/components/shared/auth-card';

// First stop after sign-up: create the business this login works for.
export default function OnboardingPage() {
  const router = useRouter();
  const [supabase] = useState(createClient);
  const [businessName, setBusinessName] = useState('');
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      invalidate('my_org_id');
      const [{ data: userData }, orgId] = await Promise.all([
        supabase.auth.getUser(),
        getMyOrgId(supabase).catch(() => null),
      ]);
      if (!userData.user) return router.replace('/login');
      if (orgId) return router.replace('/');
      const fromSignup = userData.user.user_metadata?.business_name;
      if (typeof fromSignup === 'string') setBusinessName(fromSignup);
      setChecking(false);
    })();
  }, [router, supabase]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    const { error } = await supabase.rpc('create_organization', { business_name: businessName });
    if (error) {
      setError(error.message);
      setSaving(false);
      return;
    }
    invalidate('my_org_id');
    router.replace('/settings?welcome=1');
  };

  if (checking) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary)]" />
      </div>
    );
  }

  return (
    <AuthCard>
      <div className="mb-6 text-center">
        <h2 className="text-lg font-semibold text-[var(--color-text)]">Set up your business</h2>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          This name goes on your quotes, invoices and emails. You can add your logo, ABN and bank details next.
        </p>
      </div>
      <form onSubmit={handleCreate} className="space-y-4">
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
        {error && <div className="bg-red-50 text-red-700 text-sm p-3 rounded-md">{error}</div>}
        <button type="submit" disabled={saving} className={authButtonClass}>
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {saving ? 'Setting up...' : 'Continue'}
        </button>
      </form>
    </AuthCard>
  );
}
