'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Ban, Flag, MapPin, MoreVertical, Send, X } from 'lucide-react';
import {
  messages as messagesApi,
  reports,
  users as usersApi,
  type Conversation,
  type Message,
  type Report,
} from '@/lib/api';
import { useAuth } from '@/context/auth-context';
import { cn } from '@/lib/utils';

type Filter = 'all' | 'found' | 'family' | 'community';

export default function MessagesPage() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [lostReports, setLostReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [activeConvo, setActiveConvo] = useState<Conversation | null>(null);
  const [activeReport, setActiveReport] = useState<Report | null>(null);
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [msgsLoading, setMsgsLoading] = useState(false);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [showConvoMenu, setShowConvoMenu] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [showReportModal, setShowReportModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [sighting, setSighting] = useState('');
  const [sightingSent, setSightingSent] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([messagesApi.listConversations(), reports.list().catch(() => [] as Report[])])
      .then(([convos, items]) => {
        setConversations(convos);
        setLostReports(items);
      })
      .finally(() => setLoading(false));
  }, []);

  const filteredConvos = useMemo(() => {
    if (filter === 'found' || filter === 'community') return [];
    return conversations;
  }, [conversations, filter]);

  const filteredReports = useMemo(() => {
    if (filter === 'family') return [];
    if (filter === 'community') return lostReports.filter((r) => r.isPublicBroadcast);
    if (filter === 'found') return lostReports;
    return lostReports;
  }, [lostReports, filter]);

  async function openConversation(convo: Conversation) {
    setActiveReport(null);
    setActiveConvo(convo);
    setMsgsLoading(true);
    try {
      const data = await messagesApi.listMessages(convo.id);
      setMsgs([...data].reverse());
      await messagesApi.markRead(convo.id);
      setConversations((prev) => prev.map((c) => (c.id === convo.id ? { ...c, unreadCount: 0 } : c)));
    } finally {
      setMsgsLoading(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!reply.trim() || !activeConvo) return;
    setSending(true);
    try {
      const msg = await messagesApi.send(activeConvo.id, reply.trim());
      setMsgs((prev) => [...prev, msg]);
      setReply('');
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    } finally {
      setSending(false);
    }
  }

  async function handleBlockUser() {
    if (!activeConvo?.otherParticipant) return;
    const other = activeConvo.otherParticipant;
    if (!confirm(`Block ${other.firstName} ${other.lastName}? They won't be able to send you messages.`)) return;
    setActionLoading(true);
    setShowConvoMenu(false);
    try {
      await usersApi.blockUser(other.id);
      setActiveConvo(null);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed to block user');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReportUser() {
    if (!activeConvo?.otherParticipant || !reportReason.trim()) return;
    setActionLoading(true);
    try {
      await usersApi.reportUser(activeConvo.otherParticipant.id, reportReason.trim(), 'message', activeConvo.id);
      setShowReportModal(false);
      setReportReason('');
      alert('Report submitted. Our team will review it.');
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed to submit report');
    } finally {
      setActionLoading(false);
    }
  }

  const other = activeConvo?.otherParticipant;
  const showThread = Boolean(activeConvo || activeReport);

  return (
    <div className="min-h-screen bg-[#F1E7D8] lg:h-screen lg:overflow-hidden">
      <div className="flex min-h-screen flex-col lg:h-full lg:flex-row">
        <aside className={cn('border-[#E3D8C6] bg-white lg:w-[380px] lg:flex-shrink-0 lg:border-r', showThread && 'hidden lg:block')}>
          <div className="border-b border-[#E3D8C6] px-5 py-5">
            <h1 className="text-2xl font-extrabold tracking-tight text-[#17130F]">Inbox</h1>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {(
                [
                  ['all', 'All'],
                  ['found', 'Found items'],
                  ['family', 'Family'],
                  ['community', 'Community'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFilter(id)}
                  className={cn(
                    'rounded-full px-3 py-1.5 text-xs font-bold',
                    filter === id ? 'bg-[#17130F] text-white' : 'bg-[#F1E7D8] text-[#5C5245]',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-y-auto lg:h-[calc(100vh-7.5rem)]">
            {loading ? <p className="px-5 py-10 text-sm text-[#8A7B67]">Loading…</p> : null}

            {!loading && filteredReports.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  setActiveConvo(null);
                  setActiveReport(r);
                  setSightingSent(false);
                }}
                className={cn(
                  'flex w-full gap-3 border-b border-[#E3D8C6] px-5 py-4 text-left hover:bg-[#FBF7F1]',
                  activeReport?.id === r.id && 'bg-[#FFF3EE]',
                  r.isPublicBroadcast && 'bg-[#FFF3EE]/60',
                )}
              >
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-brand-500 text-white">
                  !
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-bold text-[#17130F]">
                      {r.isPublicBroadcast ? 'Community alert' : 'Found item'}
                    </span>
                    <span className="text-[11px] text-[#8A7B67]">
                      {new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-[#5C5245]">
                    {r.finderNotes || r.locationAddress || r.finderContact}
                  </span>
                  <span className="mt-1 flex gap-1">
                    <span className="rounded-full bg-[#FFF3EE] px-2 py-0.5 text-[10px] font-bold text-brand-600">
                      {r.isPublicBroadcast ? 'Community' : 'Found'}
                    </span>
                  </span>
                </span>
              </button>
            ))}

            {!loading && filteredConvos.map((convo) => {
              const who = convo.otherParticipant;
              const initials = who ? `${who.firstName[0]}${who.lastName[0]}` : '?';
              return (
                <button
                  key={convo.id}
                  type="button"
                  onClick={() => void openConversation(convo)}
                  className={cn(
                    'flex w-full gap-3 border-b border-[#E3D8C6] px-5 py-4 text-left hover:bg-[#FBF7F1]',
                    activeConvo?.id === convo.id && 'bg-[#FFF3EE]',
                  )}
                >
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#1D4ED8] text-xs font-bold text-white">
                    {initials}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-bold text-[#17130F]">
                        {who ? `${who.firstName} ${who.lastName}` : 'Conversation'}
                      </span>
                      <span className="text-[11px] text-[#8A7B67]">
                        {convo.lastMessage
                          ? new Date(convo.lastMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : ''}
                      </span>
                    </span>
                    {convo.lastMessage ? (
                      <span className="mt-0.5 block truncate text-xs text-[#5C5245]">{convo.lastMessage.body}</span>
                    ) : null}
                    {convo.unreadCount > 0 ? (
                      <span className="mt-1 inline-block rounded-full bg-[#E7DCCA] px-2 py-0.5 text-[10px] font-bold text-[#5C5245]">
                        {convo.unreadCount} unread
                      </span>
                    ) : null}
                  </span>
                </button>
              );
            })}

            {!loading && filteredConvos.length === 0 && filteredReports.length === 0 ? (
              <p className="px-5 py-16 text-center text-sm text-[#8A7B67]">
                Conversations with finders will appear here.
              </p>
            ) : null}
          </div>
        </aside>

        <section className={cn('flex min-h-0 flex-1 flex-col bg-[#FBF7F1]', !showThread && 'hidden lg:flex')}>
          {!showThread ? (
            <div className="flex flex-1 items-center justify-center text-sm text-[#8A7B67]">Select a thread</div>
          ) : activeReport ? (
            <>
              <div className="flex items-center gap-3 border-b border-[#E3D8C6] bg-white px-4 py-3">
                <button type="button" className="lg:hidden" onClick={() => setActiveReport(null)} aria-label="Back">
                  ←
                </button>
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-500 text-white">!</div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-[#17130F]">
                    {activeReport.isPublicBroadcast ? 'Community notice' : 'Finder report'}
                  </p>
                  <p className="truncate text-xs text-[#8A7B67]">
                    {activeReport.locationAddress || 'Location shared by the finder'}
                  </p>
                </div>
                <Link
                  href={`/dashboard/alerts/${activeReport.id}`}
                  className="rounded-lg border border-[#E3D8C6] px-3 py-1.5 text-xs font-bold text-[#17130F]"
                >
                  Open report
                </Link>
              </div>
              <div className="flex-1 space-y-4 overflow-y-auto p-5">
                <div className="rounded-2xl border border-[#E3D8C6] bg-white p-4">
                  <p className="text-sm font-bold text-[#17130F]">
                    {activeReport.finderNotes || 'A finder scanned a tag and left a note.'}
                  </p>
                  {activeReport.locationAddress ? (
                    <p className="mt-2 flex items-center gap-1.5 text-xs text-[#5C5245]">
                      <MapPin className="h-3.5 w-3.5" />
                      {activeReport.locationAddress}
                    </p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-bold text-green-700">
                      Emergency contacts
                    </span>
                    {activeReport.isPublicBroadcast ? (
                      <span className="rounded-full bg-[#FFF3EE] px-2 py-0.5 text-[10px] font-bold text-brand-600">
                        Members nearby
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="rounded-2xl border border-[#E3D8C6] bg-white p-4">
                  <p className="text-sm font-bold text-[#17130F]">I&apos;ve seen this</p>
                  <p className="mt-1 text-xs text-[#8A7B67]">
                    Goes to the owner. Your name is shared; your number is not.
                  </p>
                  {sightingSent ? (
                    <p className="mt-3 text-sm font-semibold text-green-700">Sighting sent. Thank you.</p>
                  ) : (
                    <div className="mt-3 flex flex-col gap-2">
                      <input
                        className="rounded-xl border border-[#E3D8C6] bg-[#FBF7F1] px-3 py-2 text-sm outline-none focus:border-brand-500"
                        placeholder="Where and when"
                        value={sighting}
                        onChange={(e) => setSighting(e.target.value)}
                      />
                      <button
                        type="button"
                        disabled={!sighting.trim()}
                        onClick={() => {
                          reports.respond(activeReport.id, sighting.trim()).catch(() => {});
                          setSightingSent(true);
                        }}
                        className="self-start rounded-lg bg-brand-500 px-3 py-2 text-xs font-bold text-white disabled:opacity-40"
                      >
                        Send sighting
                      </button>
                    </div>
                  )}
                </div>
                <a href="tel:999" className="inline-flex rounded-lg border border-[#E3D8C6] px-3 py-2 text-xs font-bold">
                  Call 999
                </a>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3 border-b border-[#E3D8C6] bg-white px-4 py-3">
                <button type="button" className="lg:hidden" onClick={() => setActiveConvo(null)} aria-label="Back">
                  ←
                </button>
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1D4ED8] text-xs font-bold text-white">
                  {other ? `${other.firstName[0]}${other.lastName[0]}` : '?'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-[#17130F]">
                    {other ? `${other.firstName} ${other.lastName}` : 'Conversation'}
                  </p>
                  <p className="text-xs text-[#8A7B67]">Anonymous relay — your details are never shown</p>
                </div>
                {other ? (
                  <div className="relative" ref={menuRef}>
                    <button type="button" onClick={() => setShowConvoMenu((v) => !v)} className="p-1 text-[#8A7B67]">
                      <MoreVertical className="h-5 w-5" />
                    </button>
                    {showConvoMenu ? (
                      <div className="absolute right-0 top-8 z-20 w-44 overflow-hidden rounded-xl border border-[#E3D8C6] bg-white shadow-lg">
                        <button
                          type="button"
                          onClick={() => {
                            setShowConvoMenu(false);
                            setShowReportModal(true);
                          }}
                          className="flex w-full items-center gap-2 px-4 py-2.5 text-sm"
                        >
                          <Flag className="h-4 w-4 text-amber-500" />
                          Report user
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleBlockUser()}
                          disabled={actionLoading}
                          className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-600"
                        >
                          <Ban className="h-4 w-4" />
                          Block user
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {showReportModal ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
                  <div className="w-full max-w-md rounded-2xl border border-[#E3D8C6] bg-white p-6">
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="font-semibold">Report User</h3>
                      <button type="button" onClick={() => setShowReportModal(false)}>
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                    <textarea
                      value={reportReason}
                      onChange={(e) => setReportReason(e.target.value)}
                      placeholder="Describe the issue"
                      rows={4}
                      className="mb-4 w-full rounded-xl border border-[#E3D8C6] px-3 py-2.5 text-sm"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setShowReportModal(false)}
                        className="flex-1 rounded-xl border py-2 text-sm"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleReportUser()}
                        disabled={actionLoading || reportReason.trim().length < 3}
                        className="flex-1 rounded-xl bg-amber-500 py-2 text-sm font-semibold text-white disabled:opacity-40"
                      >
                        Submit
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="flex-1 space-y-2 overflow-y-auto p-4">
                {msgsLoading ? (
                  <p className="py-10 text-center text-sm text-[#8A7B67]">Loading…</p>
                ) : (
                  msgs.map((msg) => {
                    const isMe = msg.senderId === user?.id;
                    return (
                      <div key={msg.id} className={cn('flex', isMe ? 'justify-end' : 'justify-start')}>
                        <div
                          className={cn(
                            'max-w-xs rounded-2xl px-4 py-2.5 text-sm',
                            isMe ? 'rounded-tr-sm bg-brand-500 text-white' : 'rounded-tl-sm border border-[#E3D8C6] bg-white',
                          )}
                        >
                          {msg.body}
                          <p className={cn('mt-1 text-[11px]', isMe ? 'text-white/80' : 'text-[#8A7B67]')}>
                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={bottomRef} />
              </div>

              <form onSubmit={sendMessage} className="flex items-end gap-2 border-t border-[#E3D8C6] bg-white px-4 py-3">
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void sendMessage(e);
                    }
                  }}
                  placeholder="Write a reply…"
                  rows={1}
                  className="flex-1 resize-none rounded-2xl border border-[#E3D8C6] bg-[#FBF7F1] px-4 py-2.5 text-sm outline-none focus:border-brand-500"
                />
                <button
                  type="submit"
                  disabled={sending || !reply.trim()}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-[#17130F] text-white disabled:opacity-40"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
