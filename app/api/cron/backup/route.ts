import { NextRequest } from 'next/server';
import { gzipSync } from 'zlib';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { sendBackupEmail } from '@/lib/resend/emails';
import { isCronRequest } from '@/lib/utils/cron';
import { reportError } from '@/lib/notify/report-error';
import { loadBrand } from '@/lib/org/server';

const TABLES = [
  'customers',
  'invoices',
  'quotes',
  'quote_messages',
  'products',
  'appointments',
  'expenses',
  'purchase_orders',
  'website_enquiries',
  'business_settings',
];

// Weekly cron: email each business a full copy of its own data, at its own inbox.
export async function GET(request: NextRequest) {
  if (!isCronRequest(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = await createServiceRoleClient();
  const { data: orgs, error } = await supabase.from('organizations').select('id');
  if (error) {
    await reportError('Weekly backup failed', error);
    return Response.json({ error: 'Backup failed' }, { status: 500 });
  }

  const results: Array<{ org: string; ok: boolean; bytes?: number }> = [];
  for (const org of orgs || []) {
    try {
      const data: Record<string, unknown[]> = {};
      const counts: Record<string, number> = {};
      for (const table of TABLES) {
        const rows: unknown[] = [];
        for (let from = 0; ; from += 1000) {
          const { data: page, error } = await supabase
            .from(table)
            .select('*')
            .eq('organization_id', org.id)
            .order('id')
            .range(from, from + 999);
          if (error) throw new Error(`${table}: ${error.message}`);
          rows.push(...(page || []));
          if (!page || page.length < 1000) break;
        }
        data[table] = rows;
        counts[table] = rows.length;
      }

      const brand = await loadBrand(supabase, org.id);
      if (!brand.email) {
        results.push({ org: org.id, ok: false });
        continue;
      }
      const takenAt = new Date().toISOString();
      const json = JSON.stringify({ taken_at: takenAt, business: brand.name, tables: data });
      const file = gzipSync(Buffer.from(json));
      const slug = brand.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'business';
      await sendBackupEmail(brand, { takenAt, counts, filename: `${slug}-backup-${takenAt.slice(0, 10)}.json.gz`, content: file });
      results.push({ org: org.id, ok: true, bytes: file.length });
    } catch (err) {
      await reportError(`Weekly backup failed for business ${org.id}`, err);
      results.push({ org: org.id, ok: false });
    }
  }
  const failed = results.filter((r) => !r.ok).length;
  return Response.json({ ok: failed === 0, results }, { status: failed === results.length && failed > 0 ? 500 : 200 });
}
