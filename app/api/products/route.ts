import { NextRequest } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getDefaultOrg } from '@/lib/org/server';

// Public product list for a business's own website: /api/products?business=<business id>.
// With no business given it lists the original business's products, as it always has.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServiceRoleClient();
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const business = searchParams.get('business');
    const orgId = business ? (UUID.test(business) ? business : null) : (await getDefaultOrg(supabase))?.id;
    if (!orgId) return Response.json({ error: 'Unknown business' }, { status: 404 });

    let query = supabase
      .from('products')
      .select('id, name, description, default_price, photos, category, color_variants, gst_inclusive')
      .eq('organization_id', orgId)
      .eq('is_active', true)
      .order('name');

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query;

    if (error) {
      return Response.json({ error: 'Failed to fetch products' }, { status: 500 });
    }

    // Add CORS headers for website integration
    return new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  } catch (error) {
    console.error('Products API error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
