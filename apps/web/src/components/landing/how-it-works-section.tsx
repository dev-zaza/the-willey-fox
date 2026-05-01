'use client';

import { motion } from 'framer-motion';
import { Package, ScanLine, Heart } from 'lucide-react';

const STEPS = [
  {
    n: '01',
    icon: Package,
    title: 'Get a Wileyfox tag',
    body: 'A weatherproof QR sticker or fob. Stick it on the bag, the collar, the keychain, the backpack zip.',
  },
  {
    n: '02',
    icon: ScanLine,
    title: 'A stranger scans it',
    body: 'Anyone with a phone scans, sees a private profile of just what you want shown. No app required for the finder.',
  },
  {
    n: '03',
    icon: Heart,
    title: 'You get a ping',
    body: 'Push notification, email, SMS. Chat anonymously through the app. Pick the moment to share contact, never before.',
  },
];

export function HowItWorksSection() {
  return (
    <section
      className="relative py-24 sm:py-32 px-4 overflow-hidden"
      style={{ background: '#e6dcc7' }}
    >
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6 }}
          className="mb-16 sm:mb-20"
        >
          <span
            className="text-[11px] font-mono uppercase tracking-[0.18em] block mb-3"
            style={{ color: '#9d8c7a' }}
          >
            How it works
          </span>
          <h2
            className="text-4xl sm:text-5xl tracking-tight"
            style={{
              fontFamily: 'var(--font-display, Georgia, serif)',
              fontWeight: 700,
              letterSpacing: '-0.02em',
              color: '#1b1410',
              maxWidth: 720,
            }}
          >
            Three steps between lost and{' '}
            <em className="not-italic" style={{ color: '#ea2e00', fontStyle: 'italic' }}>
              found
            </em>
            .
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-10">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            return (
              <motion.div
                key={s.n}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="relative"
              >
                <div className="flex items-start gap-4 mb-5">
                  <div
                    className="flex items-center justify-center rounded-2xl flex-shrink-0"
                    style={{
                      width: 56,
                      height: 56,
                      background: '#ffffff',
                      border: '1px solid rgba(27,20,16,0.08)',
                      boxShadow: '0 6px 14px -6px rgba(80,40,15,0.14)',
                    }}
                  >
                    <Icon className="w-6 h-6" style={{ color: '#ea2e00' }} strokeWidth={1.8} />
                  </div>
                  <span
                    className="font-mono text-xs tracking-[0.15em] mt-2"
                    style={{ color: '#9d8c7a' }}
                  >
                    {s.n}
                  </span>
                </div>
                <h3
                  className="text-2xl mb-2.5 tracking-tight"
                  style={{
                    fontFamily: 'var(--font-display, Georgia, serif)',
                    fontWeight: 700,
                    color: '#1b1410',
                    letterSpacing: '-0.01em',
                  }}
                >
                  {s.title}
                </h3>
                <p className="text-[15px] leading-relaxed" style={{ color: '#5a4a3d' }}>
                  {s.body}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
