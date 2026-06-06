'use client';

import { useState, useCallback } from 'react';
import { MapPin, Hotel, Utensils, Coffee, Beer, Landmark, Trees, Train, ShoppingBag, Search, Plus, X, Star } from 'lucide-react';
import { places, PlaceData, PlaceWithReviews, CreatePlacePayload, ApiError } from '@/lib/api';
import PlaceDetailModal from './PlaceDetailModal';

const PLACE_TYPES = [
  { value: '', label: 'All', Icon: MapPin },
  { value: 'hotel', label: 'Hotel', Icon: Hotel },
  { value: 'restaurant', label: 'Restaurant', Icon: Utensils },
  { value: 'cafe', label: 'Cafe', Icon: Coffee },
  { value: 'bar', label: 'Bar', Icon: Beer },
  { value: 'attraction', label: 'Attraction', Icon: Landmark },
  { value: 'park', label: 'Park', Icon: Trees },
  { value: 'transport_hub', label: 'Transport', Icon: Train },
  { value: 'shopping', label: 'Shopping', Icon: ShoppingBag },
  { value: 'other', label: 'Other', Icon: MapPin },
] as const;

const PLACE_CATEGORY_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  hotel: Hotel,
  restaurant: Utensils,
  cafe: Coffee,
  bar: Beer,
  attraction: Landmark,
  park: Trees,
  transport_hub: Train,
  shopping: ShoppingBag,
  other: MapPin,
};

const DEFAULT_BBOX = { minLat: 51.4, minLng: -0.2, maxLat: 51.6, maxLng: 0.1 };

function StarDisplay({ rating, count }: { rating?: string | null; count: number }) {
  if (!rating) return <span className="text-xs text-[var(--text-muted)]">No ratings</span>;
  const r = parseFloat(rating);
  const filled = Math.round(r);
  return (
    <div className="flex items-center gap-1">
      <div className="flex text-yellow-400">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={i} className={`w-3 h-3 ${i < filled ? 'fill-current' : 'opacity-30'}`} />
        ))}
      </div>
      <span className="text-xs text-[var(--text-muted)]">{r.toFixed(1)} ({count})</span>
    </div>
  );
}

export default function PlacesPage() {
  const [category, setCategory] = useState('');
  const [bbox, setBbox] = useState(DEFAULT_BBOX);
  const [results, setResults] = useState<PlaceData[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  const [selectedPlace, setSelectedPlace] = useState<PlaceWithReviews | null>(null);
  const [modalLoading, setModalLoading] = useState(false);

  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState<CreatePlacePayload>({ name: '', category: 'other', lat: 51.5, lng: -0.1 });
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState('');

  const inputCls = 'w-full bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-brand-500 transition-colors';

  const handleSearch = useCallback(async () => {
    setLoading(true);
    setSearchError('');
    try {
      const data = await places.search({ ...bbox, ...(category ? { category } : {}) });
      setResults(data);
      setHasSearched(true);
    } catch (err) {
      setSearchError(err instanceof ApiError ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  }, [bbox, category]);

  async function openPlace(place: PlaceData) {
    setModalLoading(true);
    try {
      const detail = await places.get(place.id);
      setSelectedPlace(detail);
    } catch {
      setSelectedPlace({ ...place, reviews: [] });
    } finally {
      setModalLoading(false);
    }
  }

  async function refreshPlace() {
    if (!selectedPlace) return;
    try {
      const detail = await places.get(selectedPlace.id);
      setSelectedPlace(detail);
      setResults((prev) =>
        prev.map((p) => (p.id === detail.id ? { ...p, overallRating: detail.overallRating, reviewCount: detail.reviewCount } : p)),
      );
    } catch { /* ignore */ }
  }

  async function handleAddPlace(e: React.FormEvent) {
    e.preventDefault();
    setAddLoading(true);
    setAddError('');
    try {
      const created = await places.create(addForm);
      setResults((prev) => [created, ...prev]);
      setShowAddForm(false);
      setAddForm({ name: '', category: 'other', lat: 51.5, lng: -0.1 });
    } catch (err) {
      setAddError(err instanceof ApiError ? err.message : 'Failed to create place');
    } finally {
      setAddLoading(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Places</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">Discover and rate real-world places on the safety map</p>
        </div>
        <button
          onClick={() => setShowAddForm((v) => !v)}
          className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          {showAddForm ? <><X className="w-4 h-4" /> Cancel</> : <><Plus className="w-4 h-4" /> Add Place</>}
        </button>
      </div>

      {/* Add Place Form */}
      {showAddForm && (
        <form
          onSubmit={handleAddPlace}
          className="mb-6 border border-brand-500/20 rounded-xl p-5 bg-brand-500/5 space-y-4"
        >
          <h2 className="font-semibold text-[var(--text-primary)]">Add a Place</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Name *</label>
              <input required maxLength={200} className={inputCls} value={addForm.name}
                onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Category *</label>
              <select className={inputCls} value={addForm.category}
                onChange={(e) => setAddForm((f) => ({ ...f, category: e.target.value }))}>
                {PLACE_TYPES.filter((t) => t.value).map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Latitude *</label>
              <input type="number" step="any" required className={inputCls} value={addForm.lat}
                onChange={(e) => setAddForm((f) => ({ ...f, lat: parseFloat(e.target.value) }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Longitude *</label>
              <input type="number" step="any" required className={inputCls} value={addForm.lng}
                onChange={(e) => setAddForm((f) => ({ ...f, lng: parseFloat(e.target.value) }))} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Address</label>
              <input maxLength={500} className={inputCls} value={addForm.address ?? ''}
                onChange={(e) => setAddForm((f) => ({ ...f, address: e.target.value }))} />
            </div>
          </div>
          {addError && <p className="text-sm text-red-400">{addError}</p>}
          <button type="submit" disabled={addLoading}
            className="bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium px-6 py-2 rounded-lg disabled:opacity-50 transition-colors">
            {addLoading ? 'Saving…' : 'Save Place'}
          </button>
        </form>
      )}

      {/* Category filter */}
      <div className="flex flex-wrap gap-2 mb-4">
        {PLACE_TYPES.map((t) => {
          const Icon = t.Icon;
          return (
            <button
              key={t.value}
              onClick={() => setCategory(t.value)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                category === t.value
                  ? 'bg-brand-500 text-white'
                  : 'bg-surface-elevated text-[var(--text-secondary)] hover:bg-brand-500/10 hover:text-brand-400'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Bbox controls */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {(['minLat', 'minLng', 'maxLat', 'maxLng'] as const).map((key) => (
          <div key={key}>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1 uppercase tracking-wide">{key}</label>
            <input
              type="number"
              step="any"
              className={inputCls}
              value={bbox[key]}
              onChange={(e) => setBbox((b) => ({ ...b, [key]: parseFloat(e.target.value) }))}
            />
          </div>
        ))}
      </div>

      <button
        onClick={handleSearch}
        disabled={loading}
        className="flex items-center gap-2 w-full sm:w-auto bg-brand-500 hover:bg-brand-600 text-white font-medium px-6 py-2.5 rounded-lg disabled:opacity-50 transition-colors mb-6"
      >
        <Search className="w-4 h-4" />
        {loading ? 'Searching…' : 'Search Places'}
      </button>

      {searchError && <p className="text-sm text-red-400 mb-4">{searchError}</p>}

      {/* Results */}
      {hasSearched && (
        <div>
          <p className="text-sm text-[var(--text-muted)] mb-3">{results.length} place{results.length !== 1 ? 's' : ''} found</p>
          {results.length === 0 ? (
            <div className="text-center py-16 text-[var(--text-muted)]">
              <MapPin className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p>No places found in this area.</p>
              <p className="text-sm mt-1">Try adjusting the bounding box or adding a new place.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {results.map((place) => {
                const Icon = PLACE_CATEGORY_ICON[place.category] ?? MapPin;
                return (
                  <button
                    key={place.id}
                    onClick={() => openPlace(place)}
                    disabled={modalLoading}
                    className="text-left bg-surface-card border border-surface-border rounded-xl p-4 hover:border-brand-500/40 transition-all"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-brand-500/10 flex items-center justify-center flex-shrink-0">
                        <Icon className="w-5 h-5 text-brand-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-[var(--text-primary)] truncate">{place.name}</p>
                        <p className="text-xs text-[var(--text-muted)] capitalize">{place.category.replace('_', ' ')}</p>
                        {place.address && (
                          <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate">{place.address}</p>
                        )}
                        <div className="mt-2">
                          <StarDisplay rating={place.overallRating} count={place.reviewCount} />
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {!hasSearched && (
        <div className="text-center py-16 text-[var(--text-muted)]">
          <Search className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>Search for places in an area to get started.</p>
        </div>
      )}

      {selectedPlace && (
        <PlaceDetailModal
          place={selectedPlace}
          onClose={() => setSelectedPlace(null)}
          onRefresh={refreshPlace}
        />
      )}
    </div>
  );
}
