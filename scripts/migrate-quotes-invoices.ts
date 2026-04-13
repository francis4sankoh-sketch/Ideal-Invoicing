/**
 * Quotes & Invoices Migration Script — imports from Base44 into Supabase
 * Run with: npx tsx scripts/migrate-quotes-invoices.ts
 *
 * Before running, ensure:
 * 1. Supabase tables have been created (run the SQL migration first)
 * 2. Customers have been migrated (run migrate-data.ts first)
 * 3. .env.local has valid NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { randomUUID } from 'crypto';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

// ===========================================
// Base44 customer ID -> email mapping
// ===========================================
const base44CustomerMap: Record<string, string> = {
  '69d7781944be42563eba6135': 'mduluka@Yahoo.com',
  '69ce4f80f444f316bc2288d4': 'Yangjoack@yahoo.com.au',
  '69c9920b9e10ca292e2b0268': 'maddydal28@gmail.com',
  '69bcfbeea7b5cf5492b7ef5a': 'eloisewillis00@gmail.com',
  '69b7aab7c9e707ab671cfbb1': 'winny.mk@gmail.com',
  '69b7afdf85248cb5df29a9db': 'akair.w@outlook.com',
  '69aabe3a3fd209b4dc083981': 'Nyabanad@gmail.com',
  '69919e22a2a22a9c291daba7': 'Luteedavis@hotmail.com',
  '698c70308f1dfc612630e926': 'carolcherr@yahoo.com',
};

// ===========================================
// Helper: add UUID id to each line item, strip photos
// ===========================================
function processLineItems(items: any[]): any[] {
  return items.map((item) => ({
    ...item,
    id: randomUUID(),
    photos: [],
  }));
}

// ===========================================
// QUOTES DATA
// ===========================================
const quotesData = [
  {
    quote_number: 'Q0072',
    title: '1 Years Birthday and Baptism',
    event_location: 'Clyde North',
    event_date: '2026-05-02',
    status: 'accepted',
    customer_base44: '69d7781944be42563eba6135',
    subtotal: 600,
    total: 600,
    deposit_percentage: 20,
    deposit_amount: 120,
    include_gst: false,
    discount_type: null,
    discount_value: 0,
    discount_amount: 0,
    gst_amount: 0,
    converted_to_invoice: true,
    valid_until: '2026-04-14',
    created_at: '2026-04-09T10:31:55.053Z',
    notes: null,
    line_items: [
      { description: 'Orange & White Backdrop package', total: 450, quantity: 1, notes: 'Includes\n1 x 2M Orange Backdrop \n1 x 1.8m white Backdrop \n1x Orange, White and touch of Gold Ballon Garland\n1 x White Plinth \n1 x White Floor Mat\n1x Decal : Happy Christening (Orange Board)', unit_price: 450 },
      { description: 'Delivery Setup & Pack-down', total: 100, quantity: 1, notes: '', unit_price: 100 },
      { description: 'Extra Decal', total: 50, quantity: 1, notes: 'JALENS BIG ONE (White Board)\nTHE O in one should be replaced with A Basketball', unit_price: 50 },
    ],
  },
  {
    quote_number: 'Q0071',
    title: 'LING NEYRO VIDEO PREMIER',
    event_location: '30 VICTORIA HARBOUR PROMENADE DOCKLANDS VIC 3008',
    event_date: '2026-04-04',
    status: 'completed',
    customer_base44: '69ce4f80f444f316bc2288d4',
    subtotal: 525,
    total: 525,
    deposit_percentage: 20,
    deposit_amount: 105,
    include_gst: false,
    discount_type: null,
    discount_value: 0,
    discount_amount: 0,
    gst_amount: 0,
    converted_to_invoice: true,
    valid_until: '2026-04-03',
    created_at: '2026-04-02T11:19:28.129Z',
    notes: null,
    line_items: [
      { description: '360 Photo Booth', total: 525, quantity: 3, notes: 'Capacity: 1-4 people\nCustom Overlay\nGold Bollards With Red Rope\n1 x Professional Attendant\n360 Booth Setup and pack down\n360 Slow Motion Video Shared Via Email', unit_price: 175 },
    ],
  },
  {
    quote_number: 'Q0070',
    title: 'Chairs and 6ft Trestle Tables',
    event_location: 'Devon Meadows',
    event_date: '2026-04-17',
    status: 'accepted',
    customer_base44: '69c9920b9e10ca292e2b0268',
    subtotal: 410,
    total: 410,
    deposit_percentage: 20,
    deposit_amount: 82,
    include_gst: false,
    discount_type: null,
    discount_value: 0,
    discount_amount: 0,
    gst_amount: 0,
    converted_to_invoice: true,
    valid_until: '2026-04-06',
    created_at: '2026-03-29T21:00:11.314Z',
    notes: 'Good morning Madelynne, please see attached quote',
    line_items: [
      { description: 'Trestle Table', total: 60, quantity: 6, notes: '', unit_price: 10 },
      { description: 'Americana Chairs', total: 250, quantity: 50, notes: '', unit_price: 5 },
      { description: 'Delivery & Pick up', total: 100, quantity: 1, notes: '', unit_price: 100 },
    ],
  },
  {
    quote_number: 'Q0069',
    title: '25 Birthday',
    event_location: '95/90 Cranwell Street, Braybrook',
    event_date: '2026-04-19',
    status: 'accepted',
    customer_base44: '69b7aab7c9e707ab671cfbb1',
    subtotal: 1310,
    total: 1310,
    deposit_percentage: 20,
    deposit_amount: 262,
    include_gst: false,
    discount_type: null,
    discount_value: 0,
    discount_amount: 0,
    gst_amount: 0,
    converted_to_invoice: true,
    valid_until: '2026-04-10',
    created_at: '2026-03-27T12:49:50.031Z',
    notes: null,
    line_items: [
      { description: 'Sand Candles', total: 60, quantity: 3, notes: '3 sets of 3', unit_price: 20 },
      { description: 'Table Styling Package', total: 600, quantity: 30, notes: 'INCLUDES\n\n30x White Americana Chairs\n30x Burgundy Napkins\n30x Clear Charger plates\n30x Set of plates\n30x Set of Gold Cutleries\n30x glassware\nTable styled with Table runner, Red Silk roses floral arrangement, Candles', unit_price: 20 },
      { description: 'Red and White Backdrop', total: 500, quantity: 1, notes: 'Includes\n\nRipple/Slatted Arch Backdrop\nPlain Arch Backdrop\nFaux Floral Pillar\nCentrepiece Floral\nWhite Plinth\nFloor Mat', unit_price: 500 },
      { description: 'Delivery, Setup & Pick up', total: 150, quantity: 1, notes: '', unit_price: 150 },
    ],
  },
  {
    quote_number: 'Q0050',
    title: 'Wedding - 6/1 Victoria place Richmond 3121',
    event_location: '6/1 Victoria place Richmond 3121',
    event_date: '2026-03-21',
    status: 'accepted',
    customer_base44: '69bcfbeea7b5cf5492b7ef5a',
    subtotal: 150,
    total: 150,
    deposit_percentage: 20,
    deposit_amount: 30,
    include_gst: false,
    discount_type: 'fixed',
    discount_value: 0,
    discount_amount: 0,
    gst_amount: 0,
    converted_to_invoice: true,
    valid_until: null,
    created_at: '2026-03-20T07:49:03.375Z',
    notes: null,
    line_items: [
      { description: 'Green and White Pilar Flowers', total: 150, quantity: 1, notes: '', unit_price: 150 },
    ],
  },
  {
    quote_number: 'Q0049',
    title: '70TH BIRTHDAY',
    event_location: 'Hotel 520 Tarneit',
    event_date: '2026-04-25',
    status: 'accepted',
    customer_base44: '69b7aab7c9e707ab671cfbb1',
    subtotal: 1500,
    total: 1500,
    deposit_percentage: 20,
    deposit_amount: 300,
    include_gst: false,
    discount_type: null,
    discount_value: 0,
    discount_amount: 0,
    gst_amount: 0,
    converted_to_invoice: true,
    valid_until: '2026-03-23',
    created_at: '2026-03-20T07:06:14.748Z',
    notes: null,
    line_items: [
      { description: 'White Backdrop', total: 1250, quantity: 1, notes: 'Package Includes\n* White Backdrop\n* 6 White Floral arrangement\n* White Sofa\n* Gold and White Center Table\n* 2 x Gold candle Labra\n* Hour Glass Plinth', unit_price: 1250 },
      { description: 'Delivery, Set Up & Pack down', total: 250, quantity: 1, notes: '', unit_price: 250 },
    ],
  },
  {
    quote_number: 'Q0042',
    title: 'Proposal',
    event_location: 'Pick up',
    event_date: '2026-03-21',
    status: 'completed',
    customer_base44: '69b7afdf85248cb5df29a9db',
    subtotal: 1145,
    total: 1145,
    deposit_percentage: 20,
    deposit_amount: 229,
    include_gst: false,
    discount_type: null,
    discount_value: 0,
    discount_amount: 0,
    gst_amount: 0,
    converted_to_invoice: true,
    valid_until: '2026-03-18',
    created_at: '2026-03-16T08:00:09.630Z',
    notes: null,
    line_items: [
      { description: 'Red Centrepieces', total: 160, quantity: 4, notes: '', unit_price: 40 },
      { description: 'Red Pilar Flowers set', total: 750, quantity: 5, notes: '', unit_price: 150 },
      { description: 'Red Sand Candles', total: 100, quantity: 5, notes: '5 gold Candlelabras', unit_price: 20 },
      { description: 'Backdrop +vinyl', total: 135, quantity: 1, notes: '', unit_price: 135 },
    ],
  },
  {
    quote_number: 'Q0037',
    title: '',
    event_location: '7a Allison Avenue Eumemmering, Vic',
    event_date: '2026-03-11',
    status: 'completed',
    customer_base44: '69aabe3a3fd209b4dc083981',
    subtotal: 391,
    total: 391,
    deposit_percentage: 20,
    deposit_amount: 78.2,
    include_gst: false,
    discount_type: null,
    discount_value: 0,
    discount_amount: 0,
    gst_amount: 0,
    converted_to_invoice: true,
    valid_until: '2026-03-11',
    created_at: '2026-03-06T12:26:46.530Z',
    notes: null,
    line_items: [
      { description: 'Trestle Table', total: 30, quantity: 3, notes: '', unit_price: 10 },
      { description: 'Tiffany Chairs - Gold Tiffany Chairs', total: 90, quantity: 18, notes: '', unit_price: 5 },
      { description: 'Napkin - Beige', total: 27, quantity: 18, notes: '', unit_price: 1.5 },
      { description: 'Table Cloth 6ft - Beige', total: 30, quantity: 3, notes: '', unit_price: 10 },
      { description: 'Cutlery Set', total: 18, quantity: 18, notes: '18 Gold Knives', unit_price: 1 },
      { description: 'Clear Beaded Charger Plate - Gold', total: 18, quantity: 18, notes: '', unit_price: 1 },
      { description: 'Delivery & Pick up to Eumemmerring', total: 160, quantity: 2, notes: '', unit_price: 80 },
      { description: 'Table Runner', total: 18, quantity: 6, notes: '', unit_price: 3 },
    ],
  },
  {
    quote_number: 'Q0035',
    title: 'TRADITIONAL WEDDING',
    event_location: 'ST ALBANS',
    event_date: '2026-05-16',
    status: 'accepted',
    customer_base44: '69919e22a2a22a9c291daba7',
    subtotal: 6200,
    total: 6200,
    deposit_percentage: 20,
    deposit_amount: 1240,
    include_gst: false,
    discount_type: null,
    discount_value: 0,
    discount_amount: 0,
    gst_amount: 0,
    converted_to_invoice: true,
    valid_until: '2026-03-01',
    created_at: '2026-02-24T09:53:56.006Z',
    notes: null,
    line_items: [
      { description: '30 CM BROWN, BEIGE & PAMPAS GRASS CENTRE PIECE', total: 1000, quantity: 20, notes: '', unit_price: 50 },
      { description: 'DARK GREEN/ BURNT ORANGE NAPKINS', total: 300, quantity: 200, notes: '', unit_price: 1.5 },
      { description: 'AFRICAN MATERIAL TABLE RUNNER', total: 200, quantity: 20, notes: '', unit_price: 10 },
      { description: 'BROWN SAND CANDLES SET', total: 870, quantity: 60, notes: '60 set of 3', unit_price: 14.5 },
      { description: 'TRADITIONAL BACKDROP INCLUDING CURTAIN DRAPE', total: 1000, quantity: 1, notes: 'Includes\n* 4 Beige Rectangular Backdrops\n* Beige Curtain Drape\n* 4x 40 cm Pampas Grass Flowers\n* 1 X White Plinth\n* 12 X Woven Basket', unit_price: 1000 },
      { description: 'GOLD CUTLERIES', total: 400, quantity: 200, notes: '', unit_price: 2 },
      { description: 'Peacock Chair', total: 130, quantity: 2, notes: '', unit_price: 65 },
      { description: 'Rattan Place Matts + Gold Charger Plates', total: 400, quantity: 200, notes: '', unit_price: 2 },
      { description: 'Delivery Setup and Packdown', total: 400, quantity: 1, notes: '', unit_price: 400 },
      { description: 'Round Beige Table Cloth', total: 200, quantity: 20, notes: '', unit_price: 10 },
      { description: '360 Photo Booth, Smoke Machine, Cold Sparks', total: 1200, quantity: 1, notes: 'Capacity: 1-4 people\nCustom Overlay\nGold Bollards With Red Rope\n1 x Professional Attendant\n360 Booth Setup and pack down\n360 Slow Motion Video Shared Via Email', unit_price: 1200 },
      { description: 'Gold Tiffany Chairs', total: 100, quantity: 20, notes: '', unit_price: 5 },
    ],
  },
  {
    quote_number: 'Q0022',
    title: 'Bridal Shower Quote',
    event_location: '',
    event_date: '2026-08-29',
    status: 'accepted',
    customer_base44: '698c70308f1dfc612630e926',
    subtotal: 1950,
    total: 1850,
    deposit_percentage: 20,
    deposit_amount: 370,
    include_gst: false,
    discount_type: 'fixed',
    discount_value: 100,
    discount_amount: 100,
    gst_amount: 0,
    converted_to_invoice: true,
    valid_until: '2026-02-20',
    created_at: '2026-02-14T04:38:35.032Z',
    notes: null,
    line_items: [
      { description: 'Table Styling Package', total: 600, quantity: 50, notes: 'INCLUDES\n\n8x Table cloth\n50x Napkin\n50x Gold beaded charger plate\nTable styled with Table runner, 1x floral arrangement, Candles', unit_price: 12 },
      { description: 'Backdrop', total: 700, quantity: 1, notes: 'Includes\n\n1 white rectangle Backdrop\n1 Curved White Backdrop\n2x white Pilar Flowers\n3x Metres Ballon Garland\nAfrocentric Pieces\nAcrylic Floor mat\nWhite Plinth\nGold decal', unit_price: 700 },
      { description: 'Delivery and Setup', total: 200, quantity: 1, notes: '', unit_price: 200 },
      { description: 'Backdrop Curtains', total: 150, quantity: 1, notes: '', unit_price: 150 },
      { description: 'Clear Tiffany Chairs', total: 250, quantity: 50, notes: '', unit_price: 5 },
      { description: 'Peacock Chair', total: 50, quantity: 1, notes: '', unit_price: 50 },
    ],
  },
];

// ===========================================
// INVOICES DATA
// ===========================================
const invoicesData = [
  {
    invoice_number: 'INV0023',
    linked_quote: 'Q0072',
    customer_base44: '69d7781944be42563eba6135',
    title: '1 Years Birthday and Baptism',
    total: 600,
    subtotal: 600,
    amount_paid: 0,
    balance_due: 600,
    deposit_amount: 120,
    deposit_percentage: 20,
    discount_amount: 0,
    gst_amount: 0,
    status: 'unpaid',
    issue_date: '2026-04-11',
    due_date: '2026-05-02',
    event_date: '2026-05-02',
    event_location: 'Clyde North',
    paid_date: null,
    payment_method: null,
    payment_history: [],
    created_at: '2026-04-11T10:24:22.763Z',
    use_quote_line_items: 'Q0072',
  },
  {
    invoice_number: 'INV0022',
    linked_quote: 'Q0071',
    customer_base44: '69ce4f80f444f316bc2288d4',
    title: 'LING NEYRO VIDEO PREMIER',
    total: 525,
    subtotal: 525,
    amount_paid: 525,
    balance_due: 0,
    deposit_amount: 105,
    deposit_percentage: 20,
    discount_amount: 0,
    gst_amount: 0,
    status: 'completed',
    issue_date: '2026-04-03',
    due_date: '2026-04-04',
    event_date: '2026-04-04',
    event_location: '30 VICTORIA HARBOUR PROMENADE DOCKLANDS VIC 3008',
    paid_date: '2026-04-09',
    payment_method: 'other',
    payment_history: [{ date: '2026-04-09', amount: 525, notes: 'Marked as paid', payment_method: 'other' }],
    created_at: '2026-04-02T23:37:43.526Z',
    use_quote_line_items: 'Q0071',
  },
  {
    invoice_number: 'INV0021',
    linked_quote: 'Q0070',
    customer_base44: '69c9920b9e10ca292e2b0268',
    title: 'Chairs and 6ft Trestle Tables',
    total: 410,
    subtotal: 410,
    amount_paid: 82,
    balance_due: 328,
    deposit_amount: 82,
    deposit_percentage: 20,
    discount_amount: 0,
    gst_amount: 0,
    status: 'partially_paid',
    issue_date: '2026-03-30',
    due_date: '2026-04-17',
    event_date: '2026-04-17',
    event_location: 'Devon Meadows',
    paid_date: null,
    payment_method: 'bank_transfer',
    payment_history: [{ date: '2026-03-31', amount: 82, notes: '', payment_method: 'bank_transfer' }],
    created_at: '2026-03-29T23:02:19.516Z',
    use_quote_line_items: 'Q0070',
  },
  {
    invoice_number: 'INV0020',
    linked_quote: 'Q0069',
    customer_base44: '69b7aab7c9e707ab671cfbb1',
    title: '25 Birthday',
    total: 1310,
    subtotal: 1310,
    amount_paid: 262,
    balance_due: 1048,
    deposit_amount: 262,
    deposit_percentage: 20,
    discount_amount: 0,
    gst_amount: 0,
    status: 'partially_paid',
    issue_date: '2026-03-29',
    due_date: '2026-04-19',
    event_date: '2026-04-19',
    event_location: '95/90 Cranwell Street, Braybrook',
    paid_date: null,
    payment_method: 'bank_transfer',
    payment_history: [{ date: '2026-04-11', amount: 262, notes: '', payment_method: 'bank_transfer' }],
    created_at: '2026-03-29T09:57:42.308Z',
    use_quote_line_items: 'Q0069',
  },
  {
    invoice_number: 'INV0019',
    linked_quote: 'Q0049',
    customer_base44: '69b7aab7c9e707ab671cfbb1',
    title: '70TH BIRTHDAY',
    total: 1500,
    subtotal: 1500,
    amount_paid: 0,
    balance_due: 1500,
    deposit_amount: 300,
    deposit_percentage: 20,
    discount_amount: 0,
    gst_amount: 0,
    status: 'unpaid',
    issue_date: '2026-03-22',
    due_date: '2026-04-25',
    event_date: '2026-04-25',
    event_location: 'Hotel 520 Tarneit',
    paid_date: null,
    payment_method: null,
    payment_history: [],
    created_at: '2026-03-22T10:13:43.162Z',
    use_quote_line_items: 'Q0049',
  },
  {
    invoice_number: 'INV0018',
    linked_quote: 'Q0050',
    customer_base44: '69bcfbeea7b5cf5492b7ef5a',
    title: 'Wedding - 6/1 Victoria place Richmond 3121',
    total: 150,
    subtotal: 150,
    amount_paid: 150,
    balance_due: 0,
    deposit_amount: 30,
    deposit_percentage: 20,
    discount_amount: 0,
    gst_amount: 0,
    status: 'paid',
    issue_date: '2026-03-22',
    due_date: '2026-03-21',
    event_date: '2026-03-21',
    event_location: '6/1 Victoria place Richmond 3121',
    paid_date: '2026-03-22',
    payment_method: 'other',
    payment_history: [{ date: '2026-03-22', amount: 150, notes: 'Marked as paid', payment_method: 'other' }],
    created_at: '2026-03-21T13:13:54.467Z',
    use_quote_line_items: 'Q0050',
  },
  {
    invoice_number: 'INV0017',
    linked_quote: 'Q0042',
    customer_base44: '69b7afdf85248cb5df29a9db',
    title: 'Proposal',
    total: 1185,
    subtotal: 1185,
    amount_paid: 1185,
    balance_due: 0,
    deposit_amount: 229,
    deposit_percentage: 20,
    discount_amount: 0,
    gst_amount: 0,
    status: 'completed',
    issue_date: '2026-03-21',
    due_date: '2026-03-21',
    event_date: '2026-03-21',
    event_location: 'Pick up',
    paid_date: '2026-03-27',
    payment_method: 'cash',
    payment_history: [
      { date: '2026-03-22', amount: 1158, notes: '', payment_method: 'cash' },
      { date: '2026-03-27', amount: 27, notes: '', payment_method: '' },
    ],
    created_at: '2026-03-21T11:10:41.023Z',
    // INV0017 has DIFFERENT line items from its quote
    custom_line_items: [
      { description: 'Red Centrepieces', total: 200, quantity: 5, notes: '', unit_price: 40 },
      { description: 'Red Pilar Flowers set', total: 750, quantity: 5, notes: '', unit_price: 150 },
      { description: 'Red Sand Candles', total: 100, quantity: 5, notes: '5 gold Candlelabras', unit_price: 20 },
      { description: 'Backdrop +vinyl', total: 135, quantity: 1, notes: '', unit_price: 135 },
    ],
  },
  {
    invoice_number: 'INV0016',
    linked_quote: 'Q0037',
    customer_base44: '69aabe3a3fd209b4dc083981',
    title: '',
    total: 391,
    subtotal: 391,
    amount_paid: 391,
    balance_due: 0,
    deposit_amount: 78.2,
    deposit_percentage: 20,
    discount_amount: 0,
    gst_amount: 0,
    status: 'completed',
    issue_date: '2026-03-10',
    due_date: '2026-03-11',
    event_date: '2026-03-11',
    event_location: '7a Allison Avenue Eumemmering, Vic',
    paid_date: '2026-03-10',
    payment_method: 'cash',
    payment_history: [{ date: '2026-03-10', amount: 391, notes: '', payment_method: 'cash' }],
    created_at: '2026-03-10T10:58:37.154Z',
    use_quote_line_items: 'Q0037',
  },
  {
    invoice_number: 'INV0012',
    linked_quote: 'Q0035',
    customer_base44: '69919e22a2a22a9c291daba7',
    title: 'TRADITIONAL WEDDING',
    total: 6200,
    subtotal: 6200,
    amount_paid: 1075,
    balance_due: 5125,
    deposit_amount: 1240,
    deposit_percentage: 20,
    discount_amount: 0,
    gst_amount: 0,
    status: 'partially_paid',
    issue_date: '2026-03-02',
    due_date: '2026-05-16',
    event_date: '2026-05-16',
    event_location: 'ST ALBANS',
    paid_date: null,
    payment_method: 'bank_transfer',
    payment_history: [{ date: '2026-03-02', amount: 1075, notes: '1075 deposit Made to Ideal Decor and $925 deposit for chairs to Max events', payment_method: 'bank_transfer' }],
    created_at: '2026-03-01T21:29:38.244Z',
    use_quote_line_items: 'Q0035',
  },
  {
    invoice_number: 'INV0010',
    linked_quote: 'Q0022',
    customer_base44: '698c70308f1dfc612630e926',
    title: 'Bridal Shower Quote',
    total: 1850,
    subtotal: 1850,
    amount_paid: 0,
    balance_due: 1850,
    deposit_amount: 370,
    deposit_percentage: 20,
    discount_amount: 100,
    gst_amount: 0,
    status: 'unpaid',
    issue_date: '2026-02-14',
    due_date: '2026-02-28',
    event_date: null,
    event_location: '',
    paid_date: null,
    payment_method: null,
    payment_history: [],
    created_at: '2026-02-14T04:39:25.299Z',
    use_quote_line_items: 'Q0022',
  },
];

// ===========================================
// MIGRATION
// ===========================================
async function migrate() {
  console.log('=== Quotes & Invoices Migration ===\n');

  // ------------------------------------------
  // Step 1: Fetch all customers from Supabase
  // ------------------------------------------
  console.log('Step 1: Fetching customers from Supabase...');
  const { data: customers, error: custError } = await supabase
    .from('customers')
    .select('id, email, contact_name');

  if (custError || !customers) {
    console.error('Failed to fetch customers:', custError?.message);
    process.exit(1);
  }

  console.log(`  Found ${customers.length} customers\n`);

  // Build Base44 ID -> Supabase UUID lookup
  const customerIdMap: Record<string, string> = {};
  for (const [base44Id, email] of Object.entries(base44CustomerMap)) {
    const match = customers.find(
      (c) => c.email.toLowerCase() === email.toLowerCase()
    );
    if (match) {
      customerIdMap[base44Id] = match.id;
      console.log(`  Mapped: ${base44Id} -> ${match.contact_name} (${match.id.slice(0, 8)}...)`);
    } else {
      console.warn(`  WARNING: No customer found for email ${email} (Base44 ID: ${base44Id})`);
    }
  }

  console.log('');

  // ------------------------------------------
  // Step 2: Insert quotes
  // ------------------------------------------
  console.log('Step 2: Inserting quotes...');

  // Maps: quote_number -> Supabase quote ID, and quote_number -> line_items (for reuse by invoices)
  const quoteIdMap: Record<string, string> = {};
  const quoteLineItemsMap: Record<string, any[]> = {};
  let quoteSuccess = 0;
  let quoteErrors = 0;

  for (const q of quotesData) {
    const customerId = customerIdMap[q.customer_base44];
    if (!customerId) {
      console.error(`  SKIP ${q.quote_number}: no customer mapping for ${q.customer_base44}`);
      quoteErrors++;
      continue;
    }

    const lineItems = processLineItems(q.line_items);
    quoteLineItemsMap[q.quote_number] = lineItems;

    const row = {
      quote_number: q.quote_number,
      customer_id: customerId,
      title: q.title,
      event_date: q.event_date,
      event_location: q.event_location || null,
      line_items: lineItems,
      photos: [],
      subtotal: q.subtotal,
      discount_type: q.discount_type,
      discount_value: q.discount_value,
      discount_amount: q.discount_amount,
      include_gst: q.include_gst,
      gst_amount: q.gst_amount,
      total: q.total,
      deposit_percentage: q.deposit_percentage,
      deposit_amount: q.deposit_amount,
      status: q.status,
      valid_until: q.valid_until,
      notes: q.notes,
      converted_to_invoice: q.converted_to_invoice,
      view_history: [],
      created_at: q.created_at,
    };

    const { data, error } = await supabase
      .from('quotes')
      .insert(row)
      .select('id')
      .single();

    if (error) {
      console.error(`  FAILED ${q.quote_number}: ${error.message}`);
      quoteErrors++;
    } else {
      quoteIdMap[q.quote_number] = data.id;
      console.log(`  OK ${q.quote_number}: "${q.title}" -> ${data.id.slice(0, 8)}...`);
      quoteSuccess++;
    }
  }

  console.log(`\n  Quotes — Success: ${quoteSuccess}, Failed: ${quoteErrors}\n`);

  // ------------------------------------------
  // Step 3: Insert invoices (linked to quotes)
  // ------------------------------------------
  console.log('Step 3: Inserting invoices...');

  const invoiceIdMap: Record<string, string> = {}; // invoice_number -> Supabase invoice ID
  const invoiceToQuoteMap: Record<string, string> = {}; // invoice's linked_quote -> invoice Supabase ID
  let invoiceSuccess = 0;
  let invoiceErrors = 0;

  for (const inv of invoicesData) {
    const customerId = customerIdMap[inv.customer_base44];
    if (!customerId) {
      console.error(`  SKIP ${inv.invoice_number}: no customer mapping for ${inv.customer_base44}`);
      invoiceErrors++;
      continue;
    }

    const quoteId = quoteIdMap[inv.linked_quote] || null;
    if (!quoteId) {
      console.warn(`  WARNING ${inv.invoice_number}: quote ${inv.linked_quote} not found in Supabase, linking will be skipped`);
    }

    // Determine line items: use custom if specified, otherwise copy from quote
    let lineItems: any[];
    if (inv.custom_line_items) {
      lineItems = processLineItems(inv.custom_line_items);
    } else if (inv.use_quote_line_items && quoteLineItemsMap[inv.use_quote_line_items]) {
      // Re-process to get fresh UUIDs for the invoice copy
      const sourceQuote = quotesData.find((q) => q.quote_number === inv.use_quote_line_items);
      lineItems = sourceQuote ? processLineItems(sourceQuote.line_items) : [];
    } else {
      lineItems = [];
    }

    const row = {
      invoice_number: inv.invoice_number,
      quote_id: quoteId,
      customer_id: customerId,
      title: inv.title,
      event_date: inv.event_date,
      event_location: inv.event_location || null,
      line_items: lineItems,
      subtotal: inv.subtotal,
      discount_amount: inv.discount_amount,
      gst_amount: inv.gst_amount,
      total: inv.total,
      deposit_percentage: inv.deposit_percentage,
      deposit_amount: inv.deposit_amount,
      amount_paid: inv.amount_paid,
      balance_due: inv.balance_due,
      payment_history: inv.payment_history,
      status: inv.status,
      issue_date: inv.issue_date,
      due_date: inv.due_date,
      paid_date: inv.paid_date,
      payment_method: inv.payment_method,
      created_at: inv.created_at,
    };

    const { data, error } = await supabase
      .from('invoices')
      .insert(row)
      .select('id')
      .single();

    if (error) {
      console.error(`  FAILED ${inv.invoice_number}: ${error.message}`);
      invoiceErrors++;
    } else {
      invoiceIdMap[inv.invoice_number] = data.id;
      invoiceToQuoteMap[inv.linked_quote] = data.id;
      console.log(`  OK ${inv.invoice_number}: "${inv.title}" -> ${data.id.slice(0, 8)}...`);
      invoiceSuccess++;
    }
  }

  console.log(`\n  Invoices — Success: ${invoiceSuccess}, Failed: ${invoiceErrors}\n`);

  // ------------------------------------------
  // Step 4: Update quotes with invoice_id
  // ------------------------------------------
  console.log('Step 4: Linking quotes to their invoices...');

  let linkSuccess = 0;
  let linkErrors = 0;

  for (const [quoteNumber, invoiceId] of Object.entries(invoiceToQuoteMap)) {
    const quoteId = quoteIdMap[quoteNumber];
    if (!quoteId) continue;

    const { error } = await supabase
      .from('quotes')
      .update({ invoice_id: invoiceId })
      .eq('id', quoteId);

    if (error) {
      console.error(`  FAILED linking ${quoteNumber}: ${error.message}`);
      linkErrors++;
    } else {
      console.log(`  OK ${quoteNumber} -> invoice ${invoiceId.slice(0, 8)}...`);
      linkSuccess++;
    }
  }

  console.log(`\n  Links — Success: ${linkSuccess}, Failed: ${linkErrors}\n`);

  // ------------------------------------------
  // Summary
  // ------------------------------------------
  console.log('=== Migration Complete ===');
  console.log(`  Quotes:   ${quoteSuccess} inserted, ${quoteErrors} failed`);
  console.log(`  Invoices: ${invoiceSuccess} inserted, ${invoiceErrors} failed`);
  console.log(`  Links:    ${linkSuccess} set, ${linkErrors} failed`);
}

migrate().catch(console.error);
