'use client';

import { useState } from 'react';
import { pdf } from '@react-pdf/renderer';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { Quote, Invoice, Customer, BusinessSettings } from '@/types';
import { QuotePDF } from '@/lib/pdf/quote-pdf';
import { InvoicePDF } from '@/lib/pdf/invoice-pdf';

interface PDFDownloadButtonProps {
  type: 'quote' | 'invoice';
  data: Quote | Invoice;
  customer?: Customer | null;
  settings: BusinessSettings;
  variant?: 'default' | 'outline';
  size?: 'sm' | 'md';
}

export function PDFDownloadButton({ type, data, customer, settings, variant = 'outline', size = 'sm' }: PDFDownloadButtonProps) {
  const [generating, setGenerating] = useState(false);

  const handleDownload = async () => {
    setGenerating(true);
    try {
      // Attach customer to data if provided separately
      const dataWithCustomer = customer ? { ...data, customer } : data;

      const doc = type === 'quote'
        ? <QuotePDF quote={dataWithCustomer as Quote} settings={settings} />
        : <InvoicePDF invoice={dataWithCustomer as Invoice} settings={settings} />;

      const blob = await pdf(doc).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const number = type === 'quote' ? (data as Quote).quote_number : (data as Invoice).invoice_number;
      link.href = url;
      link.download = `${number}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('PDF generation failed:', err);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Button variant={variant} size={size} onClick={handleDownload} loading={generating}>
      <Download className="w-3.5 h-3.5" /> Download PDF
    </Button>
  );
}
