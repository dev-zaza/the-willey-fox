'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus } from 'lucide-react';

const FAQS = [
  {
    q: 'Does the finder need to install an app?',
    a: 'No. Anyone with a phone camera can scan the QR. They land on a private profile that you control — no signup, no app, no friction. The faster the path back to you, the better.',
  },
  {
    q: 'What information does the finder see?',
    a: 'Only what you choose. By default they see a first name, a short message, and a "Notify owner" button. You can layer in pet info, medical alerts, or ICE contacts depending on the tag.',
  },
  {
    q: 'What if the QR sticker gets damaged?',
    a: 'Tags are weatherproof and tested for outdoor wear. If one is damaged, every code can be reprinted from your dashboard for free, and the same code keeps working.',
  },
  {
    q: 'Is my address or phone number ever exposed?',
    a: 'Never by default. Chat is anonymous through the app. Sharing contact details is a deliberate action you take, only when you decide to.',
  },
  {
    q: 'How does emergency / lost-child broadcasting work?',
    a: 'You opt in, set a radius and duration, and the report appears on a public map for verified scanners nearby. We log every consent for safeguarding. Auto-retracts when resolved.',
  },
  {
    q: 'Can I cancel Pro any time?',
    a: 'Yes. One click in settings or the Stripe billing portal. No retention dance.',
  },
];

function FaqItem({ q, a, open, onToggle }: { q: string; a: string; open: boolean; onToggle: () => void }) {
  return (
    <div style={{ borderBottom: '1px solid rgba(27,20,16,0.08)' }}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left py-6 flex items-start justify-between gap-6 transition-colors"
      >
        <span
          className="text-lg sm:text-xl tracking-tight"
          style={{
            fontFamily: 'var(--font-display, Georgia, serif)',
            fontWeight: 700,
            color: '#1b1410',
            letterSpacing: '-0.01em',
          }}
        >
          {q}
        </span>
        <span
          className="flex-shrink-0 mt-1 transition-transform"
          style={{
            transform: open ? 'rotate(45deg)' : 'rotate(0deg)',
            color: '#ea2e00',
          }}
        >
          <Plus className="w-5 h-5" strokeWidth={2.4} />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <p
              className="text-[15px] leading-relaxed pb-6 pr-12"
              style={{ color: '#5a4a3d' }}
            >
              {a}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function FaqSection() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="relative py-24 sm:py-32 px-4" style={{ background: '#e6dcc7' }}>
      <div className="max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6 }}
          className="mb-12 text-center"
        >
          <span
            className="text-[11px] font-mono uppercase tracking-[0.18em] block mb-3"
            style={{ color: '#9d8c7a' }}
          >
            FAQ
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
            Honest{' '}
            <em className="not-italic" style={{ color: '#ea2e00', fontStyle: 'italic' }}>
              answers
            </em>
            .
          </h2>
        </motion.div>

        <div>
          {FAQS.map((f, i) => (
            <FaqItem
              key={f.q}
              q={f.q}
              a={f.a}
              open={open === i}
              onToggle={() => setOpen(open === i ? null : i)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
