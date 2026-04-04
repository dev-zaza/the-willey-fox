'use client';

import { useState, useCallback } from 'react';
import { places, PlaceData, PlaceWithReviews, CreatePlacePayload, ApiError } from '@/lib/api';
import PlaceDetailModal from './PlaceDetailModal';

const PLACE_TYPES = [
  { value: '', label: 'All' },
  { value: 'hotel', label: '🏨 Hotel' },
  { value: 'restaurant', label: '🍽️ Restaurant' },
  { value: 'cafe', label: '☕ Cafe' },
  { value: 'bar', label: '🍺 Bar' },
  { value: 'attraction', label: '🎭 Attraction' },
  { value: 'park', label: '🌳 Park' },
  { value: 'transport_hub', label: '🚉 Transport Hub' },
  { value: 'shopping', label: '🛍️ Shopping' },
  { value: 'other', label: '📍 Other' },
] as const;

const PLACE_CATEGORY_EMOJI: Record<string, string> = {
  hotel: '🏨',
  restaurant: '🍽️',
  cafe: '☕',
  bar: '🍺',
  attraction: '🎭',
  park: '🌳',
  transport_hub: '🚉',
  shopping: '🛍️',
  other: '📍',
};

// Default bbox: London
const DEFAULT_BBOX = { minLat: 51.4, minLng: -0.2, maxLat: 51.6, maxLng: 0.1 };

function StarDisplay({ rating, count }: { rating?: string | null; count: number }) {
  if (!rating) return <span className="text-xs text-gray-400">No ratings</span>;
  const r = parseFloat(rating);
  const filled = Math.round(r);
  return (
    <div className="flex items-center gap-1">
      <span className="text-yellow-400 text-sm">
        {'★'.repeat(filled)}{'☆'.repeat(5 - filled)}
      </span>
      <span className="text-xs text-gray-500">{r.toFixed(1)} ({count})</span>
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

  const handleSearch = useCallback(async () => {
    setLoading(true);
    setSearchError('');
    try {
      const data = await places.search({
        ...bbox,
        ...(category ? { category } : {}),
      });
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
      // fallback: show with empty reviews
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
      // also refresh search results card
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Places</h1>
          <p className="text-sm text-gray-500 mt-1">Discover and rate real-world places on the safety map</p>
        </div>
        <button
          onClick={() => setShowAddForm((v) => !v)}
          className="bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          {showAddForm ? 'Cancel' : '+ Add a Place'}
        </button>
      </div>

      {/* Add Place Form */}
      {showAddForm && (
        <form
          onSubmit={handleAddPlace}
          className="mb-6 border border-orange-200 dark:border-orange-900 rounded-xl p-5 bg-orange-50 dark:bg-orange-950/20 space-y-4"
        >
          <h2 className="font-semibold text-gray-800 dark:text-white">Add a Place</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Name *</label>
              <input
                required
                maxLength={200}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800"
                value={addForm.name}
                onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Category *</label>
              <select
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800"
                value={addForm.category}
                onChange={(e) => setAddForm((f) => ({ ...f, category: e.target.value }))}
              >
                {PLACE_TYPES.filter((t) => t.value).map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Latitude *</label>
              <input
                type="number"
                step="any"
                required
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800"
                value={addForm.lat}
                onChange={(e) => setAddForm((f) => ({ ...f, lat: parseFloat(e.target.value) }))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Longitude *</label>
              <input
                type="number"
                step="any"
                required
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800"
                value={addForm.lng}
                onChange={(e) => setAddForm((f) => ({ ...f, lng: parseFloat(e.target.value) }))}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Address</label>
              <input
                maxLength={500}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800"
                value={addForm.address ?? ''}
                onChange={(e) => setAddForm((f) => ({ ...f, address: e.target.value }))}
              />
            </div>
          </div>
          {addError && <p className="text-sm text-red-500">{addError}</p>}
          <button
            type="submit"
            disabled={addLoading}
            className="bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium px-6 py-2 rounded-lg disabled:opacity-50 transition-colors"
          >
            {addLoading ? 'Saving…' : 'Save Place'}
          </button>
        </form>
      )}

      {/* Category filter */}
      <div className="flex flex-wrap gap-2 mb-4">
        {PLACE_TYPES.map((t) => (
          <button
            key={t.value}
            onClick={() => setCategory(t.value)}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              category === t.value
                ? 'bg-orange-500 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-orange-100 dark:hover:bg-orange-900/30'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Bbox controls */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {(['minLat', 'minLng', 'maxLat', 'maxLng'] as const).map((key) => (
          <div key={key}>
            <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">{key}</label>
            <input
              type="number"
              step="any"
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-gray-800"
              value={bbox[key]}
              onChange={(e) => setBbox((b) => ({ ...b, [key]: parseFloat(e.target.value) }))}
            />
          </div>
        ))}
      </div>

      <button
        onClick={handleSearch}
        disabled={loading}
        className="w-full sm:w-auto bg-gray-900 dark:bg-white dark:text-gray-900 text-white font-medium px-6 py-2.5 rounded-lg hover:bg-gray-700 dark:hover:bg-gray-100 disabled:opacity-50 transition-colors mb-6"
      >
        {loading ? 'Searching…' : '🔍 Search Places'}
      </button>

      {searchError && <p className="text-sm text-red-500 mb-4">{searchError}</p>}

      {/* Results */}
      {hasSearched && (
        <div>
          <p className="text-sm text-gray-500 mb-3">{results.length} place{results.length !== 1 ? 's' : ''} found</p>
          {results.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p className="text-4xl mb-3">📍</p>
              <p>No places found in this area.</p>
              <p className="text-sm mt-1">Try adjusting the bounding box or adding a new place.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {results.map((place) => (
                <button
                  key={place.id}
                  onClick={() => openPlace(place)}
                  disabled={modalLoading}
                  className="text-left border border-gray-200 dark:border-gray-700 rounded-xl p-4 hover:border-orange-300 dark:hover:border-orange-700 hover:shadow-md transition-all bg-white dark:bg-gray-900"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{PLACE_CATEGORY_EMOJI[place.category] ?? '📍'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-white truncate">{place.name}</p>
                      <p className="text-xs text-gray-500 capitalize">{place.category.replace('_', ' ')}</p>
                      {place.address && (
                        <p className="text-xs text-gray-400 mt-0.5 truncate">{place.address}</p>
                      )}
                      <div className="mt-2">
                        <StarDisplay rating={place.overallRating} count={place.reviewCount} />
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {!hasSearched && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">🗺️</p>
          <p>Search for places in an area to get started.</p>
        </div>
      )}

      {/* Detail Modal */}
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
