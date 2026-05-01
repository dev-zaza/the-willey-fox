'use client';

import { useRef, useEffect, useState } from 'react';
import createGlobe, { type Marker, type Arc } from 'cobe';

// ── City data ────────────────────────────────────────────────────────────────
export interface CityMarker {
  id: string;          // matches cobe marker id → CSS var --cobe-{id}
  city: string;
  lat: number;
  lng: number;
  type: 'item' | 'pet' | 'person';
  message: string;
}

export const CITIES: CityMarker[] = [
  { id: 'm0',  city: 'New York',     lat: 40.71,  lng: -74.01, type: 'item',   message: 'Lost wallet recovered!' },
  { id: 'm1',  city: 'London',       lat: 51.51,  lng: -0.12,  type: 'pet',    message: 'Dog reunited with owner' },
  { id: 'm2',  city: 'Tokyo',        lat: 35.68,  lng: 139.69, type: 'person', message: 'Child found safe' },
  { id: 'm3',  city: 'Sydney',       lat: -33.87, lng: 151.21, type: 'item',   message: 'Luggage returned' },
  { id: 'm4',  city: 'Paris',        lat: 48.85,  lng: 2.35,   type: 'pet',    message: 'Cat found via QR' },
  { id: 'm5',  city: 'Dubai',        lat: 25.20,  lng: 55.27,  type: 'person', message: 'Elder returned home' },
  { id: 'm6',  city: 'Singapore',    lat: 1.35,   lng: 103.82, type: 'item',   message: 'Backpack recovered' },
  { id: 'm7',  city: 'Mumbai',       lat: 19.08,  lng: 72.88,  type: 'pet',    message: 'Lost dog reunited' },
  { id: 'm8',  city: 'São Paulo',    lat: -23.55, lng: -46.63, type: 'item',   message: 'Keys returned' },
  { id: 'm9',  city: 'Lagos',        lat: 6.52,   lng: 3.38,   type: 'person', message: 'Child safely home' },
  { id: 'm10', city: 'Moscow',       lat: 55.75,  lng: 37.62,  type: 'item',   message: 'Passport returned' },
  { id: 'm11', city: 'Buenos Aires', lat: -34.60, lng: -58.38, type: 'pet',    message: 'Cat scanned & reunited' },
];

const ARC_PAIRS: { from: number; to: number }[] = [
  { from: 0, to: 1 },   // NY → London
  { from: 4, to: 2 },   // Paris → Tokyo
  { from: 1, to: 8 },   // London → São Paulo
  { from: 7, to: 6 },   // Mumbai → Singapore
  { from: 9, to: 10 },  // Lagos → Moscow
  { from: 11, to: 3 },  // BA → Sydney
  { from: 5, to: 0 },   // Dubai → NY
];

// Lazy-load CSS anchor positioning polyfill once (safe in Chrome 125+, polyfills Safari/Firefox)
let polyfillLoaded = false;
function ensurePolyfill() {
  if (polyfillLoaded) return;
  if (typeof CSS !== 'undefined' && CSS.supports?.('anchor-name', '--x')) {
    polyfillLoaded = true;
    return;
  }
  polyfillLoaded = true;
  import('@oddbird/css-anchor-positioning').catch(() => {
    // Polyfill is a progressive enhancement — silently skip if unavailable
  });
}

// ── Component ────────────────────────────────────────────────────────────────
export interface GlobeCanvasProps {
  width: number;
  height: number;
  reducedMotion?: boolean;
}

export function GlobeCanvas({ width, height, reducedMotion = false }: GlobeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const phiRef = useRef(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    ensurePolyfill();
  }, []);

  useEffect(() => {
    if (!canvasRef.current) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const markers: Marker[] = CITIES.map((c) => ({
      id: c.id,
      location: [c.lat, c.lng],
      size: 0.05,
      color: [0.918, 0.18, 0.0],
    }));

    // Build the full pool of arcs once — we'll cycle them in/out via update()
    const allArcs: Arc[] = ARC_PAIRS.map(({ from, to }, i) => ({
      id: `a${i}`,
      from: [CITIES[from].lat, CITIES[from].lng],
      to:   [CITIES[to].lat,   CITIES[to].lng],
      color: [0.918, 0.18, 0.0],
    }));

    const globe = createGlobe(canvasRef.current, {
      devicePixelRatio: dpr,
      width: width * dpr,
      height: height * dpr,
      phi: 0,
      theta: 0.28,
      dark: 0,
      diffuse: 1.2,
      mapSamples: 16000,
      mapBrightness: 6,
      mapBaseBrightness: 0.0,
      baseColor: [0.94, 0.91, 0.84],
      markerColor: [0.918, 0.18, 0.0],
      glowColor: [0.95, 0.78, 0.7],
      markers,
      arcs: [],                            // start hidden — sequencer fills in
      arcColor: [0.918, 0.18, 0.0],
      arcWidth: 0.4,
      arcHeight: 0.18,
      markerElevation: 0.01,
    });

    setReady(true);

    // Arc sequencer — show 2 arcs at a time, rotate every 2.6s.
    // Each arc lives ~5s on screen total (overlapping windows give a sense of flow).
    let arcCursor = 0;
    let active: Arc[] = [];
    const tickArcs = () => {
      // Drop oldest, add next from pool
      if (active.length >= 2) active = active.slice(1);
      const next = allArcs[arcCursor % allArcs.length];
      arcCursor++;
      active = [...active, next];
      globe.update({ arcs: active });
    };
    // Prime with first two
    tickArcs();
    setTimeout(tickArcs, 1300);
    const arcInterval = reducedMotion ? null : setInterval(tickArcs, 2600);

    let raf: number;
    const tick = () => {
      if (!reducedMotion) phiRef.current += 0.0035;
      globe.update({ phi: phiRef.current });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      if (arcInterval) clearInterval(arcInterval);
      globe.destroy();
      setReady(false);
    };
  }, [width, height, reducedMotion]);

  return (
    <>
      <canvas
        ref={canvasRef}
        style={{ width, height, maxWidth: '100%', aspectRatio: '1', contain: 'layout paint size' }}
      />
      {ready && <CityLabels />}
    </>
  );
}

// ── Anchored bubble labels ───────────────────────────────────────────────────
// Cycles through the 12 cities, showing 2 bubbles at a time. Each label uses
// CSS `position-anchor: --cobe-{id}` so it tracks the marker as the globe spins.
// Visibility is driven by the `--cobe-visible-{id}` variable cobe writes when
// the marker faces the viewer.

function CityLabels() {
  const [activeIdx, setActiveIdx] = useState<number[]>([0, 4]);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIdx(([a, b]) => {
        // Step both cursors forward, keep them ~6 cities apart so they don't crowd
        const next1 = (a + 1) % CITIES.length;
        const next2 = (b + 1) % CITIES.length;
        return [next1, next2];
      });
    }, 2400);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      {activeIdx.map((idx, slot) => {
        const c = CITIES[idx];
        return <CityLabel key={`${slot}-${c.id}`} city={c} />;
      })}
    </>
  );
}

const TYPE_COLOR: Record<CityMarker['type'], string> = {
  item:   '#ea2e00',
  pet:    '#0e8b5e',
  person: '#1e3a8a',
};

const TYPE_ICON: Record<CityMarker['type'], string> = {
  item:   '📦',
  pet:    '🐾',
  person: '👤',
};

function CityLabel({ city }: { city: CityMarker }) {
  const color = TYPE_COLOR[city.type];
  const icon = TYPE_ICON[city.type];

  return (
    <div
      style={{
        position: 'absolute',
        // CSS anchor positioning — modern browsers + polyfill
        positionAnchor: `--cobe-${city.id}` as React.CSSProperties['positionAnchor'],
        bottom: 'anchor(top)' as React.CSSProperties['bottom'],
        left: 'anchor(center)' as React.CSSProperties['left'],
        translate: '-50% -8px',
        opacity: `var(--cobe-visible-${city.id}, 0)`,
        transition: 'opacity 0.4s ease',
        pointerEvents: 'none',
        zIndex: 30,
      } as React.CSSProperties}
    >
      <div
        style={{
          background: '#ffffff',
          border: '1px solid rgba(27,20,16,0.08)',
          borderRadius: 12,
          padding: '8px 12px',
          boxShadow: '0 12px 28px -8px rgba(80,40,15,0.18), 0 2px 6px rgba(80,40,15,0.06)',
          whiteSpace: 'nowrap',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          minWidth: 140,
        }}
      >
        <span style={{ fontSize: 9, color: '#9d8c7a', fontFamily: 'var(--font-mono, monospace)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {city.city}
        </span>
        <span style={{ fontSize: 11.5, fontWeight: 700, color, display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: 12 }}>{icon}</span>
          {city.message}
        </span>
      </div>
      {/* Tail */}
      <div
        style={{
          width: 0,
          height: 0,
          borderLeft: '5px solid transparent',
          borderRight: '5px solid transparent',
          borderTop: '6px solid #ffffff',
          margin: '0 auto',
          filter: 'drop-shadow(0 1px 0 rgba(27,20,16,0.06))',
        }}
      />
    </div>
  );
}
