import QuoteDetailPage from '../[id]/page';

export default function NewQuotePage() {
  return <QuoteDetailPage params={Promise.resolve({ id: 'new' })} />;
}
