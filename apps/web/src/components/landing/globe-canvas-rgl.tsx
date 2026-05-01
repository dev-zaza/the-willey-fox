'use client';

import { useRef, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import * as THREE from 'three';

// react-globe.gl uses three.js + WebGL — must be client-only
const Globe = dynamic(() => import('react-globe.gl').then((m) => m.default), {
  ssr: false,
  loading: () => <div className="w-full h-full" />,
});

// ── City data (mirrors cobe globe-canvas.tsx so messages stay consistent) ────
export interface CityMarker {
  id: string;
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
  { from: 0, to: 1 },
  { from: 4, to: 2 },
  { from: 1, to: 8 },
  { from: 7, to: 6 },
  { from: 9, to: 10 },
  { from: 11, to: 3 },
  { from: 5, to: 0 },
];

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

interface ArcDatum {
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  color: string;
}

interface BubbleDatum {
  lat: number;
  lng: number;
  city: CityMarker;
}

// ── Component ────────────────────────────────────────────────────────────────
export interface GlobeCanvasProps {
  width: number;
  height: number;
  reducedMotion?: boolean;
}

export function GlobeCanvas({ width, height, reducedMotion = false }: GlobeCanvasProps) {
  const globeRef = useRef<any>(null);
  const [activeBubbles, setActiveBubbles] = useState<BubbleDatum[]>([]);
  const [arcs, setArcs] = useState<ArcDatum[]>([]);
  const [countriesGeo, setCountriesGeo] = useState<any[]>([]);

  // Load country polygons for dot-globe land mass
  useEffect(() => {
    fetch('/globe-countries.geojson')
      .then((r) => r.json())
      .then((d) => setCountriesGeo(d.features ?? []))
      .catch(() => setCountriesGeo([]));
  }, []);

  // Configure globe controls + initial camera + recolor sphere material
  useEffect(() => {
    const g = globeRef.current;
    if (!g) return;

    const controls = g.controls?.();
    if (controls) {
      controls.enableZoom = false;
      controls.enablePan = false;
      controls.enableRotate = false; // we handle rotation manually below
      controls.autoRotate = false;
    }

    // Recolor the globe sphere — kill default earth-blue texture
    const scene = g.scene?.();
    const globeMesh = scene?.children?.find?.((c: any) => c.type === 'Mesh' && c.geometry?.type === 'SphereGeometry');
    if (globeMesh) {
      globeMesh.material = new THREE.MeshPhongMaterial({
        color: new THREE.Color('#f0e7d6'),
        emissive: new THREE.Color('#e6dcc7'),
        emissiveIntensity: 0.12,
        shininess: 30,
        transparent: true,
        opacity: 1,
      });
    }

    // Brighten ambient + warm point light so terracotta hex dots read true-to-color
    if (scene) {
      // Drop existing lights and replace with our own
      const lights = scene.children.filter((c: any) => c.isLight);
      lights.forEach((l: any) => scene.remove(l));
      const ambient = new THREE.AmbientLight('#f7eedb', 1.6);
      const dir = new THREE.DirectionalLight('#ffffff', 0.7);
      dir.position.set(2, 2, 2);
      const warm = new THREE.PointLight('#ea2e00', 0.8, 20);
      warm.position.set(3, 2, 3);
      scene.add(ambient);
      scene.add(dir);
      scene.add(warm);
    }

    g.pointOfView({ lat: 25, lng: 0, altitude: 2.5 }, 0);
  }, [reducedMotion, countriesGeo]);

  // Manual rotation loop — drive camera around lng axis at constant rate.
  // OrbitControls.autoRotate is unreliable when enableRotate=false, so do it ourselves.
  useEffect(() => {
    if (reducedMotion) return;
    let raf: number;
    let lng = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      lng += dt * 6; // 6 deg/sec → ~60s per revolution
      if (lng > 360) lng -= 360;
      const g = globeRef.current;
      if (g?.pointOfView) g.pointOfView({ lat: 25, lng, altitude: 2.5 }, 0);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reducedMotion]);

  // Cycle bubbles — show 2 at a time, rotate every 2.6s
  useEffect(() => {
    let i = 0;
    const advance = () => {
      const a = CITIES[i % CITIES.length];
      const b = CITIES[(i + 6) % CITIES.length];
      i++;
      setActiveBubbles([
        { lat: a.lat, lng: a.lng, city: a },
        { lat: b.lat, lng: b.lng, city: b },
      ]);
    };
    advance();
    if (reducedMotion) return;
    const t = setInterval(advance, 2600);
    return () => clearInterval(t);
  }, [reducedMotion]);

  // Cycle arcs — drop oldest, add next
  useEffect(() => {
    let i = 0;
    let active: ArcDatum[] = [];
    const buildArc = (idx: number): ArcDatum => {
      const { from, to } = ARC_PAIRS[idx % ARC_PAIRS.length];
      return {
        startLat: CITIES[from].lat,
        startLng: CITIES[from].lng,
        endLat:   CITIES[to].lat,
        endLng:   CITIES[to].lng,
        color: '#ea2e00',
      };
    };
    const advance = () => {
      if (active.length >= 2) active = active.slice(1);
      active = [...active, buildArc(i)];
      i++;
      setArcs(active);
    };
    advance();
    setTimeout(advance, 1300);
    if (reducedMotion) return;
    const t = setInterval(advance, 2600);
    return () => clearInterval(t);
  }, [reducedMotion]);

  // Build the HTML element for each visible bubble
  const renderHtmlElement = (d: object): HTMLElement => {
    const datum = d as BubbleDatum;
    const color = TYPE_COLOR[datum.city.type];
    const icon = TYPE_ICON[datum.city.type];

    const el = document.createElement('div');
    el.style.cssText = `
      position: relative;
      transform: translate(-50%, calc(-100% - 12px));
      pointer-events: none;
      transition: opacity 0.4s ease;
      will-change: opacity;
    `;
    el.innerHTML = `
      <div style="
        background:#ffffff;
        border:1px solid rgba(27,20,16,0.08);
        border-radius:12px;
        padding:8px 12px;
        box-shadow:0 12px 28px -8px rgba(80,40,15,0.18),0 2px 6px rgba(80,40,15,0.06);
        white-space:nowrap;
        display:flex;
        flex-direction:column;
        gap:2px;
        min-width:140px;
      ">
        <span style="font-size:9px;color:#9d8c7a;font-family:var(--font-mono,monospace);letter-spacing:0.08em;text-transform:uppercase">${datum.city.city}</span>
        <span style="font-size:11.5px;font-weight:700;color:${color};display:flex;align-items:center;gap:5px">
          <span style="font-size:12px">${icon}</span>${datum.city.message}
        </span>
      </div>
      <div style="
        width:0;height:0;
        border-left:5px solid transparent;
        border-right:5px solid transparent;
        border-top:6px solid #ffffff;
        margin:0 auto;
        filter:drop-shadow(0 1px 0 rgba(27,20,16,0.06));
      "></div>
    `;
    return el;
  };

  // Hide bubble when its lat/lng rotates to back hemisphere
  const visibilityModifier = (el: HTMLElement, isVisible: boolean) => {
    el.style.opacity = isVisible ? '1' : '0';
  };

  return (
    <div style={{ width, height, position: 'relative' }}>
      <Globe
        ref={globeRef}
        width={width}
        height={height}
        backgroundColor="rgba(0,0,0,0)"
        showGlobe
        showAtmosphere
        atmosphereColor="#ea2e00"
        atmosphereAltitude={0.18}
        // Hex-polygon land mass — terracotta dots matching brand
        hexPolygonsData={countriesGeo}
        hexPolygonResolution={3}
        hexPolygonMargin={0.4}
        hexPolygonUseDots
        hexPolygonColor={() => '#ea2e00'}
        hexPolygonAltitude={0.005}
        // Marker pins
        pointsData={CITIES}
        pointLat={(d: any) => d.lat}
        pointLng={(d: any) => d.lng}
        pointColor={() => '#ea2e00'}
        pointAltitude={0.01}
        pointRadius={0.35}
        pointResolution={6}
        // Animated arcs — fixed altitude reads correctly across all distances
        arcsData={arcs}
        arcStartLat="startLat"
        arcStartLng="startLng"
        arcEndLat="endLat"
        arcEndLng="endLng"
        arcColor={(d: any) => d.color}
        arcStroke={0.4}
        arcAltitude={0.18}
        arcDashLength={0.5}
        arcDashGap={2}
        arcDashAnimateTime={2400}
        arcsTransitionDuration={0}
        // HTML labels — react-globe.gl auto-projects each datum's lat/lng
        htmlElementsData={activeBubbles}
        htmlLat={(d: any) => d.lat}
        htmlLng={(d: any) => d.lng}
        htmlAltitude={0.05}
        htmlElement={renderHtmlElement}
        htmlElementVisibilityModifier={visibilityModifier}
      />
    </div>
  );
}
