'use client';

import { Polyline, CircleMarker } from 'react-leaflet';
import type { LatLng } from '@/types';

interface RouteLayerProps {
  route: LatLng[];
  color?: string;
}

export function RouteLayer({ route, color = '#ea2e00' }: RouteLayerProps) {
  if (route.length < 2) return null;

  const positions = route.map((p) => [p.lat, p.lng] as [number, number]);
  const destination = positions[positions.length - 1];

  return (
    <>
      {/* Shadow layer */}
      <Polyline
        positions={positions}
        pathOptions={{ color: '#000000', weight: 10, opacity: 0.3 }}
      />
      {/* Main route */}
      <Polyline
        positions={positions}
        pathOptions={{ color, weight: 5, opacity: 0.9, lineCap: 'round', lineJoin: 'round' }}
      />
      {/* Glow layer */}
      <Polyline
        positions={positions}
        pathOptions={{ color, weight: 12, opacity: 0.15 }}
      />

      {/* Destination beacon */}
      <CircleMarker
        center={destination}
        radius={12}
        pathOptions={{ color, fillColor: color, fillOpacity: 0.2, weight: 2, opacity: 0.5 }}
        className="destination-beacon"
      />
      <CircleMarker
        center={destination}
        radius={6}
        pathOptions={{ color, fillColor: color, fillOpacity: 0.9, weight: 2 }}
      />
    </>
  );
}
