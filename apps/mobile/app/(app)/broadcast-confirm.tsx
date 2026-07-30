import { Ionicons } from '@/components/Icon';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';

const T = {
  orange:     '#FF7B14',
  orangeSoft: '#FFE9D6',
  red:        '#E94B4B',
  creamLight: '#F2F4E5',
  charcoal:   '#232323',
  mute:       '#8a8a8a',
};

function bg(dark: boolean) { return dark ? '#0f1117' : T.creamLight; }
function cardBg(dark: boolean) { return dark ? '#1a1d27' : '#ffffff'; }
function textPrimary(dark: boolean) { return dark ? '#f1f5f9' : T.charcoal; }
function textMuted(dark: boolean) { return dark ? '#64748b' : T.mute; }

function PulseRing({ delay, color }: { delay: number; color: string }) {
  const scale = useRef(new Animated.Value(0.5)).current;
  const opacity = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(scale, {
            toValue: 2.8,
            duration: 1800,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0,
            duration: 1800,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(scale, { toValue: 0.5, duration: 0, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.8, duration: 0, useNativeDriver: true }),
        ]),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [delay, scale, opacity]);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: color,
        transform: [{ scale }],
        opacity,
      }}
    />
  );
}

export default function BroadcastConfirmScreen() {
  const router = useRouter();
  const dark = useColorScheme() === 'dark';
  const params = useLocalSearchParams<{ reportId?: string; tagName?: string; notifiedCount?: string }>();

  const notifiedCount = params.notifiedCount ? parseInt(params.notifiedCount, 10) : null;

  return (
    <View style={{ flex: 1, backgroundColor: bg(dark), alignItems: 'center', justifyContent: 'center', padding: 32 }}>

      {/* Pulse animation */}
      <View style={{ width: 80, height: 80, alignItems: 'center', justifyContent: 'center', marginBottom: 48 }}>
        <PulseRing delay={0} color={T.red} />
        <PulseRing delay={600} color={T.red} />
        <PulseRing delay={1200} color={T.red} />
        <View style={{
          width: 80, height: 80, borderRadius: 40,
          backgroundColor: T.red,
          alignItems: 'center', justifyContent: 'center',
          zIndex: 10,
        }}>
          <Ionicons name="radio" size={36} color="#fff" />
        </View>
      </View>

      {/* Status text */}
      <View style={{ alignItems: 'center', gap: 12, marginBottom: 40 }}>
        <Text style={{ fontSize: 28, fontWeight: '800', color: T.red, textAlign: 'center' }}>
          Alert Broadcast
        </Text>
        {params.tagName ? (
          <Text style={{ fontSize: 16, fontWeight: '600', color: textPrimary(dark), textAlign: 'center' }}>
            {params.tagName}
          </Text>
        ) : null}
        {notifiedCount !== null ? (
          <View style={{
            backgroundColor: dark ? '#2d1a1a' : '#fef2f2',
            borderWidth: 1, borderColor: dark ? '#5c2020' : '#fecaca',
            borderRadius: 12, paddingHorizontal: 16, paddingVertical: 8,
          }}>
            <Text style={{ fontSize: 14, color: T.red, fontWeight: '700', textAlign: 'center' }}>
              {notifiedCount} user{notifiedCount !== 1 ? 's' : ''} notified nearby
            </Text>
          </View>
        ) : null}
        <Text style={{ fontSize: 14, color: textMuted(dark), textAlign: 'center', lineHeight: 22, marginTop: 4 }}>
          TheWileyfox users in the area have been alerted. You will receive notifications when someone reports a sighting.
        </Text>
      </View>

      {/* Info cards */}
      <View style={{ width: '100%', gap: 10, marginBottom: 40 }}>
        {[
          { icon: 'notifications', label: 'Check Alerts tab for sighting updates' },
          { icon: 'call', label: 'Also call 999 / 112 in an emergency' },
          { icon: 'time', label: 'Broadcast active for 24 hours' },
        ].map(({ icon, label }) => (
          <View
            key={label}
            style={{
              backgroundColor: cardBg(dark),
              borderRadius: 12, padding: 14,
              flexDirection: 'row', alignItems: 'center', gap: 12,
            }}
          >
            <View style={{
              width: 36, height: 36, borderRadius: 10,
              backgroundColor: dark ? '#2d1a1a' : '#fef2f2',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Ionicons name={icon as any} size={18} color={T.red} />
            </View>
            <Text style={{ flex: 1, fontSize: 13, color: textPrimary(dark), lineHeight: 19 }}>{label}</Text>
          </View>
        ))}
      </View>

      {/* Actions */}
      <View style={{ width: '100%', gap: 10 }}>
        <TouchableOpacity
          onPress={() => router.replace('/(app)/alerts')}
          style={{
            backgroundColor: T.red, borderRadius: 16, paddingVertical: 15,
            alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8,
          }}
        >
          <Ionicons name="notifications" size={18} color="#fff" />
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>View Alerts</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.replace('/(app)/map')}
          style={{
            backgroundColor: dark ? '#1e2236' : '#f1f5f9',
            borderRadius: 16, paddingVertical: 15,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: textPrimary(dark), fontWeight: '600', fontSize: 15 }}>Back to Map</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
