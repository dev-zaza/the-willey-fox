import { Ionicons } from '@/components/Icon';
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
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { authService } from '@/services/auth.service';
import { apiClient } from '@/services/api';
import { extractApiErrorMessage } from '@/lib/api-error';
import { familiesService } from '@/services/families.service';
import { emergencyService, type EmergencyContactRecord } from '@/services/emergency.service';

// ── Mockup design tokens ──────────────────────────────────────────────────────
const T = {
  orange:      '#FF7B14',
  orangeDark:  '#E2620A',
  orangeSoft:  '#FFE9D6',
  sage:        '#AABA9F',
  cream:       '#E5EBD3',
  creamLight:  '#F2F4E5',
  charcoal:    '#232323',
  charcoalSoft:'#3a3a3a',
  mute:        '#8a8a8a',
  line:        '#ECECEC',
  red:         '#E94B4B',
  redSoft:     '#FDECEC',
  purple:      '#6A3FB4',
  green:       '#4CAF7D',
};

// ── Dark overrides ────────────────────────────────────────────────────────────
function bg(dark: boolean) {
  return dark ? '#0f1117' : T.creamLight;
}
function cardBg(dark: boolean) {
  return dark ? '#1a1d27' : '#ffffff';
}
function border(dark: boolean) {
  return dark ? '#2a2f45' : T.line;
}
function textPrimary(dark: boolean) {
  return dark ? '#f1f5f9' : T.charcoal;
}
function textMuted(dark: boolean) {
  return dark ? '#64748b' : T.mute;
}

type Screen = 'main' | 'edit';

// ── Reusable row ─────────────────────────────────────────────────────────────
function Row({
  icon,
  iconBg,
  iconColor,
  label,
  sublabel,
  value,
  valueColor,
  chevron = false,
  onPress,
  dark,
  last = false,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  iconBg?: string;
  iconColor?: string;
  label: string;
  sublabel?: string;
  value?: string;
  valueColor?: string;
  chevron?: boolean;
  onPress?: () => void;
  dark: boolean;
  last?: boolean;
}) {
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
        gap: 12,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: border(dark),
      }}
    >
      {/* Icon circle */}
      <View style={{
        width: 36, height: 36, borderRadius: 10,
        backgroundColor: iconBg ?? (dark ? '#1e2236' : T.creamLight),
        alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Ionicons name={icon} size={18} color={iconColor ?? T.orange} />
      </View>

      {/* Label */}
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: '500', color: textPrimary(dark) }}>{label}</Text>
        {sublabel ? (
          <Text style={{ fontSize: 11, color: textMuted(dark), marginTop: 2 }}>{sublabel}</Text>
        ) : null}
      </View>

      {/* Value */}
      {value ? (
        <Text style={{ fontSize: 13, color: valueColor ?? textMuted(dark), fontWeight: valueColor ? '600' : '400' }}>
          {value}
        </Text>
      ) : null}

      {/* Chevron */}
      {chevron ? (
        <Text style={{ color: textMuted(dark), fontSize: 16, marginLeft: -4 }}>›</Text>
      ) : null}
    </Wrapper>
  );
}

// ── Section label ─────────────────────────────────────────────────────────────
function SectionTitle({ label, dark }: { label: string; dark: boolean }) {
  return (
    <Text style={{
      fontSize: 11,
      letterSpacing: 1,
      textTransform: 'uppercase',
      color: textMuted(dark),
      fontWeight: '700',
      marginHorizontal: 24,
      marginTop: 18,
      marginBottom: 4,
    }}>
      {label}
    </Text>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ProfileScreen() {
  const { user, logout, setUser } = useAuth();
  const router = useRouter();
  const dark = useColorScheme() === 'dark';
  const [screen, setScreen] = useState<Screen>('main');
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [lastName, setLastName] = useState(user?.lastName ?? '');
  const [phone, setPhone] = useState('');
  const [familyMemberCount, setFamilyMemberCount] = useState<number | null>(null);
  const [primarySosContact, setPrimarySosContact] = useState<EmergencyContactRecord | null>(null);
  const [sosLoaded, setSosLoaded] = useState(false);

  useEffect(() => {
    authService.getProfile().then(setUser).catch(() => {});

    familiesService.list().then(async (memberships) => {
      if (memberships.length > 0) {
        const detail = await familiesService.get(memberships[0].familyId);
        setFamilyMemberCount(detail.members.length);
      } else {
        setFamilyMemberCount(0);
      }
    }).catch(() => {});

    emergencyService.listContacts().then((contacts) => {
      const primary = contacts.find((c) => c.isPrimarySos && c.status === 'accepted' && c.contact);
      setPrimarySosContact(primary ?? null);
    }).catch(() => {}).finally(() => setSosLoaded(true));
  }, []);

  const initials = user
    ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase() || '?'
    : '?';
  const avatarUrl = (user as any)?.avatarUrl as string | undefined;

  async function pickAndUploadAvatar() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow access to your photo library.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('file', {
        uri: asset.uri,
        type: asset.mimeType ?? 'image/jpeg',
        name: `avatar_${Date.now()}.jpg`,
      } as any);
      const { data } = await apiClient.post('/users/me/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUser({ ...user!, avatarUrl: data.avatarUrl } as any);
    } catch (e: any) {
      Alert.alert('Upload failed', extractApiErrorMessage(e, 'Could not upload photo'));
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function saveProfile() {
    setSaving(true);
    try {
      const { data } = await apiClient.put('/users/me', {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim() || undefined,
      });
      setUser(data);
      setScreen('main');
    } catch (e: any) {
      Alert.alert('Error', extractApiErrorMessage(e, 'Failed to save'));
    } finally {
      setSaving(false);
    }
  }

  // ── Edit screen ──────────────────────────────────────────────────────────────
  if (screen === 'edit') {
    return (
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: bg(dark) }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={{
          backgroundColor: cardBg(dark),
          borderBottomWidth: 1, borderBottomColor: border(dark),
          paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16,
          flexDirection: 'row', alignItems: 'center', gap: 12,
        }}>
          <TouchableOpacity
            onPress={() => setScreen('main')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={{
              width: 32, height: 32, borderRadius: 16,
              backgroundColor: dark ? '#1e2236' : T.creamLight,
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Ionicons name="chevron-back" size={20} color={dark ? '#f1f5f9' : T.charcoal} />
          </TouchableOpacity>
          <Text style={{ flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: textPrimary(dark) }}>
            Edit Profile
          </Text>
          <View style={{ width: 32 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }}>
          {[
            { label: 'First Name', value: firstName, setter: setFirstName, autoCapitalize: 'words' as const },
            { label: 'Last Name', value: lastName, setter: setLastName, autoCapitalize: 'words' as const },
          ].map(({ label, value, setter, autoCapitalize }) => (
            <View key={label} style={{ gap: 6 }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: textMuted(dark), textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {label}
              </Text>
              <TextInput
                style={{
                  backgroundColor: cardBg(dark),
                  borderWidth: 1, borderColor: border(dark),
                  borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
                  color: textPrimary(dark), fontSize: 15,
                }}
                value={value}
                onChangeText={setter}
                autoCapitalize={autoCapitalize}
                maxLength={100}
              />
            </View>
          ))}

          <View style={{ gap: 6 }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: textMuted(dark), textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Phone (optional)
            </Text>
            <TextInput
              style={{
                backgroundColor: cardBg(dark),
                borderWidth: 1, borderColor: border(dark),
                borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
                color: textPrimary(dark), fontSize: 15,
              }}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              maxLength={20}
              placeholder="+1 234 567 8900"
              placeholderTextColor={textMuted(dark)}
            />
          </View>

          <TouchableOpacity
            onPress={saveProfile}
            disabled={saving || !firstName.trim() || !lastName.trim()}
            style={{
              backgroundColor: T.orange,
              borderRadius: 14, paddingVertical: 15,
              alignItems: 'center', marginTop: 8,
              opacity: !firstName.trim() || !lastName.trim() ? 0.5 : 1,
            }}
          >
            {saving
              ? <ActivityIndicator color="#fff" />
              : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Save Changes</Text>
            }
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── Loading state ────────────────────────────────────────────────────────────
  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: bg(dark), alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={T.orange} />
      </View>
    );
  }

  // ── Main profile screen ──────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: bg(dark) }}>
      {/* Header */}
      <View style={{
        backgroundColor: cardBg(dark),
        borderBottomWidth: 1, borderBottomColor: border(dark),
        paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16,
        flexDirection: 'row', alignItems: 'center', gap: 12,
      }}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={{
            width: 32, height: 32, borderRadius: 16,
            backgroundColor: dark ? '#1e2236' : T.creamLight,
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Ionicons name="chevron-back" size={20} color={dark ? '#f1f5f9' : T.charcoal} />
        </TouchableOpacity>

        <Text style={{ flex: 1, fontSize: 22, fontWeight: '700', color: textPrimary(dark) }}>
          Profile
        </Text>

        <TouchableOpacity
          onPress={() => {
            setFirstName(user.firstName ?? '');
            setLastName(user.lastName ?? '');
            setPhone('');
            setScreen('edit');
          }}
          style={{
            paddingHorizontal: 14, paddingVertical: 8,
            backgroundColor: T.orangeSoft,
            borderRadius: 10,
          }}
        >
          <Text style={{ color: T.orangeDark, fontWeight: '600', fontSize: 13 }}>Edit</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Avatar card */}
        <View style={{ alignItems: 'center', paddingVertical: 28, paddingHorizontal: 20 }}>
          <TouchableOpacity onPress={pickAndUploadAvatar} disabled={uploadingAvatar} style={{ position: 'relative' }}>
            {avatarUrl ? (
              <Image
                source={{ uri: avatarUrl }}
                style={{ width: 108, height: 108, borderRadius: 54 }}
              />
            ) : (
              <View style={{
                width: 108, height: 108, borderRadius: 54,
                backgroundColor: T.purple,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Text style={{ color: '#fff', fontSize: 46, fontWeight: '700' }}>{initials}</Text>
              </View>
            )}

            {/* Pen badge */}
            {uploadingAvatar ? (
              <View style={{
                position: 'absolute', bottom: 4, right: 4,
                width: 30, height: 30, borderRadius: 15,
                backgroundColor: T.orange,
                borderWidth: 2, borderColor: '#fff',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <ActivityIndicator color="#fff" size="small" />
              </View>
            ) : (
              <View style={{
                position: 'absolute', bottom: 4, right: 4,
                width: 30, height: 30, borderRadius: 15,
                backgroundColor: T.orange,
                borderWidth: 2, borderColor: dark ? cardBg(dark) : '#fff',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Ionicons name="pencil" size={14} color="#fff" />
              </View>
            )}
          </TouchableOpacity>

          <Text style={{
            fontSize: 22, fontWeight: '700', color: textPrimary(dark),
            marginTop: 16, marginBottom: 2,
          }}>
            {user.firstName} {user.lastName}
          </Text>
          <Text style={{ fontSize: 13, color: textMuted(dark) }}>{user.email}</Text>
        </View>

        {/* Safety Network section */}
        <SectionTitle label="Safety Network" dark={dark} />
        <View style={{
          marginHorizontal: 16,
          backgroundColor: cardBg(dark),
          borderWidth: 1, borderColor: border(dark),
          borderRadius: 14, overflow: 'hidden',
        }}>
          <Row
            dark={dark}
            icon="people"
            label="Family Group"
            sublabel={
              familyMemberCount === null
                ? 'Loading…'
                : familyMemberCount === 0
                  ? 'No family group yet'
                  : `${familyMemberCount} ${familyMemberCount === 1 ? 'member' : 'members'}`
            }
            value={familyMemberCount && familyMemberCount > 0 ? 'Active' : undefined}
            valueColor={T.green}
            chevron
            onPress={() => router.push('/(app)/family')}
          />
          <Row
            dark={dark}
            icon="call"
            iconBg={dark ? '#2d1a1a' : T.redSoft}
            iconColor={T.red}
            label="SOS Contact"
            sublabel={
              !sosLoaded
                ? 'Loading…'
                : primarySosContact
                  ? `${primarySosContact.contact!.firstName} ${primarySosContact.contact!.lastName}`
                  : 'No primary SOS contact'
            }
            chevron
            last
            onPress={() => router.push('/(app)/sos-contact')}
          />
        </View>

        {/* Saved Spots section */}
        <SectionTitle label="Explore" dark={dark} />
        <View style={{
          marginHorizontal: 16,
          backgroundColor: cardBg(dark),
          borderWidth: 1, borderColor: border(dark),
          borderRadius: 14, overflow: 'hidden',
        }}>
          <Row
            dark={dark}
            icon="bookmark"
            iconBg={dark ? '#1e1a2e' : '#ede9fe'}
            iconColor="#8b5cf6"
            label="Saved Spots"
            sublabel="Your saved locations"
            chevron
            last
            onPress={() => router.push('/(app)/spots' as any)}
          />
        </View>

        {/* Account section */}
        <SectionTitle label="Account" dark={dark} />
        <View style={{
          marginHorizontal: 16,
          backgroundColor: cardBg(dark),
          borderWidth: 1, borderColor: border(dark),
          borderRadius: 14, overflow: 'hidden',
        }}>
          <Row
            dark={dark}
            icon="call-outline"
            label="Phone Number"
            sublabel={(user as any).phoneVerifiedAt ? 'Verified' : (user as any).phone ? 'Tap to verify' : undefined}
            value={(user as any).phone ?? 'Add'}
            valueColor={(user as any).phoneVerifiedAt ? T.green : (user as any).phone ? T.orangeDark : T.orangeDark}
            chevron
            onPress={() => router.push('/(app)/phone-verify')}
          />
          <Row
            dark={dark}
            icon="layers-outline"
            label="Plan"
            value={user.subscriptionTier ? user.subscriptionTier.charAt(0).toUpperCase() + user.subscriptionTier.slice(1) : 'Free'}
            chevron
            onPress={() => router.push('/(app)/subscription')}
          />
          <Row
            dark={dark}
            icon="checkmark-circle-outline"
            label="Email Verified"
            value={user.isVerified ? 'Yes' : 'Pending'}
            valueColor={user.isVerified ? T.green : T.orangeDark}
          />
          <Row
            dark={dark}
            icon="person-outline"
            label="User ID"
            value={`${user.id.slice(0, 8)}…`}
            last
          />
        </View>

        {/* Sign out */}
        <TouchableOpacity
          onPress={logout}
          style={{
            marginHorizontal: 16, marginTop: 18, marginBottom: 24,
            paddingVertical: 14,
            backgroundColor: 'transparent',
            borderWidth: 1.5, borderColor: dark ? '#4d1f1f' : T.redSoft,
            borderRadius: 14,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: T.red, fontWeight: '600', fontSize: 14 }}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
