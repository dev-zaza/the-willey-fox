import { Ionicons } from '@/components/Icon';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { familiesService, type FamilyMembership, type FamilyDetail } from '@/services/families.service';
import { usersService, type UserSearchResult } from '@/services/users.service';
import { extractApiErrorMessage } from '@/lib/api-error';

// ── Design tokens ─────────────────────────────────────────────────────────────
const T = {
  orange:      '#FF7B14',
  orangeDark:  '#E2620A',
  orangeSoft:  '#FFE9D6',
  sage:        '#AABA9F',
  cream:       '#E5EBD3',
  creamLight:  '#F2F4E5',
  charcoal:    '#232323',
  mute:        '#8a8a8a',
  line:        '#ECECEC',
  red:         '#E94B4B',
  redSoft:     '#FDECEC',
  purple:      '#6A3FB4',
  green:       '#4CAF7D',
  greenSoft:   '#E8F5EE',
  blue:        '#3B82F6',
  blueSoft:    '#EFF6FF',
};

function bg(dark: boolean)          { return dark ? '#0f1117' : T.creamLight; }
function cardBg(dark: boolean)      { return dark ? '#1a1d27' : '#ffffff'; }
function border(dark: boolean)      { return dark ? '#2a2f45' : T.line; }
function textPrimary(dark: boolean) { return dark ? '#f1f5f9' : T.charcoal; }
function textMuted(dark: boolean)   { return dark ? '#64748b' : T.mute; }

type Screen = 'list' | 'detail' | 'create' | 'add-member';

// ── Avatar circle ─────────────────────────────────────────────────────────────
function Avatar({ firstName, lastName, size = 44, dark }: { firstName: string; lastName: string; size?: number; dark: boolean }) {
  const initials = `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase();
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: dark ? '#1e2236' : T.orangeSoft,
      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      <Text style={{ color: T.orange, fontWeight: '700', fontSize: size * 0.35 }}>{initials}</Text>
    </View>
  );
}

// ── Role pill ─────────────────────────────────────────────────────────────────
function RolePill({ role, dark }: { role: string; dark: boolean }) {
  const isOwner = role === 'owner';
  return (
    <View style={{
      paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
      backgroundColor: isOwner ? (dark ? '#1a2a1a' : T.greenSoft) : (dark ? '#1e2236' : T.creamLight),
    }}>
      <Text style={{
        fontSize: 11, fontWeight: '600',
        color: isOwner ? T.green : textMuted(dark),
        textTransform: 'capitalize',
      }}>{role}</Text>
    </View>
  );
}

// ── Section title ─────────────────────────────────────────────────────────────
function SectionTitle({ label, dark }: { label: string; dark: boolean }) {
  return (
    <Text style={{
      fontSize: 11, letterSpacing: 1, textTransform: 'uppercase',
      color: textMuted(dark), fontWeight: '700',
      marginHorizontal: 20, marginTop: 20, marginBottom: 6,
    }}>{label}</Text>
  );
}

// ── Back header ───────────────────────────────────────────────────────────────
function Header({ title, onBack, action, dark }: {
  title: string;
  onBack: () => void;
  action?: { label: string; onPress: () => void };
  dark: boolean;
}) {
  return (
    <View style={{
      backgroundColor: cardBg(dark),
      borderBottomWidth: 1, borderBottomColor: border(dark),
      paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16,
      flexDirection: 'row', alignItems: 'center', gap: 12,
    }}>
      <TouchableOpacity
        onPress={onBack}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        style={{
          width: 32, height: 32, borderRadius: 16,
          backgroundColor: dark ? '#1e2236' : T.creamLight,
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Ionicons name="chevron-back" size={20} color={dark ? '#f1f5f9' : T.charcoal} />
      </TouchableOpacity>
      <Text style={{ flex: 1, fontSize: 17, fontWeight: '700', color: textPrimary(dark) }} numberOfLines={1}>
        {title}
      </Text>
      {action && (
        <TouchableOpacity
          onPress={action.onPress}
          style={{ paddingHorizontal: 14, paddingVertical: 8, backgroundColor: T.orangeSoft, borderRadius: 10 }}
        >
          <Text style={{ color: T.orangeDark, fontWeight: '600', fontSize: 13 }}>{action.label}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function FamilyScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const dark = useColorScheme() === 'dark';

  const [screen, setScreen] = useState<Screen>('list');
  const [families, setFamilies] = useState<FamilyMembership[]>([]);
  const [activeFamily, setActiveFamily] = useState<FamilyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Create form
  const [newName, setNewName] = useState('');

  // Add-member form
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const loadFamilies = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const data = await familiesService.list();
      setFamilies(data ?? []);
    } catch (e: any) {
      Alert.alert('Error', extractApiErrorMessage(e, 'Failed to load families'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadFamilies(); }, [loadFamilies]);

  async function openFamily(membership: FamilyMembership) {
    setDetailLoading(true);
    setScreen('detail');
    setActiveFamily(null);
    try {
      const detail = await familiesService.get(membership.familyId);
      setActiveFamily(detail);
    } catch (e: any) {
      Alert.alert('Error', extractApiErrorMessage(e, 'Failed to load family'));
      setScreen('list');
    } finally {
      setDetailLoading(false);
    }
  }

  async function createFamily() {
    if (!newName.trim()) return;
    setActionLoading(true);
    try {
      const created = await familiesService.create(newName.trim());
      setNewName('');
      await loadFamilies();
      // Open the newly created family
      const detail = await familiesService.get(created.id);
      setActiveFamily(detail);
      setScreen('detail');
    } catch (e: any) {
      Alert.alert('Error', extractApiErrorMessage(e, 'Failed to create family group'));
    } finally {
      setActionLoading(false);
    }
  }

  async function searchUsers() {
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

  async function addMember(targetUserId: string) {
    if (!activeFamily) return;
    setActionLoading(true);
    try {
      await familiesService.addMember(activeFamily.id, { userId: targetUserId });
      const detail = await familiesService.get(activeFamily.id);
      setActiveFamily(detail);
      setSearchQuery('');
      setSearchResults([]);
      setHasSearched(false);
      setScreen('detail');
    } catch (e: any) {
      Alert.alert('Error', extractApiErrorMessage(e, 'Failed to add member'));
    } finally {
      setActionLoading(false);
    }
  }

  async function removeMember(targetUserId: string, name: string) {
    if (!activeFamily) return;
    Alert.alert('Remove Member', `Remove ${name} from ${activeFamily.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await familiesService.removeMember(activeFamily.id, targetUserId);
            const detail = await familiesService.get(activeFamily.id);
            setActiveFamily(detail);
          } catch (e: any) {
            Alert.alert('Error', extractApiErrorMessage(e, 'Failed to remove member'));
          }
        },
      },
    ]);
  }

  async function deleteFamily() {
    if (!activeFamily) return;
    Alert.alert(
      'Delete Family',
      `Delete "${activeFamily.name}"? This cannot be undone. All members will lose access to shared QR codes.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await familiesService.delete(activeFamily.id);
              setActiveFamily(null);
              setScreen('list');
              await loadFamilies();
            } catch (e: any) {
              Alert.alert('Error', extractApiErrorMessage(e, 'Failed to delete family'));
            }
          },
        },
      ],
    );
  }

  const isOwner = activeFamily && user && activeFamily.ownerId === user.id;

  // ── Screen: add-member ────────────────────────────────────────────────────
  if (screen === 'add-member') {
    return (
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: bg(dark) }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Header
          title="Add Member"
          onBack={() => { setScreen('detail'); setSearchQuery(''); setSearchResults([]); setHasSearched(false); }}
          dark={dark}
        />
        <View style={{ flex: 1, padding: 20, gap: 16 }}>
          <Text style={{ fontSize: 14, color: textMuted(dark), lineHeight: 20 }}>
            Search by name or email. The person must have a TheWileyfox account.
          </Text>

          <View style={{ gap: 6 }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: textMuted(dark), textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Name or Email
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TextInput
                style={{
                  flex: 1,
                  backgroundColor: cardBg(dark),
                  borderWidth: 1, borderColor: border(dark),
                  borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
                  color: textPrimary(dark), fontSize: 15,
                }}
                placeholder="Search…"
                placeholderTextColor={textMuted(dark)}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
                autoCorrect={false}
                onSubmitEditing={searchUsers}
                returnKeyType="search"
                autoFocus
              />
              <TouchableOpacity
                onPress={searchUsers}
                disabled={searching || searchQuery.trim().length < 2}
                style={{
                  backgroundColor: T.orange,
                  paddingHorizontal: 16, borderRadius: 12,
                  justifyContent: 'center',
                  opacity: searching || searchQuery.trim().length < 2 ? 0.5 : 1,
                }}
              >
                {searching
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>Search</Text>
                }
              </TouchableOpacity>
            </View>
          </View>

          {searchResults.length > 0 && (
            <View style={{ gap: 8 }}>
              {searchResults.map((u) => {
                const alreadyMember = activeFamily?.members.some((m) => m.userId === u.id);
                return (
                  <View
                    key={u.id}
                    style={{
                      backgroundColor: cardBg(dark),
                      borderWidth: 1, borderColor: border(dark),
                      borderRadius: 14, padding: 14,
                      flexDirection: 'row', alignItems: 'center', gap: 12,
                    }}
                  >
                    <Avatar firstName={u.firstName} lastName={u.lastName} dark={dark} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: textPrimary(dark) }}>
                        {u.firstName} {u.lastName}
                      </Text>
                      <Text style={{ fontSize: 12, color: textMuted(dark) }}>{u.email}</Text>
                    </View>
                    {alreadyMember ? (
                      <View style={{
                        paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
                        backgroundColor: dark ? '#1e2236' : T.creamLight,
                      }}>
                        <Text style={{ fontSize: 12, color: textMuted(dark), fontWeight: '600' }}>Added</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        onPress={() => addMember(u.id)}
                        disabled={actionLoading}
                        style={{
                          paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
                          backgroundColor: T.orangeSoft,
                          borderWidth: 1, borderColor: T.orange + '40',
                        }}
                      >
                        {actionLoading
                          ? <ActivityIndicator color={T.orange} size="small" />
                          : <Text style={{ fontSize: 12, color: T.orangeDark, fontWeight: '600' }}>Add</Text>
                        }
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </View>
          )}

          {hasSearched && !searching && searchResults.length === 0 && (
            <Text style={{ color: textMuted(dark), fontSize: 14, textAlign: 'center', paddingVertical: 16 }}>
              No users found. They must have a TheWileyfox account.
            </Text>
          )}
        </View>
      </KeyboardAvoidingView>
    );
  }

  // ── Screen: create ────────────────────────────────────────────────────────
  if (screen === 'create') {
    return (
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: bg(dark) }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Header title="New Family Group" onBack={() => { setScreen('list'); setNewName(''); }} dark={dark} />
        <View style={{ flex: 1, padding: 20, gap: 20 }}>
          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 24, fontWeight: '700', color: textPrimary(dark) }}>
              Create a group
            </Text>
            <Text style={{ fontSize: 14, color: textMuted(dark), lineHeight: 20 }}>
              Family groups let you share QR tag access with people you trust. Add members after creating the group.
            </Text>
          </View>

          <View style={{ gap: 6 }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: textMuted(dark), textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Group Name
            </Text>
            <TextInput
              style={{
                backgroundColor: cardBg(dark),
                borderWidth: 1, borderColor: border(dark),
                borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
                color: textPrimary(dark), fontSize: 16,
              }}
              placeholder="e.g. Smith Family"
              placeholderTextColor={textMuted(dark)}
              value={newName}
              onChangeText={setNewName}
              autoCapitalize="words"
              maxLength={80}
              autoFocus
              onSubmitEditing={createFamily}
              returnKeyType="done"
            />
          </View>

          <TouchableOpacity
            onPress={createFamily}
            disabled={actionLoading || !newName.trim()}
            style={{
              backgroundColor: T.orange,
              borderRadius: 14, paddingVertical: 16,
              alignItems: 'center',
              opacity: !newName.trim() ? 0.5 : 1,
            }}
          >
            {actionLoading
              ? <ActivityIndicator color="#fff" />
              : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Create Group</Text>
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // ── Screen: detail ────────────────────────────────────────────────────────
  if (screen === 'detail') {
    return (
      <View style={{ flex: 1, backgroundColor: bg(dark) }}>
        <Header
          title={activeFamily?.name ?? '…'}
          onBack={() => { setScreen('list'); setActiveFamily(null); }}
          dark={dark}
          action={isOwner ? { label: '+ Member', onPress: () => setScreen('add-member') } : undefined}
        />

        {detailLoading || !activeFamily ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="large" color={T.orange} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
            {/* Members */}
            <SectionTitle label={`Members · ${activeFamily.members.length}`} dark={dark} />
            <View style={{
              marginHorizontal: 16,
              backgroundColor: cardBg(dark),
              borderWidth: 1, borderColor: border(dark),
              borderRadius: 14, overflow: 'hidden',
            }}>
              {activeFamily.members.map((m, i) => {
                const isMe = m.userId === user?.id;
                const canRemove = isOwner && !isMe;
                return (
                  <View
                    key={m.id}
                    style={{
                      flexDirection: 'row', alignItems: 'center',
                      paddingHorizontal: 16, paddingVertical: 12, gap: 12,
                      borderBottomWidth: i < activeFamily.members.length - 1 ? 1 : 0,
                      borderBottomColor: border(dark),
                    }}
                  >
                    <Avatar firstName={m.firstName} lastName={m.lastName} size={40} dark={dark} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: textPrimary(dark) }}>
                        {m.firstName} {m.lastName}{isMe ? ' (you)' : ''}
                      </Text>
                      <Text style={{ fontSize: 12, color: textMuted(dark) }} numberOfLines={1}>{m.email}</Text>
                    </View>
                    <RolePill role={m.role} dark={dark} />
                    {canRemove && (
                      <TouchableOpacity
                        onPress={() => removeMember(m.userId, `${m.firstName} ${m.lastName}`)}
                        style={{ padding: 6 }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="close-circle" size={20} color={T.red} />
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </View>

            {/* Shared QR Codes */}
            <SectionTitle label={`Shared Tags · ${activeFamily.qrCodes.length}`} dark={dark} />
            {activeFamily.qrCodes.length === 0 ? (
              <View style={{
                marginHorizontal: 16,
                backgroundColor: cardBg(dark),
                borderWidth: 1, borderColor: border(dark),
                borderRadius: 14, padding: 20,
                alignItems: 'center', gap: 8,
              }}>
                <Ionicons name="pricetag-outline" size={28} color={textMuted(dark)} />
                <Text style={{ fontSize: 14, color: textMuted(dark), textAlign: 'center' }}>
                  No tags shared yet. Share a QR tag from the My Tags screen.
                </Text>
              </View>
            ) : (
              <View style={{
                marginHorizontal: 16,
                backgroundColor: cardBg(dark),
                borderWidth: 1, borderColor: border(dark),
                borderRadius: 14, overflow: 'hidden',
              }}>
                {activeFamily.qrCodes.map((qr, i) => (
                  <View
                    key={qr.id}
                    style={{
                      flexDirection: 'row', alignItems: 'center',
                      paddingHorizontal: 16, paddingVertical: 12, gap: 12,
                      borderBottomWidth: i < activeFamily.qrCodes.length - 1 ? 1 : 0,
                      borderBottomColor: border(dark),
                    }}
                  >
                    <View style={{
                      width: 36, height: 36, borderRadius: 10,
                      backgroundColor: dark ? '#1e2236' : T.creamLight,
                      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <Ionicons name="pricetag" size={18} color={T.orange} />
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: textPrimary(dark) }}>{qr.name}</Text>
                      <Text style={{ fontSize: 11, color: textMuted(dark), textTransform: 'capitalize' }}>{qr.category}</Text>
                    </View>
                    {qr.isLost && (
                      <View style={{
                        paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
                        backgroundColor: dark ? '#2d1a1a' : T.redSoft,
                      }}>
                        <Text style={{ fontSize: 11, fontWeight: '600', color: T.red }}>Lost</Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}

            {/* Danger zone — owner only */}
            {isOwner && (
              <>
                <SectionTitle label="Danger Zone" dark={dark} />
                <TouchableOpacity
                  onPress={deleteFamily}
                  style={{
                    marginHorizontal: 16,
                    paddingVertical: 14,
                    backgroundColor: 'transparent',
                    borderWidth: 1.5,
                    borderColor: dark ? '#4d1f1f' : T.redSoft,
                    borderRadius: 14,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: T.red, fontWeight: '600', fontSize: 14 }}>Delete Family Group</Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        )}
      </View>
    );
  }

  // ── Screen: list ──────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: bg(dark) }}>
      <Header
        title="Family Groups"
        onBack={() => router.back()}
        dark={dark}
        action={{ label: '+ New', onPress: () => setScreen('create') }}
      />

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={T.orange} />
        </View>
      ) : (
        <FlatList
          data={families}
          keyExtractor={(item) => item.familyId}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadFamilies(true)}
              tintColor={T.orange}
            />
          }
          ListEmptyComponent={
            <View style={{ flex: 1, alignItems: 'center', paddingTop: 80, gap: 16 }}>
              <View style={{
                width: 80, height: 80, borderRadius: 40,
                backgroundColor: dark ? '#1e2236' : T.orangeSoft,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Ionicons name="people" size={40} color={T.orange} />
              </View>
              <View style={{ alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 20, fontWeight: '700', color: textPrimary(dark) }}>No Family Groups</Text>
                <Text style={{ fontSize: 14, color: textMuted(dark), textAlign: 'center', lineHeight: 20, paddingHorizontal: 32 }}>
                  Create a group to share QR tag access with family members or trusted people.
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setScreen('create')}
                style={{
                  backgroundColor: T.orange,
                  borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32,
                  marginTop: 8,
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Create a Group</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => openFamily(item)}
              activeOpacity={0.75}
              style={{
                backgroundColor: cardBg(dark),
                borderWidth: 1, borderColor: border(dark),
                borderRadius: 16, padding: 16,
                flexDirection: 'row', alignItems: 'center', gap: 14,
              }}
            >
              {/* Icon */}
              <View style={{
                width: 52, height: 52, borderRadius: 14,
                backgroundColor: dark ? '#1e2236' : T.orangeSoft,
                alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Ionicons name="people" size={26} color={T.orange} />
              </View>

              {/* Info */}
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: textPrimary(dark) }} numberOfLines={1}>
                  {item.familyName}
                </Text>
                <RolePill role={item.role} dark={dark} />
              </View>

              <Ionicons name="chevron-forward" size={18} color={textMuted(dark)} />
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}
