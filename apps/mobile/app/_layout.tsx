import '../global.css';
import * as Sentry from '@sentry/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { useURL } from 'expo-linking';
import { Stack } from 'expo-router';
import { useRouter, useSegments } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, useColorScheme, View } from 'react-native';
import { useFonts } from 'expo-font';
import { Ionicons } from '@expo/vector-icons';
import { ServiceUnavailable } from '@/components/ServiceUnavailable';
import { isServiceUnavailable } from '@/lib/api-error';
import { queryClient } from '@/lib/query-client';
import { storage } from '@/lib/storage';
import { ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, apiClient, setForceLogoutCallback } from '@/services/api';
import { authService } from '@/services/auth.service';
import { familiesService } from '@/services/families.service';
import { useAuthStore } from '@/stores';

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  environment: __DEV__ ? 'development' : 'production',
  enableLogs: true,
  sendDefaultPii: false,
  tracesSampleRate: __DEV__ ? 0 : 0.1,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: __DEV__ ? 0 : 1,
  integrations: [Sentry.mobileReplayIntegration()],
});

const ONBOARDING_DONE_KEY = 'onboarding_done';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function extractQrCode(url: string): string | null {
  const match = url.match(/\/q\/([A-Z0-9-]+)/i);
  return match ? match[1].toUpperCase() : null;
}

function extractGuardianToken(url: string): string | null {
  const match = url.match(/[?&]token=([a-f0-9]{64})/i);
  return match ? match[1] : null;
}

function extractBroadcastId(url: string): string | null {
  const match = url.match(/\/broadcasts\/([0-9a-f-]{36})/i);
  return match ? match[1] : null;
}

function RootNavigator() {
  const router = useRouter();
  const segments = useSegments();
  const colorScheme = useColorScheme();
  const url = useURL();
  const { isAuthenticated, setUser, setTokens, setLoading, clearAuth } = useAuthStore();
  const [sessionRestored, setSessionRestored] = useState(false);
  const [serviceUnavailable, setServiceUnavailable] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  // Holds a QR code extracted from a deep link that arrived before session was restored
  const pendingQrCode = useRef<string | null>(null);
  // Holds a guardian invite token from a deep link
  const pendingGuardianToken = useRef<string | null>(null);

  // Wire up forced logout so the Axios interceptor can clear auth state
  useEffect(() => {
    setForceLogoutCallback(clearAuth);
  }, [clearAuth]);

  const registerPushNotifications = useCallback(async () => {
    if (Platform.OS === 'web') return;
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') return;

      // Backend uses firebase-admin (FCM v1) and APNs directly, so we register
      // the raw native device push token rather than an ExponentPushToken.
      const token = await Notifications.getDevicePushTokenAsync();
      await apiClient.put('/users/me', { fcmToken: token.data });
    } catch {
      // Non-critical — silently ignore push setup failures
    }
  }, []);

  const restoreSession = useCallback(async (isRetry = false) => {
    if (isRetry) setIsRetrying(true);
    else setLoading(true);
    setServiceUnavailable(false);
    try {
      const token = await storage.getItemAsync(ACCESS_TOKEN_KEY);
      if (token) {
        setTokens(token);
        const user = await authService.getProfile();
        setUser(user);
        registerPushNotifications();
      }
    } catch (err) {
      if (isServiceUnavailable(err)) {
        setServiceUnavailable(true);
        // Keep token — user may have valid session; API is just down
      } else {
        await storage.deleteItemAsync(ACCESS_TOKEN_KEY);
        await storage.deleteItemAsync(REFRESH_TOKEN_KEY);
      }
    } finally {
      setLoading(false);
      setIsRetrying(false);
      setSessionRestored(true);
    }
  }, [setLoading, setTokens, setUser, registerPushNotifications]);

  // Restore session from SecureStore on app startup
  useEffect(() => {
    restoreSession(false);
  }, [restoreSession]);

  // Capture QR code from incoming deep link URL
  useEffect(() => {
    if (!url) return;
    const code = extractQrCode(url);
    if (code) {
      pendingQrCode.current = code;
    }
    const guardianToken = extractGuardianToken(url);
    if (guardianToken) {
      pendingGuardianToken.current = guardianToken;
    }
    const broadcastId = extractBroadcastId(url);
    if (broadcastId) {
      router.push({ pathname: '/broadcasts/[id]', params: { id: broadcastId } } as any);
    }
  }, [url, router]);

  // Foreground notification listener
  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener((notification) => {
      const { title, body } = notification.request.content;
      Alert.alert(title ?? 'Notification', body ?? '');
    });
    return () => sub.remove();
  }, []);

  // Tap-to-open listener — navigate to screen specified in notification data
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, string> | undefined;
      if (data?.screen) {
        router.push(data.screen as any);
      }
    });
    return () => sub.remove();
  }, [router]);

  // Don't redirect until session restore is complete (and not showing service unavailable)
  useEffect(() => {
    if (!sessionRestored || serviceUnavailable) return;
    const inAuthGroup = segments[0] === '(auth)';

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/(auth)/login');
      return;
    }

    if (isAuthenticated && inAuthGroup) {
      // Check if onboarding has been completed — if not and user has no family, show onboarding
      storage.getItemAsync(ONBOARDING_DONE_KEY).then(async (done) => {
        if (!done) {
          try {
            const families = await familiesService.list();
            if (families.length === 0) {
              router.replace('/(app)/onboard-welcome' as any);
              return;
            }
          } catch {
            // Network error — skip onboarding check, go to map
          }
          await storage.setItemAsync(ONBOARDING_DONE_KEY, '1');
        }
        router.replace('/(app)/map');
      }).catch(() => router.replace('/(app)/map'));
      return;
    }

    // Handle pending deep link — navigate to QR scanner with the code
    if (isAuthenticated && pendingQrCode.current) {
      const code = pendingQrCode.current;
      pendingQrCode.current = null;
      router.push({ pathname: '/(app)/claim/[code]' as any, params: { code } });
      return;
    }

    // Unauthenticated deep link to QR code — still route to claim (it handles the unauth state)
    if (!isAuthenticated && pendingQrCode.current) {
      const code = pendingQrCode.current;
      pendingQrCode.current = null;
      router.push({ pathname: '/(auth)/login', params: { pendingCode: code } } as any);
      return;
    }

    // Handle pending guardian invite deep link
    if (isAuthenticated && pendingGuardianToken.current) {
      const token = pendingGuardianToken.current;
      pendingGuardianToken.current = null;
      router.push({ pathname: '/(app)/guardian-accept', params: { token } });
    }
  }, [isAuthenticated, segments, sessionRestored, serviceUnavailable, router]);

  // Show loading until session restore completes — prevents flashing login when session exists
  if (!sessionRestored && !serviceUnavailable) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: colorScheme === 'dark' ? '#1a1d27' : '#f9fafb',
        }}
      >
        <ActivityIndicator size="large" color="#f97316" />
      </View>
    );
  }

  if (serviceUnavailable) {
    return (
      <ServiceUnavailable
        onRetry={() => restoreSession(true)}
        isRetrying={isRetrying}
      />
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(app)" />
    </Stack>
  );
}

function RootLayout() {
  const [fontsLoaded] = useFonts({
    ...Ionicons.font,
  });

  if (!fontsLoaded) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <RootNavigator />
    </QueryClientProvider>
  );
}

export default Sentry.wrap(RootLayout);
