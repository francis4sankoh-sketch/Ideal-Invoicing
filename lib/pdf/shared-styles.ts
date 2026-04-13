import { StyleSheet } from '@react-pdf/renderer';

export const BRAND = {
  primary: '#800020',
  accent: '#fdf0ef',
  text: '#1a1a1a',
  muted: '#555555',
  border: '#d1d5db',
  white: '#ffffff',
};

export const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: BRAND.text,
    paddingTop: 40,
    paddingBottom: 60,
    paddingHorizontal: 40,
  },
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  logoArea: {
    flexDirection: 'column',
    width: '55%',
  },
  logo: {
    width: 120,
    height: 'auto',
    marginBottom: 6,
  },
  businessName: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: BRAND.primary,
    marginBottom: 6,
  },
  businessDetail: {
    fontSize: 8,
    color: BRAND.muted,
    marginBottom: 2,
  },
  // Document title area (right side)
  docTitleArea: {
    alignItems: 'flex-end',
    width: '40%',
  },
  docTitle: {
    fontSize: 28,
    fontFamily: 'Helvetica-Bold',
    color: BRAND.primary,
    marginBottom: 12,
  },
  docMeta: {
    fontSize: 9,
    color: BRAND.muted,
    textAlign: 'right',
    marginBottom: 4,
  },
  docMetaValue: {
    fontFamily: 'Helvetica-Bold',
    color: BRAND.text,
  },
  // Divider
  divider: {
    borderBottomWidth: 1.5,
    borderBottomColor: BRAND.primary,
    marginBottom: 16,
  },
  dividerLight: {
    borderBottomWidth: 0.5,
    borderBottomColor: BRAND.border,
    marginVertical: 8,
  },
  // Bill To / Event row
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  infoCol: {
    width: '48%',
  },
  infoLabel: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: BRAND.primary,
    textTransform: 'uppercase',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  infoText: {
    fontSize: 9,
    marginBottom: 3,
    color: BRAND.text,
  },
  infoTextMuted: {
    fontSize: 9,
    color: BRAND.muted,
    marginBottom: 3,
  },
  // Line items table
  table: {
    marginBottom: 16,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: BRAND.primary,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 2,
  },
  tableHeaderText: {
    color: BRAND.white,
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: BRAND.border,
  },
  tableRowAlt: {
    backgroundColor: '#fafafa',
  },
  tableCell: {
    fontSize: 9,
    color: BRAND.text,
  },
  tableCellMuted: {
    fontSize: 8,
    color: BRAND.muted,
    marginTop: 2,
  },
  // Column widths
  colDescription: { width: '50%' },
  colQty: { width: '12%', textAlign: 'center' },
  colUnit: { width: '19%', textAlign: 'right' },
  colTotal: { width: '19%', textAlign: 'right' },
  // Totals
  totalsContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 20,
  },
  totalsBox: {
    width: 220,
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  totalsLabel: {
    fontSize: 9,
    color: BRAND.muted,
  },
  totalsValue: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
  },
  totalsFinal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    marginTop: 4,
    borderTopWidth: 1.5,
    borderTopColor: BRAND.primary,
  },
  totalsFinalLabel: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: BRAND.primary,
  },
  totalsFinalValue: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: BRAND.primary,
  },
  // Notes/terms
  sectionTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: BRAND.primary,
    marginBottom: 4,
    marginTop: 12,
  },
  sectionText: {
    fontSize: 8.5,
    color: BRAND.muted,
    lineHeight: 1.5,
  },
  // Payment box
  paymentBox: {
    backgroundColor: BRAND.accent,
    borderRadius: 4,
    padding: 12,
    marginTop: 12,
  },
  paymentTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: BRAND.primary,
    marginBottom: 6,
  },
  paymentRow: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  paymentLabel: {
    fontSize: 8.5,
    color: BRAND.muted,
    width: 100,
  },
  paymentValue: {
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    color: BRAND.text,
  },
  // Footer
  footer: {
    position: 'absolute',
    bottom: 25,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 7.5,
    color: BRAND.muted,
    borderTopWidth: 0.5,
    borderTopColor: BRAND.border,
    paddingTop: 8,
  },
  // Status badge
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 3,
    alignSelf: 'flex-end',
    marginTop: 8,
  },
  statusBadgeText: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: BRAND.white,
  },
});

export function formatCurrencyPDF(amount: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatDatePDF(date: string | null): string {
  if (!date) return '—';
  const d = new Date(date);
  const day = d.getDate();
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${day} ${months[d.getMonth()]} ${d.getFullYear()}`;
}
