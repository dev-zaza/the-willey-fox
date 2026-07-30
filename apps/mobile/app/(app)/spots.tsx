import { Ionicons } from '@/components/Icon';
import { spotsService, type Spot } from '@/services/spots.service';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Modal,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';

const T = {
  orange:     '#FF7B14',
  orangeSoft: '#FFE9D6',
  charcoal:   '#232323',
  mute:       '#8a8a8a',
  line:       '#ECECEC',
  creamLight: '#F2F4E5',
};

function bg(dark: boolean) { return dark ? '#0f1117' : T.creamLight; }
function cardBg(dark: boolean) { return dark ? '#1a1d27' : '#ffffff'; }
function borderColor(dark: boolean) { return dark ? '#2a2f45' : T.line; }
function textPrimary(dark: boolean) { return dark ? '#f1f5f9' : T.charcoal; }
function textMuted(dark: boolean) { return dark ? '#64748b' : T.mute; }

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return iso; }
}

export default function SpotsScreen() {
  const router = useRouter();
  const dark = useColorScheme() === 'dark';
  const [spots, setSpots] = useState<Spot[]>([]);
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addLoading, setAddLoading] = useState(false);

  // Add form state
  const [formName, setFormName] = useState('');
  const [formCaption, setFormCaption] = useState('');
  const [formInstagram, setFormInstagram] = useState('');

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      try {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLocation(loc);
        loadSpots(loc.lat, loc.lng);
      } catch { /* ignore */ }
    })();
  }, []);

  async function loadSpots(lat: number, lng: number) {
    setLoading(true);
    try {
      const data = await spotsService.listNearby(lat, lng, 10000);
      setSpots(data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  async function handleAdd() {
    if (!formName.trim()) {
      Alert.alert('Name required', 'Enter a location name for this spot.');
      return;
    }
    if (!location) {
      Alert.alert('Location unavailable', 'Cannot determine your current location.');
      return;
    }
    setAddLoading(true);
    try {
      const spot = await spotsService.create({
        locationName: formName.trim(),
        lat: location.lat,
        lng: location.lng,
        caption: formCaption.trim() || undefined,
        instagramUrl: formInstagram.trim() || undefined,
      });
      setSpots((prev) => [spot, ...prev]);
      setShowAddModal(false);
      setFormName('');
      setFormCaption('');
      setFormInstagram('');
    } catch {
      Alert.alert('Error', 'Failed to save spot. Please try again.');
    } finally {
      setAddLoading(false);
    }
  }

  async function handleDelete(id: string) {
    Alert.alert('Remove Spot', 'Remove this saved spot?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await spotsService.remove(id);
            setSpots((prev) => prev.filter((s) => s.id !== id));
          } catch {
            Alert.alert('Error', 'Could not remove spot.');
          }
        },
      },
    ]);
  }

  return (
    <View style={{ flex: 1, backgroundColor: bg(dark) }}>
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
        <Text style={{ fontSize: 18, fontWeight: '700', color: textPrimary(dark), flex: 1 }}>Save-a-Spot</Text>
        <TouchableOpacity
          onPress={() => setShowAddModal(true)}
          style={{
            backgroundColor: T.orange, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7,
            flexDirection: 'row', alignItems: 'center', gap: 6,
          }}
        >
          <Ionicons name="add" size={16} color="#fff" />
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Save Spot</Text>
        </TouchableOpacity>
      </View>

      {/* List */}
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={T.orange} />
        </View>
      ) : spots.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 }}>
          <Ionicons name="bookmark-outline" size={48} color={textMuted(dark)} />
          <Text style={{ fontSize: 16, fontWeight: '600', color: textPrimary(dark), textAlign: 'center' }}>
            No saved spots nearby
          </Text>
          <Text style={{ fontSize: 13, color: textMuted(dark), textAlign: 'center', lineHeight: 20 }}>
            Tap "Save Spot" to bookmark a location with its safety context.
          </Text>
          <TouchableOpacity
            onPress={() => setShowAddModal(true)}
            style={{
              backgroundColor: T.orange, borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12,
              flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8,
            }}
          >
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Save This Spot</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={spots}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          renderItem={({ item }) => (
            <View style={{
              backgroundColor: cardBg(dark), borderRadius: 16,
              borderWidth: 1, borderColor: borderColor(dark), padding: 16,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                <View style={{
                  width: 40, height: 40, borderRadius: 12,
                  backgroundColor: T.orangeSoft, alignItems: 'center', justifyContent: 'center',
                }}>
                  <Ionicons name="bookmark" size={20} color={T.orange} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: textPrimary(dark) }}>
                    {item.locationName}
                  </Text>
                  {item.caption ? (
                    <Text style={{ fontSize: 13, color: textMuted(dark), lineHeight: 18 }}>
                      {item.caption}
                    </Text>
                  ) : null}
                  <Text style={{ fontSize: 11, color: textMuted(dark), marginTop: 2 }}>
                    {formatDate(item.createdAt)}
                    {item.safetyBand ? ` · ${item.safetyBand}` : ''}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleDelete(item.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="trash-outline" size={18} color={textMuted(dark)} />
                </TouchableOpacity>
              </View>

              {item.instagramUrl ? (
                <TouchableOpacity
                  onPress={() => Linking.openURL(item.instagramUrl!)}
                  style={{
                    marginTop: 10, paddingTop: 10,
                    borderTopWidth: 1, borderTopColor: borderColor(dark),
                    flexDirection: 'row', alignItems: 'center', gap: 6,
                  }}
                >
                  <Ionicons name="logo-instagram" size={14} color="#E1306C" />
                  <Text style={{ fontSize: 12, color: '#E1306C', fontWeight: '600' }}>
                    View on Instagram
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          )}
        />
      )}

      {/* Add Spot Modal */}
      <Modal visible={showAddModal} transparent animationType="slide" onRequestClose={() => setShowAddModal(false)}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowAddModal(false)} />
        <View style={{
          backgroundColor: cardBg(dark), borderTopLeftRadius: 24, borderTopRightRadius: 24,
          padding: 24, paddingBottom: 48,
          shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.15, shadowRadius: 16, elevation: 16,
        }}>
          {/* Handle */}
          <View style={{
            width: 40, height: 4, borderRadius: 2, backgroundColor: borderColor(dark),
            alignSelf: 'center', marginBottom: 20,
          }} />

          <Text style={{ fontSize: 18, fontWeight: '800', color: textPrimary(dark), marginBottom: 20 }}>
            Save This Spot
          </Text>

          <View style={{ gap: 12 }}>
            <View>
              <Text style={{ fontSize: 12, fontWeight: '600', color: textMuted(dark), marginBottom: 6 }}>
                LOCATION NAME *
              </Text>
              <TextInput
                style={{
                  backgroundColor: bg(dark), borderRadius: 12, borderWidth: 1, borderColor: borderColor(dark),
                  paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: textPrimary(dark),
                }}
                placeholder="e.g. Borough Market, London"
                placeholderTextColor={textMuted(dark)}
                value={formName}
                onChangeText={setFormName}
              />
            </View>

            <View>
              <Text style={{ fontSize: 12, fontWeight: '600', color: textMuted(dark), marginBottom: 6 }}>
                NOTE (optional)
              </Text>
              <TextInput
                style={{
                  backgroundColor: bg(dark), borderRadius: 12, borderWidth: 1, borderColor: borderColor(dark),
                  paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: textPrimary(dark),
                  minHeight: 72,
                }}
                placeholder="What makes this spot worth saving?"
                placeholderTextColor={textMuted(dark)}
                value={formCaption}
                onChangeText={setFormCaption}
                multiline
                textAlignVertical="top"
              />
            </View>

            <View>
              <Text style={{ fontSize: 12, fontWeight: '600', color: textMuted(dark), marginBottom: 6 }}>
                INSTAGRAM LINK (optional)
              </Text>
              <TextInput
                style={{
                  backgroundColor: bg(dark), borderRadius: 12, borderWidth: 1, borderColor: borderColor(dark),
                  paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: textPrimary(dark),
                }}
                placeholder="https://www.instagram.com/p/..."
                placeholderTextColor={textMuted(dark)}
                value={formInstagram}
                onChangeText={setFormInstagram}
                autoCapitalize="none"
                keyboardType="url"
              />
            </View>
          </View>

          <TouchableOpacity
            onPress={handleAdd}
            disabled={addLoading}
            style={{
              backgroundColor: T.orange, borderRadius: 14, paddingVertical: 14,
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
              marginTop: 20, opacity: addLoading ? 0.6 : 1,
            }}
          >
            {addLoading
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="bookmark" size={18} color="#fff" />
            }
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Save Spot</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}
