import { Ionicons } from '@/components/Icon';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import { emergencyService, type EmergencyContactRecord } from '@/services/emergency.service';
import { usersService, type UserSearchResult } from '@/services/users.service';
import { extractApiErrorMessage } from '@/lib/api-error';

type Screen = 'main' | 'add';

export default function EmergencyScreen() {
  const [contacts, setContacts] = useState<EmergencyContactRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState<Screen>('main');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [sosLoading, setSosLoading] = useState(false);

  useEffect(() => {
    emergencyService
      .listContacts()
      .then(setContacts)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function search() {
    if (searchQuery.trim().length < 2) return;
    setSearching(true);
    setHasSearched(true);
    try {
      const results = await usersService.search(searchQuery.trim());
      setSearchResults(results);
    } finally {
      setSearching(false);
    }
  }

  async function addContact(userId: string) {
    setAddLoading(true);
    try {
      const contact = await emergencyService.addContact({ contactUserId: userId });
      setContacts((prev) => [contact, ...prev]);
      setSearchQuery('');
      setSearchResults([]);
      setScreen('main');
    } catch (e: any) {
      Alert.alert('Error', extractApiErrorMessage(e, 'Failed to add contact'));
    } finally {
      setAddLoading(false);
    }
  }

  async function acceptContact(contactId: string) {
    try {
      const updated = await emergencyService.acceptContact(contactId);
      setContacts((prev) => prev.map((c) => (c.id === contactId ? updated : c)));
    } catch (e: any) {
      Alert.alert('Error', extractApiErrorMessage(e, 'Failed to accept contact'));
    }
  }

  async function declineContact(contactId: string) {
    try {
      const updated = await emergencyService.declineContact(contactId);
      setContacts((prev) => prev.map((c) => (c.id === contactId ? updated : c)));
    } catch (e: any) {
      Alert.alert('Error', extractApiErrorMessage(e, 'Failed to decline contact'));
    }
  }

  async function removeContact(contactId: string) {
    Alert.alert('Remove Contact', 'Remove this emergency contact?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await emergencyService.removeContact(contactId);
            setContacts((prev) => prev.filter((c) => c.id !== contactId));
          } catch (e: any) {
            Alert.alert('Error', extractApiErrorMessage(e, 'Failed to remove contact'));
          }
        },
      },
    ]);
  }

  async function triggerSos() {
    const acceptedCount = contacts.filter((c) => c.status === 'accepted').length;
    if (acceptedCount === 0) {
      Alert.alert('No Contacts', 'Add accepted emergency contacts before sending an SOS.');
      return;
    }

    Alert.alert(
      '🆘 Send SOS Alert',
      `This will immediately alert ${acceptedCount} emergency contact${acceptedCount !== 1 ? 's' : ''} with your location. Continue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send SOS',
          style: 'destructive',
          onPress: async () => {
            setSosLoading(true);
            try {
              let lat: number | undefined;
              let lng: number | undefined;

              const { status } = await Location.requestForegroundPermissionsAsync();
              if (status === 'granted') {
                const loc = await Location.getCurrentPositionAsync({
                  accuracy: Location.Accuracy.High,
                });
                lat = loc.coords.latitude;
                lng = loc.coords.longitude;
              }

              const result = await emergencyService.triggerSos({ lat, lng });
              Alert.alert(
                '✅ SOS Sent',
                `Alert sent to ${result.notifiedCount} contact${result.notifiedCount !== 1 ? 's' : ''}. Help is on the way.`,
              );
            } catch (e: any) {
              Alert.alert('Error', extractApiErrorMessage(e, 'Failed to send SOS'));
            } finally {
              setSosLoading(false);
            }
          },
        },
      ],
    );
  }

  if (screen === 'add') {
    return (
      <KeyboardAvoidingView
        className="flex-1 bg-gray-50 dark:bg-surface"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View className="bg-white dark:bg-surface-card border-b border-gray-200 dark:border-surface-border px-6 pt-14 pb-4 flex-row items-center gap-3">
          <TouchableOpacity onPress={() => { setScreen('main'); setSearchQuery(''); setSearchResults([]); setHasSearched(false); }}>
            <Text className="text-brand-500 font-semibold text-sm">← Back</Text>
          </TouchableOpacity>
          <Text className="text-lg font-bold text-gray-900 dark:text-white flex-1 text-center mr-10">Add Contact</Text>
        </View>
        <View className="flex-1 p-6" style={{ gap: 16 }}>
          <Text className="text-sm text-gray-600 dark:text-slate-400 leading-5">
            Search by email or name. The person must have a SafeTag account. They will receive a request to accept.
          </Text>
          <View style={{ gap: 8 }}>
            <Text className="text-sm font-medium text-gray-700 dark:text-slate-300">Email or name</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TextInput
                className="flex-1 bg-white dark:bg-surface-card border border-gray-200 dark:border-surface-border rounded-xl px-4 py-3 text-gray-900 dark:text-white text-sm"
                placeholder="friend@email.com or John"
                placeholderTextColor="#9ca3af"
                autoCapitalize="none"
                autoCorrect={false}
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={search}
              />
              <TouchableOpacity
                onPress={search}
                disabled={searching || searchQuery.trim().length < 2}
                style={{
                  backgroundColor: '#f97316',
                  paddingHorizontal: 16,
                  borderRadius: 12,
                  justifyContent: 'center',
                  opacity: searching || searchQuery.trim().length < 2 ? 0.5 : 1,
                }}
              >
                {searching ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text className="text-white font-semibold text-sm">Search</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
          {searchResults.length > 0 && (
            <View style={{ gap: 8 }}>
              {searchResults.map((u) => (
                <View
                  key={u.id}
                  className="bg-white dark:bg-surface-card border border-gray-200 dark:border-surface-border rounded-xl p-4 flex-row items-center gap-4"
                >
                  <View className="w-10 h-10 rounded-full bg-brand-500/15 items-center justify-center">
                    <Text className="text-brand-500 font-bold text-xs">
                      {u.firstName[0]}{u.lastName[0]}
                    </Text>
                  </View>
                  <View className="flex-1" style={{ gap: 2 }}>
                    <Text className="text-gray-900 dark:text-white font-semibold text-sm">
                      {u.firstName} {u.lastName}
                    </Text>
                    <Text className="text-gray-500 dark:text-slate-400 text-xs">{u.email}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => addContact(u.id)}
                    disabled={addLoading}
                    className="bg-brand-500/15 border border-brand-500/30 rounded-lg px-3 py-2"
                  >
                    {addLoading ? (
                      <ActivityIndicator color="#f97316" size="small" />
                    ) : (
                      <Text className="text-brand-500 font-semibold text-xs">Add</Text>
                    )}
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
          {hasSearched && !searching && searchResults.length === 0 && (
            <Text className="text-gray-500 dark:text-slate-500 text-sm text-center py-4">
              No users found. They must register with SafeTag first.
            </Text>
          )}
        </View>
      </KeyboardAvoidingView>
    );
  }

  const acceptedContacts = contacts.filter((c) => c.status === 'accepted');
  const pendingContacts = contacts.filter((c) => c.status === 'pending');

  return (
    <View className="flex-1 bg-gray-50 dark:bg-surface">
      <View className="bg-white dark:bg-surface-card border-b border-gray-200 dark:border-surface-border px-6 pt-14 pb-4 flex-row items-center gap-3">
        <Image source={require('../../assets/logo.png')} style={{ width: 28, height: 28, borderRadius: 7 }} resizeMode="contain" />
        <Text className="text-lg font-bold text-gray-900 dark:text-white flex-1">Emergency</Text>
        <TouchableOpacity
          onPress={() => setScreen('add')}
          className="bg-brand-500/10 border border-brand-500/30 rounded-lg px-3 py-1.5"
        >
          <Text className="text-brand-500 font-semibold text-xs">+ Add</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={[]}
        keyExtractor={() => ''}
        renderItem={null}
        ListHeaderComponent={
          <View style={{ gap: 16, padding: 16 }}>
            {/* SOS Button */}
            <View className="bg-red-500/10 border border-red-500/30 rounded-3xl p-6 items-center" style={{ gap: 12 }}>
              <Ionicons name="alert-circle" size={48} color="#ef4444" />
              <Text className="text-white font-bold text-lg">Emergency SOS</Text>
              <Text className="text-slate-400 text-sm text-center leading-5">
                Instantly alerts all your accepted emergency contacts with your GPS location.
              </Text>
              <TouchableOpacity
                className="bg-red-500 rounded-2xl py-4 px-10 items-center w-full"
                onPress={triggerSos}
                disabled={sosLoading}
              >
                {sosLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-white font-bold text-base">Send SOS Alert</Text>
                )}
              </TouchableOpacity>
              {acceptedContacts.length === 0 && !loading && (
                <Text className="text-slate-500 text-xs text-center">Add accepted contacts to enable SOS</Text>
              )}
            </View>

            {loading && (
              <View className="items-center py-4">
                <ActivityIndicator color="#f97316" />
              </View>
            )}

            {/* Accepted contacts */}
            {acceptedContacts.length > 0 && (
              <View style={{ gap: 8 }}>
                <Text className="text-xs font-semibold text-gray-500 dark:text-slate-500 uppercase tracking-wider">Emergency Contacts</Text>
                {acceptedContacts.map((c) => (
                  <View
                    key={c.id}
                    className="bg-white dark:bg-surface-card border border-gray-200 dark:border-surface-border rounded-2xl p-4 flex-row items-center gap-4"
                  >
                    <View className="w-12 h-12 rounded-full bg-brand-500/15 items-center justify-center flex-shrink-0">
                      <Text className="text-brand-500 font-bold text-sm">
                        {c.contact ? c.contact.firstName[0] + c.contact.lastName[0] : '?'}
                      </Text>
                    </View>
                    <View className="flex-1" style={{ gap: 2 }}>
                      <Text className="text-gray-900 dark:text-white font-semibold text-sm" numberOfLines={1}>
                        {c.contact ? `${c.contact.firstName} ${c.contact.lastName}` : 'Unknown'}
                      </Text>
                      <Text className="text-gray-500 dark:text-slate-400 text-xs" numberOfLines={1}>{c.contact?.email}</Text>
                    </View>
                    <TouchableOpacity onPress={() => removeContact(c.id)} className="p-2">
                      <Text className="text-red-400 text-xs font-medium">Remove</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {/* Pending contacts */}
            {pendingContacts.length > 0 && (
              <View style={{ gap: 8 }}>
                <Text className="text-xs font-semibold text-gray-500 dark:text-slate-500 uppercase tracking-wider">Pending</Text>
                {pendingContacts.map((c) => (
                  <View
                    key={c.id}
                    className="bg-white dark:bg-surface-card border border-gray-200 dark:border-surface-border rounded-2xl p-4 flex-row items-center gap-4"
                    style={{ opacity: 0.8 }}
                  >
                    <View className="w-12 h-12 rounded-full bg-amber-500/15 items-center justify-center flex-shrink-0">
                      <Ionicons name="time" size={20} color="#f59e0b" />
                    </View>
                    <View className="flex-1" style={{ gap: 2 }}>
                      <Text className="text-gray-900 dark:text-white font-semibold text-sm" numberOfLines={1}>
                        {c.contact ? `${c.contact.firstName} ${c.contact.lastName}` : 'Unknown'}
                      </Text>
                      <Text className="text-amber-500 text-xs">
                        {c.isRequester ? 'Awaiting acceptance' : 'Invited you'}
                      </Text>
                    </View>
                    {!c.isRequester && (
                      <>
                        <TouchableOpacity
                          onPress={() => acceptContact(c.id)}
                          className="bg-green-500/20 border border-green-500/30 rounded-lg px-3 py-1.5 mr-1"
                        >
                          <Text className="text-green-500 text-xs font-semibold">Accept</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => declineContact(c.id)}
                          className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-1.5 mr-1"
                        >
                          <Text className="text-red-400 text-xs font-semibold">Decline</Text>
                        </TouchableOpacity>
                      </>
                    )}
                    <TouchableOpacity onPress={() => removeContact(c.id)} className="p-2">
                      <Text className="text-red-400 text-xs font-medium">Remove</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {!loading && contacts.length === 0 && (
              <View className="items-center py-8" style={{ gap: 8 }}>
                <Ionicons name="people" size={32} color="#6b7280" />
                <Text className="text-gray-900 dark:text-white font-semibold">No Contacts Yet</Text>
                <Text className="text-gray-500 dark:text-slate-400 text-sm text-center">
                  Add emergency contacts who will be alerted when you trigger SOS.
                </Text>
              </View>
            )}
          </View>
        }
      />
    </View>
  );
}
