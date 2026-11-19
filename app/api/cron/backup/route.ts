import { NextRequest } from 'next/server';
import { gzipSync } from 'zlib';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { sendBackupEmail } from '@/lib/resend/emails';
import { isCronRequest } from '@/lib/utils/cron';
import { reportError } from '@/lib/notify/report-error';

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

// Weekly cron: email a full copy of the business data to the business inbox.
export async function GET(request: NextRequest) {
  if (!isCronRequest(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = await createServiceRoleClient();
    const data: Record<string, unknown[]> = {};
    const counts: Record<string, number> = {};
    for (const table of TABLES) {
      const rows: unknown[] = [];
      for (let from = 0; ; from += 1000) {
        const { data: page, error } = await supabase.from(table).select('*').range(from, from + 999);
        if (error) throw new Error(`${table}: ${error.message}`);
        rows.push(...(page || []));
        if (!page || page.length < 1000) break;
      }
      data[table] = rows;
      counts[table] = rows.length;
    }

    const takenAt = new Date().toISOString();
    const json = JSON.stringify({ taken_at: takenAt, tables: data });
    const file = gzipSync(Buffer.from(json));
    await sendBackupEmail({ takenAt, counts, filename: `ideal-invoicing-backup-${takenAt.slice(0, 10)}.json.gz`, content: file });
    return Response.json({ ok: true, counts, bytes: file.length });
  } catch (err) {
    await reportError('Weekly backup failed', err);
    return Response.json({ error: 'Backup failed' }, { status: 500 });
  }
}
