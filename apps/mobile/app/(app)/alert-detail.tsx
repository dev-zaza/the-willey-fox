import { Ionicons } from '@/components/Icon';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import { extractApiErrorMessage } from '@/lib/api-error';
import { openNativeNavigation } from '@/lib/open-native-maps';
import { reportsService, type Report } from '@/services/reports.service';

const T = {
  orange:      '#FF7B14',
  orangeDark:  '#E2620A',
  orangeSoft:  '#FFE9D6',
  red:         '#E94B4B',
  redSoft:     '#FDECEC',
  purple:      '#6A3FB4',
  blue:        '#3b82f6',
  creamLight:  '#F2F4E5',
  charcoal:    '#232323',
  charcoalSoft:'#3a3a3a',
  mute:        '#8a8a8a',
  line:        '#ECECEC',
};

function bg(dark: boolean) { return dark ? '#0f1117' : T.creamLight; }
function cardBg(dark: boolean) { return dark ? '#1a1d27' : '#ffffff'; }
function borderColor(dark: boolean) { return dark ? '#2a2f45' : T.line; }
function textPrimary(dark: boolean) { return dark ? '#f1f5f9' : T.charcoal; }
function textMuted(dark: boolean) { return dark ? '#64748b' : T.mute; }
function textSub(dark: boolean) { return dark ? '#94a3b8' : T.charcoalSoft; }

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

export default function AlertDetailScreen() {
  const router = useRouter();
  const dark = useColorScheme() === 'dark';
  const params = useLocalSearchParams<{
    reportId: string;
    tagName?: string;
    tagCategory?: string;
    isLost?: string;
  }>();

  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState('');
  const [replying, setReplying] = useState(false);
  const [sightingNote, setSightingNote] = useState('');
  const [submittingSighting, setSubmittingSighting] = useState(false);
  const [sightingDone, setSightingDone] = useState(false);

  const load = useCallback(async () => {
    if (!params.reportId) return;
    try {
      const r = await reportsService.getById(params.reportId);
      setReport(r);
    } catch (e: any) {
      Alert.alert('Error', extractApiErrorMessage(e, 'Failed to load alert'));
    } finally {
      setLoading(false);
    }
  }, [params.reportId]);

  useEffect(() => { load(); }, [load]);

  async function handleReply() {
    if (!report || !replyText.trim()) return;
    setReplying(true);
    try {
      const response = await reportsService.respond(report.id, replyText.trim());
      setReplyText('');
      setReport((prev) => prev ? {
        ...prev,
        responses: [...(prev.responses ?? []), response],
      } : prev);
    } catch (e: any) {
      Alert.alert('Error', extractApiErrorMessage(e, 'Failed to send reply'));
    } finally {
      setReplying(false);
    }
  }

  async function handleSighting() {
    if (!report) return;
    setSubmittingSighting(true);
    try {
      await reportsService.reportSighting(report.id, { notes: sightingNote.trim() || undefined });
      setSightingDone(true);
      setSightingNote('');
    } catch (e: any) {
      Alert.alert('Error', extractApiErrorMessage(e, 'Failed to report sighting'));
    } finally {
      setSubmittingSighting(false);
    }
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: bg(dark), alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={T.orange} />
      </View>
    );
  }

  if (!report) {
    return (
      <View style={{ flex: 1, backgroundColor: bg(dark), alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <Text style={{ fontSize: 16, color: textMuted(dark), textAlign: 'center' }}>Alert not found.</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ color: T.orange, fontWeight: '600' }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const coords = getCoords(report);
  const notes = report.finderNotes ?? report.message;
  const isLost = params.isLost === 'true';

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: bg(dark) }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={{
        backgroundColor: cardBg(dark),
        borderBottomWidth: 1, borderBottomColor: borderColor(dark),
        paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16,
        flexDirection: 'row', alignItems: 'center', gap: 12,
      }}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={24} color={T.orange} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: textPrimary(dark) }}>
            {params.tagName ?? 'Alert Detail'}
          </Text>
          <Text style={{ fontSize: 12, color: textMuted(dark), marginTop: 1 }}>
            Reported {formatTimeAgo(report.createdAt)}
          </Text>
        </View>
        {isLost && (
          <View style={{
            backgroundColor: T.red, borderRadius: 6,
            paddingHorizontal: 8, paddingVertical: 3,
          }}>
            <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Missing
            </Text>
          </View>
        )}
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Photo */}
        {report.photoUrl ? (
          <Image
            source={{ uri: report.photoUrl }}
            style={{ width: '100%', height: 200, borderRadius: 16 }}
            resizeMode="cover"
          />
        ) : null}

        {/* Finder's note */}
        {notes ? (
          <View style={{
            backgroundColor: dark ? '#0f1117' : T.creamLight,
            borderRadius: 14, padding: 16,
            borderLeftWidth: 3, borderLeftColor: T.orange,
            gap: 6,
          }}>
            <Text style={{ fontSize: 10, fontWeight: '700', color: T.orange, textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Finder's Note
            </Text>
            <Text style={{ fontSize: 14, color: textSub(dark), lineHeight: 21 }}>{notes}</Text>
          </View>
        ) : null}

        {/* Contact finder */}
        {report.finderContact ? (
          <View style={{
            backgroundColor: cardBg(dark),
            borderRadius: 14, padding: 16,
            borderWidth: 1, borderColor: borderColor(dark),
            gap: 12,
          }}>
            <Text style={{ fontSize: 10, fontWeight: '700', color: textMuted(dark), textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Contact Finder
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons
                name={report.finderContact.includes('@') ? 'mail-outline' : 'call-outline'}
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
                  backgroundColor: T.orange, borderRadius: 10,
                  paddingHorizontal: 14, paddingVertical: 8,
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>
                  {report.finderContact.includes('@') ? 'Email' : 'Call'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {/* GPS */}
        {coords ? (
          <View style={{
            backgroundColor: dark ? '#0f1419' : '#f0f9ff',
            borderRadius: 14, padding: 16,
            borderWidth: 1, borderColor: dark ? '#1e3a5f' : '#bae6fd',
            gap: 12,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="location" size={12} color={T.blue} />
              <Text style={{ fontSize: 10, fontWeight: '700', color: T.blue, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                Location Reported
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
        ) : null}

        {/* "I've seen them" sighting */}
        {isLost && (
          <View style={{
            backgroundColor: dark ? '#1a1d27' : '#f0fdf4',
            borderRadius: 14, padding: 16,
            borderWidth: 1, borderColor: dark ? '#14532d' : '#bbf7d0',
            gap: 12,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="eye" size={18} color="#22c55e" />
              <Text style={{ fontSize: 14, fontWeight: '700', color: dark ? '#86efac' : '#15803d' }}>
                {sightingDone ? 'Sighting Reported — Thank You!' : "I've Seen This Person"}
              </Text>
            </View>
            {!sightingDone ? (
              <>
                <TextInput
                  style={{
                    backgroundColor: cardBg(dark),
                    borderWidth: 1, borderColor: borderColor(dark),
                    borderRadius: 10, padding: 12,
                    color: textPrimary(dark), fontSize: 14,
                    minHeight: 64, textAlignVertical: 'top',
                  }}
                  placeholder="Where did you see them? (optional)"
                  placeholderTextColor={textMuted(dark)}
                  value={sightingNote}
                  onChangeText={setSightingNote}
                  multiline
                />
                <TouchableOpacity
                  onPress={handleSighting}
                  disabled={submittingSighting}
                  style={{
                    backgroundColor: '#22c55e', borderRadius: 12, paddingVertical: 12,
                    alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8,
                    opacity: submittingSighting ? 0.7 : 1,
                  }}
                >
                  {submittingSighting ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle" size={16} color="#fff" />
                      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Report Sighting</Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <Text style={{ fontSize: 13, color: dark ? '#86efac' : '#16a34a', lineHeight: 19 }}>
                The tag owner has been notified. Thank you for helping.
              </Text>
            )}
          </View>
        )}

        {/* Previous replies */}
        {(report.responses?.length ?? 0) > 0 && (
          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 10, fontWeight: '700', color: textMuted(dark), textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Reply Thread
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
                <Text style={{ fontSize: 10, color: textMuted(dark), marginTop: 4 }}>
                  {formatTimeAgo(r.createdAt)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Reply input */}
        <View style={{
          backgroundColor: cardBg(dark),
          borderRadius: 14, padding: 16,
          borderWidth: 1, borderColor: borderColor(dark),
          gap: 10,
        }}>
          <Text style={{ fontSize: 10, fontWeight: '700', color: textMuted(dark), textTransform: 'uppercase', letterSpacing: 0.8 }}>
            Send a Reply
          </Text>
          <TextInput
            style={{
              backgroundColor: dark ? '#0f1117' : '#f8fafc',
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
          <TouchableOpacity
            onPress={handleReply}
            disabled={replying || !replyText.trim()}
            style={{
              backgroundColor: T.orange, borderRadius: 12, paddingVertical: 13,
              alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8,
              opacity: !replyText.trim() ? 0.5 : 1,
            }}
          >
            {replying ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="send" size={14} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Send Reply</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
