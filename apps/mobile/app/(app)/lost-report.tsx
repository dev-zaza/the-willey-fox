import { Ionicons } from '@/components/Icon';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import { extractApiErrorMessage } from '@/lib/api-error';
import { reportsService } from '@/services/reports.service';

// ── Design tokens ─────────────────────────────────────────────────────────────
const T = {
  orange:     '#FF7B14',
  orangeSoft: '#FFE9D6',
  red:        '#E94B4B',
  redSoft:    '#FDECEC',
  purple:     '#6A3FB4',
  purpleSoft: '#F0EBFC',
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

export default function LostReportScreen() {
  const router = useRouter();
  const dark = useColorScheme() === 'dark';
  const params = useLocalSearchParams<{ qrCodeId?: string; tagName?: string }>();

  const [description, setDescription] = useState('');
  const [lastSeenLocation, setLastSeenLocation] = useState('');
  const [contact, setContact] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
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

  async function pickPhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo access to attach an image.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  }

  async function handleSubmit() {
    if (!params.qrCodeId) {
      Alert.alert('Error', 'No QR code selected.');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Description required', 'Please describe the missing person.');
      return;
    }
    if (!contact.trim()) {
      Alert.alert('Contact required', 'Please provide a contact number or email.');
      return;
    }

    setSubmitting(true);
    try {
      const report = await reportsService.createMissingReport({
        qrCodeId: params.qrCodeId,
        description: description.trim(),
        lastSeenLocation: lastSeenLocation.trim() || undefined,
        contact: contact.trim(),
        photoUri: photoUri ?? undefined,
        lat: location?.lat,
        lng: location?.lng,
      });

      router.replace({
        pathname: '/(app)/broadcast-confirm' as any,
        params: { reportId: report.id, tagName: params.tagName },
      });
    } catch (e: any) {
      Alert.alert('Error', extractApiErrorMessage(e, 'Failed to submit report'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: bg(dark) }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={{
        backgroundColor: cardBg(dark),
        borderBottomWidth: 1, borderBottomColor: borderColor(dark),
        paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16,
        flexDirection: 'row', alignItems: 'center', gap: 12,
      }}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={24} color={T.orange} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: textPrimary(dark) }}>Report Missing</Text>
          {params.tagName ? (
            <Text style={{ fontSize: 12, color: textMuted(dark), marginTop: 1 }}>{params.tagName}</Text>
          ) : null}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Alert banner */}
        <View style={{
          backgroundColor: dark ? '#2d1a1a' : T.redSoft,
          borderWidth: 1, borderColor: dark ? '#5c2020' : T.red,
          borderRadius: 14, padding: 14,
          flexDirection: 'row', alignItems: 'flex-start', gap: 10,
        }}>
          <Ionicons name="alert-circle" size={20} color={T.red} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: T.red }}>Missing Person Alert</Text>
            <Text style={{ fontSize: 12, color: dark ? '#fca5a5' : '#b91c1c', lineHeight: 18 }}>
              This will broadcast an alert to TheWileyfox users nearby. For emergencies, also call 999 / 112.
            </Text>
          </View>
        </View>

        {/* Description */}
        <View style={{ gap: 8 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: textPrimary(dark) }}>
            Description <Text style={{ color: T.red }}>*</Text>
          </Text>
          <TextInput
            style={{
              backgroundColor: cardBg(dark),
              borderWidth: 1, borderColor: borderColor(dark),
              borderRadius: 12, padding: 14,
              color: textPrimary(dark), fontSize: 14,
              minHeight: 100, textAlignVertical: 'top',
            }}
            placeholder="Age, height, hair colour, clothing worn, distinguishing features..."
            placeholderTextColor={textMuted(dark)}
            value={description}
            onChangeText={setDescription}
            multiline
          />
        </View>

        {/* Last seen */}
        <View style={{ gap: 8 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: textPrimary(dark) }}>Last Seen Location</Text>
          <TextInput
            style={{
              backgroundColor: cardBg(dark),
              borderWidth: 1, borderColor: borderColor(dark),
              borderRadius: 12, padding: 14,
              color: textPrimary(dark), fontSize: 14,
            }}
            placeholder="e.g. Near Victoria Park, London"
            placeholderTextColor={textMuted(dark)}
            value={lastSeenLocation}
            onChangeText={setLastSeenLocation}
          />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons
              name={location ? 'location' : (locLoading ? 'hourglass' : 'location-outline')}
              size={12}
              color={location ? T.orange : textMuted(dark)}
            />
            <Text style={{ fontSize: 11, color: location ? T.orange : textMuted(dark) }}>
              {locLoading
                ? 'Getting GPS…'
                : location
                  ? `GPS attached (${location.lat.toFixed(4)}, ${location.lng.toFixed(4)})`
                  : 'GPS unavailable — location will not be attached'
              }
            </Text>
          </View>
        </View>

        {/* Your contact */}
        <View style={{ gap: 8 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: textPrimary(dark) }}>
            Your Contact <Text style={{ color: T.red }}>*</Text>
          </Text>
          <TextInput
            style={{
              backgroundColor: cardBg(dark),
              borderWidth: 1, borderColor: borderColor(dark),
              borderRadius: 12, padding: 14,
              color: textPrimary(dark), fontSize: 14,
            }}
            placeholder="Phone number or email"
            placeholderTextColor={textMuted(dark)}
            value={contact}
            onChangeText={setContact}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        {/* Photo */}
        <View style={{ gap: 8 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: textPrimary(dark) }}>Photo (optional)</Text>
          {photoUri ? (
            <View style={{ position: 'relative' }}>
              <Image
                source={{ uri: photoUri }}
                style={{ width: '100%', height: 180, borderRadius: 12 }}
                resizeMode="cover"
              />
              <TouchableOpacity
                onPress={() => setPhotoUri(null)}
                style={{
                  position: 'absolute', top: 8, right: 8,
                  backgroundColor: 'rgba(0,0,0,0.6)',
                  borderRadius: 16, width: 32, height: 32,
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Ionicons name="close" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              onPress={pickPhoto}
              style={{
                backgroundColor: cardBg(dark),
                borderWidth: 1, borderColor: borderColor(dark),
                borderStyle: 'dashed',
                borderRadius: 12, padding: 24,
                alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              <Ionicons name="camera-outline" size={28} color={textMuted(dark)} />
              <Text style={{ fontSize: 13, color: textMuted(dark) }}>Tap to add a photo</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Submit */}
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={submitting}
          style={{
            backgroundColor: T.red,
            borderRadius: 16, paddingVertical: 16,
            alignItems: 'center', justifyContent: 'center',
            flexDirection: 'row', gap: 8,
            marginTop: 8,
            opacity: submitting ? 0.7 : 1,
          }}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name="radio" size={18} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Broadcast Alert</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
