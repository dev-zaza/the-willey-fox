import { Ionicons } from '@/components/Icon';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { messagesService, type Conversation, type Message } from '@/services/messages.service';
import { useAuthStore } from '@/stores/auth.store';

type Screen = 'list' | 'chat';

export default function MessagesScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState<Screen>('list');
  const [activeConvo, setActiveConvo] = useState<Conversation | null>(null);
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [msgsLoading, setMsgsLoading] = useState(false);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const flatRef = useRef<FlatList>(null);

  useEffect(() => {
    messagesService
      .listConversations()
      .then(setConversations)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function openConversation(convo: Conversation) {
    setActiveConvo(convo);
    setMsgsLoading(true);
    setScreen('chat');
    setMsgs([]);
    try {
      const data = await messagesService.listMessages(convo.id);
      setMsgs([...data].reverse());
      await messagesService.markRead(convo.id);
      setConversations((prev) => prev.map((c) => (c.id === convo.id ? { ...c, unreadCount: 0 } : c)));
    } catch (e) {
      console.error(e);
    } finally {
      setMsgsLoading(false);
    }
  }

  async function sendMessage() {
    if (!reply.trim() || !activeConvo) return;
    setSending(true);
    try {
      const msg = await messagesService.send(activeConvo.id, reply.trim());
      setMsgs((prev) => [...prev, msg]);
      setReply('');
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e) {
      console.error(e);
    } finally {
      setSending(false);
    }
  }

  if (screen === 'chat' && activeConvo) {
    const other = activeConvo.otherParticipant;
    return (
      <KeyboardAvoidingView
        className="flex-1 bg-gray-50 dark:bg-surface"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* Header */}
        <View className="bg-white dark:bg-surface-card border-b border-gray-200 dark:border-surface-border px-6 pt-14 pb-4 flex-row items-center gap-3">
          <TouchableOpacity onPress={() => setScreen('list')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="chevron-back" size={24} color="#f97316" />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-base font-bold text-gray-900 dark:text-white" numberOfLines={1}>
              {other ? `${other.firstName} ${other.lastName}` : 'Conversation'}
            </Text>
          </View>
        </View>

        {/* Messages */}
        {msgsLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#f97316" />
          </View>
        ) : (
          <FlatList
            ref={flatRef}
            data={msgs}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: 16, gap: 8 }}
            onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: false })}
            renderItem={({ item }) => {
              const isMe = item.senderId === user?.id;
              return (
                <View style={{ alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                  <View
                    className={`rounded-2xl px-4 py-2.5 max-w-xs ${
                      isMe ? 'bg-brand-500 rounded-tr-sm' : 'bg-white dark:bg-surface-card border border-gray-200 dark:border-surface-border rounded-tl-sm'
                    }`}
                  >
                    <Text className={`text-sm ${isMe ? 'text-white' : 'text-gray-900 dark:text-white'}`}>{item.body}</Text>
                    <Text className={`text-xs mt-1 ${isMe ? 'text-brand-200' : 'text-gray-400 dark:text-slate-500'}`}>
                      {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                </View>
              );
            }}
          />
        )}

        {/* Input */}
        <View className="bg-white dark:bg-surface-card border-t border-gray-200 dark:border-surface-border px-4 py-3 flex-row gap-3 items-end">
          <TextInput
            className="flex-1 bg-gray-100 dark:bg-surface-elevated rounded-2xl px-4 py-2.5 text-sm text-gray-900 dark:text-white"
            placeholder="Type a message…"
            placeholderTextColor="#9ca3af"
            value={reply}
            onChangeText={setReply}
            multiline
            maxLength={4000}
          />
          <TouchableOpacity
            onPress={sendMessage}
            disabled={sending || !reply.trim()}
            className="bg-brand-500 rounded-full w-10 h-10 items-center justify-center"
            style={{ opacity: !reply.trim() ? 0.5 : 1 }}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text className="text-white font-bold text-base">↑</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View className="flex-1 bg-gray-50 dark:bg-surface">
      <View className="bg-white dark:bg-surface-card border-b border-gray-200 dark:border-surface-border px-6 pt-14 pb-4 flex-row items-center gap-3">
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={24} color="#f97316" />
        </TouchableOpacity>
        <Text className="text-lg font-bold text-gray-900 dark:text-white flex-1">Messages</Text>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#f97316" />
        </View>
      ) : conversations.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8" style={{ gap: 12 }}>
          <Ionicons name="chatbubble" size={40} color="#9ca3af" />
          <Text className="text-xl font-bold text-gray-900 dark:text-white">No Messages</Text>
          <Text className="text-gray-500 dark:text-slate-400 text-sm text-center leading-6">
            Conversations with finders and community members will appear here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          renderItem={({ item }) => {
            const other = item.otherParticipant;
            const initials = other ? (other.firstName[0] ?? '') + (other.lastName[0] ?? '') : '?';
            return (
              <TouchableOpacity
                onPress={() => openConversation(item)}
                className="bg-white dark:bg-surface-card border border-gray-200 dark:border-surface-border rounded-2xl p-4 flex-row items-center gap-4"
              >
                <View className="w-12 h-12 rounded-full bg-brand-500/15 items-center justify-center flex-shrink-0">
                  <Text className="text-brand-500 font-bold text-base">{initials}</Text>
                </View>
                <View className="flex-1" style={{ gap: 2 }}>
                  <Text className="text-gray-900 dark:text-white font-semibold text-sm" numberOfLines={1}>
                    {other ? `${other.firstName} ${other.lastName}` : 'Unknown'}
                  </Text>
                  {item.lastMessage && (
                    <Text className="text-gray-500 dark:text-slate-400 text-xs" numberOfLines={1}>
                      {item.lastMessage.body}
                    </Text>
                  )}
                </View>
                {item.unreadCount > 0 && (
                  <View className="bg-brand-500 rounded-full w-5 h-5 items-center justify-center flex-shrink-0">
                    <Text className="text-white text-xs font-bold">{item.unreadCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}
