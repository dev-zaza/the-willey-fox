import { Ionicons } from '@/components/Icon';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, useColorScheme, View } from 'react-native';
import { guardiansService } from '@/services/guardians.service';
import { extractApiErrorMessage } from '@/lib/api-error';

export default function GuardianAcceptScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const router = useRouter();
  const scheme = useColorScheme();
  const dark = scheme === 'dark';

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setErrorMsg('Invalid guardian invite link.');
      return;
    }

    guardiansService
      .acceptInvite(token)
      .then(() => setStatus('success'))
      .catch((err: any) => {
        const code: string = extractApiErrorMessage(err, 'Unknown error');
        if (code === 'INVITE_EXPIRED') {
          setErrorMsg('This invite has expired. Ask the owner to send a new one.');
        } else if (code === 'INVITE_ALREADY_USED') {
          setErrorMsg('This invite has already been used.');
        } else if (code === 'OWNER_CANNOT_BE_GUARDIAN') {
          setErrorMsg('You cannot be a guardian of your own QR code.');
        } else {
          setErrorMsg(code);
        }
        setStatus('error');
      });
  }, [token]);

  const bg = dark ? '#1a1d27' : '#f9fafb';
  const cardBg = dark ? '#252836' : '#ffffff';
  const textPrimary = dark ? '#f1f5f9' : '#111827';
  const textSecondary = dark ? '#94a3b8' : '#6b7280';

  return (
    <View style={{ flex: 1, backgroundColor: bg, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
      <View style={{
        backgroundColor: cardBg,
        borderRadius: 20,
        padding: 32,
        alignItems: 'center',
        width: '100%',
        maxWidth: 360,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
        elevation: 6,
      }}>
        {status === 'loading' && (
          <>
            <ActivityIndicator size="large" color="#f97316" style={{ marginBottom: 16 }} />
            <Text style={{ color: textSecondary, fontSize: 15 }}>Accepting invite…</Text>
          </>
        )}

        {status === 'success' && (
          <>
            <View style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: '#f97316',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 20,
            }}>
              <Ionicons name="checkmark-circle" size={32} color="#fff" />
            </View>
            <Text style={{ fontSize: 20, fontWeight: '700', color: textPrimary, marginBottom: 8 }}>
              You're a Guardian!
            </Text>
            <Text style={{ fontSize: 15, color: textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 24 }}>
              You've been added as a guardian. You'll be notified if the item is found.
            </Text>
            <TouchableOpacity
              onPress={() => router.replace('/(app)/map')}
              style={{
                backgroundColor: '#f97316',
                borderRadius: 12,
                paddingVertical: 14,
                paddingHorizontal: 32,
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Go to Map</Text>
            </TouchableOpacity>
          </>
        )}

        {status === 'error' && (
          <>
            <View style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: '#ef4444',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 20,
            }}>
              <Ionicons name="close" size={32} color="#fff" />
            </View>
            <Text style={{ fontSize: 20, fontWeight: '700', color: textPrimary, marginBottom: 8 }}>
              Invite Failed
            </Text>
            <Text style={{ fontSize: 15, color: textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 24 }}>
              {errorMsg || 'Unable to accept this guardian invite.'}
            </Text>
            <TouchableOpacity
              onPress={() => router.replace('/(app)/map')}
              style={{
                backgroundColor: '#f97316',
                borderRadius: 12,
                paddingVertical: 14,
                paddingHorizontal: 32,
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Go to Map</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}
