'use client';

import { useState } from 'react';
import { ThumbsUp, ThumbsDown, MapPin } from 'lucide-react';
import { TAG_CATEGORY_LABELS, PIN_COLORS } from '@/types';
import { pins as pinsApi, type PinData } from '@/lib/api';

interface PinDetailModalProps {
  pin: PinData;
  onClose?: () => void;
}

export function PinDetailModal({ pin: initialPin }: PinDetailModalProps) {
  const [pin, setPin] = useState(initialPin);
  const [voting, setVoting] = useState(false);
  const [userVote, setUserVote] = useState<'up' | 'down' | null>(null);

  const color = PIN_COLORS[pin.type as keyof typeof PIN_COLORS] ?? '#94a3b8';
  const label = TAG_CATEGORY_LABELS[pin.type as keyof typeof TAG_CATEGORY_LABELS] ?? pin.type;

  async function handleVote(vote: 'up' | 'down') {
    if (voting || userVote === vote) return; // Prevent duplicate same-direction votes
    setVoting(true);
    const prevPin = pin;
    const prevVote = userVote;

    const upDelta = vote === 'up' ? (prevVote === 'down' ? 2 : 1) : prevVote === 'up' ? -1 : 0;
    const downDelta = vote === 'down' ? (prevVote === 'up' ? 2 : 1) : prevVote === 'down' ? -1 : 0;

    setPin((prev) => ({
      ...prev,
      upvotes: Math.max(0, prev.upvotes + upDelta),
      downvotes: Math.max(0, prev.downvotes + downDelta),
    }));
    setUserVote(vote);

    try {
      await pinsApi.vote(pin.id, vote);
    } catch {
      setPin(prevPin);
      setUserVote(prevVote);
    } finally {
      setVoting(false);
    }
  }

  return (
    <div className="p-5 space-y-4">
      {/* Category badge */}
      <div className="flex items-center gap-2">
        <span
          className="px-3 py-1 rounded-full text-xs font-semibold"
          style={{ background: `${color}20`, color }}
        >
          {label}
        </span>
        <span className={`text-xs px-2 py-0.5 rounded-full ${pin.status === 'active' ? 'bg-green-500/15 text-green-400' : 'bg-surface-elevated text-[var(--text-muted)]'}`}>
          {pin.status}
        </span>
      </div>

      <h2 className="text-lg font-bold text-white">{pin.title}</h2>
      {pin.description && (
        <p className="text-sm text-[#7a6957] leading-relaxed">{pin.description}</p>
      )}

      {/* Location */}
      <div className="flex items-center gap-2 text-xs text-[#9d8c7a]">
        <MapPin className="w-3.5 h-3.5" />
        <span>{parseFloat(pin.lat).toFixed(5)}, {parseFloat(pin.lng).toFixed(5)}</span>
      </div>

      {pin.expiresAt && (
        <p className="text-xs text-amber-400">
          Expires {new Date(pin.expiresAt).toLocaleString()}
        </p>
      )}

      {/* Vote actions */}
      <div className="flex items-center gap-3 pt-2 border-t border-surface-border">
        <button
          onClick={() => handleVote('up')}
          disabled={voting}
          className="flex items-center gap-1.5 text-sm text-green-400 hover:text-green-300 disabled:opacity-50 transition-colors"
        >
          <ThumbsUp className="w-4 h-4" />
          <span>{pin.upvotes}</span>
        </button>
        <button
          onClick={() => handleVote('down')}
          disabled={voting}
          className="flex items-center gap-1.5 text-sm text-red-400 hover:text-red-300 disabled:opacity-50 transition-colors"
        >
          <ThumbsDown className="w-4 h-4" />
          <span>{pin.downvotes}</span>
        </button>
      </div>
    </div>
  );
}
