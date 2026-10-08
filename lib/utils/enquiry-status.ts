import type { SupabaseClient } from '@supabase/supabase-js';

// Moves the website enquiry behind an invoice forward: sent -> invoiced, fully paid -> completed.
// Never touches dismissed enquiries and never moves one backwards.
export function enquiryStatusFor(invoiceStatus: string): { target: string; from: string[] } | null {
  if (invoiceStatus === 'paid') return { target: 'completed', from: ['new', 'contacted', 'invoiced', 'converted'] };
  if (['unpaid', 'partially_paid', 'overdue'].includes(invoiceStatus)) {
    return { target: 'invoiced', from: ['new', 'contacted', 'converted'] };
  }
  return null;
}

export async function advanceEnquiryForInvoice(supabase: SupabaseClient, invoiceId: string, invoiceStatus: string) {
  const rule = enquiryStatusFor(invoiceStatus);
  if (!rule) return;
  const { error } = await supabase
    .from('website_enquiries')
    .update({ status: rule.target })
    .eq('invoice_id', invoiceId)
    .in('status', rule.from);
  if (error) console.error('Failed to update enquiry status:', error.message);
}
