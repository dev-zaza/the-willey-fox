'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Check, Lightbulb, Map, QrCode, Tag } from 'lucide-react';
import { markOnboardingDone } from '@/lib/onboarding';
import {
  ONBOARD_FAMILY_NAME_KEY,
  ONBOARD_QR_PROFILES_KEY,
  type CreatedQrProfile,
} from '@/lib/family-profiles';

export default function OnboardDonePage() {
  const [groupName, setGroupName] = useState('');
  const [qrList, setQrList] = useState<CreatedQrProfile[]>([]);

  useEffect(() => {
    markOnboardingDone();
    setGroupName(sessionStorage.getItem(ONBOARD_FAMILY_NAME_KEY) || '');
    try {
      const raw = sessionStorage.getItem(ONBOARD_QR_PROFILES_KEY);
      setQrList(raw ? (JSON.parse(raw) as CreatedQrProfile[]) : []);
    } catch {
      setQrList([]);
    }
    sessionStorage.removeItem(ONBOARD_QR_PROFILES_KEY);
  }, []);

  return (
    <div className="min-h-screen" style={{ background: '#f0e7d6', color: '#1b1410' }}>
    <div className="mx-auto flex max-w-md flex-col items-center px-6 py-12">
      <div
        className="flex h-[88px] w-[88px] items-center justify-center rounded-full"
        style={{ background: '#f0fdf4' }}
      >
        <Check className="h-12 w-12" style={{ color: '#3fa34d' }} strokeWidth={2.5} />
      </div>
      <h1 className="mt-4 text-center text-2xl font-extrabold">You&apos;re all set</h1>
      {groupName ? (
        <p
          className="mt-3 rounded-xl px-4 py-2 text-sm font-bold"
          style={{ background: '#ffe9d6', color: '#ea2e00' }}
        >
          {groupName}
        </p>
      ) : null}
      <p className="mt-3 max-w-sm text-center text-sm leading-6" style={{ color: '#5a4a3d' }}>
        QR safety profiles have been created for every member of your group.
      </p>

      {qrList.length > 0 && (
        <div className="mt-8 w-full space-y-2.5">
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#7a6957' }}>
            QR profiles created
          </p>
          {qrList.map((q) => (
            <div
              key={q.code}
              className="flex items-center gap-3.5 rounded-2xl border bg-white p-4"
              style={{ borderColor: 'rgba(27,20,16,0.12)' }}
            >
              <div
                className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl"
                style={{ background: '#ffe9d6' }}
              >
                <QrCode className="h-5 w-5" style={{ color: '#ea2e00' }} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">{q.name}</p>
                <p className="mt-0.5 font-mono text-xs tracking-widest" style={{ color: '#7a6957' }}>
                  {q.code}
                </p>
              </div>
              <span
                className="rounded-lg px-2.5 py-1 text-[11px] font-bold"
                style={{ background: '#f0fdf4', color: '#3fa34d' }}
              >
                Ready
              </span>
            </div>
          ))}
        </div>
      )}

      <div
        className="mt-6 flex w-full items-start gap-3 rounded-2xl border bg-white p-4"
        style={{ borderColor: 'rgba(27,20,16,0.12)' }}
      >
        <Lightbulb className="mt-0.5 h-5 w-5 flex-shrink-0" style={{ color: '#ea2e00' }} />
        <div>
          <p className="text-sm font-bold">Next step</p>
          <p className="mt-1 text-xs leading-[18px]" style={{ color: '#7a6957' }}>
            Print your QR tags and attach them to your family members&apos; bags, phones, or wear them as wristbands.
          </p>
        </div>
      </div>

      <div className="mt-8 flex w-full flex-col gap-3">
        <Link
          href="/dashboard/qr"
          className="inline-flex items-center justify-center gap-2 rounded-2xl py-4 text-sm font-bold text-white"
          style={{ background: '#ea2e00' }}
        >
          <Tag className="h-4 w-4" />
          View in My Tags
        </Link>
        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center gap-2 rounded-2xl border bg-white py-[15px] text-sm font-semibold"
          style={{ borderColor: 'rgba(27,20,16,0.12)', color: '#1b1410' }}
        >
          <Map className="h-4 w-4" />
          Go to map
        </Link>
      </div>
    </div>
    </div>
  );
}
