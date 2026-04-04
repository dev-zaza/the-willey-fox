import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import { pinsService } from '@/services/pins.service';

const PIN_TYPES = [
  { id: 'traffic', label: 'Traffic', emoji: '🚗' },
  { id: 'construction', label: 'Construction', emoji: '🚧' },
  { id: 'event', label: 'Event', emoji: '📅' },
  { id: 'safety', label: 'Safety', emoji: '⚠️' },
  { id: 'recommendation', label: 'Recommend', emoji: '👍' },
] as const;

type PinType = (typeof PIN_TYPES)[number]['id'];

export default function AddPinScreen() {
  const router = useRouter();
  const scheme = useColorScheme();
  const dark = scheme === 'dark';

  const [type, setType] = useState<PinType>('traffic');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locLoading, setLocLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      setLocLoading(true);
      try {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      } catch {
        // silently ignore
      } finally {
        setLocLoading(false);
      }
    })();
  }, []);

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('Title required', 'Please enter a title for your pin.');
      return;
    }
    if (!location) {
      Alert.alert('Location needed', 'Unable to get your location. Please try again.');
      return;
    }
    setSubmitting(true);
    try {
      await pinsService.create({
        type,
        title: title.trim(),
        description: description.trim() || undefined,
        lat: location.lat,
        lng: location.lng,
      });
      router.replace('/(app)/map');
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? 'Failed to create pin.';
      Alert.alert('Error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const bg = dark ? '#1a1d27' : '#f9fafb';
  const cardBg = dark ? '#252836' : '#ffffff';
  const border = dark ? '#2a2f45' : '#e5e7eb';
  const textPrimary = dark ? '#f1f5f9' : '#111827';
  const textSecondary = dark ? '#94a3b8' : '#6b7280';
  const inputBg = dark ? '#1a1d27' : '#f9fafb';

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 60 }}>
        <Text style={{ fontSize: 22, fontWeight: '700', color: textPrimary, marginBottom: 20 }}>
          Add a Pin
        </Text>

        {/* Pin type selector */}
        <Text style={{ fontSize: 13, fontWeight: '600', color: textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Type
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
          {PIN_TYPES.map((pt) => (
            <TouchableOpacity
              key={pt.id}
              onPress={() => setType(pt.id)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 20,
                marginRight: 8,
                backgroundColor: type === pt.id ? '#f97316' : cardBg,
                borderWidth: 1,
                borderColor: type === pt.id ? '#f97316' : border,
              }}
            >
              <Text style={{ fontSize: 16 }}>{pt.emoji}</Text>
              <Text style={{
                fontSize: 13,
                fontWeight: '600',
                color: type === pt.id ? '#fff' : textPrimary,
              }}>
                {pt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Title */}
        <Text style={{ fontSize: 13, fontWeight: '600', color: textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Title *
        </Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Brief description of the situation"
          placeholderTextColor={textSecondary}
          maxLength={120}
          style={{
            backgroundColor: inputBg,
            borderWidth: 1,
            borderColor: border,
            borderRadius: 10,
            padding: 12,
            fontSize: 15,
            color: textPrimary,
            marginBottom: 16,
          }}
        />

        {/* Description */}
        <Text style={{ fontSize: 13, fontWeight: '600', color: textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Details (optional)
        </Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="Additional details…"
          placeholderTextColor={textSecondary}
          multiline
          numberOfLines={3}
          maxLength={500}
          style={{
            backgroundColor: inputBg,
            borderWidth: 1,
            borderColor: border,
            borderRadius: 10,
            padding: 12,
            fontSize: 15,
            color: textPrimary,
            minHeight: 80,
            textAlignVertical: 'top',
            marginBottom: 16,
          }}
        />

        {/* Location status */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          padding: 12,
          backgroundColor: cardBg,
          borderWidth: 1,
          borderColor: border,
          borderRadius: 10,
          marginBottom: 24,
        }}>
          <Text style={{ fontSize: 16 }}>{location ? '📍' : locLoading ? '⏳' : '⚠️'}</Text>
          <Text style={{ fontSize: 14, color: textSecondary, flex: 1 }}>
            {location
              ? `GPS: ${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`
              : locLoading
              ? 'Getting your location…'
              : 'Location unavailable'}
          </Text>
        </View>

        <TouchableOpacity
          onPress={handleSubmit}
          disabled={submitting || !location}
          style={{
            backgroundColor: submitting || !location ? '#94a3b8' : '#f97316',
            borderRadius: 12,
            padding: 16,
            alignItems: 'center',
            marginBottom: 12,
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
            {submitting ? 'Adding Pin…' : 'Add Pin'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.back()}
          style={{ alignItems: 'center', padding: 12 }}
        >
          <Text style={{ color: textSecondary, fontSize: 14 }}>Cancel</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
