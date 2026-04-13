'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input, Textarea, Select } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { EmptyState } from '@/components/ui/empty-state';
import { Product, ColorVariant } from '@/types';
import { formatCurrency } from '@/lib/utils/format';
import { Package, Plus, Search, Trash2, Image as ImageIcon } from 'lucide-react';

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  const [form, setForm] = useState({
    name: '',
    description: '',
    category: '',
    default_price: 0,
    gst_inclusive: false,
    is_active: true,
    has_color_variants: false,
    color_variants: [] as ColorVariant[],
    photos: [] as string[],
  });

  useEffect(() => { loadProducts(); }, []);

  const loadProducts = async () => {
    const { data } = await supabase.from('products').select('*').order('name');
    if (data) setProducts(data);
    setLoading(false);
  };

  const openNew = () => {
    setEditingProduct(null);
    setForm({ name: '', description: '', category: '', default_price: 0, gst_inclusive: false, is_active: true, has_color_variants: false, color_variants: [], photos: [] });
    setModalOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditingProduct(p);
    setForm({
      name: p.name,
      description: p.description || '',
      category: p.category || '',
      default_price: p.default_price,
      gst_inclusive: p.gst_inclusive,
      is_active: p.is_active,
      has_color_variants: p.has_color_variants,
      color_variants: p.color_variants || [],
      photos: p.photos || [],
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.default_price) return;
    setSaving(true);

    const payload = {
      name: form.name,
      description: form.description || null,
      category: form.category || null,
      default_price: form.default_price,
      gst_inclusive: form.gst_inclusive,
      is_active: form.is_active,
      has_color_variants: form.has_color_variants,
      color_variants: form.color_variants,
      photos: form.photos,
    };

    if (editingProduct) {
      await supabase.from('products').update(payload).eq('id', editingProduct.id);
    } else {
      await supabase.from('products').insert(payload);
    }

    setModalOpen(false);
    setSaving(false);
    loadProducts();
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const urls: string[] = [];
    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop();
      const path = `product-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from('Products').upload(path, file);
      if (!error) {
        const { data: { publicUrl } } = supabase.storage.from('Products').getPublicUrl(path);
        urls.push(publicUrl);
      }
    }
    setForm({ ...form, photos: [...form.photos, ...urls] });
  };

  const addVariant = () => {
    setForm({
      ...form,
      color_variants: [...form.color_variants, { color_name: '', hex_code: '#000000', photos: [] }],
    });
  };

  const updateVariant = (idx: number, field: keyof ColorVariant, value: string | string[]) => {
    const variants = [...form.color_variants];
    variants[idx] = { ...variants[idx], [field]: value };
    setForm({ ...form, color_variants: variants });
  };

  const removeVariant = (idx: number) => {
    setForm({ ...form, color_variants: form.color_variants.filter((_, i) => i !== idx) });
  };

  const categories = [...new Set(products.map((p) => p.category).filter(Boolean))] as string[];

  const filtered = products.filter((p) => {
    if (!showInactive && !p.is_active) return false;
    if (categoryFilter && p.category !== categoryFilter) return false;
    return p.name.toLowerCase().includes(search.toLowerCase());
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary)]" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
            <input
              type="text"
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-[var(--color-border)] rounded-md text-sm bg-white dark:bg-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            />
          </div>
          {categories.length > 0 && (
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 border border-[var(--color-border)] rounded-md text-sm bg-white dark:bg-[#1a1a1a]"
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          )}
          <label className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
            Show inactive
          </label>
        </div>
        <Button onClick={openNew}>
          <Plus className="w-4 h-4" /> New Product
        </Button>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No products yet"
          description="Add products and services to quickly build quotes."
          action={<Button onClick={openNew}><Plus className="w-4 h-4" /> Add Product</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((p) => (
            <div
              key={p.id}
              onClick={() => openEdit(p)}
              className={`bg-white dark:bg-[#1a1a1a] border border-[var(--color-border)] rounded-lg overflow-hidden cursor-pointer hover:shadow-md transition-shadow ${
                !p.is_active ? 'opacity-60' : ''
              }`}
            >
              <div className="h-40 bg-[var(--color-bg-light)] flex items-center justify-center">
                {p.photos && p.photos.length > 0 ? (
                  <img src={p.photos[0]} alt={p.name} className="h-full w-full object-cover" />
                ) : (
                  <ImageIcon className="w-8 h-8 text-[var(--color-text-muted)]" />
                )}
              </div>
              <div className="p-4">
                <h4 className="text-sm font-medium text-[var(--color-text)] truncate">{p.name}</h4>
                {p.category && (
                  <span className="inline-block mt-1 px-2 py-0.5 rounded text-xs bg-[var(--color-accent-light)] text-[var(--color-primary)]">
                    {p.category}
                  </span>
                )}
                <p className="mt-2 text-lg font-bold text-[var(--color-text)]">
                  {formatCurrency(p.default_price)}
                  {p.gst_inclusive && <span className="text-xs font-normal text-[var(--color-text-muted)] ml-1">inc GST</span>}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Product Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingProduct ? 'Edit Product' : 'New Product'} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input label="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g. chairs, backdrops, lighting" />
            <Input label="Default Price *" type="number" step="0.01" value={form.default_price || ''} onChange={(e) => setForm({ ...form, default_price: parseFloat(e.target.value) || 0 })} />
            <div className="flex items-center gap-4 pt-6">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.gst_inclusive} onChange={(e) => setForm({ ...form, gst_inclusive: e.target.checked })} />
                GST Inclusive
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
                Active
              </label>
            </div>
          </div>

          <Textarea label="Description" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />

          {/* Photos */}
          <div>
            <label className="block text-sm font-medium text-[var(--color-text)] mb-2">Photos</label>
            <div className="flex flex-wrap gap-2">
              {form.photos.map((url, i) => (
                <div key={i} className="relative w-20 h-20 rounded overflow-hidden group">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <button
                    onClick={() => setForm({ ...form, photos: form.photos.filter((_, idx) => idx !== i) })}
                    className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                  >
                    <Trash2 className="w-4 h-4 text-white" />
                  </button>
                </div>
              ))}
              <label className="w-20 h-20 border-2 border-dashed border-[var(--color-border)] rounded flex items-center justify-center cursor-pointer hover:border-[var(--color-primary)] transition-colors">
                <Plus className="w-5 h-5 text-[var(--color-text-muted)]" />
                <input type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} />
              </label>
            </div>
          </div>

          {/* Color Variants */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-[var(--color-text)] mb-2">
              <input
                type="checkbox"
                checked={form.has_color_variants}
                onChange={(e) => setForm({ ...form, has_color_variants: e.target.checked })}
              />
              Has colour variants
            </label>
            {form.has_color_variants && (
              <div className="space-y-3 mt-2">
                {form.color_variants.map((v, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 border border-[var(--color-border)] rounded-md">
                    <input
                      type="color"
                      value={v.hex_code}
                      onChange={(e) => updateVariant(i, 'hex_code', e.target.value)}
                      className="w-8 h-8 rounded cursor-pointer"
                    />
                    <Input
                      placeholder="Colour name"
                      value={v.color_name}
                      onChange={(e) => updateVariant(i, 'color_name', e.target.value)}
                      className="flex-1"
                    />
                    <button onClick={() => removeVariant(i)} className="text-red-500 hover:text-red-700">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addVariant}>
                  <Plus className="w-3 h-3" /> Add Variant
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} loading={saving}>{editingProduct ? 'Update' : 'Create'} Product</Button>
        </div>
      </Modal>
    </div>
  );
}
