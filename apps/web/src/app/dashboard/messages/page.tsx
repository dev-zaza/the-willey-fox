'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Send, Search, MoreVertical, Ban, Flag, X } from 'lucide-react';
import { messages as messagesApi, users as usersApi, type Conversation, type Message } from '@/lib/api';
import { useAuth } from '@/context/auth-context';

export default function MessagesPage() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeConvo, setActiveConvo] = useState<Conversation | null>(null);
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [msgsLoading, setMsgsLoading] = useState(false);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState('');
  const [showConvoMenu, setShowConvoMenu] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [showReportModal, setShowReportModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesApi.listConversations(search || undefined).then(setConversations).finally(() => setLoading(false));
  }, [search]);

  async function openConversation(convo: Conversation) {
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
    } catch (e: any) {
      alert(e?.response?.data?.message ?? 'Failed to block user');
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
    } catch (e: any) {
      alert(e?.response?.data?.message ?? 'Failed to submit report');
    } finally {
      setActionLoading(false);
    }
  }

  if (activeConvo) {
    const other = activeConvo.otherParticipant;
    return (
      <div className="flex flex-col h-screen bg-surface">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 bg-surface-card border-b border-surface-border flex-shrink-0">
          <button onClick={() => setActiveConvo(null)} className="text-slate-400 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-8 h-8 rounded-full bg-brand-500/20 flex items-center justify-center text-brand-400 font-bold text-xs flex-shrink-0">
            {other ? `${other.firstName[0]}${other.lastName[0]}` : '?'}
          </div>
          <p className="font-semibold text-white text-sm flex-1">{other ? `${other.firstName} ${other.lastName}` : 'Conversation'}</p>
          {/* Conversation actions menu */}
          {other && (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setShowConvoMenu((v) => !v)}
                className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/5"
              >
                <MoreVertical className="w-5 h-5" />
              </button>
              {showConvoMenu && (
                <div className="absolute right-0 top-8 w-44 bg-surface-card border border-surface-border rounded-xl shadow-lg z-50 overflow-hidden">
                  <button
                    onClick={() => { setShowConvoMenu(false); setShowReportModal(true); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-300 hover:bg-white/5 transition-colors"
                  >
                    <Flag className="w-4 h-4 text-amber-400" />
                    Report user
                  </button>
                  <button
                    onClick={handleBlockUser}
                    disabled={actionLoading}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <Ban className="w-4 h-4" />
                    Block user
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Report modal */}
        {showReportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="bg-surface-card border border-surface-border rounded-2xl p-6 w-full max-w-md">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold">Report User</h3>
                <button onClick={() => { setShowReportModal(false); setReportReason(''); }} className="text-slate-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-slate-400 text-sm mb-4">
                Describe why you're reporting {other?.firstName} {other?.lastName}. Our moderation team will review your report.
              </p>
              <textarea
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                placeholder="Describe the issue (e.g. harassment, spam, threats…)"
                rows={4}
                maxLength={500}
                className="w-full bg-surface border border-surface-border text-white text-sm rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:border-brand-500 placeholder:text-slate-500 mb-4"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => { setShowReportModal(false); setReportReason(''); }}
                  className="flex-1 py-2 rounded-xl border border-surface-border text-slate-400 text-sm hover:border-slate-500 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReportUser}
                  disabled={actionLoading || reportReason.trim().length < 3}
                  className="flex-1 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white text-sm font-semibold transition-colors"
                >
                  {actionLoading ? 'Submitting…' : 'Submit Report'}
                </button>
              </div>
            </div>
          </div>
        )}


        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {msgsLoading ? (
            <div className="flex items-center justify-center h-full text-slate-400 text-sm">Loading…</div>
          ) : (
            msgs.map((msg) => {
              const isMe = msg.senderId === user?.id;
              return (
                <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-xs rounded-2xl px-4 py-2.5 ${
                    isMe
                      ? 'bg-brand-500 rounded-tr-sm'
                      : 'bg-surface-card border border-surface-border rounded-tl-sm'
                  }`}>
                    <p className={`text-sm ${isMe ? 'text-white' : 'text-slate-200'}`}>{msg.body}</p>
                    <p className={`text-xs mt-1 ${isMe ? 'text-brand-200' : 'text-slate-500'}`}>
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <form onSubmit={sendMessage} className="flex items-end gap-2 px-4 py-3 bg-surface-card border-t border-surface-border flex-shrink-0">
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(e as any); }}}
            placeholder="Type a message…"
            rows={1}
            maxLength={4000}
            className="flex-1 bg-surface border border-surface-border text-white text-sm rounded-2xl px-4 py-2.5 resize-none focus:outline-none focus:border-brand-500 placeholder:text-slate-500"
          />
          <button
            type="submit"
            disabled={sending || !reply.trim()}
            className="w-10 h-10 rounded-full bg-brand-500 hover:bg-brand-600 disabled:opacity-40 flex items-center justify-center flex-shrink-0 transition-colors"
          >
            <Send className="w-4 h-4 text-white" />
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-4">Messages</h1>

        {/* Search */}
        <div className="relative mb-5">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversations…"
            className="w-full bg-surface-card border border-surface-border text-white text-sm rounded-xl pl-9 pr-4 py-2.5 focus:outline-none focus:border-brand-500 placeholder:text-slate-500"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {loading && <div className="text-slate-400 text-sm text-center py-20">Loading…</div>}

        {!loading && conversations.length === 0 && (
          <div className="text-center py-20 text-slate-500">
            <p className="text-4xl mb-3">💬</p>
            <p className="font-medium text-white">{search ? 'No results' : 'No Messages'}</p>
            <p className="text-sm mt-1">{search ? `No conversations matching "${search}"` : 'Conversations with finders will appear here'}</p>
          </div>
        )}

        <div className="space-y-2">
          {conversations.map((convo) => {
            const other = convo.otherParticipant;
            const initials = other ? `${other.firstName[0]}${other.lastName[0]}` : '?';
            return (
              <button
                key={convo.id}
                onClick={() => openConversation(convo)}
                className="w-full bg-surface-card border border-surface-border rounded-2xl p-4 flex items-center gap-4 hover:border-brand-500/40 transition-colors text-left"
              >
                <div className="w-11 h-11 rounded-full bg-brand-500/15 flex items-center justify-center flex-shrink-0 text-brand-400 font-bold text-sm">
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold text-sm">{other ? `${other.firstName} ${other.lastName}` : 'Unknown'}</p>
                  {convo.lastMessage && (
                    <p className="text-slate-500 text-xs truncate">{convo.lastMessage.body}</p>
                  )}
                </div>
                {convo.unreadCount > 0 && (
                  <span className="w-5 h-5 rounded-full bg-brand-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {convo.unreadCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
