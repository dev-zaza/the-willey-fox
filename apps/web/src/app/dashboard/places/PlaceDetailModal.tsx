'use client';

import { useState } from 'react';
import { X, Star, Flag, Hotel, Utensils, Coffee, Beer, Landmark, Trees, Train, ShoppingBag, MapPin, Pencil } from 'lucide-react';
import { places, PlaceWithReviews, PlaceReviewData, CreateReviewPayload, ApiError } from '@/lib/api';

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

const inputCls = 'w-full bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-brand-500 transition-colors';

interface StarPickerProps {
  value: number;
  onChange: (v: number) => void;
}

function StarPicker({ value, onChange }: StarPickerProps) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button key={star} type="button" onClick={() => onChange(star)}>
          <Star className={`w-5 h-5 transition-colors ${star <= value ? 'text-yellow-400 fill-current' : 'text-[var(--text-muted)]'}`} />
        </button>
      ))}
    </div>
  );
}

function ReviewCard({ review, placeId, onFlag }: { review: PlaceReviewData; placeId: string; onFlag: () => void }) {
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
    <div className="border border-surface-border rounded-lg p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-0.5">
          {[1, 2, 3, 4, 5].map((s) => (
            <Star key={s} className={`w-3.5 h-3.5 ${s <= review.overallRating ? 'text-yellow-400 fill-current' : 'text-[var(--text-muted)]'}`} />
          ))}
        </div>
        <span className="text-xs text-[var(--text-muted)]">{new Date(review.createdAt).toLocaleDateString()}</span>
      </div>
      {review.comment && (
        <p className="mt-2 text-sm text-[var(--text-secondary)]">{review.comment}</p>
      )}
      <div className="mt-2 flex flex-wrap gap-3 text-xs text-[var(--text-muted)]">
        {review.safetyRating != null && <span>Safety: {review.safetyRating}/5</span>}
        {review.cleanlinessRating != null && <span>Cleanliness: {review.cleanlinessRating}/5</span>}
        {review.valueRating != null && <span>Value: {review.valueRating}/5</span>}
        {review.serviceRating != null && <span>Service: {review.serviceRating}/5</span>}
      </div>
      <div className="mt-3">
        {flagging ? (
          <div className="space-y-2">
            <input
              className={inputCls}
              placeholder="Reason for flagging..."
              maxLength={100}
              value={flagReason}
              onChange={(e) => setFlagReason(e.target.value)}
            />
            {flagError && <p className="text-xs text-red-400">{flagError}</p>}
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
                className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setFlagging(true)}
            className="flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-red-400 transition-colors"
          >
            <Flag className="w-3 h-3" /> Flag
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

  const Icon = PLACE_CATEGORY_ICON[place.category] ?? MapPin;

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

  return (
    <div className="dashboard fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-surface-card border border-surface-border rounded-2xl shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-surface-card border-b border-surface-border px-6 py-4 flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-brand-500/10 flex items-center justify-center flex-shrink-0">
            <Icon className="w-5 h-5 text-brand-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] truncate">{place.name}</h2>
            <p className="text-sm text-[var(--text-muted)] capitalize">{place.category.replace('_', ' ')}</p>
            {place.address && (
              <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate">{place.address}</p>
            )}
            <div className="flex items-center gap-2 mt-1">
              {place.overallRating ? (
                <>
                  <div className="flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={`w-3.5 h-3.5 ${i < Math.round(parseFloat(place.overallRating!)) ? 'text-yellow-400 fill-current' : 'text-[var(--text-muted)]'}`} />
                    ))}
                  </div>
                  <span className="text-sm font-medium text-[var(--text-secondary)]">{parseFloat(place.overallRating).toFixed(1)}</span>
                </>
              ) : (
                <span className="text-[var(--text-muted)] text-xs">No rating yet</span>
              )}
              <span className="text-xs text-[var(--text-muted)]">({place.reviewCount} {place.reviewCount === 1 ? 'review' : 'reviews'})</span>
            </div>
          </div>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors ml-2">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4">
          <button
            onClick={() => setShowReviewForm((v) => !v)}
            className="flex items-center justify-center gap-2 w-full text-sm font-medium text-brand-400 hover:text-brand-300 border border-brand-500/30 rounded-lg py-2 transition-colors"
          >
            <Pencil className="w-4 h-4" />
            {showReviewForm ? 'Cancel Review' : 'Write a Review'}
          </button>

          {showReviewForm && (
            <form onSubmit={handleSubmitReview} className="space-y-3 border border-surface-border rounded-lg p-4 bg-surface-elevated">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Overall Rating *</label>
                <StarPicker value={form.overallRating} onChange={(v) => setForm((f) => ({ ...f, overallRating: v }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                {(['safetyRating', 'cleanlinessRating', 'valueRating', 'serviceRating'] as const).map((field) => (
                  <div key={field}>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1 capitalize">
                      {field.replace('Rating', '').replace(/([A-Z])/g, ' $1').trim()}
                    </label>
                    <StarPicker value={form[field] ?? 0} onChange={(v) => setForm((f) => ({ ...f, [field]: v }))} />
                  </div>
                ))}
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Comment</label>
                <textarea
                  className={`${inputCls} resize-none`}
                  rows={3}
                  maxLength={500}
                  placeholder="Share your experience…"
                  value={form.comment ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))}
                />
              </div>
              {submitError && <p className="text-sm text-red-400">{submitError}</p>}
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-brand-500 text-white font-medium py-2 rounded-lg hover:bg-brand-600 disabled:opacity-50 transition-colors"
              >
                {submitting ? 'Submitting…' : 'Submit Review'}
              </button>
            </form>
          )}

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-[var(--text-secondary)]">Reviews</h3>
            {place.reviews.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)] text-center py-6">No reviews yet. Be the first.</p>
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
