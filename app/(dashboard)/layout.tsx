'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/shared/sidebar';
import { Topbar } from '@/components/shared/topbar';
import { EmailHealthBanner } from '@/components/shared/email-health-banner';
import { createClient } from '@/lib/supabase/client';
import { getMyOrgId } from '@/lib/org/client';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string>('');
  const [businessName, setBusinessName] = useState<string>('');
  // A login with no business yet goes to setup first, so pages never load half-empty.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) setUserEmail(user.email);
    });
    getMyOrgId(supabase)
      .then(async (orgId) => {
        if (!orgId) {
          router.replace('/onboarding');
          return;
        }
        setReady(true);
        const { data } = await supabase.from('business_settings').select('business_name').maybeSingle();
        if (data?.business_name) setBusinessName(data.business_name);
      })
      // If the check itself fails, show the app rather than lock the owner out.
      .catch(() => setReady(true));
  }, [router]);

  if (!ready) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary)]" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        userEmail={userEmail}
        businessName={businessName}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex flex-col flex-1 lg:ml-60 min-h-0 min-w-0 print:ml-0">
        <Topbar onMenuClick={() => setSidebarOpen(true)} />
        <EmailHealthBanner />

        <main className="flex-1 overflow-y-auto overflow-x-hidden min-w-0 bg-[var(--color-bg-light)] p-4 md:p-8 print:overflow-visible print:p-0 print:bg-white">
          {children}
        </main>
      </div>
    </div>
  );
}
