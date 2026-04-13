# Ideal Invoicing

Business management application for **Ideal Events Group** — an Australian event styling and decor hire business based in Melbourne, Victoria.

## Tech Stack

- **Framework:** Next.js (App Router) with TypeScript
- **Styling:** Tailwind CSS
- **Database:** Supabase (PostgreSQL)
- **Auth:** Supabase Auth + token-based customer portal
- **Email:** Resend API
- **Calendar:** react-big-calendar
- **Icons:** lucide-react
- **Hosting:** Vercel

## Getting Started

### 1. Clone and install

```bash
git clone https://github.com/YOUR_USERNAME/ideal-invoicing.git
cd ideal-invoicing
npm install
```

### 2. Set up Supabase

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the migration file: `supabase/migrations/001_initial_schema.sql`
3. Go to **Storage** and create these buckets (set all to public):
   - `logos`
   - `products`
   - `quotes`
   - `receipts`
4. Go to **Authentication > Settings** and add a user for yourself

### 3. Configure environment variables

Copy `.env.example` to `.env.local` and fill in:

```bash
cp .env.example .env.local
```

| Variable | Where to find it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase > Settings > API > Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase > Settings > API > anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase > Settings > API > service_role key |
| `RESEND_API_KEY` | [resend.com](https://resend.com) > API Keys |
| `NEXT_PUBLIC_APP_URL` | Your deployment URL (e.g. `https://ideal-invoicing.vercel.app`) |
| `ENQUIRY_API_SECRET` | Generate a random string for website integration security |

### 4. Run the migration script

```bash
npx tsx scripts/migrate-data.ts
```

This inserts the 12 existing customers into the database.

### 5. Start development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Deployment (Vercel)

1. Push to GitHub
2. Import the repo in [Vercel](https://vercel.com)
3. Add all environment variables from `.env.local`
4. Deploy

## Features

- **Customers** — Full CRM with portal access tokens
- **Quotes** — Builder with product picker, line items, photos, GST, discounts, deposits
- **Invoices** — Generated from accepted quotes, payment tracking, email reminders
- **Calendar** — Appointment scheduling with colour-coded statuses
- **Products** — Library with photos, categories, colour variants
- **Expenses** — Categorised expense tracking with receipt uploads
- **Purchase Orders** — Supplier order management
- **Customer Portal** — Token-based portal for customers to view quotes/invoices, accept/reject, and message
- **Email Notifications** — 8 email templates via Resend API
- **Dashboard** — Revenue metrics, activity feed, quick actions
- **Dark Mode** — Full dark mode support

## Website Integration

### Enquiry API

```
POST /api/enquiry
Header: x-api-secret: YOUR_SECRET

Body: {
  name, email, phone?, event_type?, event_date?,
  event_location?, guest_count?, selected_items[], additional_notes?
}
```

### Products API

```
GET /api/products
GET /api/products?category=chairs
```

### Website Integration Instructions

To connect the Ideal Events Group Netlify website:

1. **Quote request form:** On form submission, POST to `https://YOUR_DOMAIN/api/enquiry` with the `x-api-secret` header
2. **Product listings:** Fetch `https://YOUR_DOMAIN/api/products` to display live products
3. **Add to Quote cart:** Collect items in a cart, then submit to `/api/enquiry` with `selected_items` array

## Australian Requirements

- Currency: AUD ($)
- GST: 10%
- ABN displayed on invoices
- BSB + Account Number format
- Australian states dropdown
- Date format: DD/MM/YYYY (UI), DD Month YYYY (documents)
- Default timezone: Australia/Melbourne

---

Built for Ideal Events Group - Melbourne, Victoria - 2026
