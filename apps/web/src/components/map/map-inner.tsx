'use client';

import { useEffect, useRef, useState } from 'react';
import { MapContainer, useMap, useMapEvents, Circle, GeoJSON, Tooltip } from 'react-leaflet';
import { tileLayer as createTileLayer, type Map as LeafletMap, type TileLayer as LeafletTileLayer } from 'leaflet';
import type { Feature, FeatureCollection, GeoJsonObject, Geometry } from 'geojson';
import 'leaflet/dist/leaflet.css';
import { EventPin } from './event-pin';
import { RouteLayer } from './route-layer';
import { UserLocationMarker } from './user-location-marker';
import { resolveNumericId } from './country-lookup';
import type { LatLng } from '@/types';
import type { PinData, SafetyZoneOverlay, H3TileCollection } from '@/lib/api';

const DEFAULT_CENTER: [number, number] = [51.505, -0.09];
const DEFAULT_ZOOM = 13;

/** Same Mapbox style family as mobile; Leaflet raster tiles (256px). */
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ?? '';
const TILE_URL = MAPBOX_TOKEN
  ? `https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/256/{z}/{x}/{y}@2x?access_token=${MAPBOX_TOKEN}`
  : '';
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a>';

function mapIsLive(map: LeafletMap) {
  try {
    return Boolean(map.getContainer()?.parentNode && map.getPane('mapPane') && map.getPane('tilePane'));
  } catch {
    return false;
  }
}

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
      if (!mapIsLive(map)) return;
      map.flyTo([center.lat, center.lng], zoom ?? map.getZoom(), {
        animate: true,
        duration: 1.2,
      });
      prevCenter.current = center;
    }
  }, [center, zoom, map]);

  useEffect(() => {
    const container = map.getContainer();
    if (!container) return;

    let raf = 0;
    const invalidate = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (!mapIsLive(map)) return;
        const size = map.getSize();
        if (size.x < 1 || size.y < 1) return;
        map.invalidateSize({ animate: false });
      });
    };

    const ro = new ResizeObserver(invalidate);
    ro.observe(container);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [map]);

  return null;
}

function MapTiles({
  url,
  attribution,
  maxZoom,
}: {
  url: string;
  attribution: string;
  maxZoom: number;
}) {
  const map = useMap();

  useEffect(() => {
    let layer: LeafletTileLayer | null = null;
    let cancelled = false;

    const attach = () => {
      if (cancelled || layer) return;
      if (!map.getPane('tilePane')) return;
      const next = createTileLayer(url, { attribution, maxZoom });
      try {
        next.addTo(map);
        layer = next;
      } catch {
        /* map torn down during attach (Strict Mode remount) */
      }
    };

    map.whenReady(attach);

    return () => {
      cancelled = true;
      if (layer) {
        try {
          map.removeLayer(layer);
        } catch {
          /* map already destroyed */
        }
        layer = null;
      }
    };
  }, [map, url, attribution, maxZoom]);

  return null;
}

type BoundsPayload = { minLat: number; minLng: number; maxLat: number; maxLng: number };

const LONG_PRESS_MS = 500;
const LONG_PRESS_MOVE_PX = 12;

/** Match mobile: add-pin only on long-press (or desktop right-click). Short tap does not open create-pin. */
function MapEventHandler({
  onMapLongPress,
  onBoundsChange,
}: {
  onMapLongPress?: (latlng: LatLng) => void;
  onBoundsChange?: (bounds: BoundsPayload) => void;
}) {
  const map = useMap();
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPoint = useRef<{ x: number; y: number } | null>(null);
  const suppressClickUntil = useRef(0);
  const onLongPressRef = useRef(onMapLongPress);
  onLongPressRef.current = onMapLongPress;

  useMapEvents({
    contextmenu(e) {
      // Desktop right-click → same as long-press pin
      e.originalEvent.preventDefault();
      onLongPressRef.current?.({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
    click() {
      // Swallow ghost click after long-press
      if (Date.now() < suppressClickUntil.current) {
        return;
      }
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

  useEffect(() => {
    if (!mapIsLive(map)) return;
    const container = map.getContainer();

    const clearTimer = () => {
      if (longPressTimer.current != null) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
      startPoint.current = null;
    };

    const fireLongPress = (clientX: number, clientY: number) => {
      const rect = container.getBoundingClientRect();
      const point = map.containerPointToLatLng([
        clientX - rect.left,
        clientY - rect.top,
      ]);
      suppressClickUntil.current = Date.now() + 400;
      onLongPressRef.current?.({ lat: point.lat, lng: point.lng });
    };

    const startLongPress = (clientX: number, clientY: number) => {
      clearTimer();
      startPoint.current = { x: clientX, y: clientY };
      longPressTimer.current = setTimeout(() => {
        const origin = startPoint.current;
        longPressTimer.current = null;
        startPoint.current = null;
        if (!origin) return;
        fireLongPress(origin.x, origin.y);
      }, LONG_PRESS_MS);
    };

    const onPointerDown = (e: PointerEvent) => {
      // Ignore non-primary mouse button (right-click uses contextmenu instead)
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      startLongPress(e.clientX, e.clientY);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!startPoint.current || longPressTimer.current == null) return;
      const dx = e.clientX - startPoint.current.x;
      const dy = e.clientY - startPoint.current.y;
      if (dx * dx + dy * dy > LONG_PRESS_MOVE_PX * LONG_PRESS_MOVE_PX) {
        clearTimer();
      }
    };

    const onPointerUp = () => clearTimer();

    // Block the synthetic click that follows a completed long-press (esp. on hex layers)
    const onClickCapture = (e: MouseEvent) => {
      if (Date.now() < suppressClickUntil.current) {
        e.stopPropagation();
        e.preventDefault();
      }
    };

    container.addEventListener('pointerdown', onPointerDown);
    container.addEventListener('pointermove', onPointerMove);
    container.addEventListener('pointerup', onPointerUp);
    container.addEventListener('pointercancel', onPointerUp);
    container.addEventListener('pointerleave', onPointerUp);
    container.addEventListener('click', onClickCapture, true);

    return () => {
      clearTimer();
      container.removeEventListener('pointerdown', onPointerDown);
      container.removeEventListener('pointermove', onPointerMove);
      container.removeEventListener('pointerup', onPointerUp);
      container.removeEventListener('pointercancel', onPointerUp);
      container.removeEventListener('pointerleave', onPointerUp);
      container.removeEventListener('click', onClickCapture, true);
    };
  }, [map]);

  return null;
}

function safetyScoreToColor(score: number): string {
  if (score >= 70) return '#16a34a';
  if (score >= 40) return '#f59e0b';
  return '#ef4444';
}

// Module-level cache — loaded once for the lifetime of the page
let countriesCache: Map<number, Feature<Geometry>> | null = null;
let countriesLoadPromise: Promise<Map<number, Feature<Geometry>>> | null = null;

function loadCountries(): Promise<Map<number, Feature<Geometry>>> {
  if (countriesCache) return Promise.resolve(countriesCache);
  if (!countriesLoadPromise) {
    countriesLoadPromise = Promise.all([
      fetch('/countries-50m.json').then(r => r.json()),
      import('topojson-client'),
    ]).then(([topoRes, topojson]) => {
      const fc = topojson.feature(topoRes, topoRes.objects.countries) as unknown as FeatureCollection<Geometry>;
      const map = new Map<number, Feature<Geometry>>();
      for (const f of fc.features) {
        if (f.id != null) map.set(Number(f.id), f);
      }
      countriesCache = map;
      return map;
    });
  }
  return countriesLoadPromise;
}

interface ZoneLayerProps {
  safetyZones: SafetyZoneOverlay[];
}

function ZoneLayer({ safetyZones }: ZoneLayerProps) {
  const [countries, setCountries] = useState<Map<number, Feature<Geometry>> | null>(
    countriesCache, // use synchronously if already loaded
  );

  // Always kick off load on mount; set state when done
  useEffect(() => {
    if (countriesCache) { setCountries(countriesCache); return; }
    loadCountries().then(m => setCountries(m)).catch(() => {});
  }, []);

  return (
    <>
      {safetyZones.map((zone) => {
        const score = Number(zone.safetyScore);
        const color = safetyScoreToColor(score);
        const label = zone.sourceRegion ?? zone.source;

        // Country-granularity → actual GeoJSON border, no boxes
        if (zone.sourceGranularity === 'country' && zone.sourceRegion) {
          if (!countries) return null; // still loading
          const numericId = resolveNumericId(zone.sourceRegion);
          const feature = numericId != null ? countries.get(numericId) : undefined;
          if (!feature) return null; // country not in 110m dataset
          const score2 = Number(zone.safetyScore);
          const color2 = safetyScoreToColor(score2);
          return (
            // key includes score so GeoJSON remounts when data changes
            <GeoJSON
              key={`${zone.id}-${score2}`}
              data={feature as GeoJsonObject}
              style={{ color: color2, fillColor: color2, fillOpacity: 0.25, weight: 1.5 }}
            >
              <Tooltip sticky>{label} — {score2.toFixed(0)}</Tooltip>
            </GeoJSON>
          );
        }

        // Point zones (street / neighbourhood) → circle
        const lat = zone.centerLat ? parseFloat(zone.centerLat) : (zone.centroidLat ? parseFloat(zone.centroidLat) : null);
        const lng = zone.centerLng ? parseFloat(zone.centerLng) : (zone.centroidLng ? parseFloat(zone.centroidLng) : null);
        if (!lat || !lng || isNaN(lat) || isNaN(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
        const radius = zone.radiusMetres ?? 2000;
        return (
          <Circle
            key={zone.id}
            center={[lat, lng]}
            radius={zone.radiusMetres ?? radius}
            pathOptions={{ color, fillColor: color, fillOpacity: 0.18, weight: 1 }}
          >
            <Tooltip sticky>{label} — {score.toFixed(0)}</Tooltip>
          </Circle>
        );
      })}
    </>
  );
}

interface MapInnerProps {
  pins?: PinData[];
  route?: LatLng[];
  safetyZones?: SafetyZoneOverlay[];
  h3Tiles?: H3TileCollection | null;
  center?: LatLng;
  zoom?: number;
  userLocation?: LatLng | null;
  onPinClick?: (pin: PinData) => void;
  /** Fired on long-press / right-click — used to open create-pin (matches mobile). */
  onMapLongPress?: (latlng: LatLng) => void;
  onBoundsChange?: (bounds: BoundsPayload) => void;
  onH3Click?: (props: {
    h3: string;
    score: number | null;
    band: string;
    color: string;
    incidentCount: number;
    lat?: number;
    lng?: number;
  }) => void;
}

export function MapInner({ pins = [], route, safetyZones = [], h3Tiles, center, zoom, userLocation, onPinClick, onMapLongPress, onBoundsChange, onH3Click }: MapInnerProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hasSize, setHasSize] = useState(false);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const markSized = () => {
      if (el.clientWidth > 0 && el.clientHeight > 0) {
        setHasSize(true);
        return true;
      }
      return false;
    };

    if (markSized()) return;

    const ro = new ResizeObserver(() => {
      if (markSized()) ro.disconnect();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%', height: '100%' }}>
      {hasSize ? (
      <MapContainer
        center={center ? [center.lat, center.lng] : DEFAULT_CENTER}
        zoom={zoom ?? DEFAULT_ZOOM}
        style={{ width: '100%', height: '100%' }}
        zoomControl={false}
      >
        {TILE_URL ? (
          <MapTiles url={TILE_URL} attribution={TILE_ATTRIBUTION} maxZoom={22} />
        ) : null}
        <MapController center={center} zoom={zoom} />
        <MapEventHandler onMapLongPress={onMapLongPress} onBoundsChange={onBoundsChange} />

        {pins.map((pin) => (
          <EventPin key={pin.id} pin={pin} onClick={onPinClick} />
        ))}

        {route && route.length >= 2 && <RouteLayer route={route} />}

        {userLocation ? <UserLocationMarker location={userLocation} /> : null}

        <ZoneLayer safetyZones={safetyZones} />

        {h3Tiles && h3Tiles.features.length > 0 && (
          <GeoJSON
            key={h3Tiles.features.length}
            data={h3Tiles as unknown as GeoJsonObject}
            style={(feature) => ({
              color: '#ffffff',
              weight: 0.8,
              fillColor: (feature as any)?.properties?.color ?? '#888888',
              fillOpacity: 0.48,
            })}
            onEachFeature={(feature, layer) => {
              const p = feature.properties as any;
              if (p?.h3) {
                layer.bindTooltip(
                  `${p.band ?? 'unknown'} · score: ${p.score != null ? Math.round(p.score) : '–'} · ${p.incidentCount ?? 0} incidents`,
                  { sticky: true },
                );
                layer.on('click', (e) => {
                  // Keep hex safety info on short tap; do not open create-pin
                  if (e.originalEvent?.stopPropagation) {
                    e.originalEvent.stopPropagation();
                  }
                  const latlng = (e as { latlng?: { lat: number; lng: number } }).latlng;
                  onH3Click?.({
                    h3: p.h3,
                    score: p.score != null ? Number(p.score) : null,
                    band: p.band ?? '',
                    color: p.color ?? '#888888',
                    incidentCount: p.incidentCount != null ? Number(p.incidentCount) : 0,
                    lat: latlng?.lat,
                    lng: latlng?.lng,
                  });
                });
              }
            }}
          />
        )}
      </MapContainer>
      ) : null}
      {!TILE_URL ? (
        <div
          style={{
            position: 'absolute',
            zIndex: 1000,
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(246,247,249,0.92)',
            padding: 24,
            textAlign: 'center',
            color: '#334155',
            fontSize: 14,
            pointerEvents: 'none',
          }}
        >
          Mapbox token missing. Set NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN in apps/web/.env.local
        </div>
      ) : null}
    </div>
  );
}
