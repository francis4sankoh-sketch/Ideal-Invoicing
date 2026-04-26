import React from 'react';
import { Document, Page, Text, View, Image } from '@react-pdf/renderer';
import { Invoice, BusinessSettings } from '@/types';
import { styles, BRAND, formatCurrencyPDF, formatDatePDF } from './shared-styles';

interface InvoicePDFProps {
  invoice: Invoice;
  settings: BusinessSettings;
}

export function InvoicePDF({ invoice, settings }: InvoicePDFProps) {
  const customer = invoice.customer;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoArea}>
            {settings.logo_url ? (
              <Image src={settings.logo_url} style={styles.logo} />
            ) : (
              <Text style={styles.businessName}>{settings.business_name}</Text>
            )}
            {settings.abn ? <Text style={styles.businessDetail}>ABN: {settings.abn}</Text> : null}
            {settings.address ? <Text style={styles.businessDetail}>{settings.address}</Text> : null}
            {(settings.city || settings.state || settings.postcode) ? (
              <Text style={styles.businessDetail}>
                {[settings.city, settings.state, settings.postcode].filter(Boolean).join(', ')}
              </Text>
            ) : null}
            {settings.phone ? <Text style={styles.businessDetail}>Ph: {settings.phone}</Text> : null}
            {settings.email ? <Text style={styles.businessDetail}>{settings.email}</Text> : null}
            {settings.website ? <Text style={styles.businessDetail}>{settings.website}</Text> : null}
          </View>
          <View style={styles.docTitleArea}>
            <Text style={styles.docTitle}>INVOICE</Text>
            <Text style={styles.docMeta}>
              Invoice No: <Text style={styles.docMetaValue}>{invoice.invoice_number}</Text>
            </Text>
            {invoice.issue_date ? (
              <Text style={styles.docMeta}>
                Issue Date: <Text style={styles.docMetaValue}>{formatDatePDF(invoice.issue_date)}</Text>
              </Text>
            ) : null}
            {invoice.due_date ? (
              <Text style={styles.docMeta}>
                Due Date: <Text style={styles.docMetaValue}>{formatDatePDF(invoice.due_date)}</Text>
              </Text>
            ) : null}
            <View style={[styles.statusBadge, { backgroundColor: getInvoiceStatusColor(invoice.status) }]}>
              <Text style={styles.statusBadgeText}>{invoice.status.replace('_', ' ')}</Text>
            </View>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Bill To + Event Details */}
        <View style={styles.infoRow}>
          <View style={styles.infoCol}>
            <Text style={styles.infoLabel}>Bill To</Text>
            {customer?.contact_name ? <Text style={styles.infoText}>{customer.contact_name}</Text> : null}
            {customer?.business_name ? <Text style={styles.infoTextMuted}>{customer.business_name}</Text> : null}
            {customer?.email ? <Text style={styles.infoTextMuted}>{customer.email}</Text> : null}
            {customer?.phone ? <Text style={styles.infoTextMuted}>{customer.phone}</Text> : null}
            {customer?.address ? <Text style={styles.infoTextMuted}>{customer.address}</Text> : null}
            {(customer?.city || customer?.state || customer?.postcode) ? (
              <Text style={styles.infoTextMuted}>
                {[customer?.city, customer?.state, customer?.postcode].filter(Boolean).join(', ')}
              </Text>
            ) : null}
          </View>
          {(invoice.title || invoice.event_date || invoice.event_location) ? (
            <View style={styles.infoCol}>
              <Text style={styles.infoLabel}>Event Details</Text>
              {invoice.title ? <Text style={styles.infoText}>{invoice.title}</Text> : null}
              {invoice.event_date ? <Text style={styles.infoTextMuted}>Date: {formatDatePDF(invoice.event_date)}</Text> : null}
              {invoice.event_location ? <Text style={styles.infoTextMuted}>Location: {invoice.event_location}</Text> : null}
            </View>
          ) : null}
        </View>

        {/* Line Items Table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderText, styles.colDescription]}>Description</Text>
            <Text style={[styles.tableHeaderText, styles.colQty]}>Qty</Text>
            <Text style={[styles.tableHeaderText, styles.colUnit]}>Unit Price</Text>
            <Text style={[styles.tableHeaderText, styles.colTotal]}>Total</Text>
          </View>
          {invoice.line_items.map((item, i) => (
            <View key={item.id} style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]} wrap={false}>
              <View style={styles.colDescription}>
                <Text style={styles.tableCell}>{item.description}</Text>
                {item.notes ? <Text style={styles.tableCellMuted}>{item.notes}</Text> : null}
                {item.photos && item.photos.length > 0 ? (
                  <View style={styles.photoRow}>
                    {item.photos.slice(0, 3).map((url, idx) => (
                      <Image key={idx} src={url} style={styles.photoThumb} />
                    ))}
                  </View>
                ) : null}
              </View>
              <Text style={[styles.tableCell, styles.colQty]}>{item.quantity}</Text>
              <Text style={[styles.tableCell, styles.colUnit]}>{formatCurrencyPDF(item.unit_price)}</Text>
              <Text style={[styles.tableCell, styles.colTotal]}>{formatCurrencyPDF(item.total)}</Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={styles.totalsContainer}>
          <View style={styles.totalsBox}>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Subtotal</Text>
              <Text style={styles.totalsValue}>{formatCurrencyPDF(invoice.subtotal)}</Text>
            </View>
            {invoice.discount_amount > 0 ? (
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>Discount</Text>
                <Text style={[styles.totalsValue, { color: '#dc2626' }]}>-{formatCurrencyPDF(invoice.discount_amount)}</Text>
              </View>
            ) : null}
            {invoice.gst_amount > 0 ? (
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>GST (10%)</Text>
                <Text style={styles.totalsValue}>{formatCurrencyPDF(invoice.gst_amount)}</Text>
              </View>
            ) : null}
            <View style={styles.totalsFinal}>
              <Text style={styles.totalsFinalLabel}>Total</Text>
              <Text style={styles.totalsFinalValue}>{formatCurrencyPDF(invoice.total)}</Text>
            </View>
            {invoice.deposit_amount > 0 ? (
              <View style={[styles.totalsRow, { marginTop: 4 }]}>
                <Text style={[styles.totalsLabel, { fontFamily: 'Helvetica-Bold' }]}>
                  Deposit Required ({invoice.deposit_percentage}%)
                </Text>
                <Text style={styles.totalsValue}>{formatCurrencyPDF(invoice.deposit_amount)}</Text>
              </View>
            ) : null}
            {invoice.amount_paid > 0 ? (
              <View style={styles.totalsRow}>
                <Text style={[styles.totalsLabel, { color: '#16a34a' }]}>Amount Paid</Text>
                <Text style={[styles.totalsValue, { color: '#16a34a' }]}>-{formatCurrencyPDF(invoice.amount_paid)}</Text>
              </View>
            ) : null}
            <View style={[styles.totalsRow, { marginTop: 4, paddingTop: 4, borderTopWidth: 1, borderTopColor: BRAND.border }]}>
              <Text style={[styles.totalsLabel, { fontFamily: 'Helvetica-Bold', fontSize: 10, color: BRAND.primary }]}>Balance Due</Text>
              <Text style={[styles.totalsValue, { fontSize: 10, color: BRAND.primary }]}>{formatCurrencyPDF(invoice.balance_due)}</Text>
            </View>
          </View>
        </View>

        {/* Payment History */}
        {invoice.payment_history && invoice.payment_history.length > 0 ? (
          <View wrap={false}>
            <Text style={styles.sectionTitle}>Payment History</Text>
            <View style={[styles.tableHeader, { marginTop: 4 }]}>
              <Text style={[styles.tableHeaderText, { width: '30%' }]}>Date</Text>
              <Text style={[styles.tableHeaderText, { width: '25%', textAlign: 'right' }]}>Amount</Text>
              <Text style={[styles.tableHeaderText, { width: '25%' }]}>Method</Text>
              <Text style={[styles.tableHeaderText, { width: '20%' }]}>Notes</Text>
            </View>
            {invoice.payment_history.map((p, i) => (
              <View key={i} style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}>
                <Text style={[styles.tableCell, { width: '30%' }]}>{formatDatePDF(p.date)}</Text>
                <Text style={[styles.tableCell, { width: '25%', textAlign: 'right', color: '#16a34a' }]}>{formatCurrencyPDF(p.amount)}</Text>
                <Text style={[styles.tableCell, { width: '25%' }]}>{p.payment_method.replace('_', ' ')}</Text>
                <Text style={[styles.tableCell, { width: '20%', color: BRAND.muted }]}>{p.notes || ''}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* Payment Details */}
        {(settings.bank_name || settings.bsb || settings.account_number) && invoice.balance_due > 0 ? (
          <View style={styles.paymentBox} wrap={false}>
            <Text style={styles.paymentTitle}>Payment Details</Text>
            {settings.bank_name ? (
              <View style={styles.paymentRow}>
                <Text style={styles.paymentLabel}>Bank</Text>
                <Text style={styles.paymentValue}>{settings.bank_name}</Text>
              </View>
            ) : null}
            {settings.account_name ? (
              <View style={styles.paymentRow}>
                <Text style={styles.paymentLabel}>Account Name</Text>
                <Text style={styles.paymentValue}>{settings.account_name}</Text>
              </View>
            ) : null}
            {settings.bsb ? (
              <View style={styles.paymentRow}>
                <Text style={styles.paymentLabel}>BSB</Text>
                <Text style={styles.paymentValue}>{settings.bsb}</Text>
              </View>
            ) : null}
            {settings.account_number ? (
              <View style={styles.paymentRow}>
                <Text style={styles.paymentLabel}>Account Number</Text>
                <Text style={styles.paymentValue}>{settings.account_number}</Text>
              </View>
            ) : null}
            {settings.bank_reference_note ? (
              <View style={[styles.paymentRow, { marginTop: 4 }]}>
                <Text style={[styles.paymentLabel, { fontStyle: 'italic', width: '100%' }]}>
                  Reference: {settings.bank_reference_note.replace('{invoice_number}', invoice.invoice_number)}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Notes */}
        {invoice.notes ? (
          <View wrap={false}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={styles.sectionText}>{invoice.notes}</Text>
          </View>
        ) : null}

        {/* Footer */}
        <Text style={styles.footer} fixed>
          {settings.business_name}{settings.email ? ` | ${settings.email}` : ''}{settings.phone ? ` | ${settings.phone}` : ''}{settings.website ? ` | ${settings.website}` : ''}
        </Text>
      </Page>
    </Document>
  );
}

function getInvoiceStatusColor(status: string): string {
  const colors: Record<string, string> = {
    unpaid: '#eab308',
    partially_paid: '#2563eb',
    paid: '#16a34a',
    overdue: '#dc2626',
    cancelled: '#6b7280',
  };
  return colors[status] || '#6b7280';
}
