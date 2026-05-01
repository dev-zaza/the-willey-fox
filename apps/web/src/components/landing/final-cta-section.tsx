'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

export function FinalCtaSection() {
  return (
    <section
      className="relative py-24 sm:py-32 px-4"
      style={{
        background: 'linear-gradient(135deg, #ea2e00 0%, #b81f00 100%)',
        color: '#f0e7d6',
      }}
    >
      <div
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.4) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />

      <div className="relative max-w-4xl mx-auto text-center">
        <motion.h2
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6 }}
          className="text-4xl sm:text-6xl tracking-tight mb-6"
          style={{
            fontFamily: 'var(--font-display, Georgia, serif)',
            fontWeight: 700,
            letterSpacing: '-0.025em',
          }}
        >
          The next thing you lose
          <br />
          deserves a way{' '}
          <em className="not-italic" style={{ fontStyle: 'italic', color: '#1b1410' }}>
            home
          </em>
          .
        </motion.h2>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-lg sm:text-xl leading-relaxed mb-10 max-w-2xl mx-auto"
          style={{ color: 'rgba(250,246,238,0.92)' }}
        >
          Free to start. Three tags in your hands by the end of the week. Reunite the first thing you lose, and the rest pays for itself.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Link
            href="/register"
            className="inline-flex items-center gap-2 rounded-2xl px-7 py-4 font-semibold text-base transition-transform hover:scale-[1.02]"
            style={{
              background: '#1b1410',
              color: '#f0e7d6',
              boxShadow: '0 16px 32px -10px rgba(0,0,0,0.35)',
            }}
          >
            Get your first tag
            <ArrowRight className="w-4 h-4" strokeWidth={2.4} />
          </Link>
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 rounded-2xl px-7 py-4 font-semibold text-base transition-colors"
            style={{
              background: 'rgba(255,255,255,0.12)',
              color: '#f0e7d6',
              border: '1px solid rgba(255,255,255,0.25)',
              backdropFilter: 'blur(6px)',
            }}
          >
            See pricing
          </Link>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="text-sm font-mono mt-8"
          style={{ color: 'rgba(250,246,238,0.65)' }}
        >
          No credit card. No app needed for finders. Cancel any time.
        </motion.p>
      </div>
    </section>
  );
}
