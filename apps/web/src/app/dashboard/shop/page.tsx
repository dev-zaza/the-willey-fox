'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { getShopifyShopUrl } from '@/lib/shopify-shop';
import { cn } from '@/lib/utils';

const PRODUCTS = [
  { name: 'QR stickers · 5-pack', desc: 'Weatherproof. Bags, laptops, bikes, water bottles — anything with a flat surface.' },
  { name: 'Luggage stickers', desc: 'Bigger, tougher, built for the hold. Reunited at airports and stations.' },
  { name: 'Name tag', desc: 'PU leather. Scans to the ICE fields you choose to publish.' },
  { name: 'Snap wristband', desc: 'Yellow silicone snap band, fox sticker and a unique QR.' },
  { name: 'Disposable wristbands · 10-pack', desc: 'Festivals, beach days, school trips, hostels.' },
  { name: 'Whistle keyring', desc: 'Keys, and a whistle when you need one.' },
  { name: 'Medic bracelet', desc: 'Silicone ICE band. Scans to the medical fields you’ve chosen to show.' },
];

const TABS = ['All', 'Tags', 'Wristbands', 'Premium'] as const;

export default function ShopPage() {
  const shopUrl = getShopifyShopUrl();
  const [tab, setTab] = useState<(typeof TABS)[number]>('All');

  const filtered = useMemo(() => {
    if (tab === 'Wristbands') return PRODUCTS.filter((p) => p.name.toLowerCase().includes('wrist'));
    if (tab === 'Tags') return PRODUCTS.filter((p) => !p.name.toLowerCase().includes('wrist') && !p.name.toLowerCase().includes('medic'));
    if (tab === 'Premium') return PRODUCTS.filter((p) => p.name.toLowerCase().includes('medic') || p.name.toLowerCase().includes('snap'));
    return PRODUCTS;
  }, [tab]);

  return (
    <div className="min-h-screen min-w-0 overflow-x-hidden bg-[#F1E7D8] px-4 py-6 lg:px-10 lg:py-8">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-extrabold tracking-[0.12em] text-[#8A7B67]">
              STORE OPENING SOON · ALL TAGS QR-LINKED TO YOUR IN-APP EMERGENCY PROFILE
            </p>
            <h1 className="mt-1 text-[28px] font-extrabold tracking-tight text-[#17130F]">Shop</h1>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {TABS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={cn(
                  'rounded-full px-3 py-1.5 text-xs font-bold',
                  tab === t ? 'bg-[#17130F] text-white text-white-force' : 'bg-white text-[#5C5245]',
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-4 rounded-2xl border border-[#E3D8C6] bg-white p-5">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-extrabold tracking-[0.12em] text-[#8A7B67]">WILEY FOX PREMIUM</p>
            <p className="mt-1 text-lg font-extrabold">Unlimited tags, 25 emergency contacts, lifetime history</p>
            <p className="mt-1 text-sm text-[#5C5245]">
              Priority lost-child broadcast, family guardians with role management, bulk QR packs.
            </p>
          </div>
          <Link
            href="/dashboard/subscription"
            className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-bold text-white text-white-force"
          >
            See Premium
          </Link>
        </div>

        <section
          aria-label="Custom name labels — coming soon"
          className="relative mt-8 overflow-hidden rounded-3xl border border-[#E3D8C6] bg-white"
        >
          {/* Corner ribbon */}
          <div
            className="pointer-events-none absolute -right-10 top-5 z-10 w-40 rotate-45 bg-[#17130F] py-1.5 text-center shadow-md"
            aria-hidden
          >
            <span className="text-[10px] font-extrabold tracking-[0.14em] text-white text-white-force">
              COMING SOON
            </span>
          </div>

          {/* Header strip */}
          <div className="flex flex-wrap items-center gap-2 border-b border-[#E3D8C6] bg-[#FBF7F1] px-6 py-3">
            <p className="text-[11px] font-extrabold tracking-[0.12em] text-[#8A7B67]">
              NEW · PERSONALISED FOR SCHOOL
            </p>
            <span className="inline-flex items-center rounded-full bg-[#FEF6E4] px-2 py-0.5 text-[10px] font-extrabold tracking-[0.08em] text-[#8A6100] ring-1 ring-[#E8D5A3]">
              COMING SOON
            </span>
          </div>

          <div className="grid items-center gap-6 p-6 lg:grid-cols-2">
            <div>
              <h2 className="text-2xl font-extrabold text-[#17130F]">Custom name labels for kids</h2>
              <p className="mt-2 text-sm leading-6 text-[#5C5245]">
                Waterproof stick-on labels, mini stickers and shoe labels — with your child&apos;s name, their colour and
                their icon. Choose a Wiley Fox pack, where every label carries their QR, or a plain pack if you just want
                their name on their kit.
              </p>
              <ul className="mt-4 space-y-1 text-sm text-[#17130F]">
                <li>Dishwasher &amp; washing-machine safe</li>
                <li>Won&apos;t peel off</li>
                <li>Printed and posted by our print partner</li>
              </ul>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled
                  aria-disabled="true"
                  title="Design a pack is coming soon"
                  className="cursor-not-allowed rounded-xl bg-[#E7DCCA] px-4 py-2.5 text-sm font-bold text-[#8A7B67]"
                >
                  Design a pack
                </button>
                <span className="text-xs font-semibold text-[#8A7B67]">Designer opens soon</span>
              </div>
            </div>
            <div className="relative flex min-h-[220px] items-center justify-center overflow-hidden rounded-2xl bg-[#F1E7D8] text-center">
              <div className="absolute inset-0 bg-white/35" aria-hidden />
              <div className="relative opacity-60">
                <p className="text-3xl font-extrabold tracking-tight text-brand-500">ZOE</p>
                <p className="mt-1 text-xs font-bold text-[#8A7B67]">Name label preview</p>
              </div>
            </div>
          </div>
        </section>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <div key={p.name} className="overflow-hidden rounded-2xl border border-[#E3D8C6] bg-white">
              <div className="h-28 bg-[#F1E7D8]" />
              <div className="p-4">
                <p className="font-bold text-[#17130F]">{p.name}</p>
                <p className="mt-1 text-xs leading-5 text-[#5C5245]">{p.desc}</p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-[10px] font-extrabold tracking-wider text-[#8A7B67]">COMING SOON</span>
                  {shopUrl ? (
                    <a
                      href={shopUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg bg-[#17130F] px-3 py-1.5 text-xs font-bold text-white text-white-force"
                    >
                      Notify me
                    </a>
                  ) : (
                    <Link
                      href="/register"
                      className="rounded-lg bg-[#17130F] px-3 py-1.5 text-xs font-bold text-white text-white-force"
                    >
                      Notify me
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
