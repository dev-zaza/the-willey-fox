'use client';

import dynamic from 'next/dynamic';
import type { LatLng } from '@/types';
import type { PinData, SafetyZoneOverlay } from '@/lib/api';

// All Leaflet imports must be dynamic (no SSR)
const MapInner = dynamic(() => import('./map-inner').then((m) => ({ default: m.MapInner })), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-surface flex items-center justify-center">
      <div className="text-[#9d8c7a] text-sm">Loading map…</div>
    </div>
  ),
});

interface MapViewProps {
  pins?: PinData[];
  route?: LatLng[];
  safetyZones?: SafetyZoneOverlay[];
  center?: LatLng;
  zoom?: number;
  onPinClick?: (pin: PinData) => void;
  onMapClick?: (latlng: LatLng) => void;
  onBoundsChange?: (bounds: { minLat: number; minLng: number; maxLat: number; maxLng: number }) => void;
}

export function MapView(props: MapViewProps) {
  return <MapInner {...props} />;
}
