'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Tag, Plus, AlertCircle } from 'lucide-react';
import { qrCodes } from '@/lib/api';
import type { TrackedItem } from '@/types';

interface MyTagsModalProps {
  onClose?: () => void;
  onTagSelect: (tag: TrackedItem) => void;
  onRegister: () => void;
}

export function MyTagsModal({ onTagSelect, onRegister }: MyTagsModalProps) {
  const router = useRouter();
  const [tags, setTags] = useState<TrackedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    qrCodes
      .list()
      .then((data) =>
        setTags(
          data.map((qr) => ({
            id: qr.id,
            label: qr.label ?? qr.name,
            category: qr.category as any,
            code: qr.uniqueCode,
            isLost: qr.isLost,
            ownerContactEmail: qr.ownerContactEmail,
            ownerContactPhone: qr.ownerContactPhone,
            rewardMessage: qr.rewardMessage,
            guardianCount: 0,
            createdAt: qr.createdAt,
          })),
        ),
      )
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-5">
      <button
        onClick={() => router.push('/dashboard/scan')}
        className="w-full flex items-center justify-center gap-2 border border-dashed border-brand-500/40 rounded-xl py-3 text-brand-400 text-sm font-medium hover:bg-brand-500/10 transition-colors mb-3"
      >
        <span aria-hidden>📷</span> Scan a QR tag
      </button>
      <button
        onClick={onRegister}
        className="w-full flex items-center justify-center gap-2 border border-dashed border-brand-500/40 rounded-xl py-3 text-brand-400 text-sm font-medium hover:bg-brand-500/10 transition-colors mb-4"
      >
        <Plus className="w-4 h-4" /> Register new tag
      </button>

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-surface-elevated rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {!loading && !error && tags.length === 0 && (
        <div className="text-center py-10 text-[#9d8c7a] text-sm">
          No tags yet. Register your first tag above.
        </div>
      )}

      <div className="space-y-2">
        {tags.map((tag) => (
          <button
            key={tag.id}
            onClick={() => onTagSelect(tag)}
            className="w-full flex items-center gap-3 glass rounded-xl p-4 hover:border-brand-500/30 transition-colors text-left"
          >
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${tag.isLost ? 'bg-red-500/15' : 'bg-brand-500/15'}`}>
              <Tag className={`w-5 h-5 ${tag.isLost ? 'text-red-400' : 'text-brand-400'}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-[var(--text-primary)] text-sm truncate">{tag.label}</p>
              <p className="text-xs text-[#9d8c7a] capitalize">{tag.category}</p>
            </div>
            {tag.isLost && (
              <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full flex-shrink-0">
                Lost
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
