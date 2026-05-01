'use client';

import { useState } from 'react';
import { places, PlaceWithReviews, PlaceReviewData, CreateReviewPayload, ApiError } from '@/lib/api';

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

interface StarPickerProps {
  value: number;
  onChange: (v: number) => void;
}

function StarPicker({ value, onChange }: StarPickerProps) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          className={`text-2xl leading-none transition-colors ${star <= value ? 'text-yellow-400' : 'text-gray-300 dark:text-gray-600'}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

function ReviewCard({
  review,
  placeId,
  onFlag,
}: {
  review: PlaceReviewData;
  placeId: string;
  onFlag: () => void;
}) {
  const [flagging, setFlagging] = useState(false);
  const [flagReason, setFlagReason] = useState('');
  const [flagLoading, setFlagLoading] = useState(false);
  const [flagError, setFlagError] = useState('');

  async function submitFlag() {
    if (!flagReason.trim()) return;
    setFlagLoading(true);
    setFlagError('');
    try {
      await places.flagReview(placeId, review.id, flagReason.trim());
      setFlagging(false);
      onFlag();
    } catch (err) {
      setFlagError(err instanceof ApiError ? err.message : 'Failed to flag review');
    } finally {
      setFlagLoading(false);
    }
  }

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((s) => (
            <span key={s} className={s <= review.overallRating ? 'text-yellow-400' : 'text-gray-300 dark:text-gray-600'}>
              ★
            </span>
          ))}
        </div>
        <span className="text-xs text-gray-500">{new Date(review.createdAt).toLocaleDateString()}</span>
      </div>
      {review.comment && (
        <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">{review.comment}</p>
      )}
      <div className="mt-2 flex gap-3 text-xs text-gray-400">
        {review.safetyRating != null && <span>Safety: {review.safetyRating}/5</span>}
        {review.cleanlinessRating != null && <span>Cleanliness: {review.cleanlinessRating}/5</span>}
        {review.valueRating != null && <span>Value: {review.valueRating}/5</span>}
        {review.serviceRating != null && <span>Service: {review.serviceRating}/5</span>}
      </div>
      <div className="mt-3">
        {flagging ? (
          <div className="space-y-2">
            <input
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-800"
              placeholder="Reason for flagging..."
              maxLength={100}
              value={flagReason}
              onChange={(e) => setFlagReason(e.target.value)}
            />
            {flagError && <p className="text-xs text-red-500">{flagError}</p>}
            <div className="flex gap-2">
              <button
                onClick={submitFlag}
                disabled={flagLoading || !flagReason.trim()}
                className="text-xs bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 disabled:opacity-50"
              >
                {flagLoading ? 'Flagging…' : 'Submit Flag'}
              </button>
              <button
                onClick={() => { setFlagging(false); setFlagReason(''); setFlagError(''); }}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setFlagging(true)}
            className="text-xs text-gray-400 hover:text-red-500 transition-colors"
          >
            🚩 Flag
          </button>
        )}
      </div>
    </div>
  );
}

interface Props {
  place: PlaceWithReviews;
  onClose: () => void;
  onRefresh: () => void;
}

export default function PlaceDetailModal({ place, onClose, onRefresh }: Props) {
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [form, setForm] = useState<CreateReviewPayload>({ overallRating: 0 });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  async function handleSubmitReview(e: React.FormEvent) {
    e.preventDefault();
    if (form.overallRating < 1) {
      setSubmitError('Please select a star rating.');
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    try {
      await places.createReview(place.id, form);
      setShowReviewForm(false);
      setForm({ overallRating: 0 });
      onRefresh();
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  }

  const emoji = PLACE_CATEGORY_EMOJI[place.category] ?? '📍';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-900 rounded-2xl shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-start gap-3">
          <span className="text-3xl">{emoji}</span>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white truncate">{place.name}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">{place.category.replace('_', ' ')}</p>
            {place.address && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">{place.address}</p>
            )}
            <div className="flex items-center gap-2 mt-1">
              {place.overallRating ? (
                <>
                  <span className="text-yellow-400 text-sm">{'★'.repeat(Math.round(parseFloat(place.overallRating)))}</span>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{parseFloat(place.overallRating).toFixed(1)}</span>
                </>
              ) : (
                <span className="text-gray-400 text-xs">No rating yet</span>
              )}
              <span className="text-xs text-gray-400">({place.reviewCount} {place.reviewCount === 1 ? 'review' : 'reviews'})</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl leading-none ml-2"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4">
          {/* Write a review */}
          <div>
            <button
              onClick={() => setShowReviewForm((v) => !v)}
              className="w-full text-sm font-medium text-brand-500 hover:text-brand-600 border border-brand-300 rounded-lg py-2 transition-colors"
            >
              {showReviewForm ? 'Cancel Review' : '✏️ Write a Review'}
            </button>
            {showReviewForm && (
              <form onSubmit={handleSubmitReview} className="mt-3 space-y-3 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Overall Rating *</label>
                  <StarPicker value={form.overallRating} onChange={(v) => setForm((f) => ({ ...f, overallRating: v }))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {(['safetyRating', 'cleanlinessRating', 'valueRating', 'serviceRating'] as const).map((field) => (
                    <div key={field}>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 capitalize">
                        {field.replace('Rating', '').replace(/([A-Z])/g, ' $1').trim()}
                      </label>
                      <StarPicker
                        value={form[field] ?? 0}
                        onChange={(v) => setForm((f) => ({ ...f, [field]: v }))}
                      />
                    </div>
                  ))}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Comment</label>
                  <textarea
                    className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-gray-800 resize-none"
                    rows={3}
                    maxLength={500}
                    placeholder="Share your experience…"
                    value={form.comment ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))}
                  />
                </div>
                {submitError && <p className="text-sm text-red-500">{submitError}</p>}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-brand-500 text-white font-medium py-2 rounded-lg hover:bg-brand-600 disabled:opacity-50 transition-colors"
                >
                  {submitting ? 'Submitting…' : 'Submit Review'}
                </button>
              </form>
            )}
          </div>

          {/* Reviews list */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Reviews</h3>
            {place.reviews.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No reviews yet. Be the first.</p>
            ) : (
              place.reviews.map((review) => (
                <ReviewCard key={review.id} review={review} placeId={place.id} onFlag={onRefresh} />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
