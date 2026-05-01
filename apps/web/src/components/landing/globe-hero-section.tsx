'use client';

import { useRef, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';

// Canvas must be client-only (no SSR — uses WebGL + window)
// Cobe-based version still available at './globe-canvas' — kept commented as fallback.
// const GlobeCanvas = dynamic(
//   () => import('./globe-canvas').then((m) => ({ default: m.GlobeCanvas })),
//   { ssr: false, loading: () => <div className="w-full h-full" /> },
// );
const GlobeCanvas = dynamic(
  () => import('./globe-canvas-rgl').then((m) => ({ default: m.GlobeCanvas })),
  { ssr: false, loading: () => <div className="w-full h-full" /> },
);

// ── Brand palette (Wileyfox: cream + sage + terracotta) ──────────────────────
const BRAND = {
  orange: '#ea2e00',   // brand terracotta
  blue: '#1b1410',     // ink (no native blue in brand)
  emerald: '#0e8b5e',  // success accent kept for messaging variety
  sage: '#9dbdb8',     // brand sage — second accent
};

// ── Live ticker — small recurring chip above the headline ────────────────────
interface RecoveryEvent {
  city: string;
  type: 'item' | 'pet' | 'person';
  message: string;
}
const TICKER_EVENTS: RecoveryEvent[] = [
  { city: 'New York',  type: 'item',   message: 'Lost wallet recovered!' },
  { city: 'London',    type: 'pet',    message: 'Dog reunited with owner' },
  { city: 'Tokyo',     type: 'person', message: 'Child found safe 🎉' },
  { city: 'Sydney',    type: 'item',   message: 'Luggage returned' },
  { city: 'Paris',     type: 'pet',    message: 'Cat found via QR scan' },
  { city: 'Dubai',     type: 'person', message: 'Elder returned home' },
  { city: 'Singapore', type: 'item',   message: 'Backpack recovered!' },
  { city: 'Mumbai',    type: 'pet',    message: 'Lost dog reunited' },
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
    <div
      className="flex items-center gap-2.5 rounded-full px-4 py-1.5 w-fit"
      style={{
        background: '#ffffff',
        border: '1px solid rgba(27,20,16,0.08)',
        boxShadow: '0 1px 2px rgba(27,20,16,0.04)',
      }}
    >
      <div className="flex items-center gap-1.5">
        <div className="relative w-2 h-2">
          <div className="absolute inset-0 rounded-full animate-ping opacity-60" style={{ background: '#0e8b5e' }} />
          <div className="absolute inset-0.5 rounded-full" style={{ background: '#0e8b5e' }} />
        </div>
        <span className="text-[10px] font-bold tracking-widest font-mono" style={{ color: '#0e8b5e' }}>LIVE</span>
      </div>
      <div className="w-px h-3.5" style={{ background: 'rgba(27,20,16,0.1)' }} />
      <div className="relative h-5 flex items-center" style={{ minWidth: 280 }}>
        <AnimatePresence mode="wait">
          {visible && (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0 flex items-center gap-2 whitespace-nowrap"
            >
              <span className="text-sm leading-none">{icon}</span>
              <span className="text-xs font-mono" style={{ color: '#9d8c7a' }}>{ev.city}</span>
              <span className="text-xs" style={{ color: '#5a4a3d' }}>—</span>
              <span className="text-xs font-semibold" style={{ color }}>{ev.message}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── Stat ──────────────────────────────────────────────────────────────────────
function StatBadge({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <div className="text-center">
      <div
        className="text-3xl tracking-tight leading-none"
        style={{ color, fontFamily: 'var(--font-display, Georgia, serif)', fontWeight: 700, letterSpacing: '-0.02em' }}
      >
        {value}
      </div>
      <div
        className="text-[10px] mt-1.5 uppercase"
        style={{ color: '#9d8c7a', letterSpacing: '0.14em', fontWeight: 500 }}
      >
        {label}
      </div>
    </div>
  );
}

// ── Hero ──────────────────────────────────────────────────────────────────────
export function GlobeHeroSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState<{ w: number; h: number } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

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

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return (
    <div
      className="relative w-full min-h-screen flex flex-col overflow-hidden"
      style={{ background: '#f0e7d6', color: '#1b1410' }}
    >
      {/* Warm radial dot grain */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(rgba(234,46,0,0.09) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
          maskImage: 'radial-gradient(ellipse 80% 60% at 65% 45%, black, transparent)',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 65% 45%, black, transparent)',
        }}
      />

      {/* Soft warm glow behind globe */}
      <div
        className="absolute pointer-events-none"
        style={{
          right: '5%',
          top: '20%',
          width: 600,
          height: 600,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(234,46,0,0.18) 0%, rgba(234,46,0,0) 60%)',
          filter: 'blur(30px)',
        }}
      />

      {/* Nav */}
      <nav className="relative z-20 w-full max-w-[1400px] mx-auto px-8 sm:px-16 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Image src="/logo.png" alt="TheWileyfox" width={36} height={36} className="object-contain" />
          <span
            className="text-lg tracking-tight"
            style={{ fontFamily: 'var(--font-display, Georgia, serif)', fontWeight: 900, color: '#1b1410', letterSpacing: '-0.02em' }}
          >
            TheWileyfox
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="text-sm font-medium px-4 py-3 rounded-full transition-colors"
            style={{ color: '#5a4a3d' }}
          >
            Sign In
          </Link>
          <Link
            href="/register"
            className="text-sm font-semibold text-white px-5 py-2.5 rounded-full transition-all hover:-translate-y-0.5"
            style={{
              background: '#1b1410',
              boxShadow: '0 4px 12px rgba(27,20,16,0.18)',
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
            className="leading-[0.96] m-0"
            style={{
              fontFamily: 'var(--font-display, Georgia, serif)',
              fontWeight: 900,
              fontSize: 'clamp(48px, 6.4vw, 88px)',
              letterSpacing: '-0.035em',
              color: '#1b1410',
            }}
          >
            Lost. Scanned.{' '}
            <span style={{ color: '#ea2e00', fontStyle: 'italic', fontWeight: 700 }}>Reunited.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.5 }}
            className="leading-relaxed m-0 max-w-[440px]"
            style={{ fontSize: 'clamp(16px, 1.5vw, 18px)', color: '#5a4a3d' }}
          >
            A small QR tag on the things you love. When something goes missing,
            the next stranger to scan brings it home — anywhere on Earth.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.65 }}
            className="flex flex-wrap gap-3 justify-center lg:justify-start items-center"
          >
            <Link
              href="/register"
              className="font-semibold text-white px-9 py-4 rounded-full text-base transition-all hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{
                background: '#ea2e00',
                boxShadow: '0 12px 32px -10px rgba(234,46,0,0.55), 0 4px 12px rgba(234,46,0,0.18)',
                outlineColor: '#ea2e00',
              }}
            >
              Get Your Tag →
            </Link>
            <Link
              href="/login"
              className="font-medium px-7 py-4 rounded-full text-base transition-all hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{
                color: '#1b1410',
                background: 'transparent',
                border: '1px solid rgba(27,20,16,0.12)',
                outlineColor: '#ea2e00',
              }}
            >
              See how it works
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.85 }}
            className="flex gap-10 pt-7 w-full mt-1 justify-center lg:justify-start"
            style={{ borderTop: '1px solid rgba(27,20,16,0.08)' }}
          >
            <StatBadge value="94%"  label="Recovery rate"   color={BRAND.orange} />
            <StatBadge value="180+" label="Countries"        color="#5e8a85" />
            <StatBadge value="2.4M" label="Tags registered"  color={BRAND.emerald} />
          </motion.div>
        </motion.div>

        {/* Right: globe (city labels rendered inside GlobeCanvas via CSS anchor positioning) */}
        <div
          className="flex-1 flex justify-center items-center min-w-0 mt-10 lg:mt-0"
          style={{
            opacity: loaded ? 1 : 0,
            transition: 'opacity 1.2s ease',
          }}
        >
          <div
            ref={containerRef}
            className="relative"
            style={{ width: 'clamp(320px, 46vw, 560px)', height: 'clamp(320px, 46vw, 560px)' }}
            role="img"
            aria-label="Animated globe showing live recovery events from cities worldwide"
          >
            {canvasSize && (
              <GlobeCanvas
                width={canvasSize.w}
                height={canvasSize.h}
                reducedMotion={reducedMotion}
              />
            )}
          </div>
        </div>
      </div>

      {/* Bottom fade */}
      <div
        className="absolute bottom-0 left-0 right-0 h-28 pointer-events-none"
        style={{ background: 'linear-gradient(to bottom, transparent, #ffffff)' }}
      />
    </div>
  );
}
