'use client';

import { motion } from 'framer-motion';

const CASES = [
  {
    emoji: '🎒',
    title: 'Bags & luggage',
    body: 'Slip a tag inside. Reunited at airports, train stations, cabs.',
  },
  {
    emoji: '🐾',
    title: 'Pets',
    body: 'Collar tag. Vet, neighbour, dog walker scans. You get the call.',
  },
  {
    emoji: '🧒',
    title: 'Kids',
    body: 'Backpack or wristband. A trusted adult sees the ICE info you choose.',
  },
  {
    emoji: '🩺',
    title: 'Medical',
    body: 'Allergies, conditions, medication, emergency contacts. Visible only when needed.',
  },
  {
    emoji: '🔑',
    title: 'Keys & wallets',
    body: 'The tiny things that disappear at the worst time. Now traceable.',
  },
  {
    emoji: '🚲',
    title: 'Bikes & gear',
    body: 'Proof of ownership and a contact channel if it walks off.',
  },
];

export function UseCasesSection() {
  return (
    <section className="relative py-24 sm:py-32 px-4" style={{ background: '#f0e7d6' }}>
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6 }}
          className="mb-14 sm:mb-16 max-w-2xl"
        >
          <span
            className="text-[11px] font-mono uppercase tracking-[0.18em] block mb-3"
            style={{ color: '#9d8c7a' }}
          >
            Built for the things you can't lose
          </span>
          <h2
            className="text-4xl sm:text-5xl tracking-tight"
            style={{
              fontFamily: 'var(--font-display, Georgia, serif)',
              fontWeight: 700,
              letterSpacing: '-0.02em',
              color: '#1b1410',
            }}
          >
            One small tag. Many{' '}
            <em className="not-italic" style={{ color: '#ea2e00', fontStyle: 'italic' }}>
              big
            </em>{' '}
            jobs.
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {CASES.map((c, i) => (
            <motion.div
              key={c.title}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.45, delay: (i % 3) * 0.08 }}
              className="rounded-2xl p-6 transition-shadow hover:shadow-md"
              style={{
                background: '#ffffff',
                border: '1px solid rgba(27,20,16,0.08)',
                boxShadow: '0 1px 2px rgba(27,20,16,0.04)',
              }}
            >
              <div
                className="flex items-center justify-center mb-4 rounded-xl"
                style={{
                  width: 48,
                  height: 48,
                  background: '#f7eedb',
                  fontSize: 24,
                }}
              >
                {c.emoji}
              </div>
              <h3
                className="text-lg mb-1.5 tracking-tight"
                style={{
                  fontFamily: 'var(--font-display, Georgia, serif)',
                  fontWeight: 700,
                  color: '#1b1410',
                }}
              >
                {c.title}
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: '#5a4a3d' }}>
                {c.body}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
