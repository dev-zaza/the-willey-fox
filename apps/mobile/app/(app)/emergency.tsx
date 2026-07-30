import { Ionicons } from '@/components/Icon';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { emergencyService, type EmergencyContactRecord, type ActiveSosNear } from '@/services/emergency.service';
import { familiesService, type FamilyMember } from '@/services/families.service';
import { usersService, type UserSearchResult } from '@/services/users.service';
import { extractApiErrorMessage } from '@/lib/api-error';

const T = {
  red:        '#E94B4B',
  redSoft:    '#FDECEC',
  orange:     '#FF7B14',
  orangeSoft: '#FFE9D6',
  green:      '#3FA34D',
  creamLight: '#F2F4E5',
  charcoal:   '#232323',
  mute:       '#8a8a8a',
  line:       '#ECECEC',
};

type Screen = 'main' | 'add';

export default function EmergencyScreen() {
  const router = useRouter();
  const [contacts, setContacts] = useState<EmergencyContactRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState<Screen>('main');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [sosLoading, setSosLoading] = useState(false);

  // SOS dual-audience modal
  const [sosModalVisible, setSosModalVisible] = useState(false);
  const [sosMessage, setSosMessage] = useState('');
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [nearbyAlerts, setNearbyAlerts] = useState<ActiveSosNear[]>([]);
  const [sosSent, setSosSent] = useState<{ notifiedCount: number } | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);

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

  async function openSosModal() {
    // Get location + family members in parallel before showing modal
    setSosLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      let lat: number | undefined;
      let lng: number | undefined;

      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        lat = loc.coords.latitude;
        lng = loc.coords.longitude;
        setCurrentLocation({ lat, lng });

        const nearby = await emergencyService.getActiveSosNear(lat, lng, 3218).catch(() => []);
        setNearbyAlerts(nearby);
      }

      const families = await familiesService.list().catch(() => []);
      if (families.length > 0) {
        const detail = await familiesService.get(families[0].familyId).catch(() => null);
        setFamilyMembers(detail?.members ?? []);
      }

      setSosSent(null);
      setSosMessage('');
      setSosModalVisible(true);
    } catch (e: any) {
      Alert.alert('Error', extractApiErrorMessage(e, 'Failed to prepare SOS'));
    } finally {
      setSosLoading(false);
    }
  }

  async function confirmSos() {
    setSosLoading(true);
    try {
      const result = await emergencyService.triggerSos({
        lat: currentLocation?.lat,
        lng: currentLocation?.lng,
        message: sosMessage.trim() || undefined,
      });
      setSosSent({ notifiedCount: result.notifiedCount });
    } catch (e: any) {
      Alert.alert('Error', extractApiErrorMessage(e, 'Failed to send SOS'));
    } finally {
      setSosLoading(false);
    }
  }

  if (screen === 'add') {
    return (
      <KeyboardAvoidingView
        className="flex-1 bg-gray-50 dark:bg-surface"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View className="bg-white dark:bg-surface-card border-b border-gray-200 dark:border-surface-border px-6 pt-14 pb-4 flex-row items-center gap-3">
          <TouchableOpacity onPress={() => { setScreen('main'); setSearchQuery(''); setSearchResults([]); setHasSearched(false); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="chevron-back" size={24} color="#f97316" />
          </TouchableOpacity>
          <Text className="text-lg font-bold text-gray-900 dark:text-white flex-1 text-center mr-10">Add Contact</Text>
        </View>
        <View className="flex-1 p-6" style={{ gap: 16 }}>
          <Text className="text-sm text-gray-600 dark:text-slate-400 leading-5">
            Search by email or name. The person must have a TheWileyfox account. They will receive a request to accept.
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
              No users found. They must register with TheWileyfox first.
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
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={24} color="#f97316" />
        </TouchableOpacity>
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
                onPress={openSosModal}
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

      {/* ── SOS Dual-Audience Modal ── */}
      <Modal
        visible={sosModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => { if (!sosLoading) setSosModalVisible(false); }}
      >
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' }}
          activeOpacity={1}
          onPress={() => { if (!sosLoading) setSosModalVisible(false); }}
        />
        <View style={{
          backgroundColor: '#1a1d27',
          borderTopLeftRadius: 28, borderTopRightRadius: 28,
          maxHeight: '88%',
        }}>
          {/* Handle */}
          <View style={{
            width: 36, height: 4, borderRadius: 2,
            backgroundColor: '#2a2f45',
            alignSelf: 'center', marginTop: 12, marginBottom: 4,
          }} />

          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, gap: 16 }}
            showsVerticalScrollIndicator={false}
          >
            {sosSent ? (
              /* ── Sent confirmation ── */
              <View style={{ alignItems: 'center', paddingVertical: 32, gap: 16 }}>
                <View style={{
                  width: 72, height: 72, borderRadius: 36,
                  backgroundColor: T.green,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Ionicons name="checkmark-circle" size={40} color="#fff" />
                </View>
                <Text style={{ fontSize: 22, fontWeight: '800', color: '#f1f5f9', textAlign: 'center' }}>
                  SOS Sent
                </Text>
                <Text style={{ fontSize: 14, color: '#94a3b8', textAlign: 'center', lineHeight: 21 }}>
                  {sosSent.notifiedCount} contact{sosSent.notifiedCount !== 1 ? 's' : ''} alerted with your location.
                  Help is on the way.
                </Text>
                <TouchableOpacity
                  onPress={() => setSosModalVisible(false)}
                  style={{
                    backgroundColor: T.green, borderRadius: 16,
                    paddingVertical: 14, paddingHorizontal: 32,
                    marginTop: 8,
                  }}
                >
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Done</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {/* Header */}
                <View style={{ paddingTop: 8, gap: 4 }}>
                  <Text style={{ fontSize: 20, fontWeight: '800', color: T.red, textAlign: 'center' }}>
                    Send SOS Alert
                  </Text>
                  <Text style={{ fontSize: 13, color: '#94a3b8', textAlign: 'center', lineHeight: 19 }}>
                    Your GPS location will be sent immediately.
                  </Text>
                </View>

                {/* Optional message */}
                <View style={{ gap: 8 }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                    Message (optional)
                  </Text>
                  <TextInput
                    style={{
                      backgroundColor: '#0f1117',
                      borderWidth: 1, borderColor: '#2a2f45',
                      borderRadius: 12, padding: 14,
                      color: '#f1f5f9', fontSize: 14,
                      minHeight: 72, textAlignVertical: 'top',
                    }}
                    placeholder="e.g. I'm at the park near the fountain…"
                    placeholderTextColor="#475569"
                    value={sosMessage}
                    onChangeText={setSosMessage}
                    multiline
                  />
                </View>

                {/* Family panel */}
                <View style={{
                  backgroundColor: '#0f1117',
                  borderRadius: 14, padding: 14,
                  borderWidth: 1, borderColor: '#2a2f45',
                  gap: 10,
                }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons name="people" size={16} color={T.orange} />
                    <Text style={{ fontSize: 12, fontWeight: '700', color: T.orange, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                      Family Group
                    </Text>
                  </View>
                  {familyMembers.length > 0 ? (
                    familyMembers.map((m) => (
                      <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <View style={{
                          width: 32, height: 32, borderRadius: 16,
                          backgroundColor: '#FF7B1426',
                          alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Text style={{ color: T.orange, fontWeight: '700', fontSize: 11 }}>
                            {m.firstName[0]}{m.lastName[0]}
                          </Text>
                        </View>
                        <Text style={{ flex: 1, fontSize: 13, color: '#e2e8f0' }}>
                          {m.firstName} {m.lastName}
                        </Text>
                        <Ionicons name="checkmark-circle" size={14} color={T.orange} />
                      </View>
                    ))
                  ) : (
                    <Text style={{ fontSize: 13, color: '#475569' }}>No family group — emergency contacts will be alerted.</Text>
                  )}
                </View>

                {/* Emergency contacts panel */}
                <View style={{
                  backgroundColor: '#0f1117',
                  borderRadius: 14, padding: 14,
                  borderWidth: 1, borderColor: '#2a2f45',
                  gap: 10,
                }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons name="alert-circle" size={16} color={T.red} />
                    <Text style={{ fontSize: 12, fontWeight: '700', color: T.red, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                      Emergency Contacts ({contacts.filter((c) => c.status === 'accepted').length})
                    </Text>
                  </View>
                  {contacts.filter((c) => c.status === 'accepted').map((c) => (
                    <View key={c.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <View style={{
                        width: 32, height: 32, borderRadius: 16,
                        backgroundColor: '#E94B4B26',
                        alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Text style={{ color: T.red, fontWeight: '700', fontSize: 11 }}>
                          {c.contact ? c.contact.firstName[0] + c.contact.lastName[0] : '?'}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, color: '#e2e8f0' }} numberOfLines={1}>
                          {c.contact ? `${c.contact.firstName} ${c.contact.lastName}` : 'Unknown'}
                        </Text>
                        {c.isPrimarySos && (
                          <Text style={{ fontSize: 10, color: T.red, fontWeight: '600' }}>Primary SOS</Text>
                        )}
                      </View>
                      <Ionicons name="checkmark-circle" size={14} color={T.red} />
                    </View>
                  ))}
                  {contacts.filter((c) => c.status === 'accepted').length === 0 && (
                    <Text style={{ fontSize: 13, color: '#475569' }}>No accepted contacts yet.</Text>
                  )}
                </View>

                {/* Nearby users */}
                {nearbyAlerts.length > 0 && (
                  <View style={{
                    backgroundColor: '#0f1117',
                    borderRadius: 14, padding: 14,
                    borderWidth: 1, borderColor: '#2a2f45',
                    gap: 8,
                  }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Ionicons name="radio" size={16} color="#a855f7" />
                      <Text style={{ fontSize: 12, fontWeight: '700', color: '#a855f7', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                        Nearby TheWileyfox Users
                      </Text>
                    </View>
                    <Text style={{ fontSize: 13, color: '#94a3b8', lineHeight: 18 }}>
                      {nearbyAlerts.length} users within 2 miles will also be alerted.
                    </Text>
                  </View>
                )}

                {/* Location status */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons
                    name={currentLocation ? 'location' : 'location-outline'}
                    size={14}
                    color={currentLocation ? T.green : '#475569'}
                  />
                  <Text style={{ fontSize: 12, color: currentLocation ? T.green : '#475569' }}>
                    {currentLocation
                      ? `GPS ready (${currentLocation.lat.toFixed(4)}, ${currentLocation.lng.toFixed(4)})`
                      : 'GPS unavailable — location not attached'
                    }
                  </Text>
                </View>

                {/* Send / Cancel */}
                <View style={{ gap: 10 }}>
                  <TouchableOpacity
                    onPress={confirmSos}
                    disabled={sosLoading}
                    style={{
                      backgroundColor: T.red, borderRadius: 16, paddingVertical: 16,
                      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                      opacity: sosLoading ? 0.7 : 1,
                    }}
                  >
                    {sosLoading ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <>
                        <Ionicons name="alert-circle" size={18} color="#fff" />
                        <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>Send SOS Now</Text>
                      </>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setSosModalVisible(false)}
                    disabled={sosLoading}
                    style={{
                      backgroundColor: '#1e2236', borderRadius: 16, paddingVertical: 15,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ color: '#94a3b8', fontWeight: '600', fontSize: 15 }}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
