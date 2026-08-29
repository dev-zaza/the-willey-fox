'use client';

import { useEffect } from 'react';
import { circleMarker } from 'leaflet';
import { useMap } from 'react-leaflet';
import type { LatLng } from '@/types';

interface UserLocationMarkerProps {
  location: LatLng;
}

/** Blue dot for the user's current position (matches common map UX). */
export function UserLocationMarker({ location }: UserLocationMarkerProps) {
  const map = useMap();

  useEffect(() => {
    if (!map.getPane('overlayPane')) return;

    const ring = circleMarker([location.lat, location.lng], {
      radius: 16,
      color: '#3b82f6',
      fillColor: '#3b82f6',
      fillOpacity: 0.18,
      weight: 2,
    });
    const dot = circleMarker([location.lat, location.lng], {
      radius: 7,
      color: '#ffffff',
      fillColor: '#3b82f6',
      fillOpacity: 1,
      weight: 3,
    });

    try {
      ring.addTo(map);
      dot.addTo(map);
    } catch {
      return;
    }

    return () => {
      try {
        map.removeLayer(ring);
        map.removeLayer(dot);
      } catch {
        /* map already torn down */
      }
    };
  }, [map, location.lat, location.lng]);

  return null;
}
