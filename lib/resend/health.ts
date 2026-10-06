import { FROM_EMAIL } from './emails';

export type EmailHealth = {
  level: 'ok' | 'unknown' | 'warning' | 'error';
  title?: string;
  detail?: string;
  failing?: string[];
};

type DomainSummary = { id: string; name: string; status: string; capabilities?: { sending?: string } };
type DomainRecord = { record: string; name: string; type: string; status: string };
type ApiResult = { ok: boolean; status: number; body: Record<string, unknown> | null };

const TTL_KNOWN_MS = 5 * 60_000;
const TTL_UNKNOWN_MS = 60_000;
const MIN_FORCE_AGE_MS = 15_000;

let cache: { at: number; ttl: number; value: EmailHealth } | null = null;

export function sendingDomain(from: string = FROM_EMAIL): string | null {
  const match = from.match(/@([^\s>]+)/);
  return match ? match[1].toLowerCase() : null;
}

async function resendGet(path: string, key: string): Promise<ApiResult> {
  const res = await fetch(`https://api.resend.com${path}`, {
    headers: { Authorization: `Bearer ${key}` },
    cache: 'no-store',
    signal: AbortSignal.timeout(5000),
  });
  let body: Record<string, unknown> | null = null;
  try {
    body = await res.json();
  } catch {}
  return { ok: res.ok, status: res.status, body };
}

export function interpretApiError(errorName: unknown, message?: unknown): EmailHealth {
  // A sending-only key can't list domains; that says nothing about whether sending works.
  // Resend answers a revoked or wrong key with 400 validation_error ("API key is invalid"), not invalid_api_key.
  const keyRejected =
    errorName === 'invalid_api_key' ||
    errorName === 'missing_api_key' ||
    (typeof message === 'string' && /api key is invalid/i.test(message));
  if (keyRejected) {
    return {
      level: 'error',
      title: "Emails can't be sent",
      detail: 'Resend rejected the API key this app uses, so no emails will send. Put a working key in RESEND_API_KEY in Vercel.',
    };
  }
  return { level: 'unknown' };
}

export function interpretDomain(domain: string, found: DomainSummary | undefined, failing: string[]): EmailHealth {
  if (!found) {
    return {
      level: 'error',
      title: "Emails can't be sent",
      detail: `${domain} isn't set up in this Resend account, so invoices and quotes won't reach customers. Add and verify it in Resend.`,
    };
  }

  if (found.status === 'verified') {
    if (found.capabilities?.sending === 'disabled') {
      return {
        level: 'error',
        title: "Emails can't be sent",
        detail: `Sending is switched off for ${domain} in Resend, so invoices and quotes won't reach customers.`,
      };
    }
    return { level: 'ok' };
  }

  const withRecords = failing.length > 0 ? { failing } : {};

  switch (found.status) {
    case 'failed':
      return {
        level: 'error',
        title: "Customer emails aren't being delivered",
        detail: `Resend can't find the DNS records for ${domain}, so invoices and quotes won't reach customers. Make sure the Resend records still exist in your domain's DNS, then restart verification in Resend.`,
        ...withRecords,
      };
    case 'temporary_failure':
      return {
        level: 'error',
        title: 'Customer emails are at risk of bouncing',
        detail: `Resend can't see the DNS records for ${domain} right now, so emails may bounce or land in spam. Make sure the Resend records still exist in your domain's DNS.`,
        ...withRecords,
      };
    case 'pending':
      return {
        level: 'warning',
        title: "Email setup isn't finished",
        detail: `Resend hasn't verified ${domain} yet, so emails won't send until it does. This usually takes a few minutes once the DNS records are in place.`,
        ...withRecords,
      };
    case 'not_started':
      return {
        level: 'warning',
        title: "Email setup isn't finished",
        detail: `Verification hasn't been started for ${domain} in Resend, so emails won't send. Click Verify on the domain in Resend.`,
        ...withRecords,
      };
    default:
      return {
        level: 'warning',
        title: 'Email setup needs a look',
        detail: `Resend reports ${domain} as "${found.status}", so emails may not reach customers.`,
        ...withRecords,
      };
  }
}

async function runCheck(domainOverride?: string): Promise<EmailHealth> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    return {
      level: 'error',
      title: "Emails can't be sent",
      detail: 'No Resend API key is set for this app, so invoices and quotes will not reach customers.',
    };
  }

  const domain = domainOverride ?? sendingDomain();
  if (!domain) return { level: 'unknown' };

  try {
    const list = await resendGet('/domains?limit=100', key);
    if (!list.ok) {
      const health = interpretApiError(list.body?.name, list.body?.message);
      if (health.level === 'unknown') console.warn(`Email health check inconclusive: Resend returned ${list.status}`);
      return health;
    }

    const domains = (list.body?.data as DomainSummary[] | undefined) ?? [];
    const found = domains.find((d) => d.name.toLowerCase() === domain);

    let failing: string[] = [];
    if (found && found.status !== 'verified') {
      const detail = await resendGet(`/domains/${found.id}`, key);
      const records = detail.ok ? (detail.body?.records as DomainRecord[] | undefined) : undefined;
      failing = (records ?? [])
        .filter((r) => r.status !== 'verified')
        .map((r) => `${r.name} ${r.type} (${r.record})`);
    }

    return interpretDomain(domain, found, failing);
  } catch (err) {
    console.warn('Email health check inconclusive:', err instanceof Error ? err.message : err);
    return { level: 'unknown' };
  }
}

export async function checkEmailHealth(options: { force?: boolean; domain?: string } = {}): Promise<EmailHealth> {
  const useCache = !options.domain;

  if (useCache && cache) {
    const age = Date.now() - cache.at;
    if (age < (options.force ? MIN_FORCE_AGE_MS : cache.ttl)) return cache.value;
  }

  const value = await runCheck(options.domain);
  if (useCache) {
    cache = { at: Date.now(), ttl: value.level === 'unknown' ? TTL_UNKNOWN_MS : TTL_KNOWN_MS, value };
  }
  return value;
}
