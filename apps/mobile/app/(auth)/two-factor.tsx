import { Ionicons } from '@/components/Icon';
import { useState, useRef } from 'react';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { storage } from '@/lib/storage';
import { ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, apiClient } from '@/services/api';
import { useAuthStore } from '@/stores';
import { extractApiErrorMessage } from '@/lib/api-error';

export default function TwoFactorScreen() {
  const router = useRouter();
  const { setUser, setTokens } = useAuthStore();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<TextInput>(null);

  // mfaToken stored temporarily in auth store
  const mfaToken = (useAuthStore.getState() as any).mfaToken ?? '';

  const handleVerify = async () => {
    if (code.length !== 6) return;
    setError('');
    setLoading(true);
    try {
      const { data } = await apiClient.post('/auth/2fa/confirm', { mfaToken, code });
      await storage.setItemAsync(ACCESS_TOKEN_KEY, data.accessToken);
      await storage.setItemAsync(REFRESH_TOKEN_KEY, data.refreshToken);
      setTokens(data.accessToken);
      setUser(data.user);
      // Clear mfaToken from store
      (useAuthStore.setState as any)({ mfaToken: null });
      router.replace('/(app)/map');
    } catch (e: any) {
      setError(extractApiErrorMessage(e, 'Invalid code. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-gray-50 dark:bg-surface justify-center px-6"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View className="items-center mb-8">
        <View className="w-16 h-16 rounded-2xl bg-brand-500/10 border border-brand-500/20 items-center justify-center mb-4">
          <Ionicons name="lock-closed" size={30} color="#6366f1" />
        </View>
        <Text className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
          Two-Factor Auth
        </Text>
        <Text className="text-sm text-gray-500 dark:text-slate-400 text-center">
          Enter the 6-digit code from your authenticator app
        </Text>
      </View>

      <View className="bg-white dark:bg-surface-card border border-gray-200 dark:border-surface-border rounded-2xl p-6 gap-4">
        <TextInput
          ref={inputRef}
          className="bg-gray-50 dark:bg-surface-elevated border border-gray-200 dark:border-surface-border rounded-xl px-4 py-4 text-gray-900 dark:text-white text-center text-2xl font-mono tracking-widest"
          placeholder="000000"
          placeholderTextColor="#9ca3af"
          keyboardType="number-pad"
          maxLength={6}
          value={code}
          onChangeText={(t) => setCode(t.replace(/\D/g, ''))}
          autoFocus
        />

        {error ? (
          <View className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl px-4 py-3">
            <Text className="text-red-600 dark:text-red-400 text-sm text-center">{error}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          className={`bg-brand-500 rounded-xl py-3.5 items-center ${loading || code.length !== 6 ? 'opacity-60' : ''}`}
          onPress={handleVerify}
          disabled={loading || code.length !== 6}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-semibold">Verify</Text>
          )}
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        className="mt-6"
        onPress={() => {
          (useAuthStore.setState as any)({ mfaToken: null });
          router.replace('/(auth)/login');
        }}
      >
        <Text className="text-center text-gray-500 dark:text-slate-500 text-sm">
          ← Back to sign in
        </Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}
