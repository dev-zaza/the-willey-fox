'use client';

import { motion } from 'framer-motion';

function AppleBadge() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M16.365 1.43c0 1.14-.42 2.18-1.13 2.95-.87.96-2.27 1.7-3.43 1.6-.15-1.14.42-2.32 1.16-3.07.84-.86 2.27-1.49 3.4-1.48zM20.5 17.04c-.55 1.27-.81 1.84-1.51 2.97-.98 1.57-2.36 3.52-4.07 3.54-1.52.02-1.91-.99-3.97-.98-2.05.01-2.49 1-4.01.98-1.71-.02-3.02-1.78-4-3.35C.31 15.78-.06 11.32 1.83 8.95c1.34-1.69 3.46-2.68 5.45-2.68 2.03 0 3.31 1.11 4.99 1.11 1.63 0 2.62-1.11 4.97-1.11 1.78 0 3.66.97 5 2.65-4.4 2.41-3.69 8.7 2.26 8.12z"
      />
    </svg>
  );
}

function AndroidBadge() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M3 18.4l3.7-6.4c-2.3-1.6-3.8-3.7-3.8-3.7s2.7 4 9.1 4 9.1-4 9.1-4-1.5 2.1-3.8 3.7l3.7 6.4H3zM7.5 9.7a1 1 0 100-2 1 1 0 000 2zm9 0a1 1 0 100-2 1 1 0 000 2z"
      />
    </svg>
  );
}

function StoreButton({
  icon: Icon,
  caption,
  store,
}: {
  icon: React.ComponentType;
  caption: string;
  store: string;
}) {
  return (
    <div
      className="relative inline-flex items-center gap-3 rounded-2xl px-5 py-3.5 select-none"
      style={{
        background: '#1b1410',
        color: '#f0e7d6',
        opacity: 0.94,
        boxShadow: '0 12px 26px -10px rgba(80,40,15,0.22)',
        cursor: 'not-allowed',
        minWidth: 200,
      }}
      aria-disabled="true"
      role="button"
      tabIndex={-1}
      title="Coming soon"
    >
      <span className="flex-shrink-0 opacity-95">
        <Icon />
      </span>
      <span className="flex flex-col leading-tight">
        <span className="text-[10px] uppercase tracking-[0.14em] font-mono" style={{ color: 'rgba(250,246,238,0.6)' }}>
          {caption}
        </span>
        <span className="text-base font-semibold tracking-tight">{store}</span>
      </span>
      <span
        className="absolute -top-2 -right-2 px-2 py-0.5 text-[9px] font-mono uppercase tracking-widest rounded-full"
        style={{ background: '#ea2e00', color: '#1b1410', boxShadow: '0 2px 6px rgba(234,46,0,0.4)' }}
      >
        Coming soon
      </span>
    </div>
  );
}

export function AppDownloadSection() {
  return (
    <section
      className="relative py-24 sm:py-32 px-4 overflow-hidden"
      style={{ background: '#f0e7d6' }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(rgba(234,46,0,0.06) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      <div className="relative max-w-4xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6 }}
        >
          <span
            className="text-[11px] font-mono uppercase tracking-[0.18em] block mb-3"
            style={{ color: '#9d8c7a' }}
          >
            Mobile apps
          </span>
          <h2
            className="text-4xl sm:text-5xl tracking-tight mb-5"
            style={{
              fontFamily: 'var(--font-display, Georgia, serif)',
              fontWeight: 700,
              letterSpacing: '-0.02em',
              color: '#1b1410',
            }}
          >
            Reunions in your{' '}
            <em className="not-italic" style={{ color: '#ea2e00', fontStyle: 'italic' }}>
              pocket
            </em>
            .
          </h2>
          <p
            className="text-lg leading-relaxed mx-auto mb-10 max-w-xl"
            style={{ color: '#5a4a3d' }}
          >
            iOS and Android apps land soon. Push notifications the second your tag is scanned. SOS in one tap. Anonymous chat with finders. Be first in the queue.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8"
        >
          <StoreButton icon={AppleBadge} caption="Download on the" store="App Store" />
          <StoreButton icon={AndroidBadge} caption="Get it on" store="Google Play" />
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-sm font-mono"
          style={{ color: '#9d8c7a' }}
        >
          Want a heads-up the day they ship?{' '}
          <a
            href="/register"
            className="underline underline-offset-4 transition-colors"
            style={{ color: '#ea2e00', textDecorationColor: 'rgba(234,46,0,0.4)' }}
          >
            Create a free account
          </a>{' '}
          and we'll email you.
        </motion.p>
      </div>
    </section>
  );
}
