'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// New bookings now start as an invoice — quotes are kept for history only.
// Redirect anyone who lands here (old bookmarks, muscle memory) to the
// equivalent invoice creation flow instead of a dead end.
export default function NewQuotePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/invoices/new');
  }, [router]);

  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary)]" />
    </div>
  );
}
