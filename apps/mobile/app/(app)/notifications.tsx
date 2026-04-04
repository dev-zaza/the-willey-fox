import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { notificationsService, type AppNotification } from '@/services/notifications.service';

const TYPE_CONFIG: Record<string, { emoji: string; color: string }> = {
  report:        { emoji: '📍', color: '#f97316' },
  sos:           { emoji: '🆘', color: '#ef4444' },
  guardian:      { emoji: '🛡️', color: '#8b5cf6' },
  message:       { emoji: '💬', color: '#3b82f6' },
  subscription:  { emoji: '⭐', color: '#f59e0b' },
  default:       { emoji: '🔔', color: '#64748b' },
};

function formatTimeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default function NotificationsScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const dark = colorScheme === 'dark';
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await notificationsService.list();
      setNotifications(res.notifications ?? []);
      setUnreadCount(res.unreadCount ?? 0);
    } catch {
      // silently fail — non-critical screen
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleMarkAllRead() {
    try {
      await notificationsService.markAllRead();
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch {
      // ignore
    }
  }

  const renderItem = ({ item }: { item: AppNotification }) => {
    const cfg = TYPE_CONFIG[item.type] ?? TYPE_CONFIG.default;
    return (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: 12,
          paddingHorizontal: 16,
          paddingVertical: 14,
          borderBottomWidth: 1,
          borderBottomColor: dark ? '#2a2f45' : '#f1f5f9',
          backgroundColor: !item.isRead
            ? (dark ? 'rgba(249,115,22,0.05)' : 'rgba(249,115,22,0.04)')
            : 'transparent',
        }}
      >
        {/* Icon */}
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: cfg.color + '22',
            borderWidth: 1,
            borderColor: cfg.color + '44',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Text style={{ fontSize: 18 }}>{cfg.emoji}</Text>
        </View>

        {/* Content */}
        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text
              style={{
                flex: 1,
                fontSize: 14,
                fontWeight: item.isRead ? '500' : '700',
                color: dark ? '#f1f5f9' : '#111827',
              }}
              numberOfLines={1}
            >
              {item.title}
            </Text>
            {!item.isRead && (
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#f97316' }} />
            )}
          </View>
          <Text
            style={{ fontSize: 13, color: dark ? '#94a3b8' : '#6b7280', lineHeight: 18 }}
            numberOfLines={2}
          >
            {item.body}
          </Text>
          <Text style={{ fontSize: 11, color: dark ? '#475569' : '#9ca3af', marginTop: 2 }}>
            {formatTimeAgo(item.createdAt)}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: dark ? '#0f1117' : '#f8fafc' }}>
      {/* Header */}
      <View
        style={{
          backgroundColor: dark ? '#1a1d27' : '#ffffff',
          borderBottomWidth: 1,
          borderBottomColor: dark ? '#2a2f45' : '#e5e7eb',
          paddingHorizontal: 20,
          paddingTop: 56,
          paddingBottom: 16,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: '#f97316', fontWeight: '600', fontSize: 14 }}>← Back</Text>
        </TouchableOpacity>
        <Image
          source={require('../../assets/logo.png')}
          style={{ width: 24, height: 24, borderRadius: 6 }}
          resizeMode="contain"
        />
        <Text style={{ flex: 1, fontSize: 17, fontWeight: '700', color: dark ? '#f1f5f9' : '#111827' }}>
          Notifications
          {unreadCount > 0 && (
            <Text style={{ color: '#f97316' }}> ({unreadCount})</Text>
          )}
        </Text>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={handleMarkAllRead}>
            <Text style={{ color: '#f97316', fontSize: 13, fontWeight: '600' }}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#f97316" />
        </View>
      ) : notifications.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 }}>
          <Text style={{ fontSize: 40 }}>🔔</Text>
          <Text style={{ fontSize: 18, fontWeight: '700', color: dark ? '#f1f5f9' : '#111827' }}>
            No notifications yet
          </Text>
          <Text style={{ fontSize: 14, color: dark ? '#64748b' : '#9ca3af', textAlign: 'center', lineHeight: 22 }}>
            You'll see alerts here when someone finds your tag, sends a message, or triggers an SOS.
          </Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              tintColor="#f97316"
            />
          }
        />
      )}
    </View>
  );
}
