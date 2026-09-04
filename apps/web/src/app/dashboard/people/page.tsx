'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { MessageSquare, Plus, Search, Shield, ShoppingBag } from 'lucide-react';
import {
  emergency,
  families,
  messages,
  qrCodes,
  type Conversation,
  type FamilyDetail,
  type FamilyMember,
  type QrCode,
} from '@/lib/api';
import { useAuth } from '@/context/auth-context';
import { cn } from '@/lib/utils';

const AVATAR_COLORS = ['#0F766E', '#B45309', '#1D4ED8', '#7C3AED', '#B91C1C'];

function initialsOf(first?: string | null, last?: string | null) {
  return `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase() || '?';
}

function lastScanLabel(tag: QrCode) {
  if (tag.isLost) return 'Reported missing';
  return new Date(tag.createdAt).toLocaleDateString('en-GB', { weekday: 'short' });
}

export default function PeoplePage() {
  const { user } = useAuth();
  const [family, setFamily] = useState<FamilyDetail | null>(null);
  const [tags, setTags] = useState<QrCode[]>([]);
  const [convos, setConvos] = useState<Conversation[]>([]);
  const [sosName, setSosName] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      families.list().catch(() => []),
      qrCodes.list().catch(() => []),
      messages.listConversations().catch(() => []),
      emergency.listContacts().catch(() => []),
    ])
      .then(async ([memberships, tagList, conversations, contacts]) => {
        setTags(tagList);
        setConvos(conversations);
        const primary = contacts.find((c) => c.isPrimary && c.status === 'accepted' && c.contact);
        if (primary?.contact) setSosName(`${primary.contact.firstName} ${primary.contact.lastName}`);
        if (memberships[0]) {
          const detail = await families.get(memberships[0].familyId);
          setFamily(detail);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const unread = convos.reduce((n, c) => n + (c.unreadCount || 0), 0);
  const lostTags = tags.filter((t) => t.isLost);
  const inboxNeed = convos.find((c) => c.unreadCount > 0 && c.lastMessage);

  const needs = useMemo(() => {
    const items: { href: string; title: string; sub: string; kind: 'inbox' | 'sos' | 'lost' }[] = [];
    if (inboxNeed?.lastMessage) {
      const who = inboxNeed.otherParticipant;
      items.push({
        href: '/dashboard/messages',
        title: who
          ? `${who.firstName} replied${lostTags[0] ? ` about ${lostTags[0].label ?? lostTags[0].name}` : ''}`
          : `${unread} unread in Inbox`,
        sub: `"${inboxNeed.lastMessage.body}"`,
        kind: 'inbox',
      });
    } else if (unread > 0) {
      items.push({
        href: '/dashboard/messages',
        title: `${unread} unread in Inbox`,
        sub: 'A finder or family member is waiting.',
        kind: 'inbox',
      });
    }
    if (!sosName) {
      items.push({
        href: '/dashboard/emergency/sos-contact',
        title: 'No SOS contact set for you',
        sub: 'Choose who gets called first. 1 min.',
        kind: 'sos',
      });
    }
    if (lostTags[0] && items.length < 2) {
      items.push({
        href: `/dashboard/qr/${lostTags[0].id}`,
        title: `${lostTags[0].label ?? lostTags[0].name} is reported missing`,
        sub: 'Open the tag to mark found or follow scans.',
        kind: 'lost',
      });
    }
    return items;
  }, [inboxNeed, unread, sosName, lostTags]);

  const dateLabel = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  const userInitials = initialsOf(user?.firstName, user?.lastName);

  const q = query.trim().toLowerCase();
  const visibleMembers = (family?.members ?? []).filter((m) => {
    if (!q) return true;
    return `${m.firstName} ${m.lastName} ${m.email}`.toLowerCase().includes(q);
  });
  const visibleProfiles = (family?.qrCodes ?? []).filter((p) => {
    if (!q) return true;
    return `${p.name} ${p.category}`.toLowerCase().includes(q);
  });
  const visibleTags = tags.filter((t) => {
    if (!q) return true;
    return `${t.label ?? t.name} ${t.category} ${t.uniqueCode}`.toLowerCase().includes(q);
  });

  const lastScanLine = lostTags[0]
    ? `one item reported lost`
    : tags.length > 0
      ? 'All tags active'
      : 'No tags linked yet';

  const hasPeople = visibleMembers.length > 0 || visibleProfiles.length > 0;

  return (
    <div className="min-h-screen min-w-0 overflow-x-hidden bg-[#F1E7D8]">
      <header className="hidden items-center gap-3 border-b border-[#E3D8C6] bg-[#F1E7D8] px-6 py-3 lg:flex">
        <label className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8A7B67]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people, tags, places"
            className="w-full rounded-xl border border-[#E3D8C6] bg-white py-2.5 pl-9 pr-3 text-sm text-[#17130F] outline-none placeholder:text-[#8A7B67] focus:border-brand-500"
          />
        </label>
        <Link
          href="/dashboard/shop"
          className="inline-flex items-center gap-2 rounded-xl border border-[#E3D8C6] bg-white px-3 py-2 text-sm font-bold text-[#17130F]"
        >
          <ShoppingBag className="h-4 w-4" />
          Shop
        </Link>
        <Link
          href="/dashboard/reports"
          className="rounded-xl bg-[#17130F] px-3.5 py-2 text-sm font-bold text-white"
        >
          Report something lost
        </Link>
        <Link
          href="/dashboard?panel=emergency"
          className="rounded-xl bg-brand-500 px-3 py-2 text-sm font-extrabold text-white"
        >
          SOS
        </Link>
        <Link
          href="/dashboard/profile"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[#6A3FB4] text-xs font-bold text-white"
          aria-label="Account"
        >
          {userInitials[0] || 'U'}
        </Link>
      </header>

      <div className="px-4 py-5 lg:px-8 lg:py-7">
        <div className="mx-auto max-w-[1100px] min-w-0">
          <p className="text-[13px] font-semibold text-[#8A7B67]">
            {dateLabel}{' '}
            {loading ? null : (
              <span className="ml-1 rounded-md border border-[#E3D8C6] bg-white px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-[#8A7B67]">
                Live data
              </span>
            )}
          </p>
          <h1 className="mt-1 text-[26px] font-extrabold tracking-tight text-[#17130F] sm:text-[32px] lg:text-[36px]">
            {needs.length > 0
              ? `${needs.length} thing${needs.length === 1 ? '' : 's'} need you`
              : 'You are all caught up'}
          </h1>

          <div className="mt-4 flex flex-col gap-3 rounded-2xl bg-[#17130F] px-4 py-4 text-white sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-start gap-3 sm:items-center">
              <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-[#137A3B]">
                <Shield className="h-5 w-5 text-white text-white-force" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-white text-white-force">
                  {family
                    ? `Family group active · ${family.members.length} member${family.members.length === 1 ? '' : 's'}, ${tags.length} QR tag${tags.length === 1 ? '' : 's'}`
                    : 'No family group yet'}
                </p>
                <p className="text-xs text-white/70">{lastScanLine}</p>
              </div>
            </div>
            <Link href="/dashboard/messages" className="flex-shrink-0 text-sm font-bold text-brand-400">
              Activity log →
            </Link>
          </div>

          {loading ? <p className="mt-8 text-sm text-[#8A7B67]">Loading…</p> : null}

          <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
            <div>
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[11px] font-extrabold tracking-[0.12em] text-[#8A7B67]">FAMILY</p>
                <Link href="/dashboard/family" className="text-sm font-bold text-brand-600">
                  Manage group
                </Link>
              </div>
              <div className={cn('grid gap-3', hasPeople ? 'sm:grid-cols-2 xl:grid-cols-3' : 'grid-cols-1')}>
                {visibleMembers.map((m, i) => (
                  <MemberCard
                    key={m.id}
                    member={m}
                    isYou={m.userId === user?.id}
                    isSos={sosName ? `${m.firstName} ${m.lastName}`.trim() === sosName : false}
                    color={AVATAR_COLORS[i % AVATAR_COLORS.length]}
                    tagHint={tags.length === 1 ? `1 tag` : `${tags.filter((t) => !t.isLost).length} tags`}
                  />
                ))}
                {visibleProfiles.map((p, i) => (
                  <Link
                    key={p.id}
                    href={`/dashboard/qr/${p.id}`}
                    className="flex flex-col rounded-2xl border border-[#E3D8C6] bg-white p-4"
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white"
                        style={{ background: AVATAR_COLORS[(i + 3) % AVATAR_COLORS.length] }}
                      >
                        {p.name[0]?.toUpperCase() ?? '?'}
                      </span>
                      <div>
                        <p className="text-sm font-bold text-[#17130F]">{p.name}</p>
                        <p className="text-xs capitalize text-[#8A7B67]">
                          {p.category === 'pet' ? 'Pet' : 'Protected person'}
                        </p>
                      </div>
                    </div>
                    <p className="mt-3 text-sm font-semibold text-[#17130F]">Full sharing</p>
                    <p className="text-xs text-[#8A7B67]">1 tag · {p.category}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-bold text-green-700">
                        Protected
                      </span>
                      {p.isLost ? (
                        <span className="rounded-full bg-[#FFF3EE] px-2 py-0.5 text-[11px] font-bold text-brand-600">
                          Missing
                        </span>
                      ) : null}
                    </div>
                  </Link>
                ))}
                <Link
                  href="/dashboard/family"
                  className={cn(
                    'flex rounded-2xl border-2 border-dashed border-brand-500/40 bg-white p-4',
                    hasPeople ? 'flex-col justify-center' : 'items-center gap-3',
                  )}
                >
                  <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#FFF3EE] text-brand-500">
                    <Plus className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <p className="text-sm font-bold text-[#17130F]">Add a family member</p>
                    <p className="mt-1 text-[12.5px] leading-5 text-[#8A7B67]">
                      {hasPeople
                        ? 'Send a link, show a QR code, or pick from contacts. Takes about 20 seconds.'
                        : 'Send a link or pick from contacts.'}
                    </p>
                  </span>
                </Link>
              </div>

              <div className="mt-8">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-[11px] font-extrabold tracking-[0.12em] text-[#8A7B67]">QR TAGS</p>
                  <Link href="/dashboard/qr" className="text-sm font-bold text-brand-600">
                    All tags
                  </Link>
                </div>
                <div className="overflow-hidden rounded-2xl border border-[#E3D8C6] bg-white">
                  {visibleTags.length === 0 ? (
                    <p className="px-4 py-8 text-sm text-[#8A7B67]">No tags yet.</p>
                  ) : (
                    visibleTags.slice(0, 6).map((t) => (
                      <Link
                        key={t.id}
                        href={`/dashboard/qr/${t.id}`}
                        className="flex items-center justify-between gap-3 border-b border-[#E3D8C6] px-4 py-3.5 last:border-0 hover:bg-[#FBF7F1]"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-[#17130F]">{t.label ?? t.name}</p>
                          <p className="text-xs capitalize text-[#8A7B67]">
                            {t.category}
                            {t.isLost ? ' · last scanned location logged' : ` · last scanned ${lastScanLabel(t)}`}
                          </p>
                        </div>
                        {t.isLost ? (
                          <span className="flex-shrink-0 text-right text-[12.5px] font-bold text-brand-600">
                            Reported missing
                            {unread > 0 ? ` · ${unread} replies` : ''}
                          </span>
                        ) : (
                          <span className="flex-shrink-0 rounded-full bg-[#E7DCCA] px-2 py-0.5 text-[11px] font-bold text-[#5C5245]">
                            Active
                          </span>
                        )}
                      </Link>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div>
              <div className="overflow-hidden rounded-2xl border border-[#E3D8C6] bg-white">
                <div
                  className={cn(
                    'relative bg-[linear-gradient(135deg,#b7cfc4_0%,#e4d4b4_55%,#d7c4a4_100%)]',
                    tags.length > 0 ? 'h-[168px]' : 'h-[200px]',
                  )}
                >
                  <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-bold text-[#17130F] shadow-sm">
                    Last scans
                  </span>
                  <Link
                    href="/dashboard"
                    className={cn(
                      'absolute text-xs font-bold text-brand-600',
                      tags.length > 0
                        ? 'bottom-3 right-3 rounded-full bg-white/95 px-2.5 py-1'
                        : 'right-3 top-3',
                    )}
                  >
                    Open full map
                  </Link>
                </div>
                {tags.length > 0 ? (
                  <div className="divide-y divide-[#E3D8C6]">
                    {tags.slice(0, 3).map((t) => (
                      <div key={t.id} className="flex items-center gap-2 px-4 py-2.5 text-sm">
                        <i
                          className={cn(
                            'h-2 w-2 flex-shrink-0 rounded-full',
                            t.isLost ? 'bg-brand-500' : 'bg-[#B45309]',
                          )}
                        />
                        <span className="min-w-0 flex-1 truncate font-medium text-[#17130F]">
                          {t.label ?? t.name}
                          {t.isLost ? ' · last seen' : ''}
                        </span>
                        <span className="flex-shrink-0 text-xs text-[#8A7B67]">{lastScanLabel(t)}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              <p className="mb-2 mt-6 text-[11px] font-extrabold tracking-[0.12em] text-[#8A7B67]">NEEDS YOU</p>
              <div className="overflow-hidden rounded-2xl border border-[#E3D8C6] bg-white">
                {needs.length === 0 ? (
                  <p className="px-4 py-8 text-sm text-[#8A7B67]">Nothing waiting.</p>
                ) : (
                  needs.map((n) => (
                    <Link
                      key={n.href + n.title}
                      href={n.href}
                      className="flex gap-3 border-b border-[#E3D8C6] px-4 py-3.5 last:border-0 hover:bg-[#FBF7F1]"
                    >
                      <span
                        className={cn(
                          'mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full',
                          n.kind === 'sos' ? 'bg-[#FEF6E4] text-[#8A6100]' : 'bg-[#FFF3EE] text-brand-600',
                        )}
                      >
                        {n.kind === 'sos' ? <Shield className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-bold text-[#17130F]">{n.title}</span>
                        <span className="mt-0.5 block truncate text-xs text-[#8A7B67]">{n.sub}</span>
                      </span>
                    </Link>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MemberCard({
  member,
  isYou,
  isSos,
  color,
  tagHint,
}: {
  member: FamilyMember;
  isYou: boolean;
  isSos: boolean;
  color: string;
  tagHint: string;
}) {
  const name = `${member.firstName ?? ''} ${member.lastName ?? ''}`.trim() || member.email;
  const rel =
    member.role === 'owner'
      ? isYou
        ? 'You · Guardian'
        : 'Owner · Guardian'
      : 'Family · Guardian';

  return (
    <div className="flex flex-col rounded-2xl border border-[#E3D8C6] bg-white p-4">
      <div className="flex items-center gap-2.5">
        <span
          className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white"
          style={{ background: color }}
        >
          {initialsOf(member.firstName, member.lastName)}
        </span>
        <div>
          <p className="text-sm font-bold text-[#17130F]">{name}</p>
          <p className="text-xs text-[#8A7B67]">{rel}</p>
        </div>
      </div>
      <p className="mt-3 text-sm font-semibold text-[#17130F]">Full sharing</p>
      <p className="text-xs text-[#8A7B67]">{tagHint}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {isSos ? (
          <span className="rounded-full bg-[#FEF6E4] px-2 py-0.5 text-[11px] font-bold text-[#8A6100]">SOS contact</span>
        ) : (
          <span className="rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-bold text-green-700">Guardian</span>
        )}
        <span className="text-[11px] font-semibold text-[#8A7B67]">{isYou ? 'You' : member.role}</span>
      </div>
    </div>
  );
}
