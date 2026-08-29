'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Bookmark,
  ChevronRight,
  Crown,
  LogOut,
  Phone,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { auth, emergency, families } from '@/lib/api';

function SectionTitle({ children }: { children: string }) {
  return (
    <p className="px-1 text-[11px] font-bold uppercase tracking-wider text-[#7a6957]">{children}</p>
  );
}

function ProfileRow({
  href,
  icon,
  iconClassName,
  label,
  sublabel,
  value,
  valueClassName,
  onClick,
  last = false,
}: {
  href?: string;
  icon: React.ReactNode;
  iconClassName?: string;
  label: string;
  sublabel?: string;
  value?: string;
  valueClassName?: string;
  onClick?: () => void;
  last?: boolean;
}) {
  const inner = (
    <>
      <div
        className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${iconClassName ?? 'bg-brand-500/10 text-brand-500'}`}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-[var(--text-primary)]">{label}</p>
        {sublabel ? <p className="mt-0.5 truncate text-xs text-[#7a6957]">{sublabel}</p> : null}
      </div>
      {value ? (
        <span className={`text-xs font-semibold ${valueClassName ?? 'text-[#7a6957]'}`}>{value}</span>
      ) : null}
      {(href || onClick) && <ChevronRight className="h-4 w-4 flex-shrink-0 text-[#9d8c7a]" />}
    </>
  );

  const className = `flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-black/5 ${
    last ? '' : 'border-b border-surface-border'
  }`;

  if (href) {
    return (
      <Link href={href} className={className}>
        {inner}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {inner}
    </button>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const { user, logout, setUser } = useAuth();
  const [familyMemberCount, setFamilyMemberCount] = useState<number | null>(null);
  const [sosName, setSosName] = useState<string | null>(null);
  const [sosLoaded, setSosLoaded] = useState(false);

  useEffect(() => {
    auth.me().then((profile) => setUser(profile)).catch(() => {});

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

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  const initials = `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase() || '?';
  const phoneVerified = Boolean((user as { phoneVerifiedAt?: string }).phoneVerifiedAt);

  return (
    <div className="min-h-screen bg-surface pb-8">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-surface-border bg-surface/95 px-4 pb-4 pt-safe backdrop-blur">
        <button
          type="button"
          onClick={() => router.push('/dashboard')}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-surface-border text-[#5a4a3d]"
          aria-label="Back to map"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="flex-1 text-xl font-bold text-[var(--text-primary)]">Profile</h1>
        <Link
          href="/dashboard/settings"
          className="rounded-lg bg-brand-500/10 px-3 py-1.5 text-sm font-semibold text-brand-600"
        >
          Edit
        </Link>
      </header>

      <div className="flex flex-col items-center px-4 py-8">
        {user.avatarUrl ? (
          <Image
            src={user.avatarUrl}
            alt=""
            width={108}
            height={108}
            className="h-[108px] w-[108px] rounded-full object-cover"
            unoptimized
          />
        ) : (
          <div className="flex h-[108px] w-[108px] items-center justify-center rounded-full bg-[#6A3FB4] text-4xl font-bold text-white">
            {initials}
          </div>
        )}
        <h2 className="mt-4 text-2xl font-bold text-[var(--text-primary)]">
          {user.firstName} {user.lastName}
        </h2>
        <p className="mt-1 text-sm text-[#7a6957]">{user.email}</p>
      </div>

      <div className="space-y-5 px-4">
        <div>
          <SectionTitle>Safety Network</SectionTitle>
          <div className="mt-2 overflow-hidden rounded-2xl border border-surface-border bg-surface-elevated">
            <ProfileRow
              href="/dashboard/family"
              icon={<Users className="h-4 w-4" />}
              label="Family Group"
              sublabel={
                familyMemberCount === null
                  ? 'Loading…'
                  : familyMemberCount === 0
                    ? 'No family group yet'
                    : `${familyMemberCount} ${familyMemberCount === 1 ? 'member' : 'members'}`
              }
              value={familyMemberCount && familyMemberCount > 0 ? 'Active' : undefined}
              valueClassName="text-green-600"
            />
            <ProfileRow
              href="/dashboard/emergency/sos-contact"
              icon={<Phone className="h-4 w-4" />}
              iconClassName="bg-red-500/10 text-red-500"
              label="SOS Contact"
              sublabel={!sosLoaded ? 'Loading…' : sosName ?? 'No primary SOS contact'}
              last
            />
          </div>
        </div>

        <div>
          <SectionTitle>Explore</SectionTitle>
          <div className="mt-2 overflow-hidden rounded-2xl border border-surface-border bg-surface-elevated">
            <ProfileRow
              href="/dashboard/spots"
              icon={<Bookmark className="h-4 w-4" />}
              iconClassName="bg-violet-500/10 text-violet-500"
              label="Saved Spots"
              sublabel="Your saved locations"
              last
            />
          </div>
        </div>

        <div>
          <SectionTitle>Account</SectionTitle>
          <div className="mt-2 overflow-hidden rounded-2xl border border-surface-border bg-surface-elevated">
            <ProfileRow
              href="/dashboard/settings/phone-verify"
              icon={<Phone className="h-4 w-4" />}
              label="Phone Number"
              sublabel={phoneVerified ? 'Verified' : user.phone ? 'Tap to verify' : undefined}
              value={user.phone ?? 'Add'}
              valueClassName={phoneVerified ? 'text-green-600' : 'text-brand-600'}
            />
            <ProfileRow
              href="/dashboard/subscription"
              icon={<Crown className="h-4 w-4" />}
              iconClassName="bg-amber-500/10 text-amber-600"
              label="Plan"
              value={
                user.subscriptionTier
                  ? user.subscriptionTier.charAt(0).toUpperCase() + user.subscriptionTier.slice(1)
                  : 'Free'
              }
            />
            <ProfileRow
              href="/dashboard/settings"
              icon={<ShieldCheck className="h-4 w-4" />}
              label="Settings"
              sublabel="Notifications, 2FA, avatar"
            />
            <ProfileRow
              label="Email Verified"
              icon={<ShieldCheck className="h-4 w-4" />}
              value={user.isVerified ? 'Yes' : 'Pending'}
              valueClassName={user.isVerified ? 'text-green-600' : 'text-brand-600'}
              last
            />
          </div>
        </div>

        {user.isAdmin ? (
          <Link
            href="/admin"
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-brand-500/30 py-3.5 text-sm font-medium text-brand-600 transition-colors hover:bg-brand-500/10"
          >
            <ShieldCheck className="h-4 w-4" />
            Admin Panel
          </Link>
        ) : null}

        <button
          type="button"
          onClick={() => logout()}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-500/30 py-3.5 text-sm font-semibold text-red-500 transition-colors hover:bg-red-500/10"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </div>
  );
}
