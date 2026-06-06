'use client';

import { useEffect, useState, useRef } from 'react';
import { Send, AlertCircle, ArrowLeft, Loader2 } from 'lucide-react';
import { messages as messagesApi, type Conversation, type Message } from '@/lib/api';
import { useAuth } from '@/context/auth-context';

interface MessagesModalProps {
  onClose?: () => void;
}

export function MessagesModal(_: MessagesModalProps) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeConvo, setActiveConvo] = useState<Conversation | null>(null);
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [msgsLoading, setMsgsLoading] = useState(false);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesApi
      .listConversations()
      .then(setConversations)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function openConversation(convo: Conversation) {
    setActiveConvo(convo);
    setMsgsLoading(true);
    setMsgs([]);
    try {
      const data = await messagesApi.listMessages(convo.id);
      setMsgs([...data].reverse()); // API returns newest first, show oldest first
      await messagesApi.markRead(convo.id);
      setConversations((prev) =>
        prev.map((c) => (c.id === convo.id ? { ...c, unreadCount: 0 } : c)),
      );
    } catch (e: any) {
      setError(e.message);
    } finally {
      setMsgsLoading(false);
    }
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs]);

  async function sendReply() {
    if (!reply.trim() || !activeConvo) return;
    setSending(true);
    try {
      const msg = await messagesApi.send(activeConvo.id, reply.trim());
      setMsgs((prev) => [...prev, msg]);
      setReply('');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  }

  if (activeConvo) {
    const other = activeConvo.otherParticipant;
    return (
      <div className="flex flex-col h-full">
        <button
          onClick={() => setActiveConvo(null)}
          className="flex items-center gap-2 px-5 py-3 text-sm text-[#7a6957] hover:text-[var(--text-primary)] border-b border-surface-border flex-shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
          {other ? `${other.firstName} ${other.lastName}` : 'Conversation'}
        </button>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {msgsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-[#9d8c7a]" />
            </div>
          ) : (
            msgs.map((m) => {
              const isMe = m.senderId === user?.id;
              return (
                <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
                      isMe
                        ? 'bg-brand-500 text-white rounded-tr-sm'
                        : 'bg-surface-elevated text-[var(--text-primary)] rounded-tl-sm'
                    }`}
                  >
                    <p>{m.body}</p>
                    <p className={`text-xs mt-1 ${isMe ? 'text-brand-200' : 'text-[#9d8c7a]'}`}>
                      {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        <div className="flex gap-2 p-4 border-t border-surface-border flex-shrink-0">
          <input
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Type a message…"
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendReply()}
            className="flex-1 bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-brand-500"
          />
          <button
            onClick={sendReply}
            disabled={sending || !reply.trim()}
            className="p-2 rounded-lg bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-5 space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="h-16 bg-surface-elevated rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-5 flex items-center gap-2 text-sm text-red-400">
        <AlertCircle className="w-4 h-4" />
        {error}
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="p-5 text-center py-12 text-[#9d8c7a] text-sm">
        No conversations yet. Start a conversation from a user's profile.
      </div>
    );
  }

  return (
    <div className="p-5 space-y-2">
      {conversations.map((c) => {
        const other = c.otherParticipant;
        const initials = other
          ? (other.firstName[0] ?? '') + (other.lastName[0] ?? '')
          : '?';

        return (
          <button
            key={c.id}
            onClick={() => openConversation(c)}
            className="w-full flex items-center gap-3 glass rounded-xl p-4 hover:border-brand-500/30 transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-full bg-brand-500/15 flex items-center justify-center flex-shrink-0 text-sm font-medium text-brand-400">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-[var(--text-primary)] text-sm truncate">
                {other ? `${other.firstName} ${other.lastName}` : 'Unknown'}
              </p>
              {c.lastMessage && (
                <p className="text-xs text-[#7a6957] truncate">{c.lastMessage.body}</p>
              )}
            </div>
            {c.unreadCount > 0 && (
              <span className="bg-brand-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">
                {c.unreadCount}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
