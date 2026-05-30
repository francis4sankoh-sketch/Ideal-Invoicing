/**
 * Add products from the live website (idealeventshire.com.au) into Supabase,
 * skipping anything we already have. Photos are downloaded from the website
 * and uploaded to the `Products` bucket.
 *
 * Run dry-run first to preview matches:
 *   npx tsx scripts/sync-website-products.ts --dry-run
 *
 * Then execute for real:
 *   npx tsx scripts/sync-website-products.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { lookup as mimeLookup } from 'mime-types';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DRY_RUN = process.argv.includes('--dry-run');
const BUCKET = 'Products';
const IMAGE_HOST = 'https://www.idealevents.com.au/';

type WebsiteProduct = {
  name: string;
  description: string;
  default_price: number | null;
  category: string;
  photos: string[]; // raw paths from website
};

// Scraped from idealeventshire.com.au on 2026-04-22
const websiteProducts: WebsiteProduct[] = [
  // Backdrops
  { name: 'Brown Boho Traditional Wedding', description: 'An earthy backdrop package built around dried florals and a warm brown drape. Made for cultural ceremonies and traditional weddings.', default_price: 1000, category: 'Backdrops', photos: ['ieg-Images/backdrops/Brown-Boho-Traditional-Wedding-Backdrop-Package-Ideal-Event-Hire.jpg'] },
  { name: 'Blue Baby Shower Backdrop', description: 'A soft blue baby shower backdrop package, beautifully styled to celebrate a new arrival in a fresh, modern and heartfelt way.', default_price: 530, category: 'Backdrops', photos: ['ieg-Images/backdrops/Blue-Baby-Shower-Backdrop-Package-Ideal-Event-Hire.jpg'] },
  { name: 'Mr & Mrs Floral Arch', description: 'A romantic floral arch package complete with Mr & Mrs signage, ideal for weddings and engagement celebrations that deserve a stunning focal point.', default_price: 440, category: 'Backdrops', photos: ['ieg-Images/backdrops/Mr-and-Mrs-Floral-Arch-Backdrop-Package-Ideal-Event-Hire.jpg'] },
  { name: 'Oh Baby Backdrop', description: 'A charming Oh Baby backdrop package, styled with warmth and whimsy to make any baby shower or gender reveal feel extra special.', default_price: 450, category: 'Backdrops', photos: ['ieg-Images/backdrops/Oh-baby-Backdrop-package-Hire-Ideal-Event-Hire.heic.jpg'] },
  { name: 'Ripple Hollow Backdrop', description: 'A beautiful Ripple Hollow butterfly package, bringing a delicate, nature-inspired elegance to garden parties, weddings and celebration events.', default_price: 500, category: 'Backdrops', photos: ['ieg-Images/backdrops/Ripple-Hollow-Backdrop-butterfly-package-Ideal-Event-Hire.jpg'] },
  { name: 'Red Curved Backdrop Package', description: 'Curved backdrop with rectangular panel, lush red pillar florals, acrylic floor mat, sand candles and a custom vinyl decal. Made for your event.', default_price: 700, category: 'Backdrops', photos: ['ieg-Images/backdrops/Red-Curved-Backdrop-Ideal-Event-Hire.jpg'] },
  { name: 'Gold Arch Backdrop Setup', description: 'A full gold arch backdrop setup complete with styling, ideal for birthdays and milestone events that deserve something extra special.', default_price: 500, category: 'Backdrops', photos: ['ieg-Images/backdrops/Gold-Arch-Birthday-Backdrop-Setup-Ideal-Event-Hire.JPG'] },
  { name: 'Purple Birthday Backdrop', description: 'A bold purple birthday backdrop setup. Eye-catching, on-trend and designed to be the centrepiece of your celebration.', default_price: 650, category: 'Backdrops', photos: ['ieg-Images/backdrops/Purple-Birthday-Party-Backdrop-Setup-Ideal-Event-Hire.JPG'] },
  { name: 'Boho Wedding Backdrop', description: 'A bohemian wedding backdrop paired with a peacock chair. A beautiful, relaxed setup for garden weddings and boho-themed celebrations.', default_price: 600, category: 'Backdrops', photos: ['ieg-Images/backdrops/Boho-Wedding-Backdrop-Peacock-Chair-Setup-Ideal-Event-Hire.JPG'] },
  { name: '50th Anniversary Backdrop', description: 'A sophisticated anniversary backdrop package designed to celebrate 50 years of love and memories with elegance and style.', default_price: 460, category: 'Backdrops', photos: ['ieg-Images/backdrops/50th-Anniversary-Backdrop-Package-Ideal-Event-Hire.jpg'] },
  { name: 'Boho Party Backdrop Package', description: 'A bohemian-inspired backdrop package featuring peacock chairs and styling, for creating an eclectic, free-spirited celebration atmosphere.', default_price: 600, category: 'Backdrops', photos: ['ieg-Images/backdrops/Boho-Party-Backdrop-Package-Peacock-Chairs-Ideal-Event-Hire.jpg'] },
  { name: "Girls 5th Birthday Party", description: "A magical, colourful backdrop package designed to make a 5-year-old's birthday unforgettable with playful theming and fun styling.", default_price: 450, category: 'Backdrops', photos: ['ieg-Images/backdrops/Girls-5th-Birthday-Party-Package-Ideal-Event-Hire.jpg'] },
  { name: 'Farm House Backdrop', description: "A fun farm-themed backdrop complete with animal cutouts, balloon garland, hay bale and a giant illuminated number. Made for kids' birthdays.", default_price: 500, category: 'Backdrops', photos: ['ieg-Images/backdrops/farm-house-backdrop-package.jpg'] },
  { name: 'Oh Baby & Teddy', description: 'A warm, neutral-toned Oh Baby package featuring ribbed arch panels, gold and white balloon garland, BABY letter boxes and an oversized teddy.', default_price: 450, category: 'Backdrops', photos: ['ieg-Images/backdrops/Oh-baby-Backdrop and Teddy-package-Hire-Ideal-Event-Hire.heic.jpg'] },

  // Tableware
  { name: 'Linen Napkin Hire', description: 'Soft linen napkins available in a range of colours to complement your table setting and event theme.', default_price: 1, category: 'Tableware', photos: ['ieg-Images/tableware/NAPKINS/Napkins Assorted.jpg'] },
  { name: 'Gold Candelabras', description: 'Elegant gold candelabras that add height, warmth and a touch of drama to any dinner table or ceremony space.', default_price: 50, category: 'Tableware', photos: ['ieg-Images/tableware/Candelabras/Candelabras-Hire.jpg'] },
  { name: 'Cutlery Set', description: 'Premium gold-finish cutlery sets including knife, fork and spoon. Made for weddings, galas and formal dinners.', default_price: 4, category: 'Tableware', photos: ['ieg-Images/tableware/Cutlery Set/Gold-cutlery-set-hire-Ideal.jpg'] },
  { name: 'Sand Candles', description: 'Textured white sand candles that create a warm, intimate ambience. A beautiful finishing touch for any styled table.', default_price: 20, category: 'Tableware', photos: ['ieg-Images/tableware/Sand Candles /white-sand-candels_.jpg'] },
  { name: 'Beaded Charger Plates', description: 'Elegant beaded charger plates available in gold, silver and clear. The finishing touch for any formal table setting.', default_price: 2.5, category: 'Tableware', photos: ['ieg-Images/tableware/Charger Plates/Gold-Beaded-Charger-Plate-Hire-Ideal-Event-Hire.jpg'] },
  { name: 'Candle Stands', description: 'Elegant candle stands available in gold, rose gold, black and glass finishes. An accent for any table setting.', default_price: 3, category: 'Tableware', photos: ['ieg-Images/tableware/Candle Stands/Gold-Candle-Stand-Hire-Ideal-Event-Hire.jpeg.jpg'] },
  { name: 'Centrepieces', description: 'Decorative centrepieces in gold and white, ideal for table styling, dessert tables or entrance displays.', default_price: null, category: 'Tableware', photos: ['ieg-Images/tableware/Center pieces/Gold-Flower-Pot-Hire-Ideal-Event-Hire.png'] },
  { name: 'Crushed Velvet Tablecloth', description: 'Luxurious crushed velvet tablecloths that transform any table into a showstopper, with opulent drape for weddings and styled events.', default_price: 10, category: 'Tableware', photos: ['ieg-Images/tableware/Tablecloth/Crushed-Velvet-Tablecloth-Hire-1-Ideal-Event-Hire.png'] },

  // Chairs & Tables
  { name: 'Americana Chair', description: 'Classic white Americana folding chairs. Lightweight, elegant, and made for outdoor ceremonies, garden parties and casual events.', default_price: 6, category: 'Chairs & Tables', photos: ['ieg-Images/chairs-tables/Americana Chairs/Americana-Chair-Hire-Ideal-Event-Hire.jpg.png'] },
  { name: 'Peacock Chair', description: 'An iconic rattan peacock chair. A statement hire piece for bohemian weddings, birthdays and styled photo shoots.', default_price: 75, category: 'Chairs & Tables', photos: ['ieg-Images/chairs-tables/Peacock chair/Peacock-Chair-Hire-Ideal-Event-Hire.jpg'] },
  { name: 'Tiffany Chair - Ghost/Clear', description: 'Sleek clear ghost Tiffany chairs. Versatile, modern, and made for contemporary weddings and formal dinner events. Comes with cushion.', default_price: 6, category: 'Chairs & Tables', photos: ['ieg-Images/chairs-tables/Tiffany Chairs/Ghost/Clear-Ghost-Tiffany-Chair-Hire-Ideal-Event-Hire.webp'] },
  { name: 'Tiffany Chair - Gold', description: 'Glamorous gold Tiffany chairs that add a touch of luxury to any event. Made for weddings, galas and milestone celebrations. Comes with cushion.', default_price: 6, category: 'Chairs & Tables', photos: ['ieg-Images/chairs-tables/Tiffany Chairs/Gold/Gold-Tiffany-Chair-Hire-2-Ideal-Event-Hire.jpg'] },
  { name: 'Tiffany Chair - White', description: 'Classic white Tiffany chairs. Timeless and elegant, and a popular choice for weddings, christenings and formal dining events. Comes with cushion.', default_price: 6, category: 'Chairs & Tables', photos: ['ieg-Images/chairs-tables/Tiffany Chairs/White/tifffany-chair-white.jpg'] },
  { name: 'Timber Crossback Chair', description: 'Rustic natural timber crossback chairs. Warm, charming, and made for country, garden and relaxed-style celebrations.', default_price: 7, category: 'Chairs & Tables', photos: ['ieg-Images/chairs-tables/timber-crossback.jpg'] },
  { name: 'Event Tables', description: 'Sturdy, well-finished event tables available in various sizes. The foundation of any beautifully dressed dining setup.', default_price: 11, category: 'Chairs & Tables', photos: ['ieg-Images/chairs-tables/Tables/Event-Table-Hire-Ideal-Event-Hire.png'] },

  // Faux Florals
  { name: 'Blue Faux Pillar Florals', description: 'Striking blue faux pillar florals. A bold and dramatic statement piece for ceremonies, dessert tables and styled shoots.', default_price: 180, category: 'Faux Florals', photos: ['ieg-Images/florals/Blue Faux Pilar Florals-Hire-2-Ideal-Event-Hire.jpg.png.jpg'] },
  { name: 'Green Faux Pillar Florals', description: 'Lush green faux pillar florals that bring a fresh, botanical feel to any event space. Made for garden-themed celebrations.', default_price: 180, category: 'Faux Florals', photos: ['ieg-Images/florals/Green Faux Pilar Florals-Hire-2-Ideal-Event-Hire.jpg.png.jpg'] },
  { name: 'Pink Faux Pillar Florals', description: 'Soft pink faux pillar florals. Romantic, feminine, and made for weddings, baby showers and birthday celebrations.', default_price: 180, category: 'Faux Florals', photos: ['ieg-Images/florals/Pink Faux Pilar Florals-Hire-2-Ideal-Event-Hire.jpg.png.jpg'] },
  { name: 'Red Faux Pillar Florals', description: "Rich red faux pillar florals that create a bold, passionate atmosphere. Made for Valentine's events, galas and formal dinners.", default_price: 180, category: 'Faux Florals', photos: ['ieg-Images/florals/Red Faux Pilar Florals-Hire-2-Ideal-Event-Hire.jpg'] },
  { name: 'White Pillar Florals', description: 'Classic white faux pillar florals. Timeless, elegant, and suited to any event style from weddings to corporate functions.', default_price: 180, category: 'Faux Florals', photos: ['ieg-Images/florals/White Pilar Florals-Hire-2-Ideal-Event-Hire.jpg.png.jpg'] },
  { name: "Baby's Breath Pillar Florals", description: "Soft white baby's breath pillar florals. Light, romantic and a budget-friendly alternative to full faux pillars. Made for ceremonies, dessert tables and styled photo moments.", default_price: 150, category: 'Faux Florals', photos: ['ieg-Images/florals/Babys-Breath-Pillar-Florals-Hire-Ideal-Event-Hire.jpg'] },
  { name: 'White Floral Arch', description: 'An elegant white floral arch. Made as a ceremony backdrop, photo opportunity or entrance statement piece.', default_price: 200, category: 'Faux Florals', photos: ['ieg-Images/florals/White-Floral-Arch-Hire-Ideal-Event-Hire.jpg'] },

  // Plinths
  { name: 'Gold Plinths', description: 'Elegant gold plinths to elevate your floral arrangements, centrepieces and event displays across Melbourne.', default_price: null, category: 'Plinths', photos: [] },
  { name: 'White Plinths', description: 'Elegant white plinths to elevate your floral arrangements, centrepieces and event displays across Melbourne.', default_price: null, category: 'Plinths', photos: [] },
  { name: 'Slatted Plinths', description: 'Slatted plinths available for hire. Quotes include delivery, setup and pack-down services.', default_price: null, category: 'Plinths', photos: [] },

  // Photobooth
  { name: '360 Photo Booth', description: 'Captures epic slow-motion video from every angle. Guaranteed to get guests talking and sharing. Booking includes operator, props, and unlimited video downloads.', default_price: 200, category: 'Photobooth', photos: ['ieg-Images/Photobooth/360 photobooth/360-Photo-Booth-Hire-1-Ideal-Event-Hire.jpg'] },

  // Giant Numbers
  { name: 'Giant Number Sets', description: 'Two-digit giant LED number combinations (16, 18, 21, 30, 40, 50 and more). Make your milestone birthday impossible to miss.', default_price: 50, category: 'Giant Numbers', photos: ['ieg-Images/giantnumbers-and-letters/Giant-Marquee-Numbers-4-to-9-LED-Hire-Ideal-Event-Hire.jpg.avif'] },
  { name: 'Giant LOVE Sign', description: "An iconic illuminated LOVE sign. A glowing romantic statement piece for weddings, engagements and Valentine's Day events.", default_price: 175, category: 'Giant Numbers', photos: ['ieg-Images/giantnumbers-and-letters/Giant-Love-Sign-Marquee-LED-Hire-2-Ideal-Event-Hire.jpg.avif'] },

  // Other
  { name: 'Festoon Lights', description: 'Warm festoon string lights that create a magical outdoor ambiance. Made for garden parties, wedding receptions and open-air events.', default_price: 50, category: 'Other', photos: ['ieg-Images/Others/Festoon Lights/Festoon-Lights-Event-Hire-Ideal-Event-Hire.jpg'] },
  { name: 'Food Riser / Display Stand', description: 'Elegant food riser display stands that add height and visual interest to dessert tables, grazing stations and buffet setups.', default_price: null, category: 'Other', photos: ['ieg-Images/Others/Food risers/Food-Riser-Display-Stand-Hire-Ideal-Event-Hire.jpeg'] },
  { name: 'Red Aisle Runner', description: 'A classic red aisle runner carpet that makes a grand entrance at weddings, galas, corporate events and formal celebrations.', default_price: 75, category: 'Other', photos: ['ieg-Images/Others/Red Carpet/Red-Aisle-Runner-Carpet-Hire-Ideal-Event-Hire.jpeg'] },
];

/**
 * Normalise a name for fuzzy duplicate detection.
 * Lowercase, strip punctuation, drop filler words, collapse whitespace.
 */
function normalise(name: string): string {
  const filler = new Set([
    'package', 'hire', 'ideal', 'event', 'events', 'group', 'a', 'an', 'the',
    'and', 'or', 'of', 'with', 'for', 'to', 'in', 'on', 'at',
  ]);
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t && !filler.has(t))
    .sort()
    .join(' ')
    .trim();
}

function buildAbsoluteUrl(rawPath: string): string {
  if (rawPath.startsWith('http')) return rawPath;
  return IMAGE_HOST + encodeURI(rawPath);
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

async function downloadAndUpload(url: string, productSlug: string, idx: number): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`    ! Photo fetch failed (${res.status}): ${url}`);
      return null;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const urlPath = new URL(url).pathname;
    const ext = (urlPath.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
    const safeExt = ['jpg', 'jpeg', 'png', 'webp', 'avif', 'heic'].includes(ext) ? ext : 'jpg';
    const storagePath = `website-import/${productSlug}/${productSlug}-${idx}.${safeExt}`;
    const contentType = mimeLookup(safeExt) || 'image/jpeg';

    if (DRY_RUN) {
      console.log(`    [dry-run] would upload ${url} -> ${storagePath}`);
      return `https://example.com/${storagePath}`;
    }

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buf, { contentType, upsert: true });
    if (error) {
      console.warn(`    ! Upload failed: ${error.message}`);
      return null;
    }
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
    return data.publicUrl;
  } catch (err) {
    console.warn(`    ! Photo error: ${(err as Error).message}`);
    return null;
  }
}

async function run() {
  console.log(`=== Website -> Supabase product sync${DRY_RUN ? ' (DRY RUN)' : ''} ===\n`);

  const { data: existing, error } = await supabase.from('products').select('id, name, category');
  if (error || !existing) {
    console.error('Failed to fetch existing products:', error?.message);
    process.exit(1);
  }
  const existingByNorm = new Map<string, { id: string; name: string }>();
  for (const p of existing) existingByNorm.set(normalise(p.name), p);

  const toInsert: Array<WebsiteProduct & { matched?: { id: string; name: string } }> = [];
  const skipped: Array<{ website: string; matched: string }> = [];

  for (const w of websiteProducts) {
    const m = existingByNorm.get(normalise(w.name));
    if (m) skipped.push({ website: w.name, matched: m.name });
    else toInsert.push(w);
  }

  console.log(`Existing in Supabase: ${existing.length}`);
  console.log(`From website:         ${websiteProducts.length}`);
  console.log(`Already match (skip): ${skipped.length}`);
  console.log(`To insert (NEW):      ${toInsert.length}\n`);

  if (skipped.length > 0) {
    console.log('--- Matched (will SKIP) ---');
    for (const s of skipped) console.log(`  ${s.website}  ==  ${s.matched}`);
    console.log('');
  }

  console.log('--- New items (will INSERT) ---');
  for (const t of toInsert) {
    console.log(`  + [${t.category}] ${t.name}  $${t.default_price ?? '?'}  (${t.photos.length} photo${t.photos.length === 1 ? '' : 's'})`);
  }
  console.log('');

  if (DRY_RUN) {
    console.log('Dry run complete. Re-run without --dry-run to actually insert.');
    return;
  }

  if (toInsert.length === 0) {
    console.log('Nothing to do.');
    return;
  }

  let success = 0;
  let failed = 0;

  for (const item of toInsert) {
    console.log(`Processing: ${item.name}`);
    const slug = slugify(item.name);

    const photoUrls: string[] = [];
    for (let i = 0; i < item.photos.length; i++) {
      const absUrl = buildAbsoluteUrl(item.photos[i]);
      const uploaded = await downloadAndUpload(absUrl, slug, i);
      if (uploaded) photoUrls.push(uploaded);
    }

    const { error: insErr } = await supabase.from('products').insert({
      name: item.name,
      description: item.description,
      default_price: item.default_price ?? 0,
      category: item.category,
      photos: photoUrls,
      gst_inclusive: false,
      has_color_variants: false,
      color_variants: [],
      is_active: true,
    });

    if (insErr) {
      console.error(`  ! INSERT failed: ${insErr.message}`);
      failed++;
    } else {
      console.log(`  OK ${photoUrls.length} photo(s) uploaded`);
      success++;
    }
  }

  console.log(`\n=== Done. Inserted: ${success}, Failed: ${failed} ===`);
}

run().catch(console.error);
