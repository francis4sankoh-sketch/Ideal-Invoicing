import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/lib/supabase/server';

// Server-side helpers for working out which business (organization) a request belongs to.
// Routes that use the service-role key skip the database's per-business rules, so they must
// always filter by the organization id these return.

export type Organization = {
  id: string;
  name: string;
  is_default: boolean;
  email_from: string | null;
  enquiry_api_key: string;
  calendar_feed_key: string;
};

const ORG_FIELDS = 'id, name, is_default, email_from, enquiry_api_key, calendar_feed_key';

// How a business appears in emails and documents it sends.
export type Brand = {
  orgId: string;
  isDefault: boolean;
  name: string;
  email: string | null; // the business's own inbox: gets copies and alerts, and customer replies
  phone: string | null;
  website: string | null;
  location: string | null; // "Melbourne, VIC"
  color: string;
  from: string | null; // verified sending address, or null for the shared platform address
};

// The signed-in user's business id, or null when not signed in or not set up yet.
export async function getSignedInOrgId(): Promise<{ userId: string; orgId: string | null } | null> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const { data: orgId } = await supabase.rpc('current_org_id');
  return { userId: data.user.id, orgId: typeof orgId === 'string' ? orgId : null };
}

export async function getOrg(supabase: SupabaseClient, orgId: string): Promise<Organization | null> {
  const { data } = await supabase.from('organizations').select(ORG_FIELDS).eq('id', orgId).maybeSingle();
  return (data as Organization | null) ?? null;
}

// The original business (Ideal Events Hire). Old secrets with no business attached belong to it.
export async function getDefaultOrg(supabase: SupabaseClient): Promise<Organization | null> {
  const { data } = await supabase.from('organizations').select(ORG_FIELDS).eq('is_default', true).maybeSingle();
  return (data as Organization | null) ?? null;
}

export async function findOrgBySecret(
  supabase: SupabaseClient,
  column: 'enquiry_api_key' | 'calendar_feed_key',
  secret: string
): Promise<Organization | null> {
  if (!secret || secret.length < 16) return null;
  const { data } = await supabase.from('organizations').select(ORG_FIELDS).eq(column, secret).maybeSingle();
  return (data as Organization | null) ?? null;
}

export async function loadBrand(supabase: SupabaseClient, orgId: string): Promise<Brand> {
  const [org, settingsRes] = await Promise.all([
    getOrg(supabase, orgId),
    supabase
      .from('business_settings')
      .select('business_name, email, phone, website, city, state, brand_color')
      .eq('organization_id', orgId)
      .maybeSingle(),
  ]);
  if (!org) throw new Error('Business not found');
  const s = settingsRes.data;
  const location = [s?.city, s?.state].filter(Boolean).join(', ');
  return {
    orgId,
    isDefault: org.is_default,
    name: s?.business_name || org.name,
    email: s?.email || null,
    phone: s?.phone || null,
    website: s?.website || null,
    location: location || null,
    color: /^#[0-9a-f]{6}$/i.test(s?.brand_color || '') ? s!.brand_color : '#1f3a5f',
    from: org.email_from,
  };
}
