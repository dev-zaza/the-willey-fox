import { Ionicons } from '@/components/Icon';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { emergencyService, type EmergencyContactRecord } from '@/services/emergency.service';
import { extractApiErrorMessage } from '@/lib/api-error';

// ── Design tokens ─────────────────────────────────────────────────────────────
const T = {
  orange:     '#FF7B14',
  orangeDark: '#E2620A',
  orangeSoft: '#FFE9D6',
  creamLight: '#F2F4E5',
  charcoal:   '#232323',
  mute:       '#8a8a8a',
  line:       '#ECECEC',
  red:        '#E94B4B',
  redSoft:    '#FDECEC',
  green:      '#4CAF7D',
  greenSoft:  '#E8F5EE',
};

function bg(dark: boolean)          { return dark ? '#0f1117' : T.creamLight; }
function cardBg(dark: boolean)      { return dark ? '#1a1d27' : '#ffffff'; }
function border(dark: boolean)      { return dark ? '#2a2f45' : T.line; }
function textPrimary(dark: boolean) { return dark ? '#f1f5f9' : T.charcoal; }
function textMuted(dark: boolean)   { return dark ? '#64748b' : T.mute; }

export default function SosContactScreen() {
  const router = useRouter();
  const dark = useColorScheme() === 'dark';

  const [contacts, setContacts] = useState<EmergencyContactRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [settingId, setSettingId] = useState<string | null>(null);

  const accepted = contacts.filter((c) => c.status === 'accepted');
  const primary = contacts.find((c) => c.isPrimarySos);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const data = await emergencyService.listContacts();
      setContacts(data ?? []);
    } catch (e: any) {
      Alert.alert('Error', extractApiErrorMessage(e, 'Failed to load contacts'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function setPrimary(contact: EmergencyContactRecord) {
    if (contact.isPrimarySos) return;
    const name = contact.contact
      ? `${contact.contact.firstName} ${contact.contact.lastName}`
      : 'this contact';

    Alert.alert(
      'Set SOS Contact',
      `${name} will be notified first when you trigger an SOS alert. Continue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Set as Primary',
          onPress: async () => {
            setSettingId(contact.id);
            try {
              await emergencyService.setPrimary(contact.id);
              setContacts((prev) =>
                prev.map((c) => ({ ...c, isPrimarySos: c.id === contact.id })),
              );
            } catch (e: any) {
              Alert.alert('Error', extractApiErrorMessage(e, 'Failed to set primary'));
            } finally {
              setSettingId(null);
            }
          },
        },
      ],
    );
  }

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
        <Text style={{ flex: 1, fontSize: 17, fontWeight: '700', color: textPrimary(dark) }}>
          SOS Contact
        </Text>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={T.orange} />
        </View>
      ) : (
        <FlatList
          data={accepted}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={T.orange} />
          }
          ListHeaderComponent={
            <View style={{ gap: 16, marginBottom: 8 }}>
              {/* Explainer card */}
              <View style={{
                backgroundColor: dark ? '#1a1d27' : T.orangeSoft,
                borderRadius: 14, padding: 16, gap: 8,
                borderWidth: 1, borderColor: dark ? '#2a2f45' : T.orange + '30',
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Ionicons name="alert-circle" size={20} color={T.orange} />
                  <Text style={{ fontSize: 14, fontWeight: '700', color: T.orangeDark }}>
                    What is a primary SOS contact?
                  </Text>
                </View>
                <Text style={{ fontSize: 13, color: dark ? '#94a3b8' : T.charcoal, lineHeight: 19 }}>
                  Your primary SOS contact is notified first — and separately — when you trigger an SOS alert. All other accepted contacts are also notified.
                </Text>
              </View>

              {/* Current primary banner */}
              {primary && primary.contact && (
                <View style={{
                  backgroundColor: dark ? '#0e2a1a' : T.greenSoft,
                  borderRadius: 14, padding: 14,
                  flexDirection: 'row', alignItems: 'center', gap: 12,
                  borderWidth: 1, borderColor: dark ? '#1a4a2a' : T.green + '40',
                }}>
                  <View style={{
                    width: 40, height: 40, borderRadius: 20,
                    backgroundColor: dark ? '#1a3a2a' : '#c8edd9',
                    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <Ionicons name="checkmark-circle" size={22} color={T.green} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, color: T.green, fontWeight: '600', marginBottom: 2 }}>
                      Current Primary
                    </Text>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: textPrimary(dark) }}>
                      {primary.contact.firstName} {primary.contact.lastName}
                    </Text>
                    <Text style={{ fontSize: 12, color: textMuted(dark) }}>{primary.contact.email}</Text>
                  </View>
                </View>
              )}

              <Text style={{
                fontSize: 11, letterSpacing: 1, textTransform: 'uppercase',
                color: textMuted(dark), fontWeight: '700', marginTop: 4,
              }}>
                {accepted.length === 0 ? 'No Accepted Contacts' : `Accepted Contacts · ${accepted.length}`}
              </Text>
            </View>
          }
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingTop: 32, gap: 12 }}>
              <View style={{
                width: 72, height: 72, borderRadius: 36,
                backgroundColor: dark ? '#1e2236' : T.redSoft,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Ionicons name="people-outline" size={36} color={T.red} />
              </View>
              <Text style={{ fontSize: 17, fontWeight: '700', color: textPrimary(dark) }}>
                No accepted contacts
              </Text>
              <Text style={{ fontSize: 14, color: textMuted(dark), textAlign: 'center', lineHeight: 20, paddingHorizontal: 24 }}>
                Add and accept emergency contacts first, then return here to set your primary SOS contact.
              </Text>
              <TouchableOpacity
                onPress={() => router.push('/(app)/emergency')}
                style={{
                  backgroundColor: T.orange,
                  borderRadius: 12, paddingVertical: 12, paddingHorizontal: 24,
                  marginTop: 4,
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Manage Contacts</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item }) => {
            const name = item.contact
              ? `${item.contact.firstName} ${item.contact.lastName}`
              : 'Unknown';
            const initials = item.contact
              ? `${item.contact.firstName[0] ?? ''}${item.contact.lastName[0] ?? ''}`.toUpperCase()
              : '?';
            const isPrimary = item.isPrimarySos;
            const isLoading = settingId === item.id;

            return (
              <TouchableOpacity
                onPress={() => setPrimary(item)}
                activeOpacity={isPrimary ? 1 : 0.75}
                style={{
                  backgroundColor: cardBg(dark),
                  borderWidth: isPrimary ? 2 : 1,
                  borderColor: isPrimary ? T.green : border(dark),
                  borderRadius: 16, padding: 14,
                  flexDirection: 'row', alignItems: 'center', gap: 14,
                }}
              >
                {/* Avatar */}
                <View style={{
                  width: 48, height: 48, borderRadius: 24,
                  backgroundColor: dark ? '#1e2236' : T.orangeSoft,
                  alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <Text style={{ color: T.orange, fontWeight: '700', fontSize: 16 }}>{initials}</Text>
                </View>

                {/* Info */}
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: textPrimary(dark) }}>{name}</Text>
                  <Text style={{ fontSize: 12, color: textMuted(dark) }} numberOfLines={1}>
                    {item.contact?.email}
                  </Text>
                  {isPrimary && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                      <Ionicons name="checkmark-circle" size={13} color={T.green} />
                      <Text style={{ fontSize: 12, color: T.green, fontWeight: '600' }}>Primary SOS</Text>
                    </View>
                  )}
                </View>

                {/* Action */}
                {isLoading ? (
                  <ActivityIndicator color={T.orange} size="small" />
                ) : isPrimary ? (
                  <View style={{
                    width: 28, height: 28, borderRadius: 14,
                    backgroundColor: T.green,
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Ionicons name="checkmark" size={16} color="#fff" />
                  </View>
                ) : (
                  <View style={{
                    width: 28, height: 28, borderRadius: 14,
                    borderWidth: 2, borderColor: border(dark),
                  }} />
                )}
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}
