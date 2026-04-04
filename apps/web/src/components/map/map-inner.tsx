'use client';

import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, useMap, useMapEvents, Circle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { EventPin } from './event-pin';
import { RouteLayer } from './route-layer';
import type { LatLng } from '@/types';
import type { PinData, SafetyZoneOverlay } from '@/lib/api';

const DEFAULT_CENTER: [number, number] = [51.505, -0.09];
const DEFAULT_ZOOM = 13;
const TILE_URL =
  'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const TILE_ATTRIBUTION =
  '&copy; <a href="https://carto.com/">CARTO</a>';

// MapController: sync center/zoom programmatically
function MapController({ center, zoom }: { center?: LatLng; zoom?: number }) {
  const map = useMap();
  const prevCenter = useRef<LatLng | undefined>(undefined);

  useEffect(() => {
    if (
      center &&
      (!prevCenter.current ||
        prevCenter.current.lat !== center.lat ||
        prevCenter.current.lng !== center.lng)
    ) {
      map.flyTo([center.lat, center.lng], zoom ?? map.getZoom(), {
        animate: true,
        duration: 1.2,
      });
      prevCenter.current = center;
    }
  }, [center, zoom, map]);

  return null;
}

type BoundsPayload = { minLat: number; minLng: number; maxLat: number; maxLng: number };

// ClickHandler + BoundsEmitter
function MapEventHandler({
  onMapClick,
  onBoundsChange,
}: {
  onMapClick?: (latlng: LatLng) => void;
  onBoundsChange?: (bounds: BoundsPayload) => void;
}) {
  useMapEvents({
    click(e) {
      onMapClick?.({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
    moveend(e) {
      const b = e.target.getBounds();
      onBoundsChange?.({
        minLat: b.getSouthWest().lat,
        minLng: b.getSouthWest().lng,
        maxLat: b.getNorthEast().lat,
        maxLng: b.getNorthEast().lng,
      });
    },
    load(e) {
      const b = e.target.getBounds();
      onBoundsChange?.({
        minLat: b.getSouthWest().lat,
        minLng: b.getSouthWest().lng,
        maxLat: b.getNorthEast().lat,
        maxLng: b.getNorthEast().lng,
      });
    },
  });
  return null;
}

function safetyScoreToColor(score: number): string {
  if (score >= 70) return '#16a34a';
  if (score >= 40) return '#f59e0b';
  return '#ef4444';
}

interface MapInnerProps {
  pins?: PinData[];
  route?: LatLng[];
  safetyZones?: SafetyZoneOverlay[];
  center?: LatLng;
  zoom?: number;
  onPinClick?: (pin: PinData) => void;
  onMapClick?: (latlng: LatLng) => void;
  onBoundsChange?: (bounds: BoundsPayload) => void;
}

export function MapInner({ pins = [], route, safetyZones = [], center, zoom, onPinClick, onMapClick, onBoundsChange }: MapInnerProps) {
  return (
    <MapContainer
      center={
        center ? [center.lat, center.lng] : DEFAULT_CENTER
      }
      zoom={zoom ?? DEFAULT_ZOOM}
      style={{ width: '100%', height: '100%' }}
      zoomControl={false}
    >
      <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
      <MapController center={center} zoom={zoom} />
      <MapEventHandler onMapClick={onMapClick} onBoundsChange={onBoundsChange} />

      {pins.map((pin) => (
        <EventPin key={pin.id} pin={pin} onClick={onPinClick} />
      ))}

      {route && route.length >= 2 && <RouteLayer route={route} />}

      {safetyZones.map((zone) => {
        const lat = zone.centroidLat ? parseFloat(zone.centroidLat) : null;
        const lng = zone.centroidLng ? parseFloat(zone.centroidLng) : null;
        if (!lat || !lng) return null;
        const score = Number(zone.safetyScore);
        const color = safetyScoreToColor(score);
        return (
          <Circle
            key={zone.id}
            center={[lat, lng]}
            radius={2000}
            pathOptions={{ color, fillColor: color, fillOpacity: 0.2, weight: 1 }}
          />
        );
      })}
    </MapContainer>
  );
}
