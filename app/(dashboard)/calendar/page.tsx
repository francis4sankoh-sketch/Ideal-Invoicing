'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Calendar as BigCalendar, dateFnsLocalizer, Views } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enAU } from 'date-fns/locale/en-AU';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { Button } from '@/components/ui/button';
import { Input, Textarea, Select } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Appointment, Customer, Quote, Invoice } from '@/types';
import { Plus, CalendarDays, FileText, Receipt } from 'lucide-react';

const locales = { 'en-AU': enAU };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

type EventSource = 'appointment' | 'quote' | 'invoice';

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  source: EventSource;
  resource: Appointment | (Quote & { _source: 'quote' }) | (Invoice & { _source: 'invoice' });
}

const sourceColors: Record<EventSource, string> = {
  appointment: '#800020',
  quote: '#2563eb',    // blue for quotes
  invoice: '#16a34a',  // green for invoices
};

const statusColors: Record<string, string> = {
  scheduled: '#800020',
  in_progress: '#f59e0b',
  completed: '#22c55e',
  cancelled: '#9ca3af',
};

export default function CalendarPage() {
  const router = useRouter();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [bookingEvents, setBookingEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [saving, setSaving] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentView, setCurrentView] = useState<(typeof Views)[keyof typeof Views]>(Views.MONTH);
  const supabase = createClient();

  const [form, setForm] = useState({
    title: '',
    customer_id: '',
    start_time: '',
    end_time: '',
    location: '',
    notes: '',
    status: 'scheduled' as Appointment['status'],
  });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const [apptRes, custRes, quotesRes, invoicesRes] = await Promise.all([
      supabase.from('appointments').select('*').order('start_time'),
      supabase.from('customers').select('*').order('contact_name'),
      supabase.from('quotes').select('*, customer:customers(contact_name)').not('event_date', 'is', null).is('invoice_id', null),
      supabase.from('invoices').select('*, customer:customers(contact_name)').not('event_date', 'is', null),
    ]);
    setAppointments(apptRes.data || []);
    setCustomers(custRes.data || []);

    // Build quote events
    const quoteEvents: CalendarEvent[] = (quotesRes.data || []).map((q: Quote & { customer?: { contact_name: string } }) => {
      const eventDate = new Date(q.event_date + 'T09:00:00');
      const endDate = new Date(q.event_date + 'T18:00:00');
      const customerName = q.customer?.contact_name || 'Unknown';
      const statusLabel = q.status.charAt(0).toUpperCase() + q.status.slice(1);
      return {
        id: `quote-${q.id}`,
        title: `📋 ${q.title || 'Quote ' + q.quote_number} — ${customerName} (${statusLabel})`,
        start: eventDate,
        end: endDate,
        source: 'quote' as EventSource,
        resource: { ...q, _source: 'quote' as const },
      };
    });

    // Build invoice events
    const invoiceEvents: CalendarEvent[] = (invoicesRes.data || []).map((inv: Invoice & { customer?: { contact_name: string } }) => {
      const eventDate = new Date(inv.event_date + 'T09:00:00');
      const endDate = new Date(inv.event_date + 'T18:00:00');
      const customerName = inv.customer?.contact_name || 'Unknown';
      const statusLabel = inv.status.charAt(0).toUpperCase() + inv.status.replace('_', ' ').slice(1);
      return {
        id: `invoice-${inv.id}`,
        title: `🧾 ${inv.title || 'Invoice ' + inv.invoice_number} — ${customerName} (${statusLabel})`,
        start: eventDate,
        end: endDate,
        source: 'invoice' as EventSource,
        resource: { ...inv, _source: 'invoice' as const },
      };
    });

    setBookingEvents([...quoteEvents, ...invoiceEvents]);
    setLoading(false);
  };

  // Appointment events
  const appointmentEvents: CalendarEvent[] = appointments.map((a) => ({
    id: a.id,
    title: a.title,
    start: new Date(a.start_time),
    end: new Date(a.end_time),
    source: 'appointment' as EventSource,
    resource: a,
  }));

  // Combine all events
  const events = [...appointmentEvents, ...bookingEvents];

  const eventStyleGetter = (event: CalendarEvent) => {
    let bg = sourceColors[event.source] || '#800020';
    // For appointments, use status-based color
    if (event.source === 'appointment' && 'status' in event.resource) {
      bg = statusColors[(event.resource as Appointment).status] || '#800020';
    }
    return {
      style: {
        backgroundColor: bg,
        borderRadius: '4px',
        color: 'white',
        border: 'none',
        fontSize: '0.8rem',
      },
    };
  };

  const openNew = (slotInfo?: { start: Date; end: Date }) => {
    setSelectedAppointment(null);
    const now = slotInfo?.start || new Date();
    const end = slotInfo?.end || new Date(now.getTime() + 60 * 60 * 1000);
    setForm({
      title: '',
      customer_id: '',
      start_time: toLocalDatetime(now),
      end_time: toLocalDatetime(end),
      location: '',
      notes: '',
      status: 'scheduled',
    });
    setModalOpen(true);
  };

  const openEdit = (event: CalendarEvent) => {
    // If it's a quote or invoice event, navigate to that record
    if (event.source === 'quote') {
      const q = event.resource as Quote & { _source: string };
      router.push(`/quotes/${q.id}`);
      return;
    }
    if (event.source === 'invoice') {
      const inv = event.resource as Invoice & { _source: string };
      router.push(`/invoices/${inv.id}`);
      return;
    }
    // Otherwise it's an appointment — open the edit modal
    const a = event.resource as Appointment;
    setSelectedAppointment(a);
    setForm({
      title: a.title,
      customer_id: a.customer_id || '',
      start_time: toLocalDatetime(new Date(a.start_time)),
      end_time: toLocalDatetime(new Date(a.end_time)),
      location: a.location || '',
      notes: a.notes || '',
      status: a.status,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.title || !form.start_time || !form.end_time) return;
    setSaving(true);

    const payload = {
      title: form.title,
      customer_id: form.customer_id || null,
      start_time: new Date(form.start_time).toISOString(),
      end_time: new Date(form.end_time).toISOString(),
      location: form.location || null,
      notes: form.notes || null,
      status: form.status,
    };

    if (selectedAppointment) {
      await supabase.from('appointments').update(payload).eq('id', selectedAppointment.id);
    } else {
      await supabase.from('appointments').insert(payload);
    }

    setModalOpen(false);
    setSaving(false);
    loadData();
  };

  const handleDelete = async () => {
    if (!selectedAppointment || !confirm('Delete this appointment?')) return;
    await supabase.from('appointments').delete().eq('id', selectedAppointment.id);
    setModalOpen(false);
    loadData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary)]" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => openNew()}>
          <Plus className="w-4 h-4" /> New Appointment
        </Button>
      </div>

      <div className="bg-white dark:bg-[#1a1a1a] rounded-lg border border-[var(--color-border)] p-4" style={{ height: 'calc(100vh - 220px)' }}>
        <BigCalendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          date={currentDate}
          view={currentView}
          onNavigate={(date) => setCurrentDate(date)}
          onView={(view) => setCurrentView(view)}
          views={[Views.MONTH, Views.WEEK, Views.DAY]}
          eventPropGetter={eventStyleGetter}
          onSelectEvent={openEdit}
          onSelectSlot={openNew}
          selectable
          popup
          style={{ height: '100%' }}
        />
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-sm text-[var(--color-text-muted)]">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: sourceColors.quote }} />
          <span>Quotes (event date)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: sourceColors.invoice }} />
          <span>Invoices (event date)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: sourceColors.appointment }} />
          <span>Appointments</span>
        </div>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={selectedAppointment ? 'Edit Appointment' : 'New Appointment'}
        size="lg"
      >
        <div className="space-y-4">
          <Input label="Title *" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <Select label="Customer" value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })}>
            <option value="">No customer linked</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.contact_name}</option>
            ))}
          </Select>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Start *" type="datetime-local" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
            <Input label="End *" type="datetime-local" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
          </div>
          <Input label="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          <Select label="Status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Appointment['status'] })}>
            <option value="scheduled">Scheduled</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </Select>
          <Textarea label="Notes" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>
        <div className="flex justify-between mt-6">
          <div>
            {selectedAppointment && (
              <Button variant="danger" size="sm" onClick={handleDelete}>Delete</Button>
            )}
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} loading={saving}>
              {selectedAppointment ? 'Update' : 'Create'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function toLocalDatetime(d: Date): string {
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}
