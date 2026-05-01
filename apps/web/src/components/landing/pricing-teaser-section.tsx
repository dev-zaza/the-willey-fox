'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

const FREE = [
  'Up to 3 active QR tags',
  '3 emergency contacts',
  '7-day report history',
  'Anonymous chat with finder',
];

const PRO = [
  'Unlimited tags + bulk codes',
  '25 emergency contacts',
  'Lifetime report history',
  'Priority lost-child broadcast',
  'Family guardians + role mgmt',
  'Premium themes & print packs',
];

export function PricingTeaserSection() {
  return (
    <section className="relative py-24 sm:py-32 px-4" style={{ background: '#f0e7d6' }}>
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6 }}
          className="text-center mb-14 max-w-2xl mx-auto"
        >
          <span
            className="text-[11px] font-mono uppercase tracking-[0.18em] block mb-3"
            style={{ color: '#9d8c7a' }}
          >
            Pricing
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
            Free to start.{' '}
            <em className="not-italic" style={{ color: '#ea2e00', fontStyle: 'italic' }}>
              Pro
            </em>{' '}
            when it matters.
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-4xl mx-auto">
          {/* Free */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="rounded-2xl p-8"
            style={{
              background: '#ffffff',
              border: '1px solid rgba(27,20,16,0.08)',
            }}
          >
            <div className="mb-6">
              <h3
                className="text-2xl mb-1 tracking-tight"
                style={{
                  fontFamily: 'var(--font-display, Georgia, serif)',
                  fontWeight: 700,
                  color: '#1b1410',
                }}
              >
                Free
              </h3>
              <p className="text-sm" style={{ color: '#7a6957' }}>
                Everything most people need. Forever.
              </p>
            </div>
            <div className="mb-6">
              <span
                className="text-5xl tracking-tight"
                style={{
                  fontFamily: 'var(--font-display, Georgia, serif)',
                  fontWeight: 700,
                  color: '#1b1410',
                  letterSpacing: '-0.02em',
                }}
              >
                £0
              </span>
              <span className="text-sm ml-2" style={{ color: '#9d8c7a' }}>
                /forever
              </span>
            </div>
            <ul className="space-y-3 mb-7">
              {FREE.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm" style={{ color: '#5a4a3d' }}>
                  <Check className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#0e8b5e' }} strokeWidth={2.5} />
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href="/register"
              className="block w-full text-center rounded-xl py-3 text-sm font-semibold transition-colors"
              style={{
                border: '1px solid rgba(27,20,16,0.15)',
                color: '#1b1410',
                background: '#ffffff',
              }}
            >
              Start free
            </Link>
          </motion.div>

          {/* Pro */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="relative rounded-2xl p-8"
            style={{
              background: '#1b1410',
              color: '#f0e7d6',
              boxShadow: '0 18px 38px -14px rgba(80,40,15,0.32)',
            }}
          >
            <span
              className="absolute top-4 right-4 px-2.5 py-1 text-[10px] font-mono uppercase tracking-widest rounded-full"
              style={{ background: '#ea2e00', color: '#1b1410' }}
            >
              Recommended
            </span>
            <div className="mb-6">
              <h3
                className="text-2xl mb-1 tracking-tight"
                style={{
                  fontFamily: 'var(--font-display, Georgia, serif)',
                  fontWeight: 700,
                }}
              >
                Pro
              </h3>
              <p className="text-sm" style={{ color: 'rgba(250,246,238,0.6)' }}>
                For families, frequent travellers, and anything irreplaceable.
              </p>
            </div>
            <div className="mb-6">
              <span
                className="text-5xl tracking-tight"
                style={{
                  fontFamily: 'var(--font-display, Georgia, serif)',
                  fontWeight: 700,
                  color: '#ea2e00',
                  letterSpacing: '-0.02em',
                }}
              >
                £4
              </span>
              <span className="text-sm ml-2" style={{ color: 'rgba(250,246,238,0.5)' }}>
                /month
              </span>
            </div>
            <ul className="space-y-3 mb-7">
              {PRO.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm" style={{ color: 'rgba(250,246,238,0.85)' }}>
                  <Check className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#ea2e00' }} strokeWidth={2.5} />
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href="/pricing"
              className="block w-full text-center rounded-xl py-3 text-sm font-semibold transition-opacity hover:opacity-90"
              style={{
                background: '#ea2e00',
                color: '#1b1410',
              }}
            >
              See full pricing
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
