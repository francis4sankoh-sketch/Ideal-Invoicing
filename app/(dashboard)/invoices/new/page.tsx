import InvoiceDetailPage from '../[id]/page';

export default function NewInvoicePage() {
  return <InvoiceDetailPage params={Promise.resolve({ id: 'new' })} />;
}
