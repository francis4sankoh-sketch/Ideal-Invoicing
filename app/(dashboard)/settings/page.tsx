'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input, Textarea, Select } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { AUSTRALIAN_STATES, BusinessSettings } from '@/types';
import { invalidate } from '@/lib/utils/cache';
import { orgFolder } from '@/lib/org/client';
import { Save, Upload, Copy, CalendarPlus } from 'lucide-react';

export default function SettingsPage() {
  const [settings, setSettings] = useState<BusinessSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const supabase = createClient();

  const [calendarUrl, setCalendarUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [org, setOrg] = useState<{ id: string; enquiry_api_key: string } | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [welcome, setWelcome] = useState(false);

  const copyText = async (field: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  useEffect(() => {
    loadSettings();
    setWelcome(new URLSearchParams(window.location.search).get('welcome') === '1');
    supabase
      .from('organizations')
      .select('id, enquiry_api_key')
      .maybeSingle()
      .then(({ data }) => data && setOrg(data));
    fetch('/api/calendar/link')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.url && setCalendarUrl(d.url))
      .catch(() => {});
  }, []);

  const webcalUrl = calendarUrl?.replace(/^https?:\/\//, 'webcal://') || '';

  const copyCalendarUrl = async () => {
    if (!calendarUrl) return;
    await navigator.clipboard.writeText(calendarUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const loadSettings = async () => {
    const { data } = await supabase.from('business_settings').select('*').limit(1).single();
    if (data) setSettings(data);
    setLoading(false);
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    setMessage('');

    const { error } = await supabase
      .from('business_settings')
      .update(settings)
      .eq('id', settings.id);

    if (error) {
      setMessage('Error saving settings: ' + error.message);
    } else {
      invalidate('business_settings'); // so other pages pick up the change
      setMessage('Settings saved successfully!');
    }
    setSaving(false);
    setTimeout(() => setMessage(''), 3000);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !settings) return;

    const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '');
    let path: string;
    try {
      path = `${await orgFolder(supabase)}/logo-${Date.now()}.${ext}`;
    } catch (err) {
      setMessage('Error uploading logo: ' + (err instanceof Error ? err.message : String(err)));
      return;
    }

    const { error } = await supabase.storage.from('Logos').upload(path, file);
    if (error) {
      setMessage('Error uploading logo: ' + error.message);
      return;
    }

    const { data: { publicUrl } } = supabase.storage.from('Logos').getPublicUrl(path);
    setSettings({ ...settings, logo_url: publicUrl });
  };

  const update = (field: keyof BusinessSettings, value: string | number) => {
    if (!settings) return;
    setSettings({ ...settings, [field]: value } as BusinessSettings);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary)]" />
      </div>
    );
  }

  if (!settings) return <p>Unable to load settings.</p>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {message && (
        <div
          className={`p-3 rounded-md text-sm ${
            message.startsWith('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
          }`}
        >
          {message}
        </div>
      )}

      {welcome && (
        <div className="p-4 rounded-md text-sm bg-green-50 text-green-800">
          Your business is set up. Add your contact details, logo, bank details and terms below, then press Save
          Settings. These go on every quote and invoice you send.
        </div>
      )}

      {/* Business Profile */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-bold" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
            Business Profile
          </h3>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Business Name" value={settings.business_name} onChange={(e) => update('business_name', e.target.value)} />
            <Input label="ABN" value={settings.abn || ''} onChange={(e) => update('abn', e.target.value)} />
            <Input label="Email" type="email" value={settings.email || ''} onChange={(e) => update('email', e.target.value)} />
            <Input label="Phone" value={settings.phone || ''} onChange={(e) => update('phone', e.target.value)} />
            <Input label="Website" value={settings.website || ''} onChange={(e) => update('website', e.target.value)} />
            <div className="md:col-span-2">
              <Input label="Address" value={settings.address || ''} onChange={(e) => update('address', e.target.value)} />
            </div>
            <Input label="City" value={settings.city || ''} onChange={(e) => update('city', e.target.value)} />
            <Select label="State" value={settings.state || ''} onChange={(e) => update('state', e.target.value)}>
              <option value="">Select state...</option>
              {AUSTRALIAN_STATES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </Select>
            <Input label="Postcode" value={settings.postcode || ''} onChange={(e) => update('postcode', e.target.value)} />
          </div>

          {/* Logo Upload */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-[var(--color-text)] mb-2">Logo</label>
            <div className="flex items-center gap-4">
              {settings.logo_url && (
                <img src={settings.logo_url} alt="Logo" className="h-16 w-auto rounded" />
              )}
              <label className="cursor-pointer">
                <div className="flex items-center gap-2 px-4 py-2 border border-[var(--color-border)] rounded-md text-sm hover:bg-[var(--color-bg-light)] transition-colors">
                  <Upload className="w-4 h-4" />
                  Upload Logo
                </div>
                <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bank Details */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-bold" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
            Bank Details
          </h3>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Bank Name" value={settings.bank_name || ''} onChange={(e) => update('bank_name', e.target.value)} />
            <Input label="Account Name" value={settings.account_name || ''} onChange={(e) => update('account_name', e.target.value)} />
            <Input label="BSB" value={settings.bsb || ''} onChange={(e) => update('bsb', e.target.value)} />
            <Input label="Account Number" value={settings.account_number || ''} onChange={(e) => update('account_number', e.target.value)} />
            <div className="md:col-span-2">
              <Input label="Payment Reference Note" value={settings.bank_reference_note || ''} onChange={(e) => update('bank_reference_note', e.target.value)} placeholder="e.g. Please use your invoice number as reference" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Defaults */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-bold" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
            Defaults
          </h3>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Payment Terms (days)" type="number" value={settings.default_payment_terms} onChange={(e) => update('default_payment_terms', parseInt(e.target.value) || 14)} />
            <Input label="Quote Validity (days)" type="number" value={settings.default_quote_validity} onChange={(e) => update('default_quote_validity', parseInt(e.target.value) || 30)} />
          </div>
          <div className="mt-4">
            <Textarea label="Default Terms & Conditions" rows={4} value={settings.default_terms || ''} onChange={(e) => update('default_terms', e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* Numbering */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-bold" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
            Numbering
          </h3>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Quote Prefix" value={settings.quote_prefix} onChange={(e) => update('quote_prefix', e.target.value)} />
            <Input label="Next Quote Number" type="number" value={settings.next_quote_number} onChange={(e) => update('next_quote_number', parseInt(e.target.value) || 1001)} />
            <Input label="Invoice Prefix" value={settings.invoice_prefix} onChange={(e) => update('invoice_prefix', e.target.value)} />
            <Input label="Next Invoice Number" type="number" value={settings.next_invoice_number} onChange={(e) => update('next_invoice_number', parseInt(e.target.value) || 1001)} />
          </div>
        </CardContent>
      </Card>

      {/* Branding */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-bold" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
            Branding
          </h3>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--color-text)] mb-1">Primary Colour</label>
              <div className="flex items-center gap-2">
                <input type="color" value={settings.brand_color} onChange={(e) => update('brand_color', e.target.value)} className="w-10 h-10 rounded border border-[var(--color-border)] cursor-pointer" />
                <span className="text-sm text-[var(--color-text-muted)]">{settings.brand_color}</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text)] mb-1">Accent Colour</label>
              <div className="flex items-center gap-2">
                <input type="color" value={settings.accent_color} onChange={(e) => update('accent_color', e.target.value)} className="w-10 h-10 rounded border border-[var(--color-border)] cursor-pointer" />
                <span className="text-sm text-[var(--color-text-muted)]">{settings.accent_color}</span>
              </div>
            </div>
            <Select label="Font Family" value={settings.font_family} onChange={(e) => update('font_family', e.target.value)}>
              <option value="Libre Baskerville">Libre Baskerville</option>
              <option value="Inter">Inter</option>
              <option value="Georgia">Georgia</option>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Calendar sync */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-bold" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
            Calendar Sync
          </h3>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-[var(--color-text-muted)]">
            Show your confirmed events in Google Calendar or Apple Calendar. New bookings, date changes and
            cancellations update automatically, usually within a few hours. Keep this link private: anyone with it can
            see your events.
          </p>
          {calendarUrl ? (
            <>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={calendarUrl}
                  onFocus={(e) => e.target.select()}
                  className="flex-1 min-w-0 px-3 py-2 border border-[var(--color-border)] rounded-md text-xs bg-[var(--color-bg-light)] text-[var(--color-text)]"
                />
                <Button variant="outline" size="sm" onClick={copyCalendarUrl}>
                  <Copy className="w-3.5 h-3.5" /> {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <a
                  href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcalUrl)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button variant="outline" size="sm">
                    <CalendarPlus className="w-3.5 h-3.5" /> Add to Google Calendar
                  </Button>
                </a>
                <a href={webcalUrl}>
                  <Button variant="outline" size="sm">
                    <CalendarPlus className="w-3.5 h-3.5" /> Add to Apple Calendar
                  </Button>
                </a>
              </div>
              <p className="text-xs text-[var(--color-text-muted)]">
                On iPhone, open this page in Safari and tap Add to Apple Calendar, or go to Settings, Calendar,
                Accounts, Add Account, Other, Add Subscribed Calendar and paste the link.
              </p>
            </>
          ) : (
            <p className="text-sm text-[var(--color-text-muted)]">The calendar link isn&apos;t set up yet.</p>
          )}
        </CardContent>
      </Card>

      {/* Website connection */}
      {org && (
        <Card>
          <CardHeader>
            <h3 className="text-lg font-bold" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
              Connect Your Website
            </h3>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-[var(--color-text-muted)]">
              Your website can send enquiries straight into the app. Each one creates a customer and a draft invoice,
              and you get an email. Give these details to whoever looks after your website. Keep the secret key private.
            </p>
            {[
              { field: 'endpoint', label: 'Enquiry address (POST)', value: `${window.location.origin}/api/enquiry`, secret: false },
              { field: 'key', label: 'Secret key (send it in the x-api-secret header)', value: org.enquiry_api_key, secret: true },
              { field: 'products', label: 'Your product list (for showing products on your website)', value: `${window.location.origin}/api/products?business=${org.id}`, secret: false },
            ].map((row) => (
              <div key={row.field}>
                <p className="text-xs font-medium text-[var(--color-text-muted)] mb-1">{row.label}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <code className="flex-1 min-w-0 truncate rounded bg-[var(--color-bg-light)] px-2 py-1.5 text-xs">
                    {row.secret && !showKey ? '•'.repeat(24) : row.value}
                  </code>
                  {row.secret && (
                    <Button variant="outline" size="sm" onClick={() => setShowKey((v) => !v)}>
                      {showKey ? 'Hide' : 'Show'}
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => copyText(row.field, row.value)}>
                    <Copy className="w-3.5 h-3.5" /> {copiedField === row.field ? 'Copied' : 'Copy'}
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Save Button */}
      <div className="flex justify-end pb-8">
        <Button onClick={handleSave} loading={saving} size="lg">
          <Save className="w-4 h-4" />
          Save Settings
        </Button>
      </div>
    </div>
  );
}
