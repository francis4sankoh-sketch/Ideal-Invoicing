export interface Customer {
  id: string;
  business_name: string | null;
  contact_name: string;
  email: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postcode: string | null;
  notes: string | null;
  portal_token: string;
  created_at: string;
  updated_at: string;
}

export interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
  notes: string;
  photos: string[];
}

export interface Quote {
  id: string;
  quote_number: string;
  customer_id: string;
  title: string;
  event_date: string | null;
  event_location: string | null;
  line_items: LineItem[];
  photos: string[];
  subtotal: number;
  discount_type: 'percentage' | 'fixed' | null;
  discount_value: number;
  discount_amount: number;
  include_gst: boolean;
  gst_amount: number;
  total: number;
  deposit_percentage: number;
  deposit_amount: number;
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';
  valid_until: string | null;
  notes: string | null;
  terms: string | null;
  converted_to_invoice: boolean;
  invoice_id: string | null;
  view_history: string[];
  last_viewed: string | null;
  created_at: string;
  updated_at: string;
  customer?: Customer;
}

export interface PaymentRecord {
  date: string;
  amount: number;
  payment_method: string;
  notes: string;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  quote_id: string | null;
  customer_id: string;
  title: string;
  event_date: string | null;
  event_location: string | null;
  line_items: LineItem[];
  subtotal: number;
  discount_amount: number;
  gst_amount: number;
  total: number;
  deposit_percentage: number;
  deposit_amount: number;
  amount_paid: number;
  balance_due: number;
  payment_history: PaymentRecord[];
  status: 'unpaid' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled';
  issue_date: string | null;
  due_date: string | null;
  paid_date: string | null;
  payment_method: string | null;
  notes: string | null;
  last_reminder_sent: string | null;
  view_history: string[];
  last_viewed: string | null;
  created_at: string;
  updated_at: string;
  customer?: Customer;
}

export interface QuoteMessage {
  id: string;
  quote_id: string;
  sender_type: 'business' | 'customer';
  sender_name: string | null;
  message: string;
  read: boolean;
  created_at: string;
}

export interface ColorVariant {
  color_name: string;
  hex_code: string;
  photos: string[];
}

export interface Product {
  id: string;
  name: string;
  description: string | null;
  photos: string[];
  default_price: number;
  gst_inclusive: boolean;
  category: string | null;
  has_color_variants: boolean;
  color_variants: ColorVariant[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Appointment {
  id: string;
  title: string;
  customer_id: string | null;
  start_time: string;
  end_time: string;
  location: string | null;
  notes: string | null;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  quote_id: string | null;
  invoice_id: string | null;
  google_calendar_event_id: string | null;
  created_at: string;
  updated_at: string;
  customer?: Customer;
}

export interface Expense {
  id: string;
  description: string;
  category: 'materials' | 'labour' | 'equipment' | 'transport' | 'overhead' | 'other';
  amount: number;
  date: string;
  appointment_id: string | null;
  purchase_order_id: string | null;
  quote_id: string | null;
  invoice_id: string | null;
  receipt_url: string | null;
  notes: string | null;
  status: 'pending' | 'paid' | 'overdue';
  created_at: string;
  updated_at: string;
}

export interface PurchaseOrderItem {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface PurchaseOrder {
  id: string;
  order_number: string;
  supplier: string;
  appointment_id: string | null;
  items: PurchaseOrderItem[];
  subtotal: number;
  gst_amount: number;
  total: number;
  status: 'draft' | 'ordered' | 'received' | 'cancelled';
  order_date: string | null;
  expected_delivery: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuoteTemplate {
  id: string;
  name: string;
  type: 'quote' | 'invoice';
  title: string | null;
  line_items: LineItem[];
  discount_type: string | null;
  discount_value: number | null;
  notes: string | null;
  terms: string | null;
  created_at: string;
}

export interface BusinessSettings {
  id: string;
  business_name: string;
  abn: string | null;
  logo_url: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postcode: string | null;
  website: string | null;
  default_payment_terms: number;
  default_quote_validity: number;
  default_terms: string | null;
  quote_prefix: string;
  invoice_prefix: string;
  next_quote_number: number;
  next_invoice_number: number;
  brand_color: string;
  accent_color: string;
  font_family: string;
  bank_name: string | null;
  account_name: string | null;
  bsb: string | null;
  account_number: string | null;
  bank_reference_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface WebsiteEnquiry {
  id: string;
  customer_id: string | null;
  quote_id: string | null;
  name: string;
  email: string;
  phone: string | null;
  event_type: string | null;
  event_date: string | null;
  event_location: string | null;
  guest_count: string | null;
  budget_range: string | null;
  venue_access: string | null;
  selected_items: EnquiryItem[];
  additional_notes: string | null;
  status: 'new' | 'converted' | 'dismissed';
  source: string;
  created_at: string;
}

export interface EnquiryItem {
  product_id?: string;
  product_name: string;
  quantity: number;
  unit_price: number;
}

export type AustralianState = 'NSW' | 'VIC' | 'QLD' | 'WA' | 'SA' | 'TAS' | 'ACT' | 'NT';

export const AUSTRALIAN_STATES: AustralianState[] = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'];

export const EXPENSE_CATEGORIES = ['materials', 'labour', 'equipment', 'transport', 'overhead', 'other'] as const;

export const PAYMENT_METHODS = ['bank_transfer', 'cash', 'card', 'other'] as const;
