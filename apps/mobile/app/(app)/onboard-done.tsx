import { Ionicons } from '@/components/Icon';
import { storage } from '@/lib/storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import {
  ScrollView,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';

const ONBOARDING_DONE_KEY = 'onboarding_done';

const T = {
  orange:     '#FF7B14',
  orangeSoft: '#FFE9D6',
  green:      '#3FA34D',
  greenSoft:  '#F0FDF4',
  creamLight: '#F2F4E5',
  charcoal:   '#232323',
  mute:       '#8a8a8a',
  line:       '#ECECEC',
};

function bg(dark: boolean) { return dark ? '#0f1117' : T.creamLight; }
function cardBg(dark: boolean) { return dark ? '#1a1d27' : '#ffffff'; }
function borderColor(dark: boolean) { return dark ? '#2a2f45' : T.line; }
function textPrimary(dark: boolean) { return dark ? '#f1f5f9' : T.charcoal; }
function textMuted(dark: boolean) { return dark ? '#64748b' : T.mute; }

interface QrEntry {
  name: string;
  code: string;
}

export default function OnboardDoneScreen() {
  const router = useRouter();
  const dark = useColorScheme() === 'dark';
  const { groupName, members: membersRaw } = useLocalSearchParams<{ groupName?: string; members?: string }>();

  let qrList: QrEntry[] = [];
  try {
    qrList = membersRaw ? (JSON.parse(membersRaw) as QrEntry[]) : [];
  } catch {
    qrList = [];
  }

  useEffect(() => {
    storage.setItemAsync(ONBOARDING_DONE_KEY, '1').catch(() => {});
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: bg(dark) }}>
      <ScrollView
        contentContainerStyle={{ padding: 24, gap: 24, paddingBottom: 64, alignItems: 'center' }}
        showsVerticalScrollIndicator={false}
      >
        {/* Success icon */}
        <View style={{ alignItems: 'center', gap: 16, paddingTop: 48 }}>
          <View style={{
            width: 88, height: 88, borderRadius: 44,
            backgroundColor: dark ? '#0f2b14' : T.greenSoft,
            alignItems: 'center', justifyContent: 'center',
            shadowColor: T.green, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 16, elevation: 10,
          }}>
            <Ionicons name="checkmark-circle" size={52} color={T.green} />
          </View>
          <Text style={{ fontSize: 26, fontWeight: '800', color: textPrimary(dark), textAlign: 'center' }}>
            You're all set!
          </Text>
          {groupName && (
            <View style={{ backgroundColor: T.orangeSoft, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 8 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: T.orange }}>{groupName}</Text>
            </View>
          )}
          <Text style={{ fontSize: 14, color: textMuted(dark), textAlign: 'center', lineHeight: 21 }}>
            QR safety profiles have been created for every member of your group.
          </Text>
        </View>

        {/* QR cards */}
        {qrList.length > 0 && (
          <View style={{ width: '100%', gap: 10 }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: textMuted(dark), textTransform: 'uppercase', letterSpacing: 0.8 }}>
              QR Profiles Created
            </Text>
            {qrList.map((q, i) => (
              <View
                key={i}
                style={{
                  backgroundColor: cardBg(dark),
                  borderRadius: 14, padding: 16,
                  borderWidth: 1, borderColor: borderColor(dark),
                  flexDirection: 'row', alignItems: 'center', gap: 14,
                }}
              >
                <View style={{
                  width: 44, height: 44, borderRadius: 12,
                  backgroundColor: T.orangeSoft, alignItems: 'center', justifyContent: 'center',
                }}>
                  <Ionicons name="qr-code" size={22} color={T.orange} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: textPrimary(dark) }}>{q.name}</Text>
                  <Text style={{ fontSize: 12, color: textMuted(dark), marginTop: 2, letterSpacing: 1.5, fontFamily: 'monospace' }}>
                    {q.code}
                  </Text>
                </View>
                <View style={{ backgroundColor: dark ? '#0f2b14' : T.greenSoft, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: T.green }}>Ready</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* What's next tip */}
        <View style={{
          backgroundColor: cardBg(dark), borderRadius: 14, padding: 16,
          borderWidth: 1, borderColor: borderColor(dark),
          width: '100%', flexDirection: 'row', gap: 12, alignItems: 'flex-start',
        }}>
          <Ionicons name="bulb" size={22} color={T.orange} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: textPrimary(dark) }}>Next step</Text>
            <Text style={{ fontSize: 12, color: textMuted(dark), marginTop: 4, lineHeight: 18 }}>
              Print your QR tags and attach them to your family members' bags, phones, or wear them as wristbands.
            </Text>
          </View>
        </View>

        {/* Actions */}
        <View style={{ width: '100%', gap: 12 }}>
          <TouchableOpacity
            onPress={() => router.replace('/(app)/tags')}
            style={{
              backgroundColor: T.orange, borderRadius: 16, paddingVertical: 16,
              alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8,
            }}
          >
            <Ionicons name="pricetag" size={18} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>View in My Tags</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.replace('/(app)/map')}
            style={{
              backgroundColor: cardBg(dark), borderRadius: 16, paddingVertical: 15,
              alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8,
              borderWidth: 1, borderColor: borderColor(dark),
            }}
          >
            <Ionicons name="map" size={18} color={textPrimary(dark)} />
            <Text style={{ color: textPrimary(dark), fontWeight: '600', fontSize: 15 }}>Go to Map</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
