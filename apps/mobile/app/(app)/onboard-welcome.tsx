import { Ionicons } from '@/components/Icon';
import { storage } from '@/lib/storage';
import { useRouter } from 'expo-router';
import { Image, Text, TouchableOpacity, useColorScheme, View, ScrollView } from 'react-native';

const ONBOARDING_DONE_KEY = 'onboarding_done';

const T = {
  orange:     '#FF7B14',
  orangeSoft: '#FFE9D6',
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

const FEATURES = [
  {
    icon: 'qr-code',
    color: T.orange,
    title: 'QR Safety Profiles',
    desc: 'Scan any TheWileyfox QR to instantly see who it belongs to and how to help.',
  },
  {
    icon: 'people',
    color: '#6A3FB4',
    title: 'Family Group',
    desc: 'Create a group for your family — members get QR profiles and SOS alerts.',
  },
  {
    icon: 'shield-checkmark',
    color: '#3FA34D',
    title: 'Community Safety',
    desc: 'See live safety alerts and missing person broadcasts near you.',
  },
];

export default function OnboardWelcomeScreen() {
  const router = useRouter();
  const dark = useColorScheme() === 'dark';

  return (
    <View style={{ flex: 1, backgroundColor: bg(dark) }}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 80, paddingBottom: 48, alignItems: 'center', gap: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Logo / hero */}
        <View style={{ alignItems: 'center', gap: 16 }}>
          <Image
            source={require('../../assets/logo.png')}
            style={{ width: 96, height: 96, borderRadius: 28 }}
            resizeMode="contain"
          />
          <Text style={{ fontSize: 30, fontWeight: '800', color: textPrimary(dark), textAlign: 'center', lineHeight: 36 }}>
            Welcome to{'\n'}TheWileyfox
          </Text>
          <Text style={{ fontSize: 15, color: textMuted(dark), textAlign: 'center', lineHeight: 23 }}>
            Help your community stay safe. Start by setting up your family group and QR profiles.
          </Text>
        </View>

        {/* Feature cards */}
        <View style={{ width: '100%', gap: 12 }}>
          {FEATURES.map((f) => (
            <View
              key={f.title}
              style={{
                backgroundColor: cardBg(dark),
                borderRadius: 16, padding: 16,
                borderWidth: 1, borderColor: borderColor(dark),
                flexDirection: 'row', alignItems: 'flex-start', gap: 14,
              }}
            >
              <View style={{
                width: 44, height: 44, borderRadius: 12,
                backgroundColor: f.color + '22',
                alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Ionicons name={f.icon as any} size={22} color={f.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: textPrimary(dark) }}>{f.title}</Text>
                <Text style={{ fontSize: 13, color: textMuted(dark), marginTop: 3, lineHeight: 19 }}>{f.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* CTAs */}
        <View style={{ width: '100%', gap: 12 }}>
          <TouchableOpacity
            onPress={() => router.push({ pathname: '/(app)/onboard-group' as any })}
            style={{
              backgroundColor: T.orange, borderRadius: 18, paddingVertical: 17,
              alignItems: 'center', justifyContent: 'center',
              shadowColor: T.orange, shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 17 }}>Create Family Group</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={async () => {
              await storage.setItemAsync(ONBOARDING_DONE_KEY, '1').catch(() => {});
              router.replace('/(app)/map');
            }}
            style={{ paddingVertical: 14, alignItems: 'center' }}
          >
            <Text style={{ color: textMuted(dark), fontSize: 14 }}>Skip for now</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
