'use client';

import Link from 'next/link';
import { useState, useEffect, type FormEvent } from 'react';
import { TIER_LIMITS } from '@safetag/shared';
import { qrCodes, settings, type QrCategoryConfig } from '@/lib/api';
import { isQrLimitReached } from '@/lib/api-error';
import { type TagCategory } from '@/types';

interface RegisterTagModalProps {
  onClose: () => void;
  onCreated: () => void;
}

const FREE_TAG_LIMIT = TIER_LIMITS.free.maxQrCodes;

export function RegisterTagModal({ onClose, onCreated }: RegisterTagModalProps) {
  const [label, setLabel] = useState('');
  const [category, setCategory] = useState<TagCategory>('pet');
  const [availableCategories, setAvailableCategories] = useState<QrCategoryConfig[]>([]);

  useEffect(() => {
    settings.getQrCategories()
      .then((cats) => setAvailableCategories(cats.filter((c) => c.enabled)))
      .catch(() => {
        // Fallback to hardcoded defaults if API fails
        setAvailableCategories([
          { value: 'pet', label: 'Pet', core: false, enabled: true },
          { value: 'bag', label: 'Bag / Luggage', core: false, enabled: true },
          { value: 'key', label: 'Keys', core: false, enabled: true },
          { value: 'person', label: 'Person', core: true, enabled: true },
          { value: 'vehicle', label: 'Vehicle', core: false, enabled: true },
          { value: 'medical', label: 'Medical', core: false, enabled: true },
          { value: 'place', label: 'Place', core: false, enabled: true },
          { value: 'other', label: 'Other', core: false, enabled: true },
        ]);
      });
  }, []);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [reward, setReward] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [limitReached, setLimitReached] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLimitReached(false);
    setLoading(true);
    try {
      await qrCodes.create({
        name: label.trim(),
        label: label.trim(),
        category,
        ownerContactEmail: email.trim() || undefined,
        ownerContactPhone: phone.trim() || undefined,
        rewardMessage: reward.trim() || undefined,
      });
      onCreated();
    } catch (err: unknown) {
      if (isQrLimitReached(err)) {
        setLimitReached(true);
      } else {
        setError((err as { message?: string })?.message ?? 'Failed to create tag');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="p-5 space-y-4">
      {limitReached && (
        <div
          className="rounded-xl p-4 flex items-start gap-3"
          style={{
            backgroundColor: 'rgba(249, 115, 22, 0.08)',
            border: '1px solid rgba(249, 115, 22, 0.25)',
          }}
        >
          <span className="text-2xl">🏷️</span>
          <div className="flex-1 space-y-1">
            <p className="text-sm font-semibold text-white">Tag limit reached</p>
            <p className="text-sm text-slate-400 leading-5">
              You&apos;ve reached your free plan limit of {FREE_TAG_LIMIT} tags. Upgrade your plan
              to register more tags for your valuables.
            </p>
            <Link
              href="/dashboard/subscription"
              onClick={onClose}
              className="inline-block text-brand-400 text-xs font-medium mt-1 hover:text-brand-300"
            >
              Upgrade plan →
            </Link>
          </div>
          <button
            type="button"
            onClick={() => setLimitReached(false)}
            className="text-slate-500 hover:text-slate-400 text-lg leading-none"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}
      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1.5">Tag label</label>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          required
          placeholder="e.g. Max the Dog, Travel Bag"
          className="w-full bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 transition-colors"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-400 mb-2">Category</label>
        <div className="grid grid-cols-3 gap-2">
          {availableCategories.map((cat) => (
            <button
              key={cat.value}
              type="button"
              onClick={() => setCategory(cat.value as TagCategory)}
              className={`py-2 rounded-lg text-xs font-medium transition-all border ${
                cat.value === category
                  ? 'bg-brand-500/20 text-brand-400 border-brand-500/50'
                  : 'bg-surface-elevated text-slate-400 border-surface-border hover:border-slate-500'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">Contact email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
            className="w-full bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 transition-colors"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">Contact phone</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+1 555 0100"
            className="w-full bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 transition-colors"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1.5">
          Reward message <span className="text-slate-600">(optional)</span>
        </label>
        <textarea
          value={reward}
          onChange={(e) => setReward(e.target.value)}
          rows={2}
          maxLength={200}
          placeholder="Reward if returned — visible to finders"
          className="w-full bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 transition-colors resize-none"
        />
      </div>

      {error && (
        <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex gap-3 pt-1">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 py-2.5 rounded-xl border border-surface-border text-slate-400 hover:text-white transition-colors text-sm"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-semibold transition-colors text-sm"
        >
          {loading ? 'Creating…' : 'Create tag'}
        </button>
      </div>
    </form>
  );
}
