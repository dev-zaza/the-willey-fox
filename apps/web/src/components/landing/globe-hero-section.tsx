'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import type { BubblePoint } from './globe-canvas';
import { BUBBLE_LOCATIONS } from './globe-canvas';

// Canvas must be client-only (no SSR)
const GlobeCanvas = dynamic(
  () => import('./globe-canvas').then((m) => ({ default: m.GlobeCanvas })),
  { ssr: false, loading: () => <div className="w-full h-full" /> },
);

// ── Brand colors ──────────────────────────────────────────────────────────────
const BRAND = {
  orange: '#f97316',
  blue: '#3B82F6',
  emerald: '#10B981',
};

// ── Recovery events per location ──────────────────────────────────────────────
interface RecoveryEvent {
  city: string;
  type: 'item' | 'pet' | 'person';
  message: string;
}

const LOCATION_EVENTS: RecoveryEvent[] = [
  { city: 'New York',      type: 'item',   message: 'Lost wallet recovered!' },
  { city: 'London',        type: 'pet',    message: 'Dog reunited with owner' },
  { city: 'Tokyo',         type: 'person', message: 'Child found safe 🎉' },
  { city: 'Sydney',        type: 'item',   message: 'Luggage returned' },
  { city: 'Paris',         type: 'pet',    message: 'Cat found via QR scan' },
  { city: 'Dubai',         type: 'person', message: 'Elder returned home' },
  { city: 'Singapore',     type: 'item',   message: 'Backpack recovered!' },
  { city: 'Mumbai',        type: 'pet',    message: 'Lost dog reunited' },
  { city: 'São Paulo',     type: 'item',   message: 'Keys returned to owner' },
  { city: 'Lagos',         type: 'person', message: 'Child safely home' },
  { city: 'Moscow',        type: 'item',   message: 'Passport returned!' },
  { city: 'Buenos Aires',  type: 'pet',    message: 'Cat scanned & reunited' },
];

const TYPE_COLOR: Record<RecoveryEvent['type'], string> = {
  item:   BRAND.orange,
  pet:    BRAND.emerald,
  person: BRAND.blue,
};

const TYPE_ICON: Record<RecoveryEvent['type'], string> = {
  item:   '📦',
  pet:    '🐾',
  person: '👤',
};

// ── Live ticker ───────────────────────────────────────────────────────────────
const TICKER_EVENTS = LOCATION_EVENTS.slice(0, 8);

function LiveTicker() {
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIdx((i) => (i + 1) % TICKER_EVENTS.length);
        setVisible(true);
      }, 400);
    }, 3200);
    return () => clearInterval(interval);
  }, []);

  const ev = TICKER_EVENTS[idx];
  const color = TYPE_COLOR[ev.type];
  const icon = TYPE_ICON[ev.type];

  return (
    <div className="flex items-center gap-2.5 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 backdrop-blur-md w-fit">
      <div className="flex items-center gap-1.5">
        <div className="relative w-2 h-2">
          <div className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-75" />
          <div className="absolute inset-0.5 rounded-full bg-emerald-500" />
        </div>
        <span className="text-[10px] font-bold text-emerald-500 tracking-widest font-mono">LIVE</span>
      </div>
      <div className="w-px h-3.5 bg-white/15" />
      <AnimatePresence mode="wait">
        {visible && (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.3 }}
            className="flex items-center gap-2"
          >
            <span className="text-sm">{icon}</span>
            <span className="text-xs text-white/50 font-mono">{ev.city}</span>
            <span className="text-xs text-white/80">—</span>
            <span className="text-xs font-semibold" style={{ color }}>{ev.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Stat badge ────────────────────────────────────────────────────────────────
function StatBadge({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <div className="text-center">
      <div className="text-2xl font-extrabold tracking-tight leading-none" style={{ color }}>{value}</div>
      <div className="text-[11px] text-white/40 mt-1 uppercase tracking-widest">{label}</div>
    </div>
  );
}

// ── Chat bubble overlay ───────────────────────────────────────────────────────
interface ActiveBubble {
  locationIdx: number;
  id: number;
}

function ChatBubbleOverlay({
  bubblePointsRef,
  canvasW,
  canvasH,
}: {
  bubblePointsRef: React.MutableRefObject<BubblePoint[]>;
  canvasW: number;
  canvasH: number;
}) {
  const [activeBubbles, setActiveBubbles] = useState<ActiveBubble[]>([]);
  const [positions, setPositions] = useState<Record<number, { x: number; y: number }>>({});
  const counterRef = useRef(0);
  const usedIndicesRef = useRef<Set<number>>(new Set());

  // Spawn a new bubble at a random visible location
  const spawnBubble = useCallback(() => {
    const points = bubblePointsRef.current;
    if (!points.length) return;

    // Find visible locations not already in use
    const candidates = points
      .map((p, i) => ({ ...p, i }))
      .filter((p) => p.visible && !usedIndicesRef.current.has(p.i));

    if (!candidates.length) return;

    const chosen = candidates[Math.floor(Math.random() * candidates.length)];
    const id = ++counterRef.current;

    usedIndicesRef.current.add(chosen.i);
    setActiveBubbles((prev) => [...prev, { locationIdx: chosen.i, id }]);

    // Auto-remove after 3.5s
    setTimeout(() => {
      usedIndicesRef.current.delete(chosen.i);
      setActiveBubbles((prev) => prev.filter((b) => b.id !== id));
    }, 3500);
  }, [bubblePointsRef]);

  // Spawn bubbles on staggered interval — keep 2-3 alive
  useEffect(() => {
    // Initial spawns with stagger
    const t1 = setTimeout(() => spawnBubble(), 800);
    const t2 = setTimeout(() => spawnBubble(), 1800);
    const t3 = setTimeout(() => spawnBubble(), 2800);

    // Ongoing: spawn one every ~1.4s
    const interval = setInterval(() => spawnBubble(), 1400);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearInterval(interval);
    };
  }, [spawnBubble]);

  // Sync screen positions from refs each animation frame
  // Clamp so bubble bodies (which extend above/beside the anchor) stay inside the canvas
  useEffect(() => {
    let raf: number;
    function tick() {
      const pts = bubblePointsRef.current;
      if (pts.length) {
        // Margins: top/bottom ~70px (bubble height), sides ~90px (half bubble width)
        const MX = 90;
        const MY = 70;
        const next: Record<number, { x: number; y: number }> = {};
        activeBubbles.forEach(({ locationIdx, id }) => {
          const pt = pts[locationIdx];
          if (pt) {
            next[id] = {
              x: Math.max(MX, Math.min(canvasW - MX, pt.screenX)),
              y: Math.max(MY, Math.min(canvasH - 20, pt.screenY)),
            };
          }
        });
        setPositions(next);
      }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [activeBubbles, bubblePointsRef, canvasW, canvasH]);

  return (
    <AnimatePresence>
      {activeBubbles.map(({ locationIdx, id }) => {
        const pos = positions[id];
        if (!pos) return null;

        const event = LOCATION_EVENTS[locationIdx];
        const color = TYPE_COLOR[event.type];
        const icon = TYPE_ICON[event.type];

        return (
          <motion.div
            key={id}
            initial={{ opacity: 0, scale: 0.7, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: -6 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: 'absolute',
              left: pos.x,
              top: pos.y,
              transform: 'translate(-50%, -100%)',
              pointerEvents: 'none',
              zIndex: 30,
            }}
          >
            {/* Bubble body */}
            <div
              style={{
                background: 'rgba(8, 14, 28, 0.92)',
                border: `1px solid ${color}55`,
                borderRadius: 10,
                padding: '6px 10px',
                boxShadow: `0 0 16px ${color}33, 0 4px 12px rgba(0,0,0,0.5)`,
                backdropFilter: 'blur(8px)',
                whiteSpace: 'nowrap',
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                minWidth: 130,
              }}
            >
              {/* City name */}
              <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                {event.city}
              </span>
              {/* Message */}
              <span style={{ fontSize: 11, fontWeight: 700, color, display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ fontSize: 12 }}>{icon}</span>
                {event.message}
              </span>
            </div>
            {/* Tail pointing down to the location dot */}
            <div
              style={{
                width: 0,
                height: 0,
                borderLeft: '5px solid transparent',
                borderRight: '5px solid transparent',
                borderTop: `6px solid ${color}55`,
                margin: '0 auto',
              }}
            />
            {/* Dot at pin location */}
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: color,
                boxShadow: `0 0 8px ${color}`,
                margin: '0 auto',
                marginTop: -1,
              }}
            />
          </motion.div>
        );
      })}
    </AnimatePresence>
  );
}

// ── Main hero section ─────────────────────────────────────────────────────────
export function GlobeHeroSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const globeWrapperRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState<{ w: number; h: number } | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Shared ref — GlobeCanvas writes projected screen coords each frame
  const bubblePointsRef = useRef<BubblePoint[]>(
    BUBBLE_LOCATIONS.map((loc) => ({ ...loc, screenX: 0, screenY: 0, visible: false })),
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) setCanvasSize({ w: Math.round(width), h: Math.round(height) });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (canvasSize) setTimeout(() => setLoaded(true), 300);
  }, [canvasSize]);

  return (
    <div className="relative w-full min-h-screen flex flex-col overflow-hidden" style={{ background: '#020408' }}>
      {/* Background grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(59,130,246,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.04) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
          maskImage: 'radial-gradient(ellipse 80% 60% at 60% 50%, black, transparent)',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 60% 50%, black, transparent)',
        }}
      />

      {/* Nav */}
      <nav className="relative z-20 w-full max-w-[1400px] mx-auto px-8 sm:px-16 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Image src="/logo.png" alt="TheWileyfox" width={36} height={36} className="object-contain" />
          <span className="font-bold text-lg text-white tracking-tight">TheWileyfox</span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="text-sm text-white/55 hover:text-orange-400 font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/register"
            className="text-sm font-bold text-white px-5 py-2.5 rounded-full transition-all hover:-translate-y-0.5"
            style={{
              background: 'linear-gradient(135deg, #f97316, #ea580c)',
              boxShadow: '0 0 32px rgba(249,115,22,0.3), 0 4px 16px rgba(249,115,22,0.2)',
            }}
          >
            Get Started
          </Link>
        </div>
      </nav>

      {/* Main layout */}
      <div className="relative z-10 flex flex-col lg:flex-row items-center flex-1 w-full max-w-[1400px] mx-auto px-8 sm:px-16 py-8 pb-20 gap-0">
        {/* Left: text */}
        <motion.div
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col gap-7 items-start lg:w-[460px] w-full text-center lg:text-left items-center lg:items-start"
        >
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }}>
            <LiveTicker />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="font-extrabold text-white leading-[1.05] tracking-tight m-0"
            style={{ fontSize: 'clamp(40px, 4.5vw, 64px)' }}
          >
            Lost. Scanned.{' '}
            <span
              style={{
                background: 'linear-gradient(135deg, #f97316 0%, #fb923c 50%, #fdba74 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              Reunited.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.5 }}
            className="text-white/50 leading-relaxed m-0 max-w-[400px]"
            style={{ fontSize: 'clamp(15px, 1.5vw, 18px)' }}
          >
            TheWileyfox turns any lost item, pet, or person into a recoverable asset.
            Attach a QR tag. If it&apos;s found anywhere in the world, your community brings it home.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.65 }}
            className="flex flex-wrap gap-3 justify-center lg:justify-start"
          >
            <Link
              href="/register"
              className="font-bold text-white px-9 py-4 rounded-full text-base transition-all hover:-translate-y-0.5"
              style={{
                background: 'linear-gradient(135deg, #f97316, #ea580c)',
                boxShadow: '0 0 40px rgba(249,115,22,0.35), 0 8px 32px rgba(249,115,22,0.2)',
              }}
            >
              Get Your Tag →
            </Link>
            <Link
              href="/login"
              className="font-semibold text-white/70 hover:text-orange-400 hover:border-orange-500/50 px-9 py-4 rounded-full text-base border border-white/15 backdrop-blur-sm transition-all hover:-translate-y-0.5"
            >
              Sign In
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.85 }}
            className="flex gap-8 pt-2 border-t border-white/[0.07] w-full mt-1 justify-center lg:justify-start"
          >
            <StatBadge value="94%"  label="Recovery rate"   color={BRAND.orange} />
            <StatBadge value="180+" label="Countries"        color={BRAND.blue} />
            <StatBadge value="2.4M" label="Tags registered"  color={BRAND.emerald} />
          </motion.div>
        </motion.div>

        {/* Right: globe with bubble overlays */}
        <div
          className="flex-1 flex justify-center items-center min-w-0 mt-10 lg:mt-0"
          style={{
            opacity: loaded ? 1 : 0,
            transition: 'opacity 1.2s ease',
          }}
        >
          <div
            ref={globeWrapperRef}
            className="relative"
            style={{ width: 'clamp(320px, 46vw, 560px)', height: 'clamp(320px, 46vw, 560px)' }}
          >
            {/* Canvas */}
            <div ref={containerRef} className="w-full h-full">
              {canvasSize && (
                <GlobeCanvas
                  width={canvasSize.w}
                  height={canvasSize.h}
                  bubblePointsRef={bubblePointsRef}
                />
              )}
            </div>

            {/* Chat bubble overlays — positioned relative to the globe wrapper */}
            <AnimatePresence>
              {loaded && (
                <ChatBubbleOverlay
                  bubblePointsRef={bubblePointsRef}
                  canvasW={canvasSize?.w ?? 500}
                  canvasH={canvasSize?.h ?? 500}
                />
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Bottom fade */}
      <div
        className="absolute bottom-0 left-0 right-0 h-28 pointer-events-none"
        style={{ background: 'linear-gradient(to bottom, transparent, #020408)' }}
      />

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
