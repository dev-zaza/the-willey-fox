import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Linking,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { qrService, type QrCode } from '@/services/qr.service';
import { reportsService, type Report } from '@/services/reports.service';
import { notificationsService } from '@/services/notifications.service';
import { useModal } from '@/context/ModalContext';

interface AlertItem {
  report: Report;
  tag: QrCode;
}

const CATEGORY_EMOJI: Record<string, string> = {
  pet: '🐾', bag: '🎒', key: '🔑', person: '👦', vehicle: '🚗', other: '🏷️',
};

function formatTimeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function getCoords(report: Report): { lat: number; lng: number } | null {
  const lat = report.latitude ?? report.locationLat;
  const lng = report.longitude ?? report.locationLng;
  if (lat != null && lng != null) return { lat, lng };
  return null;
}

function openMapsRoute(lat: number, lng: number) {
  const label = encodeURIComponent('Item found here');
  const url = Platform.OS === 'ios'
    ? `maps://?daddr=${lat},${lng}&dirflg=d`
    : `google.navigation:q=${lat},${lng}`;
  Linking.openURL(url).catch(() => {
    // Fallback to browser maps
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`);
  });
}

export default function AlertsScreen() {
  const router = useRouter();
  const dark = useColorScheme() === 'dark';
  const { setModalOpen } = useModal();

  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Detail modal
  const [selected, setSelected] = useState<AlertItem | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replying, setReplying] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const tags = await qrService.list();
      const items: AlertItem[] = [];
      for (const tag of tags) {
        const tagReports = await reportsService.listForQr(tag.id);
        for (const report of tagReports) {
          items.push({ report, tag });
        }
      }
      items.sort((a, b) => b.report.createdAt.localeCompare(a.report.createdAt));
      setAlerts(items);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    notificationsService.list()
      .then((res) => setUnreadCount(res.unreadCount ?? 0))
      .catch(() => {});
  }, [load]);

  async function handleReply() {
    if (!selected || !replyText.trim()) return;
    setReplying(true);
    try {
      const response = await reportsService.respond(selected.report.id, replyText.trim());
      setReplyText('');
      // Update the report in the list with the new response
      const updatedReport: Report = {
        ...selected.report,
        responses: [...(selected.report.responses ?? []), response],
      };
      setSelected({ ...selected, report: updatedReport });
      setAlerts((prev) =>
        prev.map((a) =>
          a.report.id === selected.report.id ? { ...a, report: updatedReport } : a,
        ),
      );
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message ?? e?.message ?? 'Failed to send reply');
    } finally {
      setReplying(false);
    }
  }

  function openDetail(item: AlertItem) {
    setSelected(item);
    setModalOpen(true);
  }

  function closeDetail() {
    setSelected(null);
    setReplyText('');
    setModalOpen(false);
  }

  const renderCard = ({ item: { report, tag } }: { item: AlertItem }) => {
    const coords = getCoords(report);
    const notes = report.finderNotes ?? report.message;
    const emoji = CATEGORY_EMOJI[tag.category] ?? '🏷️';

    return (
      <TouchableOpacity
        onPress={() => openDetail({ report, tag })}
        activeOpacity={0.85}
        style={{
          backgroundColor: dark ? '#1a1d27' : '#ffffff',
          borderRadius: 18,
          borderWidth: 1,
          borderColor: dark ? '#2a2f45' : '#e5e7eb',
          padding: 16,
          gap: 10,
        }}
      >
        {/* Top row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{
            width: 44, height: 44, borderRadius: 22,
            backgroundColor: '#f9731622', borderWidth: 1.5, borderColor: '#f9731644',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Text style={{ fontSize: 22 }}>{emoji}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: dark ? '#f1f5f9' : '#111827' }}>
              {tag.name}
            </Text>
            <Text style={{ fontSize: 12, color: dark ? '#64748b' : '#9ca3af', marginTop: 1 }}>
              {tag.category} · {formatTimeAgo(report.createdAt)}
            </Text>
          </View>
          {/* Unread dot */}
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#f97316' }} />
        </View>

        {/* Finder note preview */}
        {notes ? (
          <View style={{
            backgroundColor: dark ? '#0f1117' : '#f8fafc',
            borderRadius: 10, padding: 10,
            borderLeftWidth: 3, borderLeftColor: '#f97316',
          }}>
            <Text style={{ fontSize: 13, color: dark ? '#cbd5e1' : '#374151', lineHeight: 18 }} numberOfLines={2}>
              {notes}
            </Text>
          </View>
        ) : null}

        {/* Footer row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {/* Finder contact chip */}
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 4,
            backgroundColor: dark ? '#0f1117' : '#f1f5f9',
            borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, flex: 1,
          }}>
            <Text style={{ fontSize: 11 }}>
              {report.finderContact?.includes('@') ? '📧' : '📞'}
            </Text>
            <Text style={{ fontSize: 11, color: dark ? '#94a3b8' : '#6b7280', flex: 1 }} numberOfLines={1}>
              {report.finderContact}
            </Text>
          </View>
          {/* GPS chip */}
          {coords && (
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 4,
              backgroundColor: '#3b82f611', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
            }}>
              <Text style={{ fontSize: 11 }}>📍</Text>
              <Text style={{ fontSize: 11, color: '#3b82f6', fontWeight: '600' }}>GPS</Text>
            </View>
          )}
          <Text style={{ fontSize: 11, color: dark ? '#475569' : '#9ca3af' }}>Tap for details →</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: dark ? '#0f1117' : '#f8fafc' }}>
      {/* Header — single, unified */}
      <View style={{
        backgroundColor: dark ? '#1a1d27' : '#ffffff',
        borderBottomWidth: 1,
        borderBottomColor: dark ? '#2a2f45' : '#e5e7eb',
        paddingHorizontal: 20,
        paddingTop: 56,
        paddingBottom: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
      }}>
        <Image source={require('../../assets/logo.png')} style={{ width: 26, height: 26, borderRadius: 6 }} resizeMode="contain" />
        <Text style={{ flex: 1, fontSize: 18, fontWeight: '700', color: dark ? '#f1f5f9' : '#111827' }}>
          Alerts
          {alerts.length > 0 && (
            <Text style={{ color: '#f97316' }}> ({alerts.length})</Text>
          )}
        </Text>
        {/* Bell — notifications history */}
        <TouchableOpacity
          onPress={() => router.push('/(app)/notifications')}
          style={{ position: 'relative', padding: 6 }}
        >
          <Text style={{ fontSize: 20 }}>🔔</Text>
          {unreadCount > 0 && (
            <View style={{
              position: 'absolute', top: 2, right: 2,
              minWidth: 15, height: 15, borderRadius: 8,
              backgroundColor: '#ef4444',
              alignItems: 'center', justifyContent: 'center',
              paddingHorizontal: 3,
            }}>
              <Text style={{ color: '#fff', fontSize: 8, fontWeight: '700' }}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#f97316" />
        </View>
      ) : alerts.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 32 }}>
          <Text style={{ fontSize: 44 }}>🔔</Text>
          <Text style={{ fontSize: 20, fontWeight: '700', color: dark ? '#f1f5f9' : '#111827' }}>No Alerts Yet</Text>
          <Text style={{ fontSize: 14, color: dark ? '#64748b' : '#9ca3af', textAlign: 'center', lineHeight: 22 }}>
            When someone scans one of your tags and submits a report, you'll see it here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={alerts}
          keyExtractor={(item, i) => `${item.report.id}-${i}`}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#f97316" />
          }
          renderItem={renderCard}
        />
      )}

      {/* ── Detail Modal ── */}
      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={closeDetail}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' }} activeOpacity={1} onPress={closeDetail} />
        {selected && (() => {
          const { report, tag } = selected;
          const coords = getCoords(report);
          const notes = report.finderNotes ?? report.message;
          const emoji = CATEGORY_EMOJI[tag.category] ?? '🏷️';
          return (
            <View style={{
              backgroundColor: dark ? '#1a1d27' : '#ffffff',
              borderTopLeftRadius: 28, borderTopRightRadius: 28,
              maxHeight: '88%',
            }}>
              {/* Pull handle */}
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: dark ? '#2a2f45' : '#e5e7eb', alignSelf: 'center', marginTop: 12, marginBottom: 4 }} />

              <ScrollView contentContainerStyle={{ padding: 24, gap: 18 }} showsVerticalScrollIndicator={false}>
                {/* Tag header */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{
                    width: 52, height: 52, borderRadius: 26,
                    backgroundColor: '#f9731622', borderWidth: 2, borderColor: '#f9731644',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Text style={{ fontSize: 26 }}>{emoji}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 17, fontWeight: '700', color: dark ? '#f1f5f9' : '#111827' }}>
                      {tag.name}
                    </Text>
                    <Text style={{ fontSize: 12, color: dark ? '#64748b' : '#9ca3af', marginTop: 2 }}>
                      {tag.category} · Found {formatTimeAgo(report.createdAt)}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={closeDetail} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Text style={{ fontSize: 22, color: dark ? '#475569' : '#9ca3af' }}>×</Text>
                  </TouchableOpacity>
                </View>

                {/* Photo */}
                {report.photoUrl && (
                  <Image
                    source={{ uri: report.photoUrl }}
                    style={{ width: '100%', height: 180, borderRadius: 14, backgroundColor: '#1a1d27' }}
                    resizeMode="cover"
                  />
                )}

                {/* Finder message */}
                {notes ? (
                  <View style={{
                    backgroundColor: dark ? '#0f1117' : '#f8fafc',
                    borderRadius: 14, padding: 14,
                    borderLeftWidth: 3, borderLeftColor: '#f97316',
                    gap: 4,
                  }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#f97316', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Finder's Note
                    </Text>
                    <Text style={{ fontSize: 14, color: dark ? '#cbd5e1' : '#374151', lineHeight: 21 }}>
                      {notes}
                    </Text>
                  </View>
                ) : null}

                {/* Finder contact */}
                <View style={{
                  backgroundColor: dark ? '#0f1117' : '#f8fafc',
                  borderRadius: 14, padding: 14, gap: 10,
                }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: dark ? '#64748b' : '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Contact Finder
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Text style={{ fontSize: 14, color: dark ? '#f1f5f9' : '#111827', flex: 1 }}>
                      {report.finderContact?.includes('@') ? '📧 ' : '📞 '}
                      {report.finderContact}
                    </Text>
                    <TouchableOpacity
                      onPress={() => {
                        const url = report.finderContact?.includes('@')
                          ? `mailto:${report.finderContact}`
                          : `tel:${report.finderContact}`;
                        Linking.openURL(url);
                      }}
                      style={{
                        backgroundColor: '#f97316',
                        borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8,
                      }}
                    >
                      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>
                        {report.finderContact?.includes('@') ? 'Email' : 'Call'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* GPS location + route */}
                {coords && (
                  <View style={{
                    backgroundColor: dark ? '#0f1117' : '#f0f9ff',
                    borderRadius: 14, padding: 14, gap: 10,
                    borderWidth: 1, borderColor: dark ? '#1e3a5f' : '#bae6fd',
                  }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#3b82f6', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      📍 Location Found
                    </Text>
                    <Text style={{ fontSize: 13, color: dark ? '#93c5fd' : '#1e40af' }}>
                      {report.locationAddress ?? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`}
                    </Text>
                    <TouchableOpacity
                      onPress={() => openMapsRoute(coords.lat, coords.lng)}
                      style={{
                        backgroundColor: '#3b82f6',
                        borderRadius: 12, paddingVertical: 12,
                        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                      }}
                    >
                      <Text style={{ fontSize: 16 }}>🗺️</Text>
                      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>
                        Get Directions
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Previous replies */}
                {(report.responses?.length ?? 0) > 0 && (
                  <View style={{ gap: 8 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: dark ? '#64748b' : '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Your Replies
                    </Text>
                    {(report.responses ?? []).map((r) => (
                      <View key={r.id} style={{
                        backgroundColor: '#f9731614', borderRadius: 12,
                        borderWidth: 1, borderColor: '#f9731630', padding: 12,
                      }}>
                        <Text style={{ fontSize: 13, color: dark ? '#fdba74' : '#ea580c', lineHeight: 19 }}>
                          {r.message}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Reply box */}
                <View style={{ gap: 10 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: dark ? '#64748b' : '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Send a Reply
                  </Text>
                  <TextInput
                    style={{
                      backgroundColor: dark ? '#0f1117' : '#f8fafc',
                      borderWidth: 1, borderColor: dark ? '#2a2f45' : '#e5e7eb',
                      borderRadius: 12, padding: 12,
                      color: dark ? '#f1f5f9' : '#111827',
                      fontSize: 14, minHeight: 72, textAlignVertical: 'top',
                    }}
                    placeholder="e.g. Thank you! I'm on my way…"
                    placeholderTextColor={dark ? '#475569' : '#9ca3af'}
                    value={replyText}
                    onChangeText={setReplyText}
                    multiline
                  />
                  <TouchableOpacity
                    onPress={handleReply}
                    disabled={replying || !replyText.trim()}
                    style={{
                      backgroundColor: '#f97316',
                      borderRadius: 14, paddingVertical: 14,
                      alignItems: 'center',
                      opacity: !replyText.trim() ? 0.5 : 1,
                    }}
                  >
                    {replying
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Send Reply</Text>
                    }
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          );
        })()}
      </Modal>
    </View>
  );
}
