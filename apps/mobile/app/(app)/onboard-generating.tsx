import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Text, useColorScheme, View } from 'react-native';

const T = {
  orange:     '#FF7B14',
  creamLight: '#F2F4E5',
  charcoal:   '#232323',
  mute:       '#8a8a8a',
};

function bg(dark: boolean) { return dark ? '#0f1117' : T.creamLight; }
function textPrimary(dark: boolean) { return dark ? '#f1f5f9' : T.charcoal; }
function textMuted(dark: boolean) { return dark ? '#64748b' : T.mute; }

function SpinRing() {
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 1200,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ).start();
  }, [spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Animated.View style={{ transform: [{ rotate }] }}>
      <View style={{
        width: 80, height: 80, borderRadius: 40,
        borderWidth: 4,
        borderTopColor: T.orange,
        borderRightColor: T.orange + '44',
        borderBottomColor: T.orange + '44',
        borderLeftColor: T.orange + '44',
      }} />
    </Animated.View>
  );
}

export default function OnboardGeneratingScreen() {
  const router = useRouter();
  const dark = useColorScheme() === 'dark';
  const { groupName, members: membersRaw } = useLocalSearchParams<{ groupName?: string; members?: string }>();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace({
        pathname: '/(app)/onboard-done' as any,
        params: { groupName, members: membersRaw },
      });
    }, 2200);
    return () => clearTimeout(timer);
  }, [router, groupName, membersRaw]);

  return (
    <View style={{ flex: 1, backgroundColor: bg(dark), alignItems: 'center', justifyContent: 'center', gap: 28, padding: 32 }}>
      <SpinRing />
      <View style={{ alignItems: 'center', gap: 8 }}>
        <Text style={{ fontSize: 20, fontWeight: '800', color: textPrimary(dark), textAlign: 'center' }}>
          Creating QR Safety Profiles…
        </Text>
        <Text style={{ fontSize: 14, color: textMuted(dark), textAlign: 'center', lineHeight: 21 }}>
          Setting up{groupName ? ` ${groupName}` : ' your group'} and generating unique QR codes for each member.
        </Text>
      </View>
    </View>
  );
}
