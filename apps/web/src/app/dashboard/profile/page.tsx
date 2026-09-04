'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { auth, emergency, families, users as usersApi } from '@/lib/api';
import { cn } from '@/lib/utils';

type Prefs = { email?: boolean; push?: boolean; sms?: boolean };

function Chan({ on, label }: { on: boolean; label: string }) {
  return (
    <span
      className={cn(
        'inline-flex min-w-[2.5rem] items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-bold',
        on ? 'bg-[#17130F] text-white text-white-force' : 'bg-[#E7DCCA] text-[#8A7B67]',
      )}
    >
      {label}
    </span>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const { user, logout, setUser } = useAuth();
  const [familyMemberCount, setFamilyMemberCount] = useState<number | null>(null);
  const [sosName, setSosName] = useState<string | null>(null);
  const [sosLoaded, setSosLoaded] = useState(false);
  const [prefs, setPrefs] = useState<Prefs>({ email: true, push: true, sms: false });
  const [savingPrefs, setSavingPrefs] = useState(false);

  useEffect(() => {
    auth
      .me()
      .then((profile) => {
        setUser(profile);
        const p = (profile as UserProfileWithPrefs).notificationPreferences ?? {};
        setPrefs({ email: p.email !== false, push: p.push !== false, sms: p.sms === true });
      })
      .catch(() => {});

    families
      .list()
      .then(async (memberships) => {
        if (memberships.length === 0) {
          setFamilyMemberCount(0);
          return;
        }
        const detail = await families.get(memberships[0].familyId);
        setFamilyMemberCount(detail.members?.length ?? 0);
      })
      .catch(() => setFamilyMemberCount(0));

    emergency
      .listContacts()
      .then((contacts) => {
        const primary = contacts.find((c) => c.isPrimary && c.status === 'accepted' && c.contact);
        if (primary?.contact) {
          setSosName(`${primary.contact.firstName} ${primary.contact.lastName}`);
        }
      })
      .catch(() => {})
      .finally(() => setSosLoaded(true));
  }, [setUser]);

  async function savePrefs(next: Prefs) {
    setPrefs(next);
    setSavingPrefs(true);
    try {
      const updated = await usersApi.updateProfile({ notificationPreferences: next });
      setUser(updated);
    } catch {
      /* keep local */
    } finally {
      setSavingPrefs(false);
    }
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F1E7D8]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  const initials = `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase() || '?';
  const phoneVerified = Boolean((user as { phoneVerifiedAt?: string }).phoneVerifiedAt);
  const tier = user.subscriptionTier
    ? user.subscriptionTier.charAt(0).toUpperCase() + user.subscriptionTier.slice(1)
    : 'Free';
  const since = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
    : '';

  return (
    <div className="min-h-screen min-w-0 overflow-x-hidden bg-[#F1E7D8] px-4 py-4 lg:px-10 lg:py-8">
      <div className="mx-auto grid max-w-5xl gap-5 lg:grid-cols-[1fr_280px] lg:gap-6">
        <div className="min-w-0 space-y-4 lg:space-y-5">
          <div className="flex flex-col gap-3 rounded-2xl border border-[#E3D8C6] bg-white p-4 sm:flex-row sm:items-center sm:gap-4 sm:p-5">
            <div className="flex min-w-0 items-center gap-3">
              {user.avatarUrl ? (
                <Image src={user.avatarUrl} alt="" width={56} height={56} className="h-14 w-14 flex-shrink-0 rounded-full object-cover" unoptimized />
              ) : (
                <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-brand-500 text-lg font-bold text-white text-white-force">
                  {initials}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-lg font-extrabold text-[#17130F] sm:text-xl">
                  {user.firstName} {user.lastName}
                </p>
                <p className="truncate text-sm text-[#8A7B67]">
                  {user.email}
                  {since ? ` · since ${since}` : ''}
                </p>
              </div>
            </div>
            <Link
              href="/dashboard/settings"
              className="w-full flex-shrink-0 rounded-xl border border-[#E3D8C6] px-3 py-2 text-center text-sm font-bold text-[#17130F] sm:w-auto"
            >
              Edit profile
            </Link>
          </div>

          <div className="flex flex-col gap-3 rounded-2xl bg-[#FFF3EE] p-4 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-brand-500 text-xs font-bold text-white text-white-force">
                SOS
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-[#17130F]">
                  {sosLoaded && sosName ? `SOS contact: ${sosName}` : 'Choose your SOS contact'}
                </p>
                <p className="text-xs text-[#8A7B67]">
                  {sosName ? 'Who we call and text first when you hold SOS.' : 'Nobody is set for you. 1 min.'}
                </p>
              </div>
            </div>
            <Link
              href="/dashboard/emergency/sos-contact"
              className="w-full flex-shrink-0 rounded-xl bg-brand-500 px-3 py-2 text-center text-sm font-bold text-white text-white-force sm:w-auto"
            >
              {sosName ? 'Change' : 'Choose'}
            </Link>
          </div>

          <div className="min-w-0">
            <p className="mb-2 text-[11px] font-extrabold tracking-[0.12em] text-[#8A7B67]">SIGN-IN &amp; SECURITY</p>
            <div className="overflow-hidden rounded-2xl border border-[#E3D8C6] bg-white">
              <Row
                title="Mobile number"
                sub={phoneVerified ? `${user.phone} · verified` : user.phone ? `${user.phone} · not verified` : 'Not added'}
                action="Verify"
                href="/dashboard/settings/phone-verify"
              />
              <Row title="Two-factor authentication" sub="Required for protected person accounts" href="/dashboard/settings/security" action="Manage" />
              <Row title="Active sessions" sub="This device" href="/dashboard/settings/security" action="Review" last />
            </div>
          </div>

          <div className="min-w-0">
            <p className="mb-2 text-[11px] font-extrabold tracking-[0.12em] text-[#8A7B67]">WHAT YOU&apos;RE TOLD ABOUT</p>
            <div className="space-y-3 rounded-2xl border border-[#E3D8C6] bg-white p-4">
              <NotifRow label="Someone scans one of my tags" prefs={prefs} disabled={savingPrefs} onChange={savePrefs} />
              <NotifRow label="A finder sends a message" prefs={prefs} disabled={savingPrefs} onChange={savePrefs} />
              <NotifRow label="SOS or lost-child alert in my group" prefs={{ ...prefs, sms: true }} disabled onChange={() => {}} />
              <div className="flex flex-col gap-2 border-t border-[#E3D8C6] pt-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm text-[#17130F]">Weekly safety digest</span>
                <span className="flex flex-wrap gap-1">
                  <Chan on={false} label="Push" />
                  <Chan on={Boolean(prefs.email)} label="Email" />
                  <Chan on={false} label="SMS" />
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="min-w-0 space-y-4 lg:space-y-5">
          <div className="rounded-2xl border border-[#E3D8C6] bg-white p-4 sm:p-5">
            <p className="text-[11px] font-extrabold tracking-[0.12em] text-[#8A7B67]">PLAN</p>
            <p className="mt-1 text-2xl font-extrabold text-[#17130F]">{tier}</p>
            <p className="mt-2 text-sm leading-5 text-[#5C5245]">
              QR tags, emergency contacts and report history follow your plan limits.
            </p>
            <Link
              href="/dashboard/subscription"
              className="mt-4 flex w-full justify-center rounded-xl bg-[#17130F] py-2.5 text-sm font-bold text-white text-white-force"
            >
              Compare with Premium
            </Link>
          </div>
          <div className="min-w-0">
            <p className="mb-2 text-[11px] font-extrabold tracking-[0.12em] text-[#8A7B67]">SHORTCUTS</p>
            <div className="overflow-hidden rounded-2xl border border-[#E3D8C6] bg-white">
              <Shortcut href="/dashboard/family" label={`Family group${familyMemberCount ? ` · ${familyMemberCount} members` : ''}`} />
              <Shortcut href="/dashboard/spots" label="Saved places" />
              <Shortcut href="/dashboard/qr" label="Tags & items" />
              <Shortcut href="/dashboard/shop" label="Orders & delivery" />
              <Shortcut href="/privacy-policy" label="Privacy & data export" />
              <button
                type="button"
                onClick={() => logout()}
                className="flex w-full items-center justify-between px-4 py-3.5 text-left text-sm font-bold text-brand-600 hover:bg-[#FBF7F1]"
              >
                Sign out
                <span className="text-[#8A7B67]">›</span>
              </button>
            </div>
          </div>
          {user.isAdmin ? (
            <button
              type="button"
              onClick={() => router.push('/admin')}
              className="w-full rounded-2xl border border-brand-500/30 py-3 text-sm font-medium text-brand-600"
            >
              Admin Panel
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Row({
  title,
  sub,
  action,
  href,
  last,
}: {
  title: string;
  sub: string;
  action: string;
  href: string;
  last?: boolean;
}) {
  return (
    <div className={cn('flex items-start gap-3 px-4 py-3.5 sm:items-center', !last && 'border-b border-[#E3D8C6]')}>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-[#17130F]">{title}</p>
        <p className="break-words text-xs text-[#8A7B67]">{sub}</p>
      </div>
      <Link href={href} className="flex-shrink-0 rounded-lg border border-[#E3D8C6] px-2.5 py-1.5 text-xs font-bold text-[#17130F]">
        {action}
      </Link>
    </div>
  );
}

function Shortcut({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="flex items-center justify-between border-b border-[#E3D8C6] px-4 py-3.5 text-sm hover:bg-[#FBF7F1]">
      <span className="min-w-0 truncate pr-2">{label}</span>
      <span className="flex-shrink-0 text-[#8A7B67]">›</span>
    </Link>
  );
}

function NotifRow({
  label,
  prefs,
  disabled,
  onChange,
}: {
  label: string;
  prefs: Prefs;
  disabled?: boolean;
  onChange: (next: Prefs) => void;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <span className="min-w-0 text-sm text-[#17130F]">{label}</span>
      <span className="flex flex-shrink-0 flex-wrap gap-1">
        <button type="button" disabled={disabled} onClick={() => onChange({ ...prefs, push: !prefs.push })}>
          <Chan on={Boolean(prefs.push)} label="Push" />
        </button>
        <button type="button" disabled={disabled} onClick={() => onChange({ ...prefs, email: !prefs.email })}>
          <Chan on={Boolean(prefs.email)} label="Email" />
        </button>
        <button type="button" disabled={disabled} onClick={() => onChange({ ...prefs, sms: !prefs.sms })}>
          <Chan on={Boolean(prefs.sms)} label="SMS" />
        </button>
      </span>
    </div>
  );
}

type UserProfileWithPrefs = {
  notificationPreferences?: Prefs;
};
