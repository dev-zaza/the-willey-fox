import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Controller } from '@/components/shims';
import { useForm } from 'react-hook-form';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { z } from 'zod';
import { ServiceUnavailable } from '@/components/ServiceUnavailable';
import { useAuth } from '@/hooks/useAuth';
import { storage } from '@/lib/storage';
import { ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, apiClient } from '@/services/api';
import { useAuthStore } from '@/stores';

WebBrowser.maybeCompleteAuthSession();

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3002/api/v1';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginScreen() {
  const router = useRouter();
  const { login, isLoading } = useAuth();
  const { setUser, setTokens } = useAuthStore();
  const [serverError, setServerError] = useState<string | null>(null);
  const [serviceUnavailable, setServiceUnavailable] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);


  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormValues) => {
    setServerError(null);
    setServiceUnavailable(false);
    const result = await login(data.email, data.password);
    if (result) {
      if (result.isServiceUnavailable) {
        setServiceUnavailable(true);
      } else {
        setServerError(result.message);
      }
      return;
    }
    // Check if 2FA is required
    const { mfaToken } = useAuthStore.getState();
    if (mfaToken) {
      router.push('/(auth)/two-factor' as any);
    }
  };

  const handleGoogleLogin = async () => {
    setOauthLoading(true);
    try {
      // Open the backend's Google OAuth flow in the system browser.
      // Pass state=mobile so the backend redirects to thewileyfox:// instead of the web app.
      // WebBrowser.openAuthSessionAsync intercepts that deep link and returns it here.
      const backendBase = API_URL.replace('/api/v1', '');
      // Linking.createURL generates the correct scheme for the current environment:
      //   Expo Go dev  → exp://192.168.x.x:8081/--/auth/oauth-callback
      //   Standalone   → thewileyfox://auth/oauth-callback
      // We send it to the backend so it redirects to exactly this URL.
      const callbackUrl = Linking.createURL('auth/oauth-callback');
      const initUrl = `${backendBase}/api/v1/auth/google/mobile-init?redirectUri=${encodeURIComponent(callbackUrl)}`;
      const result = await WebBrowser.openAuthSessionAsync(initUrl, callbackUrl);

      if (result.type !== 'success' || !result.url) {
        if (result.type !== 'cancel' && result.type !== 'dismiss') {
          setServerError('Google sign-in was cancelled.');
        }
        return;
      }

      // Extract the one-time code from the redirect URL
      const { queryParams } = Linking.parse(result.url);
      const code = queryParams?.code as string | undefined;

      if (!code) {
        setServerError('Google sign-in failed. Please try again.');
        return;
      }

      // Exchange the one-time code for app tokens
      const { data } = await apiClient.post('/auth/oauth-exchange', { code });

      await storage.setItemAsync(ACCESS_TOKEN_KEY, data.accessToken);
      await storage.setItemAsync(REFRESH_TOKEN_KEY, data.refreshToken);
      setTokens(data.accessToken);
      setUser(data.user);
    } catch (e: any) {
      setServerError('Google sign-in failed. Please try again.');
    } finally {
      setOauthLoading(false);
    }
  };

  const handleRetry = () => {
    setServiceUnavailable(false);
    handleSubmit(onSubmit)();
  };

  if (serviceUnavailable) {
    return (
      <ServiceUnavailable
        onRetry={handleRetry}
        isRetrying={isLoading}
      />
    );
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-gray-50 dark:bg-surface justify-center px-6"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Logo + heading */}
      <View className="items-center mb-8">
        <Image
          source={require('../../assets/logo.png')}
          style={{ width: 56, height: 56, borderRadius: 14, marginBottom: 16 }}
          resizeMode="contain"
        />
        <Text className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Welcome back</Text>
        <Text className="text-sm text-gray-500 dark:text-slate-400">Sign in to your Wileyfox account</Text>
      </View>

      {/* Card */}
      <View className="bg-white dark:bg-surface-card border border-gray-200 dark:border-surface-border rounded-2xl p-6 gap-4">

        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, onBlur, value } }: { field: { onChange: any; onBlur: any; value: any } }) => (
            <View className="gap-1.5">
              <Text className="text-sm font-medium text-gray-700 dark:text-slate-300">Email address</Text>
              <TextInput
                className={`bg-gray-50 dark:bg-surface-elevated border rounded-xl px-4 py-3 text-gray-900 dark:text-white text-sm ${
                  errors.email ? 'border-red-500' : 'border-gray-200 dark:border-surface-border'
                }`}
                placeholder="you@example.com"
                placeholderTextColor="#9ca3af"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
              />
              {errors.email && (
                <Text className="text-xs text-red-500">{errors.email.message}</Text>
              )}
            </View>
          )}
        />

        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, onBlur, value } }: { field: { onChange: any; onBlur: any; value: any } }) => (
            <View className="gap-1.5">
              <Text className="text-sm font-medium text-gray-700 dark:text-slate-300">Password</Text>
              <TextInput
                className={`bg-gray-50 dark:bg-surface-elevated border rounded-xl px-4 py-3 text-gray-900 dark:text-white text-sm ${
                  errors.password ? 'border-red-500' : 'border-gray-200 dark:border-surface-border'
                }`}
                placeholder="••••••••"
                placeholderTextColor="#9ca3af"
                secureTextEntry
                autoComplete="current-password"
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
              />
              {errors.password && (
                <Text className="text-xs text-red-500">{errors.password.message}</Text>
              )}
            </View>
          )}
        />

        {serverError && (
          <View className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl px-4 py-3">
            <Text className="text-red-600 dark:text-red-400 text-sm">{serverError}</Text>
          </View>
        )}

        <TouchableOpacity
          className={`bg-brand-500 rounded-xl py-3 items-center mt-1 ${isLoading ? 'opacity-60' : ''}`}
          onPress={handleSubmit(onSubmit)}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-semibold text-sm">Sign In</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Divider */}
      <View className="flex-row items-center mt-4 gap-3">
        <View className="flex-1 h-px bg-gray-200 dark:bg-surface-border" />
        <Text className="text-gray-400 dark:text-slate-500 text-xs">or continue with</Text>
        <View className="flex-1 h-px bg-gray-200 dark:bg-surface-border" />
      </View>

      {/* Google OAuth */}
      <TouchableOpacity
        className="flex-row items-center justify-center gap-3 bg-white dark:bg-surface-card border border-gray-200 dark:border-surface-border rounded-xl py-3 mt-3"
        onPress={handleGoogleLogin}
        disabled={oauthLoading}
        style={{ opacity: oauthLoading ? 0.6 : 1 }}
      >
        {oauthLoading ? (
          <ActivityIndicator color="#6366f1" size="small" />
        ) : (
          <>
            <View style={{ width: 20, height: 20 }}>
              {/* Google G icon using colored squares */}
            </View>
            <Text className="text-gray-700 dark:text-slate-300 font-semibold text-sm">Sign in with Google</Text>
          </>
        )}
      </TouchableOpacity>

      {/* Switch link */}
      <TouchableOpacity className="mt-6" onPress={() => router.push('/(auth)/signup')}>
        <Text className="text-center text-gray-500 dark:text-slate-500 text-sm">
          Don&apos;t have an account?{' '}
          <Text className="text-brand-500 font-semibold">Sign up free</Text>
        </Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}
