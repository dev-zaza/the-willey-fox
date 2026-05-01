'use client';

import { motion } from 'framer-motion';
import { ShieldAlert, Navigation, Users, QrCode, MessageCircle, Bell } from 'lucide-react';

const FEATURES = [
  {
    title: 'Anonymous chat with finders',
    description:
      'Talk to whoever scanned your tag through a private channel. Share contact only when you decide to.',
    icon: MessageCircle,
    accent: '#ea2e00',
  },
  {
    title: 'Smart hazard-aware routes',
    description:
      'Live community pin data feeds into directions. Skip the road closures, the demo, the unsafe shortcut.',
    icon: Navigation,
    accent: '#0e8b5e',
  },
  {
    title: 'One-tap SOS with GPS',
    description:
      'Critical alert with your live location goes to every emergency contact. Push, SMS, and email at once.',
    icon: ShieldAlert,
    accent: '#dc2626',
  },
  {
    title: 'Lost-child broadcasting',
    description:
      'Opt-in public broadcast pins a profile to a radius for verified scanners. Auto-retracts on resolved.',
    icon: Bell,
    accent: '#1e3a8a',
  },
  {
    title: 'Bulk QR for families & teams',
    description:
      'Generate, print, and assign tag packs at once. Perfect for kids, fleets, school trips, dog walkers.',
    icon: QrCode,
    accent: '#7c3aed',
  },
  {
    title: 'Guardians & shared access',
    description:
      'Add trusted contacts with the right permissions. Anyone in the family can respond when you can\'t.',
    icon: Users,
    accent: '#0891b2',
  },
];

export function FeaturesSection() {
  return (
    <section className="relative py-24 sm:py-32 px-4" style={{ background: '#e6dcc7' }}>
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
            What's inside
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
            Everything you need to stay{' '}
            <em className="not-italic" style={{ color: '#ea2e00', fontStyle: 'italic' }}>
              connected
            </em>
            .
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
          {FEATURES.map((f, i) => {
            const Icon = f.icon;
            return (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.45, delay: (i % 2) * 0.08 }}
                className="flex gap-5"
              >
                <div
                  className="flex-shrink-0 flex items-center justify-center rounded-2xl"
                  style={{
                    width: 52,
                    height: 52,
                    background: '#ffffff',
                    border: '1px solid rgba(27,20,16,0.08)',
                    boxShadow: '0 6px 14px -8px rgba(80,40,15,0.14)',
                  }}
                >
                  <Icon className="w-5 h-5" style={{ color: f.accent }} strokeWidth={1.9} />
                </div>
                <div className="flex-1 pt-1">
                  <h3
                    className="text-xl mb-2 tracking-tight"
                    style={{
                      fontFamily: 'var(--font-display, Georgia, serif)',
                      fontWeight: 700,
                      color: '#1b1410',
                      letterSpacing: '-0.01em',
                    }}
                  >
                    {f.title}
                  </h3>
                  <p className="text-[15px] leading-relaxed" style={{ color: '#5a4a3d' }}>
                    {f.description}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
