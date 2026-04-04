'use client';

import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Tag, Users, AlertTriangle, CheckCircle, Copy } from 'lucide-react';
import { qrCodes } from '@/lib/api';
import { QR_CATEGORY_LABELS, type TrackedItem } from '@/types';

interface TagDetailModalProps {
  tag: TrackedItem;
  onClose?: () => void;
}

export function TagDetailModal({ tag: initialTag }: TagDetailModalProps) {
  const [tag, setTag] = useState(initialTag);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const scanUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/q/${tag.code}`
      : `/q/${tag.code}`;

  async function toggleLost() {
    setLoading(true);
    try {
      const updated = tag.isLost
        ? await qrCodes.markFound(tag.id)
        : await qrCodes.markLost(tag.id);
      setTag((prev) => ({ ...prev, isLost: updated.isLost }));
    } finally {
      setLoading(false);
    }
  }

  function copyUrl() {
    navigator.clipboard.writeText(scanUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="p-5 space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${tag.isLost ? 'bg-red-500/15' : 'bg-brand-500/15'}`}>
          <Tag className={`w-6 h-6 ${tag.isLost ? 'text-red-400' : 'text-brand-400'}`} />
        </div>
        <div>
          <h2 className="font-bold text-white">{tag.label}</h2>
          <p className="text-sm text-slate-400 capitalize">{QR_CATEGORY_LABELS[tag.category] ?? tag.category}</p>
        </div>
        {tag.isLost && (
          <span className="ml-auto text-xs bg-red-500/20 text-red-400 px-2.5 py-1 rounded-full font-medium">
            Lost
          </span>
        )}
      </div>

      {/* QR Code */}
      <div className="flex flex-col items-center gap-3 py-4 bg-surface-elevated rounded-xl">
        <QRCodeSVG
          value={scanUrl}
          size={160}
          bgColor="transparent"
          fgColor="#f1f5f9"
          includeMargin={false}
        />
        <button
          onClick={copyUrl}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-brand-400 transition-colors"
        >
          {copied ? <CheckCircle className="w-3.5 h-3.5 text-brand-400" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? 'Copied!' : 'Copy scan link'}
        </button>
      </div>

      {/* Info */}
      <div className="space-y-2">
        {tag.ownerContactEmail && (
          <InfoRow label="Contact email" value={tag.ownerContactEmail} />
        )}
        {tag.ownerContactPhone && (
          <InfoRow label="Contact phone" value={tag.ownerContactPhone} />
        )}
        {tag.rewardMessage && (
          <InfoRow label="Reward" value={tag.rewardMessage} />
        )}
        <div className="flex items-center gap-2 text-sm">
          <Users className="w-4 h-4 text-slate-500" />
          <span className="text-slate-400">{tag.guardianCount} guardian{tag.guardianCount !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Lost / Found toggle */}
      <button
        onClick={toggleLost}
        disabled={loading}
        className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-colors ${
          tag.isLost
            ? 'bg-brand-500/15 text-brand-400 hover:bg-brand-500/25'
            : 'bg-red-500/15 text-red-400 hover:bg-red-500/25'
        } disabled:opacity-50`}
      >
        {loading ? '…' : tag.isLost ? (
          <><CheckCircle className="w-4 h-4" /> Mark as found</>
        ) : (
          <><AlertTriangle className="w-4 h-4" /> Report as lost</>
        )}
      </button>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-sm text-white">{value}</span>
    </div>
  );
}
