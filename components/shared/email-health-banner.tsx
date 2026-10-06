'use client';

import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, MailWarning, RefreshCw } from 'lucide-react';
import { cached, invalidate } from '@/lib/utils/cache';
import type { EmailHealth } from '@/lib/resend/health';

const CACHE_KEY = 'email_health';
const FIVE_MINUTES = 5 * 60_000;
const TEN_MINUTES = 10 * 60_000;

async function fetchHealth(refresh: boolean): Promise<EmailHealth> {
  try {
    const res = await fetch(`/api/email-health${refresh ? '?refresh=1' : ''}`, { cache: 'no-store' });
    if (!res.ok) return { level: 'unknown' };
    return (await res.json()) as EmailHealth;
  } catch {
    return { level: 'unknown' };
  }
}

export function EmailHealthBannerView({
  health,
  checking,
  onRecheck,
}: {
  health: EmailHealth;
  checking: boolean;
  onRecheck: () => void;
}) {
  const isError = health.level === 'error';
  const tone = isError
    ? 'bg-red-600 text-white'
    : 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100';
  const button = isError
    ? 'border-white/40 hover:bg-white/10'
    : 'border-amber-800/30 hover:bg-amber-200/60 dark:border-amber-100/30 dark:hover:bg-amber-900/50';

  return (
    <div
      role="alert"
      className={`${tone} shrink-0 px-4 md:px-8 py-3 text-sm flex flex-col gap-3 sm:flex-row sm:items-start print:hidden`}
    >
      <div className="flex items-start gap-3 min-w-0 flex-1">
        <MailWarning className="w-5 h-5 shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="font-semibold">{health.title}</p>
          <p>{health.detail}</p>
          {health.failing && health.failing.length > 0 && (
            <p className="mt-1 text-xs opacity-90">Not verified: {health.failing.join(', ')}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0 pl-8 sm:pl-0">
        <button
          type="button"
          onClick={onRecheck}
          disabled={checking}
          className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-60 ${button}`}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} /> Check again
        </button>
        <a
          href="https://resend.com/domains"
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${button}`}
        >
          <ExternalLink className="w-3.5 h-3.5" /> Open Resend
        </a>
      </div>
    </div>
  );
}

export function EmailHealthBanner() {
  const [health, setHealth] = useState<EmailHealth | null>(null);
  const [checking, setChecking] = useState(false);

  const load = useCallback(async (refresh = false) => {
    if (refresh) {
      invalidate(CACHE_KEY);
      setChecking(true);
    }
    try {
      setHealth(await cached(CACHE_KEY, FIVE_MINUTES, () => fetchHealth(refresh)));
    } finally {
      if (refresh) setChecking(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(() => load(), TEN_MINUTES);
    return () => clearInterval(timer);
  }, [load]);

  if (!health || (health.level !== 'error' && health.level !== 'warning')) return null;
  return <EmailHealthBannerView health={health} checking={checking} onRecheck={() => load(true)} />;
}
