'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Tag, AlertTriangle, CheckCircle, Trash2, ChevronRight, Layers, ShoppingBag } from 'lucide-react';
import { qrCodes, type QrCode } from '@/lib/api';
import { useAuth } from '@/context/auth-context';
import { getShopifyShopUrl } from '@/lib/shopify-shop';

const QR_CATEGORIES = ['pet', 'bag', 'key', 'person', 'vehicle', 'other', 'medical', 'place'] as const;

export default function QrPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [tags, setTags] = useState<QrCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Bulk generate state
  const [showBulkForm, setShowBulkForm] = useState(false);
  const [bulkCount, setBulkCount] = useState(3);
  const [bulkCategory, setBulkCategory] = useState('other');
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkError, setBulkError] = useState('');

  const isPremium = user?.subscriptionTier === 'premium' || user?.subscriptionTier === 'enterprise';
  const shopUrl = getShopifyShopUrl();

  useEffect(() => {
    qrCodes
      .list()
      .then(setTags)
      .catch(() => setError('Failed to load tags'))
      .finally(() => setLoading(false));
  }, []);

  async function handleMarkLost(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      const updated = await qrCodes.markLost(id);
      setTags((prev) => prev.map((t) => (t.id === id ? updated : t)));
    } catch {}
  }

  async function handleMarkFound(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      const updated = await qrCodes.markFound(id);
      setTags((prev) => prev.map((t) => (t.id === id ? updated : t)));
    } catch {}
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm('Delete this tag?')) return;
    try {
      await qrCodes.delete(id);
      setTags((prev) => prev.filter((t) => t.id !== id));
    } catch {}
  }

  async function handleBulkCreate(e: React.FormEvent) {
    e.preventDefault();
    setBulkLoading(true);
    setBulkError('');
    try {
      const created = await qrCodes.bulkCreate({ count: bulkCount, category: bulkCategory });
      setTags((prev) => [...prev, ...created]);
      setShowBulkForm(false);
    } catch {
      setBulkError('Failed to generate tags. Check your plan limits and try again.');
    } finally {
      setBulkLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">My Tags</h1>
            <p className="text-[#7a6957] text-sm mt-1">{tags.length} registered tag{tags.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="flex items-center gap-2">
            {shopUrl && (
              <a
                href={shopUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 bg-surface-card border border-surface-border hover:border-brand-500/40 text-[#5a4a3d] text-sm font-semibold px-3 py-2 rounded-xl transition-colors"
              >
                <ShoppingBag className="w-4 h-4" />
                Shop
              </a>
            )}
            {isPremium && (
              <button
                onClick={() => setShowBulkForm((v) => !v)}
                className="flex items-center gap-2 bg-surface-card border border-surface-border hover:border-brand-500/40 text-[#5a4a3d] text-sm font-semibold px-3 py-2 rounded-xl transition-colors"
              >
                <Layers className="w-4 h-4" />
                Generate Multiple
              </button>
            )}
            <button
              onClick={() => router.push('/dashboard')}
              className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
            >
              <Plus className="w-4 h-4" />
              Register Tag
            </button>
          </div>
        </div>

        {/* Bulk generate form — premium only */}
        {isPremium && showBulkForm && (
          <form
            onSubmit={handleBulkCreate}
            className="bg-surface-card border border-surface-border rounded-2xl p-4 mb-4 space-y-3"
          >
            <p className="text-white font-semibold text-sm">Generate Multiple Tags</p>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <label className="text-xs text-[#7a6957] mb-1 block">Count (1–50)</label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={bulkCount}
                  onChange={(e) => setBulkCount(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))}
                  className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs text-[#7a6957] mb-1 block">Category</label>
                <select
                  value={bulkCategory}
                  onChange={(e) => setBulkCategory(e.target.value)}
                  className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
                >
                  {QR_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
                  ))}
                </select>
              </div>
            </div>
            {bulkError && (
              <p className="text-red-400 text-xs">{bulkError}</p>
            )}
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={bulkLoading}
                className="bg-brand-500 hover:bg-brand-600 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
              >
                {bulkLoading ? 'Generating…' : `Generate ${bulkCount} Tag${bulkCount !== 1 ? 's' : ''}`}
              </button>
              <button
                type="button"
                onClick={() => setShowBulkForm(false)}
                className="text-[#7a6957] text-sm px-3 py-2 hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {loading && (
          <div className="flex items-center justify-center py-20 text-[#7a6957]">Loading…</div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {!loading && !error && tags.length === 0 && (
          <div className="text-center py-20 text-[#9d8c7a]">
            <Tag className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium">No tags registered yet</p>
            <p className="text-sm mt-1">Register your first tag to get started</p>
          </div>
        )}

        <div className="space-y-3">
          {tags.map((tag) => (
            <div
              key={tag.id}
              className="bg-surface-card border border-surface-border rounded-2xl p-4 flex items-center gap-4 cursor-pointer hover:border-brand-500/40 transition-colors"
              onClick={() => router.push(`/dashboard/qr/${tag.id}`)}
            >
              <div className="w-10 h-10 rounded-xl bg-brand-500/15 flex items-center justify-center flex-shrink-0">
                <Tag className="w-5 h-5 text-brand-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-white font-semibold text-sm truncate">{tag.label ?? tag.name}</p>
                  {tag.isLost && (
                    <span className="flex items-center gap-1 bg-red-500/15 text-red-400 text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0">
                      <AlertTriangle className="w-3 h-3" /> Lost
                    </span>
                  )}
                </div>
                <p className="text-[#9d8c7a] text-xs capitalize mt-0.5">{tag.category}</p>
                <p className="text-[#7a6957] text-xs font-mono mt-0.5">{tag.uniqueCode}</p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {tag.isLost ? (
                  <button
                    onClick={(e) => handleMarkFound(tag.id, e)}
                    className="flex items-center gap-1 bg-green-500/15 text-green-400 text-xs font-medium px-2 py-1 rounded-lg hover:bg-green-500/25 transition-colors"
                  >
                    <CheckCircle className="w-3 h-3" /> Found
                  </button>
                ) : (
                  <button
                    onClick={(e) => handleMarkLost(tag.id, e)}
                    className="flex items-center gap-1 bg-red-500/15 text-red-400 text-xs font-medium px-2 py-1 rounded-lg hover:bg-red-500/25 transition-colors"
                  >
                    <AlertTriangle className="w-3 h-3" /> Mark Lost
                  </button>
                )}
                <button
                  onClick={(e) => handleDelete(tag.id, e)}
                  className="p-1.5 text-[#7a6957] hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <ChevronRight className="w-4 h-4 text-[#7a6957]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
