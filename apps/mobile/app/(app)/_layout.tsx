import { Ionicons } from '@/components/Icon';
import { Tabs } from '@/components/shims';
import { Platform, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { ModalProvider } from '@/context/ModalContext';
import { SosButton } from '@/components/SosButton';
import { usePathname } from 'expo-router';

const ONBOARDING_ROUTES = [
  '/onboard-welcome',
  '/onboard-group',
  '/onboard-members',
  '/onboard-generating',
  '/onboard-done',
];

// ── Regular tab icon ─────────────────────────────────────────────────────────
function TabIcon({
  focused,
  color,
  size,
  activeName,
  inactiveName,
}: {
  focused: boolean;
  color: string;
  size: number;
  activeName: string;
  inactiveName: string;
}) {
  return (
    <View style={styles.iconWrap}>
      <Ionicons name={focused ? activeName : inactiveName as any} size={size ?? 24} color={color} />
      {focused && <View style={[styles.activeDot, { backgroundColor: color }]} />}
    </View>
  );
}

// ── Raised centre + button (like reference image) ────────────────────────────
function CentreAddButton({ focused }: { focused: boolean }) {
  return (
    <View style={styles.centreButtonOuter}>
      <View style={[styles.centreButtonInner, focused && styles.centreButtonFocused]}>
        <Text style={styles.centreButtonIcon}>+</Text>
      </View>
    </View>
  );
}

// ── Custom tab bar background (glassy look via semi-transparent white) ───────
function TabBarBackground() {
  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        {
          backgroundColor: Platform.OS === 'ios' ? 'rgba(255,255,255,0.88)' : '#ffffff',
          borderTopWidth: 0,
        },
      ]}
    />
  );
}

export default function AppLayout() {
  const scheme = useColorScheme();
  const dark = scheme === 'dark';
  const pathname = usePathname();
  const isOnboarding = ONBOARDING_ROUTES.some((r) => pathname.endsWith(r));

  return (
    <ModalProvider>
      <View style={{ flex: 1 }}>
        {!isOnboarding && <SosButton />}
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: '#f97316',
            tabBarInactiveTintColor: dark ? '#64748b' : '#9ca3af',
            tabBarStyle: isOnboarding ? { display: 'none' } : styles.tabBar,
            tabBarLabelStyle: styles.tabLabel,
            tabBarBackground: () => <TabBarBackground />,
          }}
        >
          <Tabs.Screen
            name="map"
            options={{
              title: 'Map',
              tabBarIcon: ({ focused, color, size }: { focused: boolean; color: string; size: number }) => (
                <TabIcon focused={focused} color={color} size={size} activeName="map" inactiveName="map-outline" />
              ),
            }}
          />
          <Tabs.Screen
            name="qr"
            options={{
              title: 'Scan',
              tabBarIcon: ({ focused, color, size }: { focused: boolean; color: string; size: number }) => (
                <TabIcon focused={focused} color={color} size={size} activeName="scan" inactiveName="scan-outline" />
              ),
            }}
          />

          {/* ── Raised centre button ── */}
          <Tabs.Screen
            name="addpin"
            options={{
              title: '',
              tabBarIcon: ({ focused }: { focused: boolean }) => <CentreAddButton focused={focused} />,
              tabBarItemStyle: styles.centreTabItem,
            }}
          />

          <Tabs.Screen
            name="tags"
            options={{
              title: 'My Tags',
              tabBarIcon: ({ focused, color, size }: { focused: boolean; color: string; size: number }) => (
                <TabIcon focused={focused} color={color} size={size} activeName="pricetag" inactiveName="pricetag-outline" />
              ),
            }}
          />
          <Tabs.Screen
            name="alerts"
            options={{
              title: 'Alerts',
              tabBarIcon: ({ focused, color, size }: { focused: boolean; color: string; size: number }) => (
                <TabIcon focused={focused} color={color} size={size} activeName="notifications" inactiveName="notifications-outline" />
              ),
            }}
          />
          <Tabs.Screen
            name="profile"
            options={{ href: null }}
          />

          {/* Hidden screens */}
          <Tabs.Screen name="messages" options={{ href: null }} />
          <Tabs.Screen name="emergency" options={{ href: null }} />
          <Tabs.Screen name="places" options={{ href: null }} />
          <Tabs.Screen name="subscription" options={{ href: null }} />
          <Tabs.Screen name="guardian-accept" options={{ href: null }} />
          <Tabs.Screen name="notifications" options={{ href: null }} />
          <Tabs.Screen name="phone-verify" options={{ href: null }} />
          <Tabs.Screen name="family" options={{ href: null }} />
          <Tabs.Screen name="sos-contact" options={{ href: null }} />
          {/* Phase 4 screens */}
          <Tabs.Screen name="lost-report" options={{ href: null }} />
          <Tabs.Screen name="broadcast-confirm" options={{ href: null }} />
          <Tabs.Screen name="alert-detail" options={{ href: null }} />
          <Tabs.Screen name="tag-detail" options={{ href: null }} />
          {/* Phase 5.2 area screens */}
          <Tabs.Screen name="area" options={{ href: null }} />
          <Tabs.Screen name="area-detail" options={{ href: null }} />
          {/* Phase 5 onboarding screens */}
          <Tabs.Screen name="onboard-welcome" options={{ href: null }} />
          <Tabs.Screen name="onboard-group" options={{ href: null }} />
          <Tabs.Screen name="onboard-members" options={{ href: null }} />
          <Tabs.Screen name="onboard-generating" options={{ href: null }} />
          <Tabs.Screen name="onboard-done" options={{ href: null }} />
          {/* Phase 6 screens */}
          <Tabs.Screen name="claim" options={{ href: null }} />
          {/* Save-a-Spot */}
          <Tabs.Screen name="spots" options={{ href: null }} />
        </Tabs>
      </View>
    </ModalProvider>
  );
}

const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 84 : 68;

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: TAB_BAR_HEIGHT,
    borderTopWidth: 0,
    // subtle top border replaced by shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 20,
    backgroundColor: 'transparent',
    paddingBottom: Platform.OS === 'ios' ? 20 : 8,
    paddingTop: 8,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.1,
  },

  // Regular icon + active dot
  iconWrap: {
    alignItems: 'center',
    gap: 3,
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },

  // Centre raised button
  centreTabItem: {
    // Push the item up so the circle rises above the tab bar
    marginTop: -28,
  },
  centreButtonOuter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  centreButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f97316',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#f97316',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 12,
    borderWidth: 3,
    borderColor: '#ffffff',
  },
  centreButtonFocused: {
    backgroundColor: '#ea6c0a',
  },
  centreButtonIcon: {
    color: '#ffffff',
    fontSize: 32,
    lineHeight: 36,
    fontWeight: '300',
    marginTop: -2,
  },
});
