'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Product } from '@/types';
import { formatCurrency } from '@/lib/utils/format';
import { Search, Package } from 'lucide-react';

interface ProductPickerProps {
  open: boolean;
  onClose: () => void;
  products: Product[];
  onSelect: (product: Product) => void;
}

export function ProductPicker({ open, onClose, products, onSelect }: ProductPickerProps) {
  const [search, setSearch] = useState('');

  const handleClose = () => {
    onClose();
    setSearch('');
  };

  const q = search.trim().toLowerCase();
  const filtered = q
    ? products.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.category || '').toLowerCase().includes(q) ||
          (p.description || '').toLowerCase().includes(q)
      )
    : products;

  return (
    <Modal open={open} onClose={handleClose} title="Add from Products" size="lg">
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
        <input
          type="text"
          autoFocus
          placeholder="Search products by name or category..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 border border-[var(--color-border)] rounded-md text-sm bg-white dark:bg-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
        />
      </div>
      {filtered.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)] text-center py-8">
          No products match &ldquo;{search}&rdquo;.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-96 overflow-y-auto">
          {filtered.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                onSelect(p);
                handleClose();
              }}
              className="flex items-center gap-3 p-3 border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-bg-light)] transition-colors text-left"
            >
              <div className="w-12 h-12 bg-[var(--color-bg-light)] rounded flex items-center justify-center shrink-0">
                {p.photos?.[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.photos[0]} alt="" className="w-full h-full object-cover rounded" />
                ) : (
                  <Package className="w-5 h-5 text-[var(--color-text-muted)]" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{p.name}</p>
                {p.category && <p className="text-xs text-[var(--color-text-muted)] truncate">{p.category}</p>}
                <p className="text-sm text-[var(--color-primary)] font-bold">{formatCurrency(p.default_price)}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}
