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
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { authService } from '@/services/auth.service';
import { apiClient } from '@/services/api';
import { extractApiErrorMessage } from '@/lib/api-error';

type Screen = 'main' | 'edit';

export default function ProfileScreen() {
  const { user, logout, setUser } = useAuth();
  const router = useRouter();
  const [screen, setScreen] = useState<Screen>('main');
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [lastName, setLastName] = useState(user?.lastName ?? '');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    authService.getProfile().then(setUser).catch(() => {});
  }, []);

  const initials = user
    ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase() || '?'
    : '?';
  const avatarUrl = (user as any)?.avatarUrl as string | undefined;

  async function pickAndUploadAvatar() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow access to your photo library to upload an avatar.');
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

  if (screen === 'edit') {
    return (
      <KeyboardAvoidingView
        className="flex-1 bg-gray-50 dark:bg-surface"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View className="bg-white dark:bg-surface-card border-b border-gray-200 dark:border-surface-border px-6 pt-14 pb-4 flex-row items-center gap-3">
          <TouchableOpacity onPress={() => setScreen('main')}>
            <Text className="text-brand-500 font-semibold text-sm">← Back</Text>
          </TouchableOpacity>
          <Text className="text-lg font-bold text-gray-900 dark:text-white flex-1 text-center mr-10">Edit Profile</Text>
        </View>

        <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }}>
          <View style={{ gap: 8 }}>
            <Text className="text-sm font-medium text-gray-700 dark:text-slate-300">First Name</Text>
            <TextInput
              className="bg-white dark:bg-surface-card border border-gray-200 dark:border-surface-border rounded-xl px-4 py-3 text-gray-900 dark:text-white text-sm"
              value={firstName}
              onChangeText={setFirstName}
              autoCapitalize="words"
              maxLength={100}
            />
          </View>

          <View style={{ gap: 8 }}>
            <Text className="text-sm font-medium text-gray-700 dark:text-slate-300">Last Name</Text>
            <TextInput
              className="bg-white dark:bg-surface-card border border-gray-200 dark:border-surface-border rounded-xl px-4 py-3 text-gray-900 dark:text-white text-sm"
              value={lastName}
              onChangeText={setLastName}
              autoCapitalize="words"
              maxLength={100}
            />
          </View>

          <View style={{ gap: 8 }}>
            <Text className="text-sm font-medium text-gray-700 dark:text-slate-300">Phone (optional)</Text>
            <TextInput
              className="bg-white dark:bg-surface-card border border-gray-200 dark:border-surface-border rounded-xl px-4 py-3 text-gray-900 dark:text-white text-sm"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              maxLength={20}
              placeholder="+1 234 567 8900"
              placeholderTextColor="#9ca3af"
            />
          </View>

          <TouchableOpacity
            className="bg-brand-500 rounded-2xl py-4 items-center mt-4"
            onPress={saveProfile}
            disabled={saving || !firstName.trim() || !lastName.trim()}
            style={{ opacity: !firstName.trim() || !lastName.trim() ? 0.5 : 1 }}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-bold">Save Changes</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  if (!user) {
    return (
      <View className="flex-1 bg-gray-50 dark:bg-surface items-center justify-center">
        <ActivityIndicator size="large" color="#f97316" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50 dark:bg-surface">
      {/* Header */}
      <View className="bg-white dark:bg-surface-card border-b border-gray-200 dark:border-surface-border px-6 pt-14 pb-4 flex-row items-center gap-3">
        <Image
          source={require('../../assets/logo.png')}
          style={{ width: 28, height: 28, borderRadius: 7 }}
          resizeMode="contain"
        />
        <Text className="text-lg font-bold text-gray-900 dark:text-white flex-1">Profile</Text>
        <TouchableOpacity
          onPress={() => {
            setFirstName(user?.firstName ?? '');
            setLastName(user?.lastName ?? '');
            setPhone('');
            setScreen('edit');
          }}
          className="bg-brand-500/10 border border-brand-500/30 rounded-lg px-3 py-1.5"
        >
          <Text className="text-brand-500 font-semibold text-xs">Edit</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 24, gap: 20 }}>
        {/* Avatar + name */}
        <View className="items-center" style={{ gap: 8 }}>
          <TouchableOpacity onPress={pickAndUploadAvatar} disabled={uploadingAvatar} style={{ position: 'relative' }}>
            {avatarUrl ? (
              <Image
                source={{ uri: avatarUrl }}
                style={{ width: 80, height: 80, borderRadius: 40 }}
              />
            ) : (
              <View className="w-20 h-20 rounded-full bg-brand-500 items-center justify-center">
                <Text className="text-white text-2xl font-bold">{initials}</Text>
              </View>
            )}
            {uploadingAvatar ? (
              <View style={{
                position: 'absolute', inset: 0,
                borderRadius: 40, backgroundColor: 'rgba(0,0,0,0.4)',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <ActivityIndicator color="#fff" size="small" />
              </View>
            ) : (
              <View style={{
                position: 'absolute', bottom: 0, right: 0,
                backgroundColor: '#f97316', borderRadius: 12,
                width: 24, height: 24,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>✎</Text>
              </View>
            )}
          </TouchableOpacity>
          {user && (
            <>
              <Text className="text-xl font-bold text-gray-900 dark:text-white">
                {user.firstName} {user.lastName}
              </Text>
              <Text className="text-sm text-gray-500 dark:text-slate-400">{user.email}</Text>
            </>
          )}
        </View>

        {/* Info card */}
        {user && (
          <View className="bg-white dark:bg-surface-card border border-gray-200 dark:border-surface-border rounded-2xl overflow-hidden">
            <TouchableOpacity
              className="px-4 py-3.5 flex-row justify-between items-center border-b border-gray-100 dark:border-surface-border"
              onPress={() => router.push('/(app)/subscription')}
            >
              <Text className="text-sm text-gray-500 dark:text-slate-400">Plan</Text>
              <View className="flex-row items-center gap-2">
                <Text className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                  {user.subscriptionTier ?? 'Free'}
                </Text>
                <Text className="text-gray-400 dark:text-slate-500 text-sm">›</Text>
              </View>
            </TouchableOpacity>
            <View className="px-4 py-3.5 flex-row justify-between items-center border-b border-gray-100 dark:border-surface-border">
              <Text className="text-sm text-gray-500 dark:text-slate-400">Email Verified</Text>
              <Text className={`text-sm font-medium ${user.isVerified ? 'text-green-500' : 'text-yellow-500'}`}>
                {user.isVerified ? 'Yes' : 'Pending'}
              </Text>
            </View>
            <View className="px-4 py-3.5 flex-row justify-between items-center">
              <Text className="text-sm text-gray-500 dark:text-slate-400">User ID</Text>
              <Text className="text-xs text-gray-400 dark:text-slate-500 font-mono" numberOfLines={1} style={{ maxWidth: 180 }}>
                {user.id}
              </Text>
            </View>
          </View>
        )}

        {/* Sign out */}
        <TouchableOpacity
          className="border border-red-200 dark:border-red-500/40 rounded-xl py-3.5 items-center"
          onPress={logout}
        >
          <Text className="text-red-500 dark:text-red-400 font-semibold text-sm">Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
