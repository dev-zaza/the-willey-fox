import { Ionicons } from '@/components/Icon';
import { apiClient } from '@/services/api';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import {
  ScrollView,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';

const T = {
  orange:     '#FF7B14',
  orangeSoft: '#FFE9D6',
  red:        '#E94B4B',
  redSoft:    '#FDECEC',
  purple:     '#6A3FB4',
  purpleSoft: '#F0EBFC',
  green:      '#3FA34D',
  greenSoft:  '#F0FDF4',
  sage:       '#AABA9F',
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

function scoreToBand(score: number): { label: string; color: string; bg: string; description: string } {
  if (score >= 80) return { label: 'Safe',      color: T.green,  bg: T.greenSoft,  description: 'Low crime activity. Generally safe to explore.' };
  if (score >= 55) return { label: 'Moderate',  color: '#EAB308', bg: '#FEFCE8',  description: 'Some crime activity. Stay alert in busy areas.' };
  if (score >= 30) return { label: 'Caution',   color: T.red,    bg: T.redSoft,   description: 'Elevated crime risk. Extra vigilance advised.' };
  return              { label: 'High Risk', color: T.purple, bg: T.purpleSoft, description: 'High crime area. Avoid if possible, travel in groups.' };
}

function bandFromColour(colour: string): { label: string; color: string } {
  const c = colour.toLowerCase();
  if (c.includes('green') || c === '#22c55e' || c === '#4ade80') return { label: 'Safe', color: T.green };
  if (c.includes('amber') || c.includes('yellow') || c === '#eab308') return { label: 'Moderate', color: '#EAB308' };
  if (c.includes('red') || c === '#ef4444') return { label: 'Caution', color: T.red };
  if (c.includes('purple') || c === '#a855f7') return { label: 'High Risk', color: T.purple };
  return { label: 'Unknown', color: T.mute };
}

interface ZoneItem {
  id: string;
  safetyScore: number;
  source: string;
  sourceRegion: string | null;
  colour: string;
}

const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL?.replace(/\/$/, '') ?? 'https://safetag.app';

export default function AreaDetailScreen() {
  const router = useRouter();
  const dark = useColorScheme() === 'dark';
  const { areaName, fullName, avgScore: avgScoreStr, zonesJson } = useLocalSearchParams<{
    areaName?: string;
    fullName?: string;
    avgScore?: string;
    zonesJson?: string;
  }>();

  const avgScore = avgScoreStr ? parseInt(avgScoreStr, 10) : 0;
  const band = scoreToBand(avgScore);

  let zones: ZoneItem[] = [];
  try {
    zones = zonesJson ? (JSON.parse(zonesJson) as ZoneItem[]) : [];
  } catch {
    zones = [];
  }

  // Group zones by band
  const grouped: Record<string, number> = { Safe: 0, Moderate: 0, Caution: 0, 'High Risk': 0 };
  zones.forEach((z) => {
    const b = z.colour ? bandFromColour(z.colour) : scoreToBand(z.safetyScore);
    if (grouped[b.label] !== undefined) grouped[b.label]++;
  });

  const citySlug = (areaName ?? '').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

  const [ratingData, setRatingData] = useState<{ avgRating: number | null; totalRatings: number } | null>(null);
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);

  useEffect(() => {
    if (!areaName) return;
    apiClient
      .get<{ avgRating: number | null; totalRatings: number }>(
        `/safety-engine/rate?areaName=${encodeURIComponent(areaName)}`,
      )
      .then((res) => setRatingData(res.data))
      .catch(() => {});
  }, [areaName]);

  async function submitRating(star: number) {
    if (ratingSubmitted || !areaName) return;
    setSelectedRating(star);
    try {
      const res = await apiClient.post<{ avgRating: number; totalRatings: number }>(
        '/safety-engine/rate',
        { areaName, rating: star },
      );
      setRatingData(res.data);
      setRatingSubmitted(true);
    } catch {
      setSelectedRating(null);
    }
  }

  async function openTravelGuide() {
    const url = `${WEB_URL}/guides/${citySlug}`;
    await WebBrowser.openBrowserAsync(url);
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
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: textPrimary(dark) }} numberOfLines={1}>
            {areaName ?? 'Area'}
          </Text>
          {fullName ? (
            <Text style={{ fontSize: 12, color: textMuted(dark), marginTop: 1 }} numberOfLines={1}>{fullName}</Text>
          ) : null}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        {/* Rating card */}
        <View style={{
          backgroundColor: cardBg(dark), borderRadius: 20,
          borderWidth: 1, borderColor: borderColor(dark),
          padding: 20, gap: 16,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            {/* Orb */}
            <View style={{
              width: 76, height: 76, borderRadius: 38,
              backgroundColor: band.bg, borderWidth: 3, borderColor: band.color,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Text style={{ fontSize: 26, fontWeight: '900', color: band.color }}>{avgScore}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 22, fontWeight: '800', color: textPrimary(dark) }}>{band.label}</Text>
              <Text style={{ fontSize: 13, color: textMuted(dark), marginTop: 4, lineHeight: 19 }}>{band.description}</Text>
            </View>
          </View>

          {/* Gradient bar */}
          <View>
            <View style={{ flexDirection: 'row', gap: 4, borderRadius: 8, overflow: 'hidden', height: 10 }}>
              {[T.purple, T.red, '#EAB308', T.green].map((c, i) => (
                <View key={i} style={{ flex: 1, backgroundColor: c, opacity: 0.85 }} />
              ))}
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
              <Text style={{ fontSize: 10, color: textMuted(dark) }}>Highest crime</Text>
              <Text style={{ fontSize: 10, color: textMuted(dark) }}>Safest</Text>
            </View>
          </View>
        </View>

        {/* Zone breakdown */}
        {zones.length > 0 && (
          <View style={{ backgroundColor: cardBg(dark), borderRadius: 16, borderWidth: 1, borderColor: borderColor(dark), padding: 16, gap: 12 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: textPrimary(dark) }}>Zone Breakdown</Text>
            {Object.entries(grouped).filter(([, count]) => count > 0).map(([label, count]) => {
              const bandColors: Record<string, string> = { Safe: T.green, Moderate: '#EAB308', Caution: T.red, 'High Risk': T.purple };
              const pct = Math.round((count / zones.length) * 100);
              return (
                <View key={label} style={{ gap: 4 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: bandColors[label] }} />
                      <Text style={{ fontSize: 13, color: textPrimary(dark), fontWeight: '600' }}>{label}</Text>
                    </View>
                    <Text style={{ fontSize: 13, color: textMuted(dark) }}>{count} zone{count !== 1 ? 's' : ''} · {pct}%</Text>
                  </View>
                  <View style={{ height: 6, backgroundColor: dark ? '#2a2f45' : '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
                    <View style={{ height: '100%', width: `${pct}%` as any, backgroundColor: bandColors[label], borderRadius: 3 }} />
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Individual zone list */}
        {zones.length > 0 && (
          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: textMuted(dark), textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Safety Zones ({zones.length})
            </Text>
            {zones.map((z) => {
              const b = z.colour ? bandFromColour(z.colour) : scoreToBand(z.safetyScore);
              return (
                <View
                  key={z.id}
                  style={{
                    backgroundColor: cardBg(dark), borderRadius: 12, padding: 14,
                    borderWidth: 1, borderColor: borderColor(dark),
                    flexDirection: 'row', alignItems: 'center', gap: 12,
                  }}
                >
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: b.color }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: textPrimary(dark) }}>
                      {z.sourceRegion ?? z.source ?? 'Zone'}
                    </Text>
                    <Text style={{ fontSize: 12, color: b.color, fontWeight: '600', marginTop: 1 }}>{b.label}</Text>
                  </View>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: b.color }}>{Math.round(z.safetyScore)}</Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Rate this area */}
        <View style={{
          backgroundColor: cardBg(dark), borderRadius: 16,
          borderWidth: 1, borderColor: borderColor(dark),
          padding: 16, gap: 12,
        }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: textPrimary(dark) }}>Rate This Area</Text>
          {ratingData && ratingData.totalRatings > 0 && (
            <Text style={{ fontSize: 12, color: textMuted(dark) }}>
              Community avg: {'★'.repeat(Math.round(ratingData.avgRating ?? 0))}{'☆'.repeat(5 - Math.round(ratingData.avgRating ?? 0))}
              {' '}{(ratingData.avgRating ?? 0).toFixed(1)} ({ratingData.totalRatings} rating{ratingData.totalRatings !== 1 ? 's' : ''})
            </Text>
          )}
          {ratingSubmitted ? (
            <Text style={{ fontSize: 13, color: T.green, fontWeight: '600' }}>Thanks for rating!</Text>
          ) : (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity key={star} onPress={() => submitRating(star)} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
                  <Text style={{ fontSize: 28, color: (selectedRating ?? 0) >= star ? '#FBBF24' : (dark ? '#2a2f45' : '#E5E7EB') }}>
                    ★
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Travel guide */}
        <TouchableOpacity
          onPress={openTravelGuide}
          style={{
            backgroundColor: cardBg(dark), borderRadius: 14, padding: 16,
            borderWidth: 1, borderColor: borderColor(dark),
            flexDirection: 'row', alignItems: 'center', gap: 12,
          }}
        >
          <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: T.orangeSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="book" size={20} color={T.orange} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: textPrimary(dark) }}>Download Travel Guide</Text>
            <Text style={{ fontSize: 12, color: textMuted(dark), marginTop: 2 }}>
              Safe areas, tips, and local knowledge for {areaName ?? 'this area'}
            </Text>
          </View>
          <Ionicons name="open-outline" size={16} color={textMuted(dark)} />
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.back()} style={{ alignItems: 'center', padding: 12 }}>
          <Text style={{ color: textMuted(dark), fontSize: 14 }}>Back to Area Search</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
