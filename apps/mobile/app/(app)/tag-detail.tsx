import { Ionicons } from '@/components/Icon';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Share,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import { QRCode } from '@/components/shims';
import { extractApiErrorMessage } from '@/lib/api-error';
import { qrService, type QrCode } from '@/services/qr.service';

const T = {
  orange:     '#FF7B14',
  orangeDark: '#E2620A',
  orangeSoft: '#FFE9D6',
  red:        '#E94B4B',
  redSoft:    '#FDECEC',
  purple:     '#6A3FB4',
  sage:       '#AABA9F',
  green:      '#3FA34D',
  creamLight: '#F2F4E5',
  charcoal:   '#232323',
  mute:       '#8a8a8a',
  line:       '#ECECEC',
};

const CATEGORY_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  pet:     { icon: 'paw',       color: T.sage,   label: 'Pet' },
  bag:     { icon: 'briefcase', color: T.orange,  label: 'Bag' },
  key:     { icon: 'key',       color: T.orange,  label: 'Keys' },
  person:  { icon: 'person',    color: T.purple,  label: 'Person' },
  vehicle: { icon: 'car',       color: T.orange,  label: 'Vehicle' },
  medical: { icon: 'medkit',    color: T.red,     label: 'Medical' },
  place:   { icon: 'location',  color: T.sage,    label: 'Place' },
  other:   { icon: 'pricetag',  color: T.orange,  label: 'Other' },
};

function bg(dark: boolean) { return dark ? '#0f1117' : T.creamLight; }
function cardBg(dark: boolean) { return dark ? '#1a1d27' : '#ffffff'; }
function borderColor(dark: boolean) { return dark ? '#2a2f45' : T.line; }
function textPrimary(dark: boolean) { return dark ? '#f1f5f9' : T.charcoal; }
function textMuted(dark: boolean) { return dark ? '#64748b' : T.mute; }

const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL?.replace(/\/$/, '') ?? 'https://safetag.app';

export default function TagDetailScreen() {
  const router = useRouter();
  const dark = useColorScheme() === 'dark';
  const params = useLocalSearchParams<{ tagId: string }>();

  const [tag, setTag] = useState<QrCode | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  const load = useCallback(async () => {
    if (!params.tagId) return;
    try {
      const result = await qrService.get(params.tagId);
      setTag(result);
    } catch (e: any) {
      Alert.alert('Error', extractApiErrorMessage(e, 'Failed to load tag'));
    } finally {
      setLoading(false);
    }
  }, [params.tagId]);

  useEffect(() => { load(); }, [load]);

  async function toggleLost() {
    if (!tag) return;
    if (tag.isLost) {
      Alert.alert('Mark as Found', 'Mark this tag as found and stop the missing alert?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark Found',
          style: 'default',
          onPress: async () => {
            setToggling(true);
            try {
              const updated = await qrService.markFound(tag.id);
              setTag(updated);
            } catch (e: any) {
              Alert.alert('Error', extractApiErrorMessage(e, 'Failed to update'));
            } finally {
              setToggling(false);
            }
          },
        },
      ]);
    } else {
      router.push({
        pathname: '/(app)/lost-report' as any,
        params: { qrCodeId: tag.id, tagName: tag.name },
      });
    }
  }

  async function handleShare() {
    if (!tag) return;
    const url = `${WEB_URL}/q/${tag.uniqueCode}`;
    try {
      await Share.share({
        message: `Help return ${tag.name}! Scan or visit: ${url}`,
        url,
        title: `${tag.name} — TheWileyfox`,
      });
    } catch {
      // user cancelled
    }
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: bg(dark), alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={T.orange} />
      </View>
    );
  }

  if (!tag) {
    return (
      <View style={{ flex: 1, backgroundColor: bg(dark), alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <Text style={{ fontSize: 16, color: textMuted(dark), textAlign: 'center' }}>Tag not found.</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ color: T.orange, fontWeight: '600' }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const cat = CATEGORY_CONFIG[tag.category] ?? CATEGORY_CONFIG.other;
  const qrUrl = `${WEB_URL}/q/${tag.uniqueCode}`;

  return (
    <View style={{ flex: 1, backgroundColor: bg(dark) }}>
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
          <Text style={{ fontSize: 18, fontWeight: '700', color: textPrimary(dark) }} numberOfLines={1}>
            {tag.name}
          </Text>
          <Text style={{ fontSize: 12, color: textMuted(dark), marginTop: 1 }}>
            {cat.label}
          </Text>
        </View>
        <TouchableOpacity onPress={handleShare} style={{ padding: 6 }}>
          <Ionicons name="share-outline" size={22} color={textPrimary(dark)} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Lost banner */}
        {tag.isLost && (
          <View style={{
            backgroundColor: dark ? '#2d1a1a' : T.redSoft,
            borderWidth: 1, borderColor: dark ? '#5c2020' : T.red,
            borderRadius: 14, padding: 14,
            flexDirection: 'row', alignItems: 'center', gap: 10,
          }}>
            <Ionicons name="alert-circle" size={20} color={T.red} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: T.red }}>Missing Alert Active</Text>
              <Text style={{ fontSize: 12, color: dark ? '#fca5a5' : '#b91c1c', marginTop: 2 }}>
                TheWileyfox users nearby are alerted. Tap "Mark Found" when recovered.
              </Text>
            </View>
          </View>
        )}

        {/* QR card */}
        <View style={{
          backgroundColor: cardBg(dark),
          borderRadius: 20, padding: 24,
          borderWidth: 1, borderColor: borderColor(dark),
          alignItems: 'center', gap: 16,
        }}>
          {/* Category badge */}
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 8,
            backgroundColor: dark ? '#0f1117' : T.creamLight,
            borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6,
          }}>
            <View style={{
              width: 28, height: 28, borderRadius: 8,
              backgroundColor: cat.color,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Ionicons name={cat.icon as any} size={14} color="#fff" />
            </View>
            <Text style={{ fontSize: 13, fontWeight: '600', color: textPrimary(dark) }}>{cat.label}</Text>
          </View>

          {/* QR code */}
          <View style={{
            backgroundColor: '#ffffff',
            borderRadius: 16, padding: 16,
            shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.08, shadowRadius: 8, elevation: 4,
          }}>
            <QRCode value={qrUrl} size={180} />
          </View>

          {/* Code */}
          <View style={{ alignItems: 'center', gap: 4 }}>
            <Text style={{ fontSize: 11, color: textMuted(dark), textTransform: 'uppercase', letterSpacing: 1 }}>
              Unique Code
            </Text>
            <Text style={{ fontSize: 16, fontWeight: '700', color: textPrimary(dark), letterSpacing: 2 }}>
              {tag.uniqueCode}
            </Text>
          </View>
        </View>

        {/* Tag info */}
        {tag.rewardMessage ? (
          <View style={{
            backgroundColor: cardBg(dark),
            borderRadius: 14, padding: 16,
            borderWidth: 1, borderColor: borderColor(dark),
            gap: 6,
          }}>
            <Text style={{ fontSize: 10, fontWeight: '700', color: textMuted(dark), textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Reward Message
            </Text>
            <Text style={{ fontSize: 14, color: textPrimary(dark), lineHeight: 21 }}>{tag.rewardMessage}</Text>
          </View>
        ) : null}

        {/* Status row */}
        <View style={{
          backgroundColor: cardBg(dark),
          borderRadius: 14, padding: 16,
          borderWidth: 1, borderColor: borderColor(dark),
          flexDirection: 'row', alignItems: 'center', gap: 12,
        }}>
          <View style={{
            width: 36, height: 36, borderRadius: 10,
            backgroundColor: tag.isLost ? (dark ? '#2d1a1a' : T.redSoft) : (dark ? '#0f2b14' : '#f0fdf4'),
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Ionicons
              name={tag.isLost ? 'alert-circle' : 'checkmark-circle'}
              size={20}
              color={tag.isLost ? T.red : T.green}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: textPrimary(dark) }}>
              {tag.isLost ? 'Status: Missing' : 'Status: OK'}
            </Text>
            <Text style={{ fontSize: 12, color: textMuted(dark), marginTop: 1 }}>
              {tag.isLost ? 'Broadcast alert is active' : 'No active alert'}
            </Text>
          </View>
        </View>

        {/* Actions */}
        <View style={{ gap: 10 }}>
          <TouchableOpacity
            onPress={toggleLost}
            disabled={toggling}
            style={{
              backgroundColor: tag.isLost ? T.green : T.red,
              borderRadius: 16, paddingVertical: 15,
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
              opacity: toggling ? 0.7 : 1,
            }}
          >
            {toggling ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name={tag.isLost ? 'checkmark-circle' : 'alert-circle'} size={18} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>
                  {tag.isLost ? 'Mark as Found' : 'Report Missing'}
                </Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleShare}
            style={{
              backgroundColor: dark ? '#1e2236' : '#f1f5f9',
              borderRadius: 16, paddingVertical: 15,
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            <Ionicons name="share-outline" size={18} color={textPrimary(dark)} />
            <Text style={{ color: textPrimary(dark), fontWeight: '600', fontSize: 15 }}>Share Tag Link</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
