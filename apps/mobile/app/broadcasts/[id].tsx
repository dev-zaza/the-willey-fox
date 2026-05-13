import { useEffect, useState } from 'react';
import { View, Text, Image, ScrollView, StyleSheet, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AxiosError } from 'axios';
import { broadcastsService, type BroadcastDetail } from '@/services/broadcasts.service';
import { useAuthStore } from '@/stores';

export default function BroadcastDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [data, setData] = useState<BroadcastDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [expired, setExpired] = useState(false);
  const [messaging, setMessaging] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    broadcastsService
      .getPublic(id)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((err: AxiosError) => {
        if (!cancelled) {
          if (err.response?.status === 410) setExpired(true);
          else setExpired(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function contactFamily() {
    if (!isAuthenticated) {
      Alert.alert('Sign in required', 'Please sign in to contact the family.');
      return;
    }
    if (!id) return;
    setMessaging(true);
    try {
      const { conversationId } = await broadcastsService.messageGuardian(id);
      router.push({ pathname: '/(app)/messages', params: { conversation: conversationId } } as any);
    } catch (err) {
      const msg = err instanceof AxiosError && err.response?.status === 429
        ? 'Too many messages. Try again later.'
        : 'Could not start conversation.';
      Alert.alert('Error', msg);
    } finally {
      setMessaging(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#f97316" />
      </View>
    );
  }

  if (expired || !data) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Alert no longer active</Text>
        <Text style={styles.subtitle}>This broadcast has expired or been resolved.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {data.photoUrl ? (
        <Image source={{ uri: data.photoUrl }} style={styles.photo} />
      ) : (
        <View style={[styles.photo, styles.photoPlaceholder]}>
          <Text style={styles.subtitle}>No photo available</Text>
        </View>
      )}

      <Text style={styles.label}>MISSING PERSON ALERT</Text>
      <Text style={styles.name}>{data.name ?? 'Missing person'}</Text>

      {data.description && <Text style={styles.body}>{data.description}</Text>}

      {data.lastSeenLocation && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Last seen</Text>
          <Text style={styles.body}>{data.lastSeenLocation}</Text>
        </View>
      )}

      {data.lastSeenNotes && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Notes</Text>
          <Text style={styles.body}>{data.lastSeenNotes}</Text>
        </View>
      )}

      <Pressable style={styles.button} onPress={contactFamily} disabled={messaging}>
        <Text style={styles.buttonText}>{messaging ? 'Connecting…' : 'Message the family'}</Text>
      </Pressable>

      <Text style={styles.expiry}>
        Alert expires {new Date(data.broadcastExpiresAt).toLocaleDateString()}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0f172a' },
  center: { flex: 1, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center', padding: 24 },
  content: { padding: 16, paddingBottom: 40 },
  photo: { width: '100%', aspectRatio: 1, borderRadius: 16, backgroundColor: '#1e293b' },
  photoPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  label: { color: '#f87171', fontWeight: '700', fontSize: 11, letterSpacing: 2, marginTop: 16 },
  name: { color: '#fff', fontSize: 28, fontWeight: '700', marginTop: 4 },
  title: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 8 },
  subtitle: { color: '#94a3b8', fontSize: 14 },
  section: { marginTop: 12 },
  sectionLabel: { color: '#64748b', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' },
  body: { color: '#e2e8f0', fontSize: 14, marginTop: 4 },
  button: { backgroundColor: '#f97316', paddingVertical: 12, borderRadius: 12, marginTop: 24, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '600' },
  expiry: { color: '#475569', fontSize: 12, textAlign: 'center', marginTop: 16 },
});
