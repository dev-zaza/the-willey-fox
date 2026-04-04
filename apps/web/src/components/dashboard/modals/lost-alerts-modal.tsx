'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, MapPin, Clock } from 'lucide-react';
import { qrCodes, reports } from '@/lib/api';
import type { LostAlert } from '@/types';

interface LostAlertsModalProps {
  onClose?: () => void;
}

export function LostAlertsModal(_: LostAlertsModalProps) {
  const [alerts, setAlerts] = useState<LostAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const [tags, allReports] = await Promise.all([qrCodes.list(), reports.list()]);
        const tagMap = new Map(tags.map((t) => [t.id, t]));
        const all: LostAlert[] = allReports.map((r) => {
          const tag = tagMap.get(r.qrCodeId);
          return {
            id: r.id,
            itemId: r.qrCodeId,
            itemLabel: tag ? (tag.label ?? tag.name) : 'Unknown item',
            category: (tag?.category ?? 'other') as any,
            reportedAt: r.createdAt,
            lastSeenLocation:
              r.locationLat && r.locationLng
                ? { lat: parseFloat(r.locationLat), lng: parseFloat(r.locationLng) }
                : undefined,
            finderContact: r.finderContact,
            message: r.finderNotes,
          };
        });
        setAlerts(all.sort((a, b) => b.reportedAt.localeCompare(a.reportedAt)));
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="p-5 space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-surface-elevated rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-5 flex items-center gap-2 text-sm text-red-400">
        <AlertCircle className="w-4 h-4" />
        {error}
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <div className="p-5 text-center text-slate-500 text-sm py-12">
        No lost alerts. All your items are safe!
      </div>
    );
  }

  return (
    <div className="p-5 space-y-3">
      {alerts.map((alert) => (
        <div key={alert.id} className="glass rounded-xl p-4 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-medium text-white text-sm">{alert.itemLabel}</p>
              {alert.message && (
                <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{alert.message}</p>
              )}
            </div>
            <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full flex-shrink-0 capitalize">
              {alert.category}
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs text-slate-500">
            {alert.lastSeenLocation && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {alert.lastSeenLocation.lat.toFixed(4)}, {alert.lastSeenLocation.lng.toFixed(4)}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {new Date(alert.reportedAt).toLocaleDateString()}
            </span>
          </div>

          {alert.finderContact && (
            <p className="text-xs text-brand-400">Finder: {alert.finderContact}</p>
          )}
        </div>
      ))}
    </div>
  );
}
