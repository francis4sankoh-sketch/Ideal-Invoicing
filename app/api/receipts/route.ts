import { NextRequest } from 'next/server';
import { randomUUID } from 'crypto';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getOrg, getSignedInOrgId } from '@/lib/org/server';

// Receipts live in the private "Receipts" bucket. Expenses store the object path, and the
// dashboard opens it through GET here, which hands out a short-lived signed link.
// Each business's receipts sit in a folder named after its id. Receipts from before businesses
// were separated sit in month folders ("2026-05/...") and belong to the original business.
const BUCKET = 'Receipts';
const MAX_BYTES = 10 * 1024 * 1024;
const TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'application/pdf': 'pdf',
};

async function signedInOrg() {
  const me = await getSignedInOrgId();
  return me?.orgId ?? null;
}

export async function POST(request: NextRequest) {
  const orgId = await signedInOrg();
  if (!orgId) return Response.json({ error: 'Not signed in' }, { status: 401 });

  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return Response.json({ error: 'No file received' }, { status: 400 });
  const ext = TYPES[file.type];
  if (!ext) return Response.json({ error: 'Receipts must be a photo (JPEG, PNG, WebP, HEIC) or a PDF' }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: 'Receipts must be under 10 MB' }, { status: 400 });

  const path = `${orgId}/${new Date().toISOString().slice(0, 7)}/${randomUUID()}.${ext}`;
  const supabase = await createServiceRoleClient();
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ path });
}

export async function GET(request: NextRequest) {
  const orgId = await signedInOrg();
  if (!orgId) return new Response('Not signed in', { status: 401 });

  const path = request.nextUrl.searchParams.get('path') || '';
  if (!/^[\w\-/]+\.(jpg|png|webp|heic|heif|pdf)$/.test(path) || path.includes('..')) {
    return new Response('Bad receipt path', { status: 400 });
  }
  const supabase = await createServiceRoleClient();
  const folder = path.split('/')[0];
  const ownsPath =
    folder === orgId || (/^\d{4}-\d{2}$/.test(folder) && (await getOrg(supabase, orgId))?.is_default === true);
  if (!ownsPath) return new Response('Receipt not found', { status: 404 });

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 300);
  if (error || !data) return new Response('Receipt not found', { status: 404 });
  return Response.redirect(data.signedUrl, 302);
}
