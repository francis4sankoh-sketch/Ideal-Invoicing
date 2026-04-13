import React from 'react';
import { Document, Page, Text, View, Image } from '@react-pdf/renderer';
import { Quote, BusinessSettings } from '@/types';
import { styles, BRAND, formatCurrencyPDF, formatDatePDF } from './shared-styles';

interface QuotePDFProps {
  quote: Quote;
  settings: BusinessSettings;
}

export function QuotePDF({ quote, settings }: QuotePDFProps) {
  const customer = quote.customer;

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
            <Text style={styles.docTitle}>QUOTE</Text>
            <Text style={styles.docMeta}>
              Quote No: <Text style={styles.docMetaValue}>{quote.quote_number}</Text>
            </Text>
            <Text style={styles.docMeta}>
              Date: <Text style={styles.docMetaValue}>{formatDatePDF(quote.created_at)}</Text>
            </Text>
            {quote.valid_until ? (
              <Text style={styles.docMeta}>
                Valid Until: <Text style={styles.docMetaValue}>{formatDatePDF(quote.valid_until)}</Text>
              </Text>
            ) : null}
            <View style={[styles.statusBadge, { backgroundColor: getQuoteStatusColor(quote.status) }]}>
              <Text style={styles.statusBadgeText}>{quote.status}</Text>
            </View>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Bill To + Event Details */}
        <View style={styles.infoRow}>
          <View style={styles.infoCol}>
            <Text style={styles.infoLabel}>Prepared For</Text>
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
          {(quote.title || quote.event_date || quote.event_location) ? (
            <View style={styles.infoCol}>
              <Text style={styles.infoLabel}>Event Details</Text>
              {quote.title ? <Text style={styles.infoText}>{quote.title}</Text> : null}
              {quote.event_date ? <Text style={styles.infoTextMuted}>Date: {formatDatePDF(quote.event_date)}</Text> : null}
              {quote.event_location ? <Text style={styles.infoTextMuted}>Location: {quote.event_location}</Text> : null}
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
          {quote.line_items.map((item, i) => (
            <View key={item.id} style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]} wrap={false}>
              <View style={styles.colDescription}>
                <Text style={styles.tableCell}>{item.description}</Text>
                {item.notes ? <Text style={styles.tableCellMuted}>{item.notes}</Text> : null}
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
              <Text style={styles.totalsValue}>{formatCurrencyPDF(quote.subtotal)}</Text>
            </View>
            {quote.discount_amount > 0 ? (
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>
                  Discount{quote.discount_type === 'percentage' ? ` (${quote.discount_value}%)` : ''}
                </Text>
                <Text style={[styles.totalsValue, { color: '#dc2626' }]}>-{formatCurrencyPDF(quote.discount_amount)}</Text>
              </View>
            ) : null}
            {quote.include_gst ? (
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>GST (10%)</Text>
                <Text style={styles.totalsValue}>{formatCurrencyPDF(quote.gst_amount)}</Text>
              </View>
            ) : null}
            <View style={styles.totalsFinal}>
              <Text style={styles.totalsFinalLabel}>Total</Text>
              <Text style={styles.totalsFinalValue}>{formatCurrencyPDF(quote.total)}</Text>
            </View>
            {quote.deposit_amount > 0 ? (
              <View style={[styles.totalsRow, { marginTop: 4 }]}>
                <Text style={[styles.totalsLabel, { fontFamily: 'Helvetica-Bold' }]}>
                  Deposit Required ({quote.deposit_percentage}%)
                </Text>
                <Text style={[styles.totalsValue, { color: BRAND.primary }]}>{formatCurrencyPDF(quote.deposit_amount)}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Notes */}
        {quote.notes ? (
          <View wrap={false}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={styles.sectionText}>{quote.notes}</Text>
          </View>
        ) : null}

        {/* Terms */}
        {quote.terms ? (
          <View>
            <Text style={styles.sectionTitle}>Terms & Conditions</Text>
            <Text style={styles.sectionText}>{quote.terms}</Text>
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

function getQuoteStatusColor(status: string): string {
  const colors: Record<string, string> = {
    draft: '#6b7280',
    sent: '#2563eb',
    accepted: '#16a34a',
    rejected: '#dc2626',
    expired: '#f97316',
  };
  return colors[status] || '#6b7280';
}
