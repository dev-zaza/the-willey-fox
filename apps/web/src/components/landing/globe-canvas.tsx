'use client';

import { useRef, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

// ── Types ─────────────────────────────────────────────────────────────────────
export interface BubblePoint {
  lat: number;
  lng: number;
  /** Projected screen coords (updated each frame) */
  screenX: number;
  screenY: number;
  /** Whether the point faces the viewer (front hemisphere) */
  visible: boolean;
}

// ── Brand / location data ─────────────────────────────────────────────────────
const BRAND = { orange: '#f97316', blue: '#3B82F6', emerald: '#10B981' };

export const BUBBLE_LOCATIONS: Omit<BubblePoint, 'screenX' | 'screenY' | 'visible'>[] = [
  { lat: 40.71,  lng: -74.01  }, // New York
  { lat: 51.51,  lng: -0.12   }, // London
  { lat: 35.68,  lng: 139.69  }, // Tokyo
  { lat: -33.87, lng: 151.21  }, // Sydney
  { lat: 48.85,  lng: 2.35    }, // Paris
  { lat: 25.20,  lng: 55.27   }, // Dubai
  { lat: 1.35,   lng: 103.82  }, // Singapore
  { lat: 19.08,  lng: 72.88   }, // Mumbai
  { lat: -23.55, lng: -46.63  }, // São Paulo
  { lat: 6.52,   lng: 3.38    }, // Lagos
  { lat: 55.75,  lng: 37.62   }, // Moscow
  { lat: -34.60, lng: -58.38  }, // Buenos Aires
];

const RING_DATA = BUBBLE_LOCATIONS.map((p, i) => ({
  lat: p.lat,
  lng: p.lng,
  color: [BRAND.orange, BRAND.blue, BRAND.emerald][i % 3],
}));

// Globe radius used by three-globe (default 100)
const GLOBE_RADIUS = 100;

/**
 * Convert lat/lng to a local-space position on the globe surface.
 * three-globe uses the same spherical convention as Three.js:
 *   x = -R·sin(φ)·cos(θ)
 *   y =  R·cos(φ)
 *   z =  R·sin(φ)·sin(θ)
 * where φ = (90-lat)·π/180, θ = (lng+180)·π/180
 */
function latLngToLocal(lat: number, lng: number, r = GLOBE_RADIUS): THREE.Vector3 {
  const phi   = (90 - lat)  * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
     r * Math.cos(phi),
     r * Math.sin(phi) * Math.sin(theta),
  );
}

// ── GlobeScene ────────────────────────────────────────────────────────────────
interface GlobeSceneProps {
  bubblePointsRef: React.MutableRefObject<BubblePoint[]>;
}

function GlobeScene({ bubblePointsRef }: GlobeSceneProps) {
  const groupRef = useRef<THREE.Group>(null);
  const { camera, size } = useThree();

  // Pre-compute local-space surface positions for each location
  const localPositions = useRef(
    BUBBLE_LOCATIONS.map((p) => latLngToLocal(p.lat, p.lng)),
  );

  // Reusable scratch vectors — allocated once
  const _worldPos  = useRef(new THREE.Vector3());
  const _ndc       = useRef(new THREE.Vector3());
  const _camToPoint = useRef(new THREE.Vector3());
  const _camDir    = useRef(new THREE.Vector3());

  useEffect(() => {
    let globe: any;

    async function init() {
      const ThreeGlobe = (await import('three-globe')).default;

      globe = new ThreeGlobe({ waitForGlobeReady: true, animateIn: true });

      globe
        .globeImageUrl('')
        .showAtmosphere(true)
        .atmosphereColor('#3B82F6')
        .atmosphereAltitude(0.18)
        .showGraticules(false);

      globe.globeMaterial(
        new THREE.MeshPhongMaterial({
          color: new THREE.Color('#0a1628'),
          emissive: new THREE.Color('#0d1f3c'),
          emissiveIntensity: 0.4,
          shininess: 120,
          transparent: true,
          opacity: 0.88,
        }),
      );

      const geoData = await fetch('/globe-countries.geojson').then((r) => r.json());
      globe
        .hexPolygonsData(geoData.features)
        .hexPolygonResolution(3)
        .hexPolygonMargin(0.4)
        .hexPolygonColor(() => 'rgba(59,130,246,0.22)');

      globe
        .ringsData(RING_DATA)
        .ringColor('color')
        .ringMaxRadius(3)
        .ringPropagationSpeed(2)
        .ringRepeatPeriod(1200);

      globe
        .pointsData(RING_DATA)
        .pointColor('color')
        .pointAltitude(0.01)
        .pointRadius(0.25)
        .pointsMerge(false);

      if (groupRef.current) groupRef.current.add(globe);
    }

    init();
    return () => { if (globe && groupRef.current) groupRef.current.remove(globe); };
  }, []);

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) return;

    // Auto-rotate the globe group
    group.rotation.y += delta * 0.06;

    // Camera's world-space forward direction (points away from camera)
    camera.getWorldDirection(_camDir.current);

    const updated: BubblePoint[] = BUBBLE_LOCATIONS.map((loc, i) => {
      // Transform the pre-computed local surface point into world space
      // (accounts for group rotation AND any parent transforms)
      _worldPos.current.copy(localPositions.current[i]);
      group.localToWorld(_worldPos.current);

      // Vector from camera to this point
      _camToPoint.current.copy(_worldPos.current).sub(camera.position).normalize();

      // Point is on the front face when the camera is looking roughly "at" it.
      // dot(camDir, camToPoint) > threshold means the point faces the viewer.
      // We use 0.3 so only well-centred points qualify (avoids limb overflow).
      const dot = _camDir.current.dot(_camToPoint.current);
      const visible = dot > 0.3;

      // Project world position → NDC → pixel coords
      _ndc.current.copy(_worldPos.current).project(camera);
      const screenX = ( _ndc.current.x + 1) / 2 * size.width;
      const screenY = (-_ndc.current.y + 1) / 2 * size.height;

      return { ...loc, screenX, screenY, visible };
    });

    bubblePointsRef.current = updated;
  });

  return (
    <group ref={groupRef}>
      <ambientLight intensity={0.6} color="#ffffff" />
      <directionalLight position={[2, 2, 2]} intensity={1.2} color="#ffffff" />
      <directionalLight position={[-2, -1, -1]} intensity={0.3} color="#3B82F6" />
      <pointLight position={[3, 3, 3]} intensity={1.5} color="#f97316" distance={10} />
    </group>
  );
}

// ── Exported canvas wrapper ───────────────────────────────────────────────────
export interface GlobeCanvasProps {
  width: number;
  height: number;
  bubblePointsRef: React.MutableRefObject<BubblePoint[]>;
}

export function GlobeCanvas({ width, height, bubblePointsRef }: GlobeCanvasProps) {
  return (
    <Canvas
      camera={{ position: [0, 0, 260], fov: 50, near: 0.1, far: 2000 }}
      gl={{ antialias: true, alpha: true }}
      style={{ display: 'block', width, height, background: 'transparent' }}
    >
      <GlobeScene bubblePointsRef={bubblePointsRef} />
      <OrbitControls
        enableZoom={false}
        enablePan={false}
        autoRotate={false}
        minPolarAngle={Math.PI * 0.25}
        maxPolarAngle={Math.PI * 0.75}
        rotateSpeed={0.3}
      />
    </Canvas>
  );
}
