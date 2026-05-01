'use client';

import { motion } from 'framer-motion';

const STATS = [
  { value: '12,847', label: 'Items reunited', sub: 'and counting' },
  { value: '94%', label: 'Recovery rate', sub: 'within 48 hours' },
  { value: '63', label: 'Countries', sub: 'finders worldwide' },
  { value: '< 4 min', label: 'Avg first ping', sub: 'after a scan' },
];

const QUOTES = [
  {
    body:
      'Lost my dog at a service station near Bristol. Someone scanned her tag, messaged me through the app, met me halfway. She was home for dinner.',
    name: 'Priya R.',
    place: 'Bristol, UK',
  },
  {
    body:
      'Left my camera bag in a taxi after a wedding shoot. The driver scanned the tag, dropped it back to my hotel the next morning. Saved a year of work.',
    name: 'Marcus T.',
    place: 'Brooklyn, NY',
  },
  {
    body:
      'My mum has early dementia. She wears a tag now. The peace of mind is worth more than I can put in a review.',
    name: 'Sarah K.',
    place: 'Manchester, UK',
  },
];

export function TrustStatsSection() {
  return (
    <section className="relative py-24 sm:py-32 px-4" style={{ background: '#1b1410', color: '#f0e7d6' }}>
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6 }}
          className="mb-14 max-w-2xl"
        >
          <span
            className="text-[11px] font-mono uppercase tracking-[0.18em] block mb-3"
            style={{ color: '#ea2e00' }}
          >
            Real people, real reunions
          </span>
          <h2
            className="text-4xl sm:text-5xl tracking-tight"
            style={{
              fontFamily: 'var(--font-display, Georgia, serif)',
              fontWeight: 700,
              letterSpacing: '-0.02em',
            }}
          >
            Strangers giving things{' '}
            <em className="not-italic" style={{ color: '#ea2e00', fontStyle: 'italic' }}>
              back
            </em>
            .
          </h2>
        </motion.div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-16 pb-16" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          {STATS.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
            >
              <div
                className="text-4xl sm:text-5xl tracking-tight leading-none mb-2"
                style={{
                  fontFamily: 'var(--font-display, Georgia, serif)',
                  fontWeight: 700,
                  color: '#ea2e00',
                  letterSpacing: '-0.02em',
                }}
              >
                {s.value}
              </div>
              <div className="text-sm font-semibold" style={{ color: '#f0e7d6' }}>
                {s.label}
              </div>
              <div className="text-xs mt-0.5" style={{ color: 'rgba(250,246,238,0.5)' }}>
                {s.sub}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Testimonials */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {QUOTES.map((q, i) => (
            <motion.figure
              key={q.name}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="rounded-2xl p-7"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <div
                className="text-3xl mb-3 leading-none"
                style={{ color: '#ea2e00', fontFamily: 'var(--font-display, Georgia, serif)' }}
              >
                "
              </div>
              <blockquote
                className="text-[15px] leading-relaxed mb-5"
                style={{ color: 'rgba(250,246,238,0.92)' }}
              >
                {q.body}
              </blockquote>
              <figcaption className="flex items-center gap-3">
                <div
                  className="rounded-full flex items-center justify-center font-semibold text-sm"
                  style={{
                    width: 36,
                    height: 36,
                    background: '#ea2e00',
                    color: '#1b1410',
                  }}
                >
                  {q.name.charAt(0)}
                </div>
                <div>
                  <div className="text-sm font-semibold">{q.name}</div>
                  <div className="text-xs" style={{ color: 'rgba(250,246,238,0.5)' }}>
                    {q.place}
                  </div>
                </div>
              </figcaption>
            </motion.figure>
          ))}
        </div>
      </div>
    </section>
  );
}
