import { Ionicons } from '@/components/Icon';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
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
import { broadcastsService, type BroadcastListItem } from '@/services/broadcasts.service';
import { useModal } from '@/context/ModalContext';
import { openNativeNavigation } from '@/lib/open-native-maps';
import { extractApiErrorMessage } from '@/lib/api-error';

// ── Mockup design tokens ──────────────────────────────────────────────────────
const T = {
  orange:      '#FF7B14',
  orangeDark:  '#E2620A',
  orangeSoft:  '#FFE9D6',
  sage:        '#AABA9F',
  creamLight:  '#F2F4E5',
  charcoal:    '#232323',
  charcoalSoft:'#3a3a3a',
  mute:        '#8a8a8a',
  line:        '#ECECEC',
  red:         '#E94B4B',
  redSoft:     '#FDECEC',
  purple:      '#6A3FB4',
  blue:        '#3b82f6',
};

function bg(dark: boolean) { return dark ? '#0f1117' : T.creamLight; }
function cardBg(dark: boolean) { return dark ? '#1a1d27' : '#ffffff'; }
function borderColor(dark: boolean) { return dark ? '#2a2f45' : T.line; }
function textPrimary(dark: boolean) { return dark ? '#f1f5f9' : T.charcoal; }
function textMuted(dark: boolean) { return dark ? '#64748b' : T.mute; }
function textSub(dark: boolean) { return dark ? '#94a3b8' : T.charcoalSoft; }

// ── Category → thumb config ────────────────────────────────────────────────────
const CATEGORY_THUMB: Record<string, { bg: string; icon: React.ComponentProps<typeof Ionicons>['name'] }> = {
  pet:     { bg: T.sage,   icon: 'paw' },
  bag:     { bg: T.orange, icon: 'briefcase' },
  key:     { bg: T.orange, icon: 'key' },
  person:  { bg: T.purple, icon: 'person' },
  vehicle: { bg: T.orange, icon: 'car' },
  medical: { bg: T.red,    icon: 'medkit' },
  place:   { bg: T.sage,   icon: 'location' },
  other:   { bg: T.orange, icon: 'pricetag' },
};

interface AlertItem {
  report: Report;
  tag: QrCode;
}

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

// ── Alert card ─────────────────────────────────────────────────────────────────
function AlertCard({
  item,
  onPress,
  dark,
}: {
  item: AlertItem;
  onPress: () => void;
  dark: boolean;
}) {
  const { report, tag } = item;
  const notes = report.finderNotes ?? report.message;
  const thumb = CATEGORY_THUMB[tag.category] ?? CATEGORY_THUMB.other;
  const initials = tag.name.slice(0, 2).toUpperCase();
  const isLost = tag.isLost;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.82}
      style={{
        backgroundColor: isLost
          ? (dark ? '#2d1a1a' : T.redSoft)
          : cardBg(dark),
        borderWidth: 1,
        borderColor: isLost
          ? (dark ? '#5c2020' : T.red)
          : borderColor(dark),
        borderRadius: 14,
        padding: 14,
        flexDirection: 'row',
        gap: 12,
        marginHorizontal: 16,
      }}
    >
      {/* Thumb */}
      <View style={{
        width: 56, height: 56, borderRadius: 12,
        backgroundColor: thumb.bg,
        alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 18 }}>{initials}</Text>
      </View>

      {/* Meta */}
      <View style={{ flex: 1, minWidth: 0 }}>
        {/* Title row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          <Text
            style={{ fontWeight: '700', fontSize: 14, color: textPrimary(dark), flexShrink: 1 }}
            numberOfLines={1}
          >
            {tag.name}
          </Text>
          {isLost && (
            <View style={{
              backgroundColor: T.red, borderRadius: 4,
              paddingHorizontal: 5, paddingVertical: 1,
            }}>
              <Text style={{ color: '#fff', fontSize: 9, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' }}>
                Lost
              </Text>
            </View>
          )}
          <View style={{
            backgroundColor: dark ? '#1e2236' : T.creamLight, borderRadius: 4,
            paddingHorizontal: 5, paddingVertical: 1, marginLeft: 'auto',
          }}>
            <Text style={{ color: T.orange, fontSize: 9, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' }}>
              {tag.category}
            </Text>
          </View>
        </View>

        {/* Snippet */}
        {notes ? (
          <Text
            style={{ fontSize: 12, color: textSub(dark), lineHeight: 17, marginBottom: 4 }}
            numberOfLines={2}
          >
            {notes}
          </Text>
        ) : (
          <Text style={{ fontSize: 12, color: textMuted(dark), marginBottom: 4 }}>
            No finder notes
          </Text>
        )}

        {/* Info row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 11, color: textMuted(dark) }}>
            {report.finderContact ?? 'No contact'}
          </Text>
          <View style={{ width: 3, height: 3, backgroundColor: textMuted(dark), borderRadius: 2 }} />
          <Text style={{ fontSize: 11, color: textMuted(dark) }}>
            {formatTimeAgo(report.createdAt)}
          </Text>
          {getCoords(report) && (
            <>
              <View style={{ width: 3, height: 3, backgroundColor: textMuted(dark), borderRadius: 2 }} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                <Ionicons name="location" size={10} color={T.blue} />
                <Text style={{ fontSize: 11, color: T.blue, fontWeight: '600' }}>GPS</Text>
              </View>
            </>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── Community broadcast card ───────────────────────────────────────────────────
function BroadcastCard({
  item,
  onPress,
  dark,
}: {
  item: BroadcastListItem;
  onPress: () => void;
  dark: boolean;
}) {
  const thumb = CATEGORY_THUMB[item.category] ?? CATEGORY_THUMB.other;
  const initials = (item.name ?? item.category).slice(0, 2).toUpperCase();

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.82}
      style={{
        backgroundColor: dark ? '#1a1d27' : '#fff',
        borderWidth: 1,
        borderColor: dark ? '#2a2f45' : T.line,
        borderRadius: 14,
        padding: 14,
        flexDirection: 'row',
        gap: 12,
        marginHorizontal: 16,
      }}
    >
      <View style={{
        width: 56, height: 56, borderRadius: 12,
        backgroundColor: thumb.bg,
        alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        {item.photoUrl ? (
          <Image source={{ uri: item.photoUrl }} style={{ width: 56, height: 56, borderRadius: 12 }} />
        ) : (
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 18 }}>{initials}</Text>
        )}
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          <Text
            style={{ fontWeight: '700', fontSize: 14, color: textPrimary(dark), flexShrink: 1 }}
            numberOfLines={1}
          >
            {item.name ?? `Missing ${item.category}`}
          </Text>
          <View style={{
            backgroundColor: T.purple, borderRadius: 4,
            paddingHorizontal: 5, paddingVertical: 1,
          }}>
            <Text style={{ color: '#fff', fontSize: 9, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' }}>
              Missing
            </Text>
          </View>
        </View>

        {item.lastSeenLocation ? (
          <Text style={{ fontSize: 12, color: textSub(dark), lineHeight: 17, marginBottom: 4 }} numberOfLines={2}>
            Last seen: {item.lastSeenLocation}
          </Text>
        ) : (
          <Text style={{ fontSize: 12, color: textMuted(dark), marginBottom: 4 }}>
            Location unknown
          </Text>
        )}

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
            <Ionicons name="megaphone-outline" size={10} color={T.purple} />
            <Text style={{ fontSize: 11, color: T.purple, fontWeight: '600' }}>Community Alert</Text>
          </View>
          <View style={{ width: 3, height: 3, backgroundColor: textMuted(dark), borderRadius: 2 }} />
          <Text style={{ fontSize: 11, color: textMuted(dark) }}>
            {formatTimeAgo(item.broadcastApprovedAt)}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── Section header ─────────────────────────────────────────────────────────────
function SectionHeader({ label, dark }: { label: string; dark: boolean }) {
  return (
    <Text style={{
      fontSize: 11, letterSpacing: 1, textTransform: 'uppercase',
      color: textMuted(dark), fontWeight: '700',
      marginHorizontal: 24, marginTop: 16, marginBottom: 6,
    }}>
      {label}
    </Text>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────────
export default function AlertsScreen() {
  const router = useRouter();
  const dark = useColorScheme() === 'dark';
  const { setModalOpen } = useModal();

  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [broadcasts, setBroadcasts] = useState<BroadcastListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const [selected, setSelected] = useState<AlertItem | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replying, setReplying] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const [tags, allReports, broadcastResult] = await Promise.all([
        qrService.list(),
        reportsService.listAll(),
        broadcastsService.listPublic(),
      ]);
      const tagMap = new Map(tags.map((t) => [t.id, t]));
      const items: AlertItem[] = allReports
        .map((report) => {
          const tag = tagMap.get(report.qrCodeId);
          return tag ? { report, tag } : null;
        })
        .filter((item): item is AlertItem => item !== null)
        .sort((a, b) => {
          if (a.tag.isLost !== b.tag.isLost) return a.tag.isLost ? -1 : 1;
          return b.report.createdAt.localeCompare(a.report.createdAt);
        });
      setAlerts(items);
      setBroadcasts(broadcastResult.items ?? []);
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
      const updatedReport: Report = {
        ...selected.report,
        responses: [...(selected.report.responses ?? []), response],
      };
      setSelected({ ...selected, report: updatedReport });
      setAlerts((prev) =>
        prev.map((a) => a.report.id === selected.report.id ? { ...a, report: updatedReport } : a),
      );
    } catch (e: any) {
      Alert.alert('Error', extractApiErrorMessage(e, 'Failed to send reply'));
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

  return (
    <View style={{ flex: 1, backgroundColor: bg(dark) }}>
      {/* ── Header ── */}
      <View style={{
        backgroundColor: cardBg(dark),
        borderBottomWidth: 1, borderBottomColor: borderColor(dark),
        paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16,
        flexDirection: 'row', alignItems: 'center', gap: 10,
      }}>
        <Text style={{ flex: 1, fontSize: 22, fontWeight: '700', color: textPrimary(dark) }}>
          Alerts
          {(alerts.length + broadcasts.length) > 0 && (
            <Text style={{ color: T.orange }}> ({alerts.length + broadcasts.length})</Text>
          )}
        </Text>

        <TouchableOpacity
          onPress={() => router.push('/(app)/notifications')}
          style={{ padding: 6, position: 'relative' }}
        >
          <Ionicons name="notifications-outline" size={22} color={textPrimary(dark)} />
          {unreadCount > 0 && (
            <View style={{
              position: 'absolute', top: 3, right: 3,
              minWidth: 15, height: 15, borderRadius: 8,
              backgroundColor: T.red,
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

      {/* ── Body ── */}
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={T.orange} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 32 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={T.orange} />
          }
        >
          {/* Finder reports on own tags */}
          <SectionHeader label={`Your Tag Alerts${alerts.length > 0 ? ` (${alerts.length})` : ''}`} dark={dark} />
          {alerts.length === 0 ? (
            <View style={{
              marginHorizontal: 16, borderRadius: 14,
              backgroundColor: cardBg(dark),
              borderWidth: 1, borderColor: borderColor(dark),
              padding: 20, alignItems: 'center', gap: 8,
            }}>
              <Ionicons name="notifications-outline" size={28} color={T.orange} />
              <Text style={{ fontSize: 13, color: textMuted(dark), textAlign: 'center' }}>
                When someone scans your tag and submits a finder report, it will appear here.
              </Text>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              {alerts.map((item, i) => (
                <AlertCard key={`${item.report.id}-${i}`} item={item} onPress={() => openDetail(item)} dark={dark} />
              ))}
            </View>
          )}

          {/* Community missing broadcasts */}
          <SectionHeader label={`Community Alerts${broadcasts.length > 0 ? ` (${broadcasts.length})` : ''}`} dark={dark} />
          {broadcasts.length === 0 ? (
            <View style={{
              marginHorizontal: 16, borderRadius: 14,
              backgroundColor: cardBg(dark),
              borderWidth: 1, borderColor: borderColor(dark),
              padding: 20, alignItems: 'center', gap: 8,
            }}>
              <Ionicons name="megaphone-outline" size={28} color={T.purple} />
              <Text style={{ fontSize: 13, color: textMuted(dark), textAlign: 'center' }}>
                No active community missing alerts in your area.
              </Text>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              {broadcasts.map((item) => (
                <BroadcastCard
                  key={item.id}
                  item={item}
                  dark={dark}
                  onPress={() => router.push({ pathname: '/broadcasts/[id]' as any, params: { id: item.id } })}
                />
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {/* ── Detail bottom sheet ── */}
      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={closeDetail}>
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' }}
          activeOpacity={1}
          onPress={closeDetail}
        />

        {selected && (() => {
          const { report, tag } = selected;
          const coords = getCoords(report);
          const notes = report.finderNotes ?? report.message;
          const thumb = CATEGORY_THUMB[tag.category] ?? CATEGORY_THUMB.other;

          return (
            <View style={{
              backgroundColor: cardBg(dark),
              borderTopLeftRadius: 28, borderTopRightRadius: 28,
              maxHeight: '90%',
            }}>
              {/* Pull handle */}
              <View style={{
                width: 36, height: 4, borderRadius: 2,
                backgroundColor: borderColor(dark),
                alignSelf: 'center', marginTop: 12, marginBottom: 8,
              }} />

              <ScrollView
                contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32, gap: 16 }}
                showsVerticalScrollIndicator={false}
              >
                {/* Hero header */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{
                    width: 52, height: 52, borderRadius: 12,
                    backgroundColor: thumb.bg,
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Ionicons name={thumb.icon} size={24} color="#fff" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <Text style={{ fontSize: 18, fontWeight: '700', color: textPrimary(dark) }}>
                        {tag.name}
                      </Text>
                      {tag.isLost && (
                        <View style={{
                          backgroundColor: T.red, borderRadius: 5,
                          paddingHorizontal: 6, paddingVertical: 2,
                        }}>
                          <Text style={{ color: '#fff', fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                            Lost
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={{ fontSize: 12, color: textMuted(dark), marginTop: 2 }}>
                      {tag.category} · Found {formatTimeAgo(report.createdAt)}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={closeDetail} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Ionicons name="close" size={20} color={textMuted(dark)} />
                  </TouchableOpacity>
                </View>

                {/* Photo */}
                {report.photoUrl ? (
                  <Image
                    source={{ uri: report.photoUrl }}
                    style={{ width: '100%', height: 180, borderRadius: 14 }}
                    resizeMode="cover"
                  />
                ) : null}

                {/* Finder's note */}
                {notes ? (
                  <View style={{
                    backgroundColor: dark ? '#0f1117' : T.creamLight,
                    borderRadius: 12, padding: 14,
                    borderLeftWidth: 3, borderLeftColor: T.orange,
                    gap: 4,
                  }}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: T.orange, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                      Finder's Note
                    </Text>
                    <Text style={{ fontSize: 14, color: textSub(dark), lineHeight: 20 }}>
                      {notes}
                    </Text>
                  </View>
                ) : null}

                {/* Contact finder */}
                <View style={{
                  backgroundColor: dark ? '#0f1117' : '#f8fafc',
                  borderRadius: 12, padding: 14,
                  borderWidth: 1, borderColor: borderColor(dark),
                  gap: 10,
                }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: textMuted(dark), textTransform: 'uppercase', letterSpacing: 0.8 }}>
                    Contact Finder
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Ionicons
                      name={report.finderContact?.includes('@') ? 'mail-outline' : 'call-outline'}
                      size={16}
                      color={textPrimary(dark)}
                    />
                    <Text style={{ fontSize: 14, color: textPrimary(dark), flex: 1 }} numberOfLines={1}>
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
                        backgroundColor: T.orange,
                        borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8,
                      }}
                    >
                      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>
                        {report.finderContact?.includes('@') ? 'Email' : 'Call'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* GPS */}
                {coords && (
                  <View style={{
                    backgroundColor: dark ? '#0f1419' : '#f0f9ff',
                    borderRadius: 12, padding: 14,
                    borderWidth: 1, borderColor: dark ? '#1e3a5f' : '#bae6fd',
                    gap: 10,
                  }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="location" size={12} color={T.blue} />
                      <Text style={{ fontSize: 10, fontWeight: '700', color: T.blue, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                        Location Found
                      </Text>
                    </View>
                    <Text style={{ fontSize: 13, color: dark ? '#93c5fd' : '#1e40af' }}>
                      {report.locationAddress ?? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`}
                    </Text>
                    <TouchableOpacity
                      onPress={() => openNativeNavigation({ lat: coords.lat, lng: coords.lng })}
                      style={{
                        backgroundColor: T.blue, borderRadius: 12, paddingVertical: 12,
                        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                      }}
                    >
                      <Ionicons name="map-outline" size={16} color="#fff" />
                      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Get Directions</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Previous replies */}
                {(report.responses?.length ?? 0) > 0 && (
                  <View style={{ gap: 8 }}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: textMuted(dark), textTransform: 'uppercase', letterSpacing: 0.8 }}>
                      Your Replies
                    </Text>
                    {(report.responses ?? []).map((r) => (
                      <View key={r.id} style={{
                        backgroundColor: dark ? '#1a1d27' : T.orangeSoft,
                        borderRadius: 12, padding: 12,
                        borderWidth: 1, borderColor: dark ? '#3d2210' : '#fed7aa',
                      }}>
                        <Text style={{ fontSize: 13, color: dark ? '#fdba74' : T.orangeDark, lineHeight: 19 }}>
                          {r.message}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Reply input + send */}
                <View style={{
                  backgroundColor: dark ? '#0f1117' : '#f8fafc',
                  borderRadius: 12, padding: 14,
                  borderWidth: 1, borderColor: borderColor(dark),
                  gap: 10,
                }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: textMuted(dark), textTransform: 'uppercase', letterSpacing: 0.8 }}>
                    Send a Reply
                  </Text>
                  <TextInput
                    style={{
                      backgroundColor: cardBg(dark),
                      borderWidth: 1, borderColor: borderColor(dark),
                      borderRadius: 10, padding: 12,
                      color: textPrimary(dark), fontSize: 14,
                      minHeight: 72, textAlignVertical: 'top',
                    }}
                    placeholder="e.g. Thank you! I'm on my way…"
                    placeholderTextColor={textMuted(dark)}
                    value={replyText}
                    onChangeText={setReplyText}
                    multiline
                  />
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity
                      onPress={closeDetail}
                      style={{
                        flex: 1, paddingVertical: 13,
                        backgroundColor: dark ? '#1e2236' : T.creamLight,
                        borderRadius: 12, alignItems: 'center',
                      }}
                    >
                      <Text style={{ color: textPrimary(dark), fontWeight: '600', fontSize: 14 }}>Close</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handleReply}
                      disabled={replying || !replyText.trim()}
                      style={{
                        flex: 2, paddingVertical: 13,
                        backgroundColor: T.orange,
                        borderRadius: 12, alignItems: 'center',
                        opacity: !replyText.trim() ? 0.5 : 1,
                      }}
                    >
                      {replying
                        ? <ActivityIndicator color="#fff" size="small" />
                        : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Send Reply</Text>
                      }
                    </TouchableOpacity>
                  </View>
                </View>
              </ScrollView>
            </View>
          );
        })()}
      </Modal>
    </View>
  );
}
