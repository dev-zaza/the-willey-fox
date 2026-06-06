import { Ionicons } from '@/components/Icon';
import { useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import {
  placesService,
  type Place,
  type PlaceCategory,
  type PlaceReview,
  type PlaceWithReviews,
} from '@/services/places.service';
import { extractApiErrorMessage } from '@/lib/api-error';

// ─── Constants ───────────────────────────────────────────────────────────────

const CATEGORIES: { label: string; value: PlaceCategory | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: '🏨 Hotel', value: 'hotel' },
  { label: '🍽 Restaurant', value: 'restaurant' },
  { label: '☕ Cafe', value: 'cafe' },
  { label: '🍺 Bar', value: 'bar' },
  { label: '🎭 Attraction', value: 'attraction' },
  { label: '🌳 Park', value: 'park' },
  { label: '🚉 Transport', value: 'transport_hub' },
  { label: '🛍 Shopping', value: 'shopping' },
  { label: '📍 Other', value: 'other' },
];

const CATEGORY_ICONS: Record<PlaceCategory, string> = {
  hotel: 'business',
  restaurant: 'restaurant',
  cafe: 'cafe',
  bar: 'beer',
  attraction: 'color-palette',
  park: 'leaf',
  transport_hub: 'train',
  shopping: 'bag-handle',
  other: 'location',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function StarDisplay({ rating, max = 5 }: { rating: number; max?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 1 }}>
      {Array.from({ length: max }).map((_, i) => (
        <Ionicons key={i} name="star" size={12} color={i < Math.round(rating) ? '#f97316' : '#d1d5db'} />
      ))}
    </View>
  );
}

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: 4 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <TouchableOpacity key={n} onPress={() => onChange(n)}>
          <Ionicons name="star" size={26} color={n <= value ? '#f97316' : '#d1d5db'} />
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── Place Detail Sheet ───────────────────────────────────────────────────────

function PlaceDetailSheet({
  place: initialPlace,
  onClose,
  onReviewSubmitted,
}: {
  place: Place;
  onClose: () => void;
  onReviewSubmitted: (updatedPlace: Place) => void;
}) {
  const dark = useColorScheme() === 'dark';
  const [detail, setDetail] = useState<PlaceWithReviews | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(true);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);

  // Review form state
  const [overallRating, setOverallRating] = useState(5);
  const [safetyRating, setSafetyRating] = useState(0);
  const [cleanlinessRating, setCleanlinessRating] = useState(0);
  const [valueRating, setValueRating] = useState(0);
  const [serviceRating, setServiceRating] = useState(0);
  const [comment, setComment] = useState('');

  const load = useCallback(async () => {
    setLoadingDetail(true);
    try {
      const d = await placesService.get(initialPlace.id);
      setDetail(d);
    } catch {
      Alert.alert('Error', 'Could not load place details.');
    } finally {
      setLoadingDetail(false);
    }
  }, [initialPlace.id]);

  useState(() => {
    load();
  });

  async function submitReview() {
    setSubmittingReview(true);
    try {
      await placesService.createReview(initialPlace.id, {
        overallRating,
        safetyRating: safetyRating || undefined,
        cleanlinessRating: cleanlinessRating || undefined,
        valueRating: valueRating || undefined,
        serviceRating: serviceRating || undefined,
        comment: comment.trim() || undefined,
      });
      setShowReviewForm(false);
      setComment('');
      setSafetyRating(0);
      setCleanlinessRating(0);
      setValueRating(0);
      setServiceRating(0);
      setOverallRating(5);
      await load();
      onReviewSubmitted({
        ...initialPlace,
        reviewCount: initialPlace.reviewCount + 1,
      });
    } catch (e: any) {
      Alert.alert('Error', extractApiErrorMessage(e, 'Failed to submit review'));
    } finally {
      setSubmittingReview(false);
    }
  }

  async function flagReview(review: PlaceReview) {
    Alert.prompt(
      'Flag Review',
      'Please describe why this review is inappropriate:',
      async (reason) => {
        if (!reason?.trim()) return;
        try {
          await placesService.flagReview(initialPlace.id, review.id, reason.trim());
          Alert.alert('Flagged', 'Thank you. This review has been flagged for moderation.');
        } catch (e: any) {
          Alert.alert('Error', extractApiErrorMessage(e, 'Failed to flag review'));
        }
      },
      'plain-text',
    );
  }

  const bg = dark ? '#1a1d27' : '#f9fafb';
  const cardBg = dark ? '#1e2235' : '#ffffff';
  const border = dark ? '#2a2f45' : '#e5e7eb';
  const textPrimary = dark ? '#ffffff' : '#111827';
  const textSecondary = dark ? '#94a3b8' : '#6b7280';

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      {/* Header */}
      <View style={{
        backgroundColor: cardBg, borderBottomWidth: 1, borderBottomColor: border,
        paddingHorizontal: 24, paddingTop: 56, paddingBottom: 16,
        flexDirection: 'row', alignItems: 'center', gap: 12,
      }}>
        <TouchableOpacity onPress={onClose}>
          <Text style={{ color: '#f97316', fontWeight: '600', fontSize: 14 }}>← Back</Text>
        </TouchableOpacity>
        <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 18, flex: 1 }} numberOfLines={1}>
          {initialPlace.name}
        </Text>
      </View>

      {loadingDetail ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#f97316" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
          {/* Place info */}
          <View style={{ backgroundColor: cardBg, borderWidth: 1, borderColor: border, borderRadius: 16, padding: 16, gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name={CATEGORY_ICONS[detail?.category ?? initialPlace.category] as any} size={28} color={textSecondary} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 16 }}>{detail?.name ?? initialPlace.name}</Text>
                <Text style={{ color: textSecondary, fontSize: 12, textTransform: 'capitalize' }}>
                  {(detail?.category ?? initialPlace.category).replace('_', ' ')}
                </Text>
              </View>
            </View>
            {(detail?.address ?? initialPlace.address) && (
              <Text style={{ color: textSecondary, fontSize: 13 }}>{detail?.address ?? initialPlace.address}</Text>
            )}
            {detail?.overallRating ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <StarDisplay rating={parseFloat(detail.overallRating)} />
                <Text style={{ color: textSecondary, fontSize: 12 }}>
                  {parseFloat(detail.overallRating).toFixed(1)} ({detail.reviewCount} review{detail.reviewCount !== 1 ? 's' : ''})
                </Text>
              </View>
            ) : (
              <Text style={{ color: textSecondary, fontSize: 12 }}>No reviews yet</Text>
            )}
          </View>

          {/* Write review button */}
          {!showReviewForm && (
            <TouchableOpacity
              style={{ backgroundColor: '#f97316', borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}
              onPress={() => setShowReviewForm(true)}
            >
              <Text style={{ color: '#fff', fontWeight: '700' }}>Write a Review</Text>
            </TouchableOpacity>
          )}

          {/* Review form */}
          {showReviewForm && (
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
              <View style={{ backgroundColor: cardBg, borderWidth: 1, borderColor: border, borderRadius: 16, padding: 16, gap: 14 }}>
                <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 15 }}>Your Review</Text>

                <View style={{ gap: 4 }}>
                  <Text style={{ color: textSecondary, fontSize: 13 }}>Overall *</Text>
                  <StarPicker value={overallRating} onChange={setOverallRating} />
                </View>
                <View style={{ gap: 4 }}>
                  <Text style={{ color: textSecondary, fontSize: 13 }}>Safety (optional)</Text>
                  <StarPicker value={safetyRating} onChange={setSafetyRating} />
                </View>
                <View style={{ gap: 4 }}>
                  <Text style={{ color: textSecondary, fontSize: 13 }}>Cleanliness (optional)</Text>
                  <StarPicker value={cleanlinessRating} onChange={setCleanlinessRating} />
                </View>
                <View style={{ gap: 4 }}>
                  <Text style={{ color: textSecondary, fontSize: 13 }}>Value (optional)</Text>
                  <StarPicker value={valueRating} onChange={setValueRating} />
                </View>
                <View style={{ gap: 4 }}>
                  <Text style={{ color: textSecondary, fontSize: 13 }}>Service (optional)</Text>
                  <StarPicker value={serviceRating} onChange={setServiceRating} />
                </View>

                <View style={{ gap: 4 }}>
                  <Text style={{ color: textSecondary, fontSize: 13 }}>Comment (optional)</Text>
                  <TextInput
                    style={{
                      backgroundColor: dark ? '#12151f' : '#f3f4f6',
                      borderWidth: 1, borderColor: border, borderRadius: 10,
                      padding: 12, color: textPrimary, fontSize: 14,
                      minHeight: 80, textAlignVertical: 'top',
                    }}
                    multiline
                    maxLength={500}
                    placeholder="Share your experience..."
                    placeholderTextColor="#9ca3af"
                    value={comment}
                    onChangeText={setComment}
                  />
                  <Text style={{ color: textSecondary, fontSize: 11, textAlign: 'right' }}>{comment.length}/500</Text>
                </View>

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity
                    style={{ flex: 1, borderWidth: 1, borderColor: border, borderRadius: 12, paddingVertical: 12, alignItems: 'center' }}
                    onPress={() => setShowReviewForm(false)}
                  >
                    <Text style={{ color: textSecondary, fontWeight: '600' }}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ flex: 2, backgroundColor: '#f97316', borderRadius: 12, paddingVertical: 12, alignItems: 'center', opacity: submittingReview ? 0.6 : 1 }}
                    onPress={submitReview}
                    disabled={submittingReview}
                  >
                    {submittingReview ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={{ color: '#fff', fontWeight: '700' }}>Submit Review</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </KeyboardAvoidingView>
          )}

          {/* Reviews list */}
          {(detail?.reviews ?? []).length > 0 && (
            <View style={{ gap: 10 }}>
              <Text style={{ color: textSecondary, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                Reviews ({detail!.reviews.length})
              </Text>
              {detail!.reviews.map((r) => (
                <View
                  key={r.id}
                  style={{ backgroundColor: cardBg, borderWidth: 1, borderColor: border, borderRadius: 14, padding: 14, gap: 6 }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <StarDisplay rating={r.overallRating} />
                    <TouchableOpacity onPress={() => flagReview(r)}>
                      <Text style={{ color: '#ef4444', fontSize: 11 }}>Flag</Text>
                    </TouchableOpacity>
                  </View>
                  {r.comment && (
                    <Text style={{ color: textPrimary, fontSize: 13, lineHeight: 18 }}>{r.comment}</Text>
                  )}
                  <Text style={{ color: textSecondary, fontSize: 11 }}>
                    {new Date(r.createdAt).toLocaleDateString()}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {!loadingDetail && (detail?.reviews ?? []).length === 0 && !showReviewForm && (
            <Text style={{ color: textSecondary, fontSize: 13, textAlign: 'center', paddingVertical: 8 }}>
              No reviews yet. Be the first to review!
            </Text>
          )}
        </ScrollView>
      )}
    </View>
  );
}

// ─── Add Place Form ───────────────────────────────────────────────────────────

function AddPlaceForm({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (place: Place) => void;
}) {
  const dark = useColorScheme() === 'dark';
  const [name, setName] = useState('');
  const [category, setCategory] = useState<PlaceCategory>('other');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);

  const cardBg = dark ? '#1e2235' : '#ffffff';
  const border = dark ? '#2a2f45' : '#e5e7eb';
  const textPrimary = dark ? '#ffffff' : '#111827';
  const textSecondary = dark ? '#94a3b8' : '#6b7280';

  async function useCurrentLocation() {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Location permission is needed to auto-fill coordinates.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLat(pos.coords.latitude.toFixed(7));
      setLng(pos.coords.longitude.toFixed(7));
    } catch {
      Alert.alert('Error', 'Could not get current location.');
    } finally {
      setLocating(false);
    }
  }

  async function submit() {
    if (!name.trim()) {
      Alert.alert('Validation', 'Place name is required.');
      return;
    }
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    if (isNaN(latNum) || isNaN(lngNum)) {
      Alert.alert('Validation', 'Valid coordinates are required. Use "Use My Location" to auto-fill.');
      return;
    }
    setSaving(true);
    try {
      const place = await placesService.create({
        name: name.trim(),
        category,
        lat: latNum,
        lng: lngNum,
        address: address.trim() || undefined,
      });
      onCreated(place);
    } catch (e: any) {
      Alert.alert('Error', extractApiErrorMessage(e, 'Failed to create place'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: dark ? '#1a1d27' : '#f9fafb' }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={{
        backgroundColor: cardBg, borderBottomWidth: 1, borderBottomColor: border,
        paddingHorizontal: 24, paddingTop: 56, paddingBottom: 16,
        flexDirection: 'row', alignItems: 'center', gap: 12,
      }}>
        <TouchableOpacity onPress={onClose}>
          <Text style={{ color: '#f97316', fontWeight: '600', fontSize: 14 }}>← Back</Text>
        </TouchableOpacity>
        <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 18, flex: 1 }}>Add a Place</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }}>
        <View style={{ gap: 6 }}>
          <Text style={{ color: textSecondary, fontSize: 13, fontWeight: '500' }}>Name *</Text>
          <TextInput
            style={{ backgroundColor: cardBg, borderWidth: 1, borderColor: border, borderRadius: 12, padding: 12, color: textPrimary, fontSize: 14 }}
            placeholder="Place name"
            placeholderTextColor="#9ca3af"
            value={name}
            onChangeText={setName}
            maxLength={200}
          />
        </View>

        <View style={{ gap: 6 }}>
          <Text style={{ color: textSecondary, fontSize: 13, fontWeight: '500' }}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {CATEGORIES.filter((c) => c.value !== 'all').map((c) => (
                <TouchableOpacity
                  key={c.value}
                  onPress={() => setCategory(c.value as PlaceCategory)}
                  style={{
                    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
                    backgroundColor: category === c.value ? '#f97316' : cardBg,
                    borderWidth: 1, borderColor: category === c.value ? '#f97316' : border,
                  }}
                >
                  <Text style={{ color: category === c.value ? '#fff' : textSecondary, fontSize: 13 }}>{c.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        <View style={{ gap: 6 }}>
          <Text style={{ color: textSecondary, fontSize: 13, fontWeight: '500' }}>Address (optional)</Text>
          <TextInput
            style={{ backgroundColor: cardBg, borderWidth: 1, borderColor: border, borderRadius: 12, padding: 12, color: textPrimary, fontSize: 14 }}
            placeholder="Street address or area"
            placeholderTextColor="#9ca3af"
            value={address}
            onChangeText={setAddress}
            maxLength={500}
          />
        </View>

        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: textSecondary, fontSize: 13, fontWeight: '500' }}>Coordinates *</Text>
            <TouchableOpacity
              onPress={useCurrentLocation}
              disabled={locating}
              style={{ backgroundColor: '#f97316', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 }}
            >
              {locating ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>Use My Location</Text>
              )}
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput
              style={{ flex: 1, backgroundColor: cardBg, borderWidth: 1, borderColor: border, borderRadius: 12, padding: 12, color: textPrimary, fontSize: 14 }}
              placeholder="Latitude"
              placeholderTextColor="#9ca3af"
              value={lat}
              onChangeText={setLat}
              keyboardType="numeric"
            />
            <TextInput
              style={{ flex: 1, backgroundColor: cardBg, borderWidth: 1, borderColor: border, borderRadius: 12, padding: 12, color: textPrimary, fontSize: 14 }}
              placeholder="Longitude"
              placeholderTextColor="#9ca3af"
              value={lng}
              onChangeText={setLng}
              keyboardType="numeric"
            />
          </View>
        </View>

        <TouchableOpacity
          style={{ backgroundColor: '#f97316', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 8, opacity: saving ? 0.6 : 1 }}
          onPress={submit}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: '#fff', fontWeight: '700' }}>Add Place</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

type ScreenMode = 'list' | 'detail' | 'add';

export default function PlacesScreen() {
  const dark = useColorScheme() === 'dark';
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<PlaceCategory | 'all'>('all');
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [mode, setMode] = useState<ScreenMode>('list');

  const bg = dark ? '#1a1d27' : '#f9fafb';
  const cardBg = dark ? '#1e2235' : '#ffffff';
  const border = dark ? '#2a2f45' : '#e5e7eb';
  const textPrimary = dark ? '#ffffff' : '#111827';
  const textSecondary = dark ? '#94a3b8' : '#6b7280';

  const loadPlaces = useCallback(async () => {
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      let lat = 51.5074;
      let lng = -0.1278;

      if (status === 'granted') {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      }

      const delta = 0.05;
      const results = await placesService.search({
        minLat: lat - delta,
        minLng: lng - delta,
        maxLat: lat + delta,
        maxLng: lng + delta,
        category: selectedCategory !== 'all' ? selectedCategory : undefined,
      });
      setPlaces(results);
    } catch (e: any) {
      Alert.alert('Error', extractApiErrorMessage(e, 'Could not load places'));
    } finally {
      setLoading(false);
    }
  }, [selectedCategory]);

  // Load on mount
  useState(() => {
    loadPlaces();
  });

  function handleCategoryChange(cat: PlaceCategory | 'all') {
    setSelectedCategory(cat);
    // Re-fetch with new filter (via useEffect would need dep tracking — call directly)
    setLoading(true);
    Location.requestForegroundPermissionsAsync().then(({ status }) => {
      let lat = 51.5074;
      let lng = -0.1278;
      const doSearch = (la: number, lo: number) => {
        const delta = 0.05;
        placesService
          .search({
            minLat: la - delta,
            minLng: lo - delta,
            maxLat: la + delta,
            maxLng: lo + delta,
            category: cat !== 'all' ? cat : undefined,
          })
          .then(setPlaces)
          .catch(() => {})
          .finally(() => setLoading(false));
      };
      if (status === 'granted') {
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
          .then((pos) => doSearch(pos.coords.latitude, pos.coords.longitude))
          .catch(() => doSearch(lat, lng));
      } else {
        doSearch(lat, lng);
      }
    });
  }

  if (mode === 'detail' && selectedPlace) {
    return (
      <PlaceDetailSheet
        place={selectedPlace}
        onClose={() => { setMode('list'); setSelectedPlace(null); }}
        onReviewSubmitted={(updated) => {
          setPlaces((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
        }}
      />
    );
  }

  if (mode === 'add') {
    return (
      <AddPlaceForm
        onClose={() => setMode('list')}
        onCreated={(place) => {
          setPlaces((prev) => [place, ...prev]);
          setMode('list');
        }}
      />
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      {/* Header */}
      <View style={{
        backgroundColor: cardBg, borderBottomWidth: 1, borderBottomColor: border,
        paddingHorizontal: 24, paddingTop: 56, paddingBottom: 12,
        flexDirection: 'row', alignItems: 'center', gap: 12,
      }}>
        <Image source={require('../../assets/logo.png')} style={{ width: 28, height: 28, borderRadius: 7 }} resizeMode="contain" />
        <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 18, flex: 1 }}>Places</Text>
        <TouchableOpacity
          onPress={() => setMode('add')}
          style={{ backgroundColor: 'rgba(249,115,22,0.1)', borderWidth: 1, borderColor: 'rgba(249,115,22,0.3)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 }}
        >
          <Text style={{ color: '#f97316', fontWeight: '600', fontSize: 12 }}>＋ Add</Text>
        </TouchableOpacity>
      </View>

      {/* Category filter */}
      <View style={{ backgroundColor: cardBg, borderBottomWidth: 1, borderBottomColor: border, paddingVertical: 10 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
          {CATEGORIES.map((c) => (
            <TouchableOpacity
              key={c.value}
              onPress={() => handleCategoryChange(c.value as PlaceCategory | 'all')}
              style={{
                paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
                backgroundColor: selectedCategory === c.value ? '#f97316' : bg,
                borderWidth: 1, borderColor: selectedCategory === c.value ? '#f97316' : border,
              }}
            >
              <Text style={{ color: selectedCategory === c.value ? '#fff' : textSecondary, fontSize: 13, fontWeight: '500' }}>
                {c.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Refresh button */}
      <Pressable
        onPress={loadPlaces}
        style={{ paddingHorizontal: 16, paddingTop: 10, alignSelf: 'flex-end' }}
      >
        <Text style={{ color: '#f97316', fontSize: 12, fontWeight: '600' }}>⟳ Use My Location</Text>
      </Pressable>

      {/* Content */}
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#f97316" size="large" />
        </View>
      ) : (
        <FlatList
          data={places}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 30 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => { setSelectedPlace(item); setMode('detail'); }}
              style={{
                backgroundColor: cardBg, borderWidth: 1, borderColor: border,
                borderRadius: 16, padding: 14,
                flexDirection: 'row', gap: 12, alignItems: 'flex-start',
              }}
            >
              <Ionicons name={CATEGORY_ICONS[item.category] as any} size={28} color={textSecondary} style={{ marginTop: 2 }} />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ color: textPrimary, fontWeight: '600', fontSize: 15 }} numberOfLines={1}>
                  {item.name}
                </Text>
                {item.address && (
                  <Text style={{ color: textSecondary, fontSize: 12 }} numberOfLines={1}>{item.address}</Text>
                )}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {item.overallRating ? (
                    <>
                      <StarDisplay rating={parseFloat(item.overallRating)} />
                      <Text style={{ color: textSecondary, fontSize: 12 }}>
                        {parseFloat(item.overallRating).toFixed(1)} · {item.reviewCount} review{item.reviewCount !== 1 ? 's' : ''}
                      </Text>
                    </>
                  ) : (
                    <Text style={{ color: textSecondary, fontSize: 12 }}>No reviews yet</Text>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingVertical: 60, gap: 10 }}>
              <Ionicons name="map" size={40} color={textSecondary} />
              <Text style={{ color: textPrimary, fontWeight: '600', fontSize: 16 }}>No places found</Text>
              <Text style={{ color: textSecondary, fontSize: 14, textAlign: 'center' }}>
                Try a different area or tap "Use My Location".
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}
