'use client';

import { useState, type FormEvent } from 'react';
import { MapPin } from 'lucide-react';
import { PIN_COLORS, TAG_CATEGORY_LABELS, type PinData, type PinCategory, type LatLng } from '@/types';
import { pins as pinsApi } from '@/lib/api';

interface CreatePinModalProps {
  location: LatLng | null;
  onClose: () => void;
  onCreated: (pin: PinData) => void;
}

const CATEGORIES = Object.keys(PIN_COLORS) as PinCategory[];

export function CreatePinModal({ location, onClose, onCreated }: CreatePinModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<PinCategory>('hazard');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!location) { setError('No location selected — tap on the map first.'); return; }

    setLoading(true);
    setError('');
    try {
      const created = await pinsApi.create({
        title: title.trim(),
        description: description.trim(),
        type: category,
        lat: location.lat,
        lng: location.lng,
      });
      onCreated(created);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to create pin');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="p-5 space-y-4">
      {location ? (
        <div className="flex items-center gap-2 text-xs text-[#7a6957] bg-surface-elevated rounded-lg px-3 py-2">
          <MapPin className="w-3.5 h-3.5 text-brand-400" />
          <span>{location.lat.toFixed(5)}, {location.lng.toFixed(5)}</span>
        </div>
      ) : (
        <p className="text-xs text-amber-400 bg-amber-500/10 rounded-lg px-3 py-2">
          Tap on the map to set a location
        </p>
      )}

      {/* Category selector */}
      <div>
        <label className="block text-xs font-medium text-[#7a6957] mb-2">Category</label>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => {
            const color = PIN_COLORS[cat];
            const isActive = cat === category;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className="px-3 py-1 rounded-full text-xs font-medium transition-all"
                style={
                  isActive
                    ? { background: `${color}30`, color, borderColor: color, border: `1px solid ${color}` }
                    : { background: 'rgba(27,20,16,0.06)', color: '#7a6957', border: '1px solid rgba(27,20,16,0.15)' }
                }
              >
                {TAG_CATEGORY_LABELS[cat]}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-[#7a6957] mb-1.5">Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          maxLength={80}
          placeholder="Brief, descriptive title…"
          className="w-full bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-sm text-white placeholder-[var(--text-muted)] focus:outline-none focus:border-brand-500 transition-colors"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-[#7a6957] mb-1.5">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          maxLength={300}
          placeholder="Add more context…"
          className="w-full bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-sm text-white placeholder-[var(--text-muted)] focus:outline-none focus:border-brand-500 transition-colors resize-none"
        />
      </div>

      {error && (
        <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 py-2.5 rounded-xl border border-surface-border text-[#7a6957] hover:text-white transition-colors text-sm"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading || !location}
          className="flex-1 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-semibold transition-colors text-sm"
        >
          {loading ? 'Posting…' : 'Post pin'}
        </button>
      </div>
    </form>
  );
}
