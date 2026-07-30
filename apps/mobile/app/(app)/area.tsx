import { Ionicons } from '@/components/Icon';
import { openNativeNavigation } from '@/lib/open-native-maps';
import { directionsService } from '@/services/directions.service';
import * as Location from 'expo-location';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as WebBrowser from 'expo-web-browser';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
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

const BAND_META: Record<string, { label: string; color: string; bg: string; num: number }> = {
  band5:     { label: 'Safe',         color: '#3FA34D', bg: '#F0FDF4', num: 5 },
  band4:     { label: 'Low Risk',     color: '#A4C957', bg: '#F7FBE8', num: 4 },
  band3:     { label: 'Stay Aware',   color: '#FFC857', bg: '#FFFBEB', num: 3 },
  band2:     { label: 'Elevated',     color: '#F46036', bg: '#FFF1ED', num: 2 },
  band1:     { label: 'High Caution', color: '#D7263D', bg: '#FEF2F2', num: 1 },
  low_count: { label: 'Low Data',     color: '#9ED2B2', bg: '#F0FDF9', num: 0 },
  green:     { label: 'Safe',         color: '#3FA34D', bg: '#F0FDF4', num: 5 },
  amber:     { label: 'Stay Aware',   color: '#FFC857', bg: '#FFFBEB', num: 3 },
  red:       { label: 'High Caution', color: '#D7263D', bg: '#FEF2F2', num: 1 },
  purple:    { label: 'High Caution', color: '#D7263D', bg: '#FEF2F2', num: 1 },
};

const BAND_STRIP = ['#D7263D', '#F46036', '#FFC857', '#A4C957', '#3FA34D'];
const GYG_PARTNER_ID = 'WXZGXR9';
const DOT_COLORS = ['#D7263D', '#F46036', '#FFC857', '#A4C957', '#3FA34D', '#2196F3', '#9C27B0', '#795548'];

const TRAVEL_TIPS: Record<string, string[]> = {
  london: [
    'Avoid leaving valuables visible in parked cars in Zone 1.',
    'The Tube is generally safe; stay aware of pickpockets at busy stations.',
    'Stick to well-lit routes around Westminster and Southwark after dark.',
    'Night buses are a safe alternative when the Tube closes.',
  ],
  manchester: [
    'Northern Quarter is lively at night — stay in groups.',
    'Avoid Piccadilly Gardens late at night.',
    'The Metrolink is well-monitored and safe after dark.',
  ],
  birmingham: [
    'The Bullring and Brindleyplace areas are well-policed.',
    'Use licensed black cabs or apps like Uber when travelling after midnight.',
  ],
  edinburgh: [
    'The Royal Mile is tourist-heavy — watch for pickpockets.',
    'Meadows area is safe for daytime walking.',
    'Avoid Leith Walk late on weekends.',
  ],
};

const DEFAULT_TIPS = [
  'Keep bags zipped and in front of you in crowded areas.',
  'Note the nearest A&E — NHS 111 is available 24/7.',
  'Share your location with a trusted contact when exploring new areas.',
  'Stick to well-lit, populated streets after dark.',
];

function getTips(cityName: string): string[] {
  const key = cityName.toLowerCase().trim();
  return TRAVEL_TIPS[key] ?? DEFAULT_TIPS;
}

function formatCrimeType(raw: string): string {
  return raw.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

interface GeocodeResult {
  id: string;
  name: string;
  fullName: string;
  lat: number;
  lng: number;
}

interface AreaSummary {
  lat: number;
  lng: number;
  radiusMetres: number;
  cityName: string;
  score: number | null;
  rawPoliceScore: number | null;
  band: string | null;
  incidentCount: number;
  weightedPerKm2: number;
  crimeBreakdown: Array<{ type: string; count: number }>;
  dataMonth: string;
  scoreMethodology: string;
}

function bg(dark: boolean) { return dark ? '#0f1117' : T.creamLight; }
function cardBg(dark: boolean) { return dark ? '#1a1d27' : '#ffffff'; }
function borderColor(dark: boolean) { return dark ? '#2a2f45' : T.line; }
function textPrimary(dark: boolean) { return dark ? '#f1f5f9' : T.charcoal; }
function textMuted(dark: boolean) { return dark ? '#64748b' : T.mute; }

export default function AreaScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const dark = useColorScheme() === 'dark';

  useEffect(() => {
    navigation.setOptions({ tabBarStyle: { display: 'none' } });
    return () => navigation.setOptions({ tabBarStyle: undefined });
  }, [navigation]);
  const params = useLocalSearchParams<{
    initialLat?: string;
    initialLng?: string;
    initialName?: string;
    initialFullName?: string;
  }>();

  const seedArea = params.initialLat && params.initialLng ? {
    id: 'seed',
    name: params.initialName ?? '',
    fullName: params.initialFullName ?? params.initialName ?? '',
    lat: Number(params.initialLat),
    lng: Number(params.initialLng),
  } : null;

  const [query, setQuery] = useState(seedArea?.name ?? '');
  const [suggestions, setSuggestions] = useState<GeocodeResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [summary, setSummary] = useState<AreaSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [selectedArea, setSelectedArea] = useState<GeocodeResult | null>(seedArea);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [routeCheckLoading, setRouteCheckLoading] = useState(false);
  const [guideHtml, setGuideHtml] = useState<string | null>(null);
  const [guideAvailable, setGuideAvailable] = useState<boolean | null>(null); // null = not checked yet
  const [guideLoading, setGuideLoading] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seededRef = useRef<string | null>(null);
  const userTypingRef = useRef(false);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      try {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setCurrentLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        if (!seedArea) loadSummary(pos.coords.latitude, pos.coords.longitude);
      } catch { /* ignore */ }
    })();
  }, []);

  const loadSummary = useCallback(async (lat: number, lng: number, city = '') => {
    setSummaryLoading(true);
    try {
      const result = await directionsService.getAreaSummary({ lat, lng, radius: 5000, city });
      setSummary(result);
    } catch {
      setSummary(null);
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  const loadGuide = useCallback(async (city: string) => {
    setGuideAvailable(null);
    setGuideHtml(null);
    setGuideLoading(true);
    try {
      const result = await directionsService.renderTravelGuide(city);
      setGuideAvailable(result.available);
      setGuideHtml(result.html);
    } catch {
      setGuideAvailable(false);
      setGuideHtml(null);
    } finally {
      setGuideLoading(false);
    }
  }, []);

  // Re-seed when params change (handles cached screen receiving new nav params)
  useEffect(() => {
    if (!seedArea) return;
    const key = `${params.initialLat},${params.initialLng}`;
    if (seededRef.current === key) return;
    seededRef.current = key;
    userTypingRef.current = false;
    setQuery(seedArea.name);
    setSelectedArea(seedArea);
    setSummary(null);
    loadSummary(seedArea.lat, seedArea.lng, seedArea.name);
    loadGuide(seedArea.name);
  }, [params.initialLat, params.initialLng, loadSummary, loadGuide]);

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!query.trim() || query.length < 2) { setSuggestions([]); return; }
    if (!userTypingRef.current) return;
    searchTimeout.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const results = await directionsService.geocode(query.trim(), currentLocation ?? undefined);
        setSuggestions(results.slice(0, 5));
      } catch {
        setSuggestions([]);
      } finally {
        setSearchLoading(false);
      }
    }, 400);
  }, [query, currentLocation]);

  async function selectArea(area: GeocodeResult) {
    userTypingRef.current = false;
    setSelectedArea(area);
    setSuggestions([]);
    setQuery(area.name);
    await loadSummary(area.lat, area.lng, area.name);
    loadGuide(area.name);
  }

  async function openRouteWithSafetyCheck() {
    if (!selectedArea || !currentLocation) {
      if (selectedArea) openNativeNavigation({ lat: selectedArea.lat, lng: selectedArea.lng }, currentLocation);
      return;
    }
    setRouteCheckLoading(true);
    try {
      const result = await directionsService.routeSafetyCheck(currentLocation, {
        lat: selectedArea.lat,
        lng: selectedArea.lng,
      });
      if (result.flaggedSegments.length > 0) {
        const bands = [...new Set(result.flaggedSegments.map((s) => s.band))];
        const bandLabel = bands.some((b) => b === 'band1' || b === 'purple') ? 'High Caution' : 'Elevated';
        Alert.alert(
          `${bandLabel} Area on Route`,
          `This route passes through ${result.flaggedSegments.length} flagged zone${result.flaggedSegments.length > 1 ? 's' : ''}.`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Open Anyway',
              style: 'destructive',
              onPress: () => openNativeNavigation({ lat: selectedArea.lat, lng: selectedArea.lng }, currentLocation),
            },
          ],
        );
      } else {
        openNativeNavigation({ lat: selectedArea.lat, lng: selectedArea.lng }, currentLocation);
      }
    } catch {
      openNativeNavigation({ lat: selectedArea.lat, lng: selectedArea.lng }, currentLocation);
    } finally {
      setRouteCheckLoading(false);
    }
  }

  function openGYG() {
    const city = summary?.cityName || selectedArea?.name || '';
    const url = `https://www.getyourguide.com/s/?q=${encodeURIComponent(city)}&partner_id=${GYG_PARTNER_ID}`;
    WebBrowser.openBrowserAsync(url);
  }

  function openBooking() {
    const city = summary?.cityName || selectedArea?.name || '';
    Linking.openURL(`https://www.booking.com/searchresults.html?ss=${encodeURIComponent(city)}`);
  }

  async function downloadTravelGuide() {
    const html = guideHtml;
    if (!html) return;
    const city = summary?.cityName || selectedArea?.name || 'this area';
    try {
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Travel Guide — ${city}`,
          UTI: 'com.adobe.pdf',
        });
      } else {
        await Print.printAsync({ html });
      }
    } catch (err: any) {
      Alert.alert('Export failed', err?.message ?? 'Could not generate PDF.');
    }
  }

  const band = summary?.band ? (BAND_META[summary.band] ?? BAND_META.band3) : null;
  const score = summary?.score != null ? Math.round(summary.score) : null;
  const tips = getTips(summary?.cityName ?? selectedArea?.name ?? '');

  return (
    <View style={{ flex: 1, backgroundColor: bg(dark) }}>
      {/* ── Header ── */}
      <View style={{
        backgroundColor: cardBg(dark),
        borderBottomWidth: 1, borderBottomColor: borderColor(dark),
        paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16, gap: 12,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="chevron-back" size={24} color={T.orange} />
          </TouchableOpacity>
          <Text style={{ fontSize: 18, fontWeight: '700', color: textPrimary(dark), flex: 1 }}>Area Safety</Text>
          {guideAvailable && (
            <TouchableOpacity onPress={downloadTravelGuide} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="share-outline" size={22} color={T.orange} />
            </TouchableOpacity>
          )}
        </View>

        {/* Search */}
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 10,
          backgroundColor: bg(dark), borderRadius: 14, borderWidth: 1, borderColor: borderColor(dark),
          paddingHorizontal: 14, paddingVertical: 10,
        }}>
          <Ionicons name="search" size={16} color={textMuted(dark)} />
          <TextInput
            style={{ flex: 1, fontSize: 15, color: textPrimary(dark) }}
            placeholder="Search city or area…"
            placeholderTextColor={textMuted(dark)}
            value={query}
            onChangeText={(t) => { userTypingRef.current = true; setQuery(t); }}
            returnKeyType="search"
          />
          {searchLoading && <ActivityIndicator size="small" color={T.orange} />}
          {query.length > 0 && !searchLoading && (
            <TouchableOpacity onPress={() => { userTypingRef.current = false; setQuery(''); setSuggestions([]); }}>
              <Ionicons name="close-circle" size={16} color={textMuted(dark)} />
            </TouchableOpacity>
          )}
        </View>

        {/* Autocomplete */}
        {suggestions.length > 0 && (
          <View style={{
            backgroundColor: cardBg(dark), borderRadius: 12,
            borderWidth: 1, borderColor: borderColor(dark),
            shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 8,
          }}>
            {suggestions.map((s, i) => (
              <TouchableOpacity
                key={s.id}
                onPress={() => selectArea(s)}
                style={{
                  padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10,
                  borderBottomWidth: i < suggestions.length - 1 ? 1 : 0,
                  borderBottomColor: borderColor(dark),
                }}
              >
                <Ionicons name="location-outline" size={16} color={T.orange} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: textPrimary(dark) }}>{s.name}</Text>
                  <Text style={{ fontSize: 12, color: textMuted(dark), marginTop: 1 }} numberOfLines={1}>{s.fullName}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* ── Content ── */}
      {summaryLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <ActivityIndicator size="large" color={T.orange} />
          <Text style={{ color: textMuted(dark), fontSize: 14 }}>Loading safety data…</Text>
        </View>
      ) : summary ? (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 48, gap: 16 }}
          showsVerticalScrollIndicator={false}
        >
          {/* 1 — Safety Score Card */}
          <View style={{
            backgroundColor: cardBg(dark), borderRadius: 20,
            borderWidth: 1, borderColor: borderColor(dark), padding: 20, gap: 16,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <View style={{
                width: 80, height: 80, borderRadius: 40,
                backgroundColor: band?.bg ?? '#F2F4E5',
                borderWidth: 3, borderColor: band?.color ?? '#888',
                alignItems: 'center', justifyContent: 'center',
              }}>
                {score != null
                  ? <Text style={{ fontSize: 26, fontWeight: '900', color: band?.color ?? '#888' }}>{score}</Text>
                  : <Ionicons name="help" size={28} color={band?.color ?? '#888'} />
                }
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 22, fontWeight: '900', color: textPrimary(dark) }}>
                  {band?.label ?? 'No Data'}
                </Text>
                <Text style={{ fontSize: 13, color: textMuted(dark), marginTop: 2 }}>
                  {summary.cityName || selectedArea?.fullName || 'Current Area'}
                </Text>
                {band && band.num > 0 && (
                  <Text style={{ fontSize: 12, color: band.color, fontWeight: '700', marginTop: 2 }}>
                    Band {band.num} of 5
                  </Text>
                )}
              </View>
            </View>

            {/* Band progress strip */}
            <View>
              <View style={{ flexDirection: 'row', gap: 3, borderRadius: 8, overflow: 'hidden', height: 10, marginBottom: 6 }}>
                {BAND_STRIP.map((c, i) => (
                  <View
                    key={i}
                    style={{
                      flex: 1, backgroundColor: c,
                      opacity: (band && band.num > 0 && i + 1 === band.num) ? 1 : 0.22,
                    }}
                  />
                ))}
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 10, color: textMuted(dark) }}>High Caution</Text>
                <Text style={{ fontSize: 10, color: textMuted(dark) }}>Safe</Text>
              </View>
            </View>

            <Text style={{ fontSize: 11, color: textMuted(dark), lineHeight: 16 }}>
              {summary.scoreMethodology}
            </Text>
            <Text style={{ fontSize: 11, color: textMuted(dark) }}>
              Data period: {summary.dataMonth} · Radius: {(summary.radiusMetres / 1000).toFixed(1)} km
            </Text>
          </View>

          {/* 2 — Crime Stats Grid */}
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{
              flex: 1, backgroundColor: cardBg(dark), borderRadius: 16,
              borderWidth: 1, borderColor: borderColor(dark),
              padding: 16, alignItems: 'center', gap: 4,
            }}>
              <Text style={{ fontSize: 28, fontWeight: '900', color: textPrimary(dark) }}>
                {summary.incidentCount.toLocaleString()}
              </Text>
              <Text style={{ fontSize: 11, color: textMuted(dark), textAlign: 'center' }}>
                Crimes{'\n'}Recorded
              </Text>
            </View>
            <View style={{
              flex: 1, backgroundColor: cardBg(dark), borderRadius: 16,
              borderWidth: 1, borderColor: borderColor(dark),
              padding: 16, alignItems: 'center', gap: 4,
            }}>
              <Text style={{ fontSize: 28, fontWeight: '900', color: textPrimary(dark) }}>
                {summary.weightedPerKm2.toLocaleString()}
              </Text>
              <Text style={{ fontSize: 11, color: textMuted(dark), textAlign: 'center' }}>
                Weighted{'\n'}per km²
              </Text>
            </View>
          </View>

          {/* 3 — Crime Breakdown */}
          {summary.crimeBreakdown.length > 0 && (
            <View style={{
              backgroundColor: cardBg(dark), borderRadius: 20,
              borderWidth: 1, borderColor: borderColor(dark), padding: 20,
            }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: textPrimary(dark), marginBottom: 14 }}>
                Crime Breakdown
              </Text>
              <View style={{ gap: 10 }}>
                {summary.crimeBreakdown.slice(0, 8).map((item, i) => {
                  const topTotal = summary.crimeBreakdown.slice(0, 8).reduce((s, x) => s + x.count, 0);
                  const pct = topTotal > 0 ? (item.count / topTotal) * 100 : 0;
                  return (
                    <View key={item.type} style={{ gap: 4 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: DOT_COLORS[i % DOT_COLORS.length] }} />
                          <Text style={{ fontSize: 13, color: textPrimary(dark), flex: 1 }} numberOfLines={1}>
                            {formatCrimeType(item.type)}
                          </Text>
                        </View>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: textMuted(dark), marginLeft: 8 }}>
                          {item.count.toLocaleString()}
                        </Text>
                      </View>
                      <View style={{ height: 3, borderRadius: 2, backgroundColor: borderColor(dark) }}>
                        <View style={{
                          height: 3, borderRadius: 2,
                          backgroundColor: DOT_COLORS[i % DOT_COLORS.length],
                          width: `${Math.round(pct)}%`,
                        }} />
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Route CTA */}
          {selectedArea && (
            <TouchableOpacity
              onPress={openRouteWithSafetyCheck}
              disabled={routeCheckLoading}
              style={{
                backgroundColor: cardBg(dark), borderRadius: 14, paddingVertical: 14,
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                borderWidth: 1, borderColor: borderColor(dark),
                opacity: routeCheckLoading ? 0.6 : 1,
              }}
            >
              {routeCheckLoading
                ? <ActivityIndicator size="small" color={T.orange} />
                : <Ionicons name="navigate" size={16} color={T.orange} />
              }
              <Text style={{ color: textPrimary(dark), fontWeight: '600', fontSize: 14 }}>Open Route in Maps</Text>
            </TouchableOpacity>
          )}

          {/* 4 — Wiley Fox Travel Intelligence */}
          <View style={{
            backgroundColor: cardBg(dark), borderRadius: 20,
            borderWidth: 1, borderColor: borderColor(dark), padding: 20,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Ionicons name="bulb" size={18} color={T.orange} />
              <Text style={{ fontSize: 15, fontWeight: '700', color: textPrimary(dark) }}>
                Wiley Fox Travel Intelligence
              </Text>
            </View>
            <View style={{ gap: 10 }}>
              {tips.map((tip, i) => (
                <View key={i} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                  <View style={{
                    width: 20, height: 20, borderRadius: 10,
                    backgroundColor: T.orangeSoft, alignItems: 'center', justifyContent: 'center', marginTop: 1,
                  }}>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: T.orange }}>{i + 1}</Text>
                  </View>
                  <Text style={{ flex: 1, fontSize: 13, color: textPrimary(dark), lineHeight: 19 }}>{tip}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* 5 — Things To Do (GYG) */}
          <View style={{
            backgroundColor: cardBg(dark), borderRadius: 20,
            borderWidth: 1, borderColor: borderColor(dark), padding: 20, gap: 14,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="ticket" size={18} color="#7C3AED" />
              <Text style={{ fontSize: 15, fontWeight: '700', color: textPrimary(dark) }}>Things To Do</Text>
            </View>
            <Text style={{ fontSize: 13, color: textMuted(dark), lineHeight: 19 }}>
              Top-rated activities, tours, and experiences in{' '}
              <Text style={{ fontWeight: '600', color: textPrimary(dark) }}>
                {summary.cityName || selectedArea?.name || 'this area'}
              </Text>
              .
            </Text>
            <TouchableOpacity
              onPress={openGYG}
              style={{
                backgroundColor: '#7C3AED', borderRadius: 12,
                paddingVertical: 12, flexDirection: 'row',
                alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              <Ionicons name="compass" size={16} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Explore Activities</Text>
            </TouchableOpacity>
          </View>

          {/* 6 — Stay Safely (Booking.com) */}
          <View style={{
            backgroundColor: cardBg(dark), borderRadius: 20,
            borderWidth: 1, borderColor: borderColor(dark), padding: 20, gap: 14,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="bed" size={18} color="#003580" />
              <Text style={{ fontSize: 15, fontWeight: '700', color: textPrimary(dark) }}>Stay Safely</Text>
            </View>
            <Text style={{ fontSize: 13, color: textMuted(dark), lineHeight: 19 }}>
              Hotels with verified safety ratings in{' '}
              <Text style={{ fontWeight: '600', color: textPrimary(dark) }}>
                {summary.cityName || selectedArea?.name || 'this area'}
              </Text>
              .
            </Text>
            <TouchableOpacity
              onPress={openBooking}
              style={{
                backgroundColor: '#003580', borderRadius: 12,
                paddingVertical: 12, flexDirection: 'row',
                alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              <Ionicons name="search" size={16} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Find Hotels</Text>
            </TouchableOpacity>
          </View>

          {/* Download travel guide */}
          {guideLoading || guideAvailable === null ? (
            <View style={{
              borderRadius: 14, paddingVertical: 14, backgroundColor: T.orange, opacity: 0.5,
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Checking Guide…</Text>
            </View>
          ) : guideAvailable ? (
            <TouchableOpacity
              onPress={downloadTravelGuide}
              style={{
                backgroundColor: T.orange, borderRadius: 14, paddingVertical: 14,
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              <Ionicons name="download-outline" size={18} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Download Travel Guide</Text>
            </TouchableOpacity>
          ) : (
            <View style={{
              backgroundColor: borderColor(dark), borderRadius: 14, paddingVertical: 14,
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              <Ionicons name="time-outline" size={18} color={textMuted(dark)} />
              <Text style={{ color: textMuted(dark), fontWeight: '700', fontSize: 15 }}>Travel Guide Coming Soon</Text>
            </View>
          )}
        </ScrollView>
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 }}>
          <Ionicons name="map-outline" size={48} color={textMuted(dark)} />
          <Text style={{ fontSize: 16, fontWeight: '600', color: textPrimary(dark), textAlign: 'center' }}>
            Search an area to see safety data
          </Text>
          <Text style={{ fontSize: 13, color: textMuted(dark), textAlign: 'center', lineHeight: 20 }}>
            Enter a city or district name to view the safety rating and zone breakdown.
          </Text>
        </View>
      )}
    </View>
  );
}
