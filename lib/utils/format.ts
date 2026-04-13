import { format, parseISO } from 'date-fns';

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatDateAU(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'dd/MM/yyyy');
}

export function formatDateDocument(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'd MMMM yyyy');
}

export function formatDatetime(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'dd/MM/yyyy h:mm a');
}

export function classNames(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function getStatusColor(status: string): { bg: string; text: string } {
  const colors: Record<string, { bg: string; text: string }> = {
    draft: { bg: 'bg-gray-100', text: 'text-gray-700' },
    sent: { bg: 'bg-blue-100', text: 'text-blue-700' },
    accepted: { bg: 'bg-green-100', text: 'text-green-700' },
    rejected: { bg: 'bg-red-100', text: 'text-red-700' },
    expired: { bg: 'bg-orange-100', text: 'text-orange-700' },
    unpaid: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
    partially_paid: { bg: 'bg-blue-100', text: 'text-blue-700' },
    paid: { bg: 'bg-green-100', text: 'text-green-700' },
    overdue: { bg: 'bg-red-100', text: 'text-red-700' },
    cancelled: { bg: 'bg-gray-100', text: 'text-gray-500' },
    scheduled: { bg: 'bg-purple-100', text: 'text-purple-700' },
    in_progress: { bg: 'bg-amber-100', text: 'text-amber-700' },
    completed: { bg: 'bg-green-100', text: 'text-green-700' },
    pending: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
    new: { bg: 'bg-blue-100', text: 'text-blue-700' },
    converted: { bg: 'bg-green-100', text: 'text-green-700' },
    dismissed: { bg: 'bg-gray-100', text: 'text-gray-500' },
    ordered: { bg: 'bg-blue-100', text: 'text-blue-700' },
    received: { bg: 'bg-green-100', text: 'text-green-700' },
  };
  return colors[status] || { bg: 'bg-gray-100', text: 'text-gray-700' };
}

export function getStatusLabel(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function generateId(): string {
  return crypto.randomUUID();
}
